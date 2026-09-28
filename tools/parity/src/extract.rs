//! `parity extract`: corpus → reference facts. Deterministic per corpus, so
//! every session regenerates the same reference from the vault corpus; the
//! output is gitignored, never committed (legal line).
//!
//! Inputs:
//! - `analysis/routes.json` (array of { path, file }) — absolute Loops/agent
//!   routes.
//! - `docs/feature-matrix.md` — the committed surface inventory; backticked
//!   chunk names (`Component.HASH.js`) name the surfaces to extract.
//! - `pretty/client/<Component>.<HASH>.js` — per-surface copy strings,
//!   component import edges, and theme-token usage.

use crate::model::{FactFile, RouteMeta, Surface};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs;
use std::io::Read;
use std::path::Path;

const MAX_CHUNK_BYTES: u64 = 16 * 1024 * 1024;

fn read_chunk(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| format!("read {}: {}", path.display(), e))?;
    let mut bytes = Vec::new();
    file.take(MAX_CHUNK_BYTES + 1).read_to_end(&mut bytes)
        .map_err(|e| format!("read {}: {}", path.display(), e))?;
    if bytes.len() as u64 > MAX_CHUNK_BYTES {
        return Err(format!("chunk exceeds 16 MiB limit: {}", path.display()));
    }
    String::from_utf8(bytes).map_err(|e| format!("read {}: {}", path.display(), e))
}

pub struct ExtractStats {
    pub surfaces: usize,
    pub chunks_read: usize,
    pub routes: usize,
    pub copy: usize,
    pub edges: usize,
    pub tokens: usize,
    /// surfaces that carry an order chain
    pub order: usize,
    /// state-alternate facts across surfaces (H3 #213 slice 3)
    pub states: usize,
    /// theme token VALUES from the corpus-executed golden vectors (#218):
    /// (parametrization surfaces, value facts). None when no goldens dir.
    pub theme_values: Option<(usize, usize)>,
    /// surfaces that carry a primitive fact (H3 #213 slice 1)
    pub primitives: usize,
    /// (passed, total) when a canary list was enforced.
    pub canaries: Option<(usize, usize)>,
}

pub fn run(
    corpus: &Path,
    matrix: &Path,
    out: &Path,
    canaries: Option<&Path>,
    goldens: Option<&Path>,
) -> Result<ExtractStats, String> {
    let mut facts = FactFile::default();

    // --- corpus integrity: the chunk inventory must be complete -------------
    // A stale or partial corpus copy produced a silent false-green reference
    // once already (#162 INFRA ALERT: 1,043/1,550 chunks, 21 matrix surfaces
    // missing, no warning; #205). analysis/chunks.json is the inventory the
    // pipeline wrote for this corpus; every chunk it names must be present in
    // pretty/client before an extract can be trusted.
    check_corpus_integrity(corpus)?;

    // --- routes: the app's Loops/agent route table is ONE fact surface ------
    // (routes.json's `file` is the chunk where the route literal appears —
    // usually a lazy-loader, not the page — so per-component attachment is
    // misleading; the route table belongs to the app shell).
    let routes_path = corpus.join("analysis/routes.json");
    let routes_text = fs::read_to_string(&routes_path)
        .map_err(|e| format!("read {}: {}", routes_path.display(), e))?;
    let routes_json = crate::json::parse(&routes_text)?;
    let routes_arr = routes_json
        .as_arr()
        .ok_or_else(|| format!("{}: expected a JSON array", routes_path.display()))?;
    // Per-route provenance (issue #208): declaredIn = every chunk basename
    // (or routes.json `file`) carrying the literal; role = where it sits.
    // The `Root.*` chunk is the app's route table (registration); any other
    // declaring chunk is a matcher call site ("this URL gates what this
    // surface renders" — the /:orgKey/loops/new dialog-route nuance, #177).
    let mut declared_in: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    let mut registered: BTreeSet<String> = BTreeSet::new();
    let mut matched: BTreeSet<String> = BTreeSet::new();
    for item in routes_arr {
        let Some(path) = item.get("path").and_then(|v| v.as_str()) else {
            continue;
        };
        if path.starts_with('/') && is_loops_route(path) {
            let entry = declared_in.entry(path.to_string()).or_default();
            // the index's `file` names the chunk the literal appears in;
            // the role follows from WHICH chunk that is, same as scan hits.
            if let Some(file) = item.get("file").and_then(|v| v.as_str()) {
                entry.insert(file.to_string());
                if is_route_table_chunk(file) {
                    registered.insert(path.to_string());
                } else {
                    matched.insert(path.to_string());
                }
            }
        }
    }
    // routes.json is a floor, not a ceiling (the analyzer misses route
    // literals — #157 meta finding): also scan chunk bodies for
    // `/:orgKey/…` template literals and merge.
    let client_for_routes = corpus.join("pretty/client");
    if let Ok(entries) = fs::read_dir(&client_for_routes) {
        for entry in entries {
            let entry = entry.map_err(|e| format!("read {}: {}", client_for_routes.display(), e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".js") {
                continue;
            }
            let text = read_chunk(&entry.path())?;
            let is_table = is_route_table_chunk(&name);
            for route in extract_route_literals(&text) {
                if is_loops_route(&route) {
                    declared_in.entry(route.clone()).or_default().insert(name.clone());
                    if is_table {
                        registered.insert(route);
                    } else {
                        matched.insert(route);
                    }
                }
            }
        }
    }
    let app_routes: Vec<String> = declared_in.keys().cloned().collect();
    if !app_routes.is_empty() {
        for (route, chunks) in &declared_in {
            let role = match (registered.contains(route), matched.contains(route)) {
                (true, true) => "both",
                (true, false) => "registration",
                _ => "matcher",
            };
            facts.route_meta.insert(
                route.clone(),
                RouteMeta { declared_in: chunks.iter().cloned().collect(), role: role.to_string() },
            );
        }
        facts.surfaces.insert(
            "app.routes".to_string(),
            Surface { routes: app_routes.clone(), ..Default::default() },
        );
    }

    // --- surfaces from the feature matrix ------------------------------------
    let matrix_text = fs::read_to_string(matrix)
        .map_err(|e| format!("read {}: {}", matrix.display(), e))?;
    let components = matrix_components(&matrix_text);

    let client_dir = corpus.join("pretty/client");
    let mut stats = ExtractStats { surfaces: 0, chunks_read: 0, routes: 0, copy: 0, edges: 0, tokens: 0, order: 0, states: 0, primitives: 0, canaries: None, theme_values: None };
    let mut unmatched: Vec<String> = Vec::new();

    for (comp, exact) in &components {
        let mut surface = Surface::default();
        // order chains per matched chunk (a surface can match several chunk
        // builds; the longest chain wins — see below)
        let mut primitive_conflict = false;
        let mut order_candidates: Vec<Vec<String>> = Vec::new();
        // chunk files for this surface pattern (hashes rotate; match by prefix)
        let mut matched_any = false;
        let entries = match fs::read_dir(&client_dir) {
            Ok(e) => e,
            Err(e) => return Err(format!("read {}: {}", client_dir.display(), e)),
        };
        for entry in entries {
            let entry = entry.map_err(|e| format!("read {}: {}", client_dir.display(), e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !chunk_matches(&name, comp, *exact) {
                continue;
            }
            matched_any = true;
            stats.chunks_read += 1;
            let text = read_chunk(&entry.path())?;
            surface.copy.extend(extract_copy(&text));
            surface.states.extend(extract_state_alternates(&text));
            surface.structure.extend(extract_edges(&text));
            surface.tokens.extend(extract_tokens(&text));
            order_candidates.extend(extract_order(&text));
            // primitive: keep the signal, tracking cross-chunk conflicts
            // (a surface can split across hash-rotated chunk builds).
            if let Some(p) = extract_primitive(&text) {
                match &surface.primitive {
                    Some(existing) if existing != &p => primitive_conflict = true,
                    Some(_) => {}
                    None => surface.primitive = Some(p),
                }
            }
        }
        // Conflicting signals across a surface's chunk builds = no fact
        // (audit rule: never guess). Tracked explicitly, not via a sentinel
        // value that could collide with a real extracted string (#229 review).
        if primitive_conflict {
            surface.primitive = None;
        }
        // A surface may match several chunk builds of the same component
        // (hash-rotated duplicates); their order chains are the same fact.
        // Keep the LONGEST chain (a stripped/duplicate build can carry a
        // truncated copy of the array literal; the fuller one is the fact).
        if let Some(best) = order_candidates.into_iter().max_by_key(Vec::len) {
            surface.order = best;
        }
        surface.normalize();
        if !matched_any {
            // A matrix surface with zero matching chunks is the other silent
            // false-green path (#205): the reference simply omits it and every
            // check against it passes vacuously. Loud failure: either the
            // corpus copy is partial (re-clone the vault) or the matrix names
            // a component the corpus no longer ships (fix the matrix row).
            unmatched.push(comp.clone());
            continue;
        }
        stats.copy += surface.copy.len();
        stats.edges += surface.structure.len();
        stats.tokens += surface.tokens.len();
        stats.order += usize::from(!surface.order.is_empty());
        stats.states += surface.states.len();
        stats.primitives += usize::from(surface.primitive.is_some());
        facts.surfaces.insert(comp.clone(), surface);
        stats.surfaces += 1;
    }
    if !unmatched.is_empty() {
        return Err(format!(
            "matrix surfaces with zero matching chunks in {} (partial corpus? re-clone the vault — #187; or a stale matrix row):\n  {}",
            client_dir.display(),
            unmatched.join("\n  ")
        ));
    }

    // --- theme: the semantic token namespace is one synthetic surface -------
    // (values are the documented served-CSS seam; names come from the
    // ThemeProvider chunks' `name: \`var(--sx-…)\`` definitions).
    let mut theme = Surface::default();
    for entry in fs::read_dir(&client_dir).map_err(|e| format!("read {}: {}", client_dir.display(), e))? {
        let entry = entry.map_err(|e| format!("read {}: {}", client_dir.display(), e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !chunk_matches(&name, "ThemeProvider", true) {
            continue;
        }
        stats.chunks_read += 1;
        let text = fs::read_to_string(entry.path())
            .map_err(|e| format!("read {}: {}", entry.path().display(), e))?;
        theme.tokens.extend(extract_tokens(&text));
    }
    theme.normalize();
    if !theme.tokens.is_empty() {
        stats.tokens += theme.tokens.len();
        facts.surfaces.insert("theme.tokens".to_string(), theme);
        stats.surfaces += 1;
    }
    if let Some(r) = facts.surfaces.get("app.routes") {
        stats.routes += r.routes.len();
        stats.surfaces += 1;
    }

    // --- theme VALUES from the corpus-executed golden vectors (#218) --------
    // src/ui-theme/golden/*.json hold token values EXECUTED from the corpus
    // generator (H2 #168, byte-verified by src/ui-theme tests). Each
    // parametrization becomes one synthetic surface `theme.values.<name>`
    // whose tokens family carries exact `token=value` facts — riding the
    // existing set compare, improvements channel, and report. Absent goldens
    // dir = no value surfaces (uncovered by the ramp rule, and the stats line
    // says so); a malformed goldens file is a loud error, never a skip.
    if let Some(goldens_dir) = goldens {
        let mut value_surfaces = 0usize;
        let mut value_facts = 0usize;
        let entries = fs::read_dir(goldens_dir)
            .map_err(|e| format!("read goldens {}: {}", goldens_dir.display(), e))?;
        let mut files: Vec<std::path::PathBuf> = Vec::new();
        for entry in entries {
            let entry = entry.map_err(|e| format!("read goldens {}: {}", goldens_dir.display(), e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.ends_with(".json") && name.starts_with("golden-derived-") {
                files.push(entry.path());
            }
        }
        files.sort();
        for path in &files {
            // retina suffix: golden-derived-retina0.json → "retina0"
            let fname = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
            let retina = fname.trim_start_matches("golden-derived-").to_string();
            let text = fs::read_to_string(path).map_err(|e| format!("read {}: {}", path.display(), e))?;
            let json = crate::json::parse(&text).map_err(|e| format!("{}: {}", path.display(), e))?;
            let obj = match &json {
                crate::json::Value::Obj(pairs) => pairs,
                _ => return Err(format!("{}: expected an object of parametrizations", path.display())),
            };
            for (param, theme) in obj {
                let colors = theme.get("color");
                let Some(crate::json::Value::Obj(colors)) = colors else {
                    return Err(format!("{}: parametrization {:?} has no color map", path.display(), param));
                };
                let mut surface = Surface::default();
                for (token, value) in colors {
                    let Some(v) = value.as_str() else {
                        return Err(format!("{}: {}.color.{} is not a string", path.display(), param, token));
                    };
                    surface.tokens.push(format!("{}={}", token, v));
                }
                // shell values (scalars: shadows, input metrics, hash) are the
                // same exactness bar — string/number/bool scalars only
                for (key, value) in match theme { crate::json::Value::Obj(p) => p.iter(), _ => unreachable!() } {
                    let fact = match value {
                        crate::json::Value::Str(v) => Some(v.clone()),
                        crate::json::Value::Num(n) => Some(crate::json::to_string(&crate::json::Value::Num(*n)).trim().to_string()),
                        crate::json::Value::Bool(b) => Some(b.to_string()),
                        _ => None,
                    };
                    if let Some(v) = fact {
                        surface.tokens.push(format!("{}={}", key, v));
                    }
                }
                surface.normalize();
                value_facts += surface.tokens.len();
                facts.surfaces.insert(format!("theme.values.{}.{}", param, retina), surface);
                value_surfaces += 1;
                stats.surfaces += 1;
            }
        }
        stats.theme_values = Some((value_surfaces, value_facts));
    }

    // --- canaries: prove the copy grammar on every extraction --------------
    // A canary absent from the CORPUS = drift alarm (refresh canaries or
    // corpus); present in corpus but absent from the EXTRACTED reference =
    // copy-grammar regression. Both are loud failures (#162 consult).
    if let Some(canary_path) = canaries {
        let list_text = fs::read_to_string(canary_path)
            .map_err(|e| format!("read canaries {}: {}", canary_path.display(), e))?;
        // Four canary kinds: plain lines are COPY canaries; `route:` lines
        // are ROUTE canaries checked against app.routes (#177); `order:` lines
        // (H3 #207) are ORDER canaries — `order:<Surface>=<a> > <b> > …` —
        // checked against the surface's extracted whole-sequence chain, so an
        // order-grammar regression fails as loudly as a copy one.
        let mut order_canaries: Vec<(String, String)> = Vec::new(); // (surface, chain)
        let mut states_canaries: Vec<(String, String)> = Vec::new(); // (surface, alt fact)
        let mut value_canaries: Vec<(String, String)> = Vec::new(); // (surface, token=value fact)
        // A malformed `order:`/`states:` line (no `=`) silently dropping
        // would let extraction pass while the intended canary never ran
        // (CodeRabbit #217): configuration errors are loud.
        let mut bad_lines: Vec<String> = Vec::new();
        let canary_list: Vec<(bool, String)> = list_text
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .filter_map(|l| {
                if let Some(o) = l.strip_prefix("order:") {
                    match o.split_once('=') {
                        Some((surface, chain)) => {
                            order_canaries.push((surface.trim().to_string(), chain.trim().to_string()))
                        }
                        None => bad_lines.push(l.to_string()),
                    }
                    return None;
                }
                // `states:<Surface>=alt:<armA>|<armB>` (H3 #213 slice 3):
                // pins the state-alternate grammar the same way order: pins
                // the chain grammar — checked against the surface's extracted
                // states facts, loud on regression or drift.
                if let Some(st) = l.strip_prefix("states:") {
                    match st.split_once('=') {
                        Some((surface, fact)) => {
                            states_canaries.push((surface.trim().to_string(), fact.trim().to_string()))
                        }
                        None => bad_lines.push(l.to_string()),
                    }
                    return None;
                }
                // `value:<theme.values.surface>=<token>=<value>` (#218): pins
                // one golden token value per extraction, so a goldens-wiring
                // regression (or theme drift on a corpus refresh) fails red.
                if let Some(v) = l.strip_prefix("value:") {
                    match v.split_once('=') {
                        Some((surface, fact)) if fact.contains('=') => {
                            value_canaries.push((surface.trim().to_string(), fact.trim().to_string()))
                        }
                        _ => bad_lines.push(l.to_string()),
                    }
                    return None;
                }
                Some(match l.strip_prefix("route:") {
                    Some(r) => (true, r.trim().to_string()),
                    None => (false, l.to_string()),
                })
            })
            .collect();
        if !bad_lines.is_empty() {
            return Err(format!(
                "canary config: malformed line(s) (expected `order:<Surface>=<chain>` / `states:<Surface>=<fact>` / `value:<Surface>=<token>=<value>`):\n  {}",
                bad_lines.join("\n  ")
            ));
        }
        let mut order_problems: Vec<String> = Vec::new();
        let mut order_passed = 0;
        for (surface, fact) in &states_canaries {
            let hit = facts
                .surfaces
                .get(surface)
                .is_some_and(|s| s.states.iter().any(|f| f == fact));
            if hit {
                order_passed += 1;
            } else {
                order_problems.push(format!(
                    "states canary: surface {:?} did not extract {:?} (states-grammar regression or corpus drift)",
                    surface, fact
                ));
            }
        }
        for (surface, fact) in &value_canaries {
            let hit = facts
                .surfaces
                .get(surface)
                .is_some_and(|s| s.tokens.iter().any(|f| f == fact));
            if hit {
                order_passed += 1;
            } else if stats.theme_values.is_none() {
                order_problems.push(format!(
                    "value canary: {:?} configured but no goldens were loaded (pass --goldens or ship src/ui-theme/golden)",
                    surface
                ));
            } else {
                order_problems.push(format!(
                    "value canary: surface {:?} did not carry {:?} (goldens-wiring regression or theme drift on corpus refresh)",
                    surface, fact
                ));
            }
        }
        for (surface, chain) in &order_canaries {
            let extracted = facts
                .surfaces
                .get(surface)
                .map(|s| s.order.join(" > "))
                .unwrap_or_default();
            if extracted == *chain {
                order_passed += 1;
            } else if extracted.is_empty() {
                order_problems.push(format!(
                    "order canary: surface {:?} extracted NO chain (order-grammar regression or corpus drift); expected [{}]",
                    surface, chain
                ));
            } else {
                order_problems.push(format!(
                    "order canary: surface {:?} chain differs — expected [{}], extracted [{}] (grammar regression or corpus drift)",
                    surface, chain, extracted
                ));
            }
        }
        if !canary_list.is_empty() || !order_canaries.is_empty() || !states_canaries.is_empty() || !value_canaries.is_empty() {
            // one pass over every chunk, all canaries at once
            let mut in_corpus: Vec<bool> = vec![false; canary_list.len()];
            // a registration route may live only in analysis/routes.json
            // (the analyzer's index), not as a chunk literal: count that as
            // corpus presence for route canaries.
            for (i, (is_route, c)) in canary_list.iter().enumerate() {
                if *is_route && routes_text.contains(&format!("\"{}\"", c)) {
                    in_corpus[i] = true;
                }
            }
            for entry in fs::read_dir(&client_dir).map_err(|e| format!("read {}: {}", client_dir.display(), e))? {
                let entry = entry.map_err(|e| format!("read {}: {}", client_dir.display(), e))?;
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.ends_with(".js") {
                    continue;
                }
                let Ok(text) = fs::read_to_string(entry.path()) else { continue };
                for (i, (is_route, c)) in canary_list.iter().enumerate() {
                    if in_corpus[i] {
                        continue;
                    }
                    // a route literal sits in a backtick template string
                    let hit = if *is_route {
                        text.contains(&format!("`{}`", c)) || text.contains(&format!("`{}", c))
                    } else {
                        text.contains(c.as_str())
                    };
                    if hit {
                        in_corpus[i] = true;
                    }
                }
            }
            let extracted_copy: std::collections::BTreeSet<&str> = facts
                .surfaces
                .values()
                .flat_map(|s| s.copy.iter().map(String::as_str))
                .collect();
            let extracted_routes: std::collections::BTreeSet<&str> = facts
                .surfaces
                .values()
                .flat_map(|s| s.routes.iter().map(String::as_str))
                .collect();
            let mut problems: Vec<String> = Vec::new();
            let mut passed = 0;
            for (i, (is_route, c)) in canary_list.iter().enumerate() {
                let extracted = if *is_route { &extracted_routes } else { &extracted_copy };
                let kind = if *is_route { "route" } else { "copy" };
                if !in_corpus[i] {
                    problems.push(format!("{} canary absent from corpus (drift — refresh the canary list or the corpus): {:?}", kind, c));
                } else if !extracted.contains(c.as_str()) {
                    problems.push(format!("{} canary in corpus but NOT extracted ({}-extraction regression): {:?}", kind, kind, c));
                } else {
                    passed += 1;
                }
            }
            problems.extend(order_problems);
            passed += order_passed;
            stats.canaries = Some((passed, canary_list.len() + order_canaries.len() + states_canaries.len() + value_canaries.len()));
            if !problems.is_empty() {
                return Err(format!("canary check failed:\n  {}", problems.join("\n  ")));
            }
        }
    }

    let parent = out.parent().ok_or("out path has no parent dir")?;
    fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {}", parent.display(), e))?;
    fs::write(out, crate::json::to_string(&crate::model::to_value(&facts)))
        .map_err(|e| format!("write {}: {}", out.display(), e))?;
    Ok(stats)
}

/// The app-shell route-table chunk: `Root.<hash>.js` holds the client's route
/// REGISTRATIONS (verified on 1.32.4: `Root.DfW4FHnP.js` declares 39 of the
/// 43 Loops/agent routes). Every other declaring chunk is a matcher call site.
fn is_route_table_chunk(filename: &str) -> bool {
    chunk_matches(filename, "Root", true)
}

/// Corpus integrity: every chunk named by `analysis/chunks.json` (the
/// inventory the pipeline wrote for THIS corpus) must exist in
/// `pretty/client/`. A shortfall means a partial or stale corpus copy — the
/// exact condition that produced a silent false-green reference on
/// 2026-09-27 (#162 INFRA ALERT, #205). The fix is a full re-clone of the
/// vault (#187), never trusting a sparse/API-based fetch.
/// A missing chunks.json is tolerated (fixture mini-corpora don't carry one);
/// a present-but-unreadable one is an error.
fn check_corpus_integrity(corpus: &Path) -> Result<(), String> {
    let inventory_path = corpus.join("analysis/chunks.json");
    if !inventory_path.exists() {
        return Ok(());
    }
    let text = fs::read_to_string(&inventory_path)
        .map_err(|e| format!("read {}: {}", inventory_path.display(), e))?;
    let json = crate::json::parse(&text)?;
    let arr = json
        .as_arr()
        .ok_or_else(|| format!("{}: expected a JSON array", inventory_path.display()))?;
    let client_dir = corpus.join("pretty/client");
    let mut missing: Vec<String> = Vec::new();
    let mut total = 0usize;
    for item in arr {
        // The pipeline writes a string `file` for every chunk record: a
        // malformed entry is a broken inventory, not a skippable row — if the
        // matrix does not name the affected chunk, skipping would let
        // extraction write an incomplete reference (CodeRabbit #210).
        let Some(file) = item.get("file").and_then(|v| v.as_str()) else {
            return Err(format!(
                "{}: malformed inventory entry (missing string `file`): {}",
                inventory_path.display(),
                crate::json::to_string(item).trim_end()
            ));
        };
        total += 1;
        if !client_dir.join(file).is_file() {
            missing.push(file.to_string());
        }
    }
    if !missing.is_empty() {
        let shown: Vec<&str> = missing.iter().take(10).map(String::as_str).collect();
        let more = if missing.len() > 10 { format!("\n  … and {} more", missing.len() - 10) } else { String::new() };
        return Err(format!(
            "corpus integrity: {}/{} chunks from {} are missing in {} — partial or stale corpus copy; the vault fast path must be a FULL git clone (#187):\n  {}{}",
            missing.len(),
            total,
            inventory_path.display(),
            client_dir.display(),
            shown.join("\n  "),
            more
        ));
    }
    Ok(())
}

/// Absolute routes that belong to the Loops/agent surfaces.
fn is_loops_route(path: &str) -> bool {
    let p = path.to_ascii_lowercase();
    p.contains("loop") || p.contains("automation") || p.contains("agent")
}

/// Chunk file belongs to component: "AutomationNewDialog.Wu-wKkiY.js" matches
/// "AutomationNewDialog". Hashes rotate between corpus versions, so the match
/// is a strict "<Name>." prefix.
/// Chunk file belongs to a pattern: exact patterns need "<prefix>." (a dot
/// before the hash); family patterns are raw prefix matches.
fn chunk_matches(filename: &str, prefix: &str, exact: bool) -> bool {
    if !filename.ends_with(".js") || filename.len() <= prefix.len() {
        return false;
    }
    if !filename.starts_with(prefix) {
        return false;
    }
    if exact {
        filename.as_bytes()[prefix.len()] == b'.'
    } else {
        true
    }
}

/// Surface patterns from the feature matrix. Two kinds:
/// - exact component: `Name.HASH.js` or `Name.{H1,H2}.js` → matches chunks
///   named "<Name>.<anything>.js" (hashes rotate between corpus versions).
/// - family prefix: any other Capitalized backticked token ending in ".js",
///   "*" or "{" (e.g. `WorkspaceAgent(s)SettingsPage.*`, `AgentPanel*`) →
///   leading alphanumeric run, matched as a raw prefix.
/// Returns (prefix, exact) pairs, sorted and deduped.
fn matrix_components(matrix: &str) -> Vec<(String, bool)> {
    let mut out: Vec<(String, bool)> = Vec::new();
    let mut rest = matrix;
    while let Some(start) = rest.find('`') {
        let after = &rest[start + 1..];
        let Some(end) = after.find('`') else { break };
        let tok = &after[..end];
        rest = &after[end + 1..];
        let Some(first) = tok.chars().next() else { continue };
        if !first.is_ascii_uppercase() {
            continue;
        }
        // exact: only ".js"-suffixed tokens are chunk names (without this,
        // `KNOWLEDGE.md` parsed as surface "KNOWLEDGE" with hash "md" — a
        // phantom surface, #205). Strip ".js", optional ".{…}" brace
        // hash-list, then "Name.hash".
        let is_chunk_name = tok.ends_with(".js");
        let mut core = tok.strip_suffix(".js").unwrap_or(tok);
        let mut exact = false;
        if is_chunk_name {
            if let Some(brace_at) = core.find(".{") {
                if core.ends_with('}') {
                    core = &core[..brace_at];
                    exact = true;
                }
            }
            if !exact {
                if let Some((name, hash)) = core.rsplit_once('.') {
                    if !hash.is_empty()
                        && hash.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
                        && !name.contains('.')
                        && name.chars().all(|c| c.is_ascii_alphanumeric())
                    {
                        core = name;
                        exact = true;
                    }
                }
            }
        }
        if exact {
            let name = core.to_string();
            if !out.iter().any(|(p, _)| p == &name) {
                out.push((name, true));
            }
            continue;
        }
        // family prefix. `(` is NOT a trigger: parenthesized backticked
        // tokens in the matrix are GraphQL op shorthand
        // (`AutomationTrustedSources(WithUsage)`), not chunk patterns — they
        // parsed into phantom surfaces that match zero chunks (#205).
        // `.js` must be a SUFFIX to trigger (a `Component.js.md` token in an
        // alternate --matrix would otherwise create a phantom surface —
        // CodeRabbit #210); `*` and `{` stay as the family/brace triggers.
        if tok.ends_with(".js") || tok.contains('*') || tok.contains('{') {
            let prefix: String = tok.chars().take_while(|c| c.is_ascii_alphanumeric()).collect();
            if !prefix.is_empty() && !out.iter().any(|(p, _)| p == &prefix) {
                out.push((prefix, false));
            }
        }
    }
    out.sort();
    out
}

/// Route literals in chunk bodies: `` `/:orgKey/…` `` template strings the
/// analysis index misses (#157 meta: indexes are a floor, grep is truth).
fn extract_route_literals(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(idx) = rest.find("`/:orgKey/") {
        let after = &rest[idx + 1..];
        let Some(end) = after.find('`') else { break };
        let route = &after[..end];
        rest = &after[end + 1..];
        // route paths: segments of word chars, dashes, :params, and optional
        // params (`:viewType?` — issue #177: without `?` the loops LIST route
        // and `/:orgKey/agent/:conversationId?` were dropped whole).
        if !route.is_empty()
            && route
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | ':' | '-' | '_' | '?'))
        {
            out.push(route.to_string());
        }
    }
    out
}

/// User-visible copy candidates from a prettified chunk. The grammar
/// (#162 consult): all three string-literal forms carry copy in the compiled
/// JSX (`children: "…"`, backtick literals, props into shell components) — so
/// scan literals, then keep what reads like UI copy: capitalized words or
/// multi-word phrases, dropping identifiers, paths, URLs, keys, hashes,
/// colors. The canary set (`--canaries`) proves the grammar per extraction:
/// extraction regression = hard fail, never a silent false green.
fn extract_copy(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let q = bytes[i];
        if q == b'"' || q == b'\'' || q == b'`' {
            let start = i + 1;
            let mut j = start;
            let mut escaped = false;
            while j < bytes.len() {
                if escaped {
                    escaped = false;
                } else if bytes[j] == b'\\' {
                    escaped = true;
                } else if bytes[j] == q {
                    break;
                } else if bytes[j] == b'\n' && q != b'`' {
                    break; // unterminated single/double-quoted: bail
                }
                j += 1;
            }
            if j < bytes.len() && bytes[j] == q {
                if let Ok(s) = std::str::from_utf8(&bytes[start..j]) {
                    if looks_like_copy(s) {
                        out.push(s.to_string());
                    }
                }
                i = j + 1;
                continue;
            }
            i = j.max(start) + 1;
        } else {
            i += 1;
        }
    }
    out
}

/// State-conditional copy alternates (H3 #213 slice 3): the compiled chunks
/// carry state-gated UI text as literal ternaries with BOTH arms as template
/// strings — `` cond ? `No matching loops` : `No loops yet` ``
/// (LoopsManagementPage), `` ? `Unavailable` : `Loading…` ``, `` ? `Failed` :
/// `Completed` `` (AutomationRunsPage). The gating variable is minified away,
/// so naming the state (empty/loading/…) would be a guess; the PAIR is the
/// verbatim corpus fact: one slot renders exactly these two alternates. Fact
/// form: `alt:<armA>|<armB>` (source order kept — the truthy arm first).
/// Both arms must pass the copy grammar, which drops class-name and
/// expression ternaries with near-zero noise.
fn extract_state_alternates(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = text.as_bytes();
    let mut search = 0;
    // scan `?` tokens and allow any JS whitespace (or none) before the first
    // backtick: `cond?\`A\`:\`B\`` and multiline pretty-printed forms are the
    // same fact (CodeRabbit #217). `??`/`?.` are skipped.
    while let Some(rel) = text[search..].find('?') {
        let q = search + rel;
        if matches!(bytes.get(q + 1), Some(b'?') | Some(b'.')) || matches!(bytes.get(q.wrapping_sub(1)), Some(b'?')) {
            search = q + 2;
            continue;
        }
        let mut a_tick = q + 1;
        while a_tick < bytes.len() && (bytes[a_tick] as char).is_ascii_whitespace() {
            a_tick += 1;
        }
        if a_tick >= bytes.len() || bytes[a_tick] != b'`' {
            search = q + 1;
            continue;
        }
        let a_start = a_tick + 1;
        let Some(a_len) = text[a_start..].find('`') else { break };
        let a_end = a_start + a_len;
        // between the arms: whitespace, then `:`, then whitespace, then a backtick
        let mut j = a_end + 1;
        while j < bytes.len() && (bytes[j] as char).is_ascii_whitespace() {
            j += 1;
        }
        if j >= bytes.len() || bytes[j] != b':' {
            search = a_end + 1;
            continue;
        }
        j += 1;
        while j < bytes.len() && (bytes[j] as char).is_ascii_whitespace() {
            j += 1;
        }
        if j >= bytes.len() || bytes[j] != b'`' {
            search = a_end + 1;
            continue;
        }
        let b_start = j + 1;
        let Some(b_len) = text[b_start..].find('`') else { break };
        let b_end = b_start + b_len;
        let a = &text[a_start..a_end];
        let b = &text[b_start..b_end];
        if looks_like_copy(a) && looks_like_copy(b) {
            out.push(format!("alt:{}|{}", a, b));
        }
        search = b_end + 1;
    }
    out
}

fn looks_like_copy(s: &str) -> bool {
    let t = s.trim();
    if t.len() < 2 || t.len() > 80 {
        return false;
    }
    if !t.chars().any(|c| c.is_ascii_alphabetic()) {
        return false;
    }
    // drop paths, urls, keys, colors, hashes, template holes, markup-ish
    for bad in ["./", ".js", "://", "\\n", "${", "#", "{", "}", "<", ">"] {
        if t.contains(bad) {
            return false;
        }
    }
    if t.starts_with("--") || t.contains("__") {
        return false;
    }
    let words = t.split(' ').count();
    if words == 1 {
        // single word: keep only Capitalized alphabetic (nav labels, "Loops");
        // tolerate a trailing colon (form labels: "Name:")
        let w = t.strip_suffix(':').unwrap_or(t);
        return w.len() >= 2
            && w.chars().next().is_some_and(|c| c.is_ascii_uppercase())
            && w.chars().all(|c| c.is_ascii_alphabetic());
    }
    // multi-word: sentence-case copy starts capitalized (Linear's style), and
    // must be ≥2/3 letters/spaces (admits terminal punctuation like "…")
    if !t.chars().next().is_some_and(|c| c.is_ascii_uppercase()) && !t.chars().any(|c| c.is_ascii_uppercase()) {
        return false;
    }
    let letters = t.chars().filter(|c| c.is_ascii_alphabetic() || c.is_whitespace()).count();
    letters * 3 >= t.len() * 2
}

/// Ordered-presentation chains from a prettified chunk (family 9, H3 #207).
/// Order is compiled into the bundle as ARRAY/OBJECT LITERALS whose source
/// order IS the render order, so the grammars read literal sequences — never
/// inferred layout. Two corpus-proven forms (Linear 1.32.4):
///
/// 1. column declarations: consecutive `orderingKey: `k`` props on list
///    header cells (AutomationsList: name > trigger > team > owner > runs >
///    lastExecuted). The key is the stable fact; the display label is already
///    a copy fact.
/// 2. filter/section declarations: consecutive `key: `k`,\n name: `Label``
///    pairs inside one options array (LoopsManagementPage: Enabled > Team >
///    Owner > Trusted external source). The user-visible `name` is the fact.
///
/// A chain needs >= 2 items (one item carries no order). Each grammar yields
/// at most one chain per chunk; the caller keeps the longest chain per
/// surface (ramp rule: surfaces without a proven chain stay uncovered).
fn extract_order(text: &str) -> Vec<Vec<String>> {
    let mut chains: Vec<Vec<String>> = Vec::new();

    // grammar 1: `orderingKey: `k`` in source order
    let mut cols: Vec<String> = Vec::new();
    let mut seen_cols = HashSet::new();
    let mut rest = text;
    while let Some(idx) = rest.find("orderingKey: `") {
        // skip identifier-suffixed lookalikes (e.g. activeOrderingKey) by
        // requiring a non-identifier char before the match
        let pre_ok = idx == 0
            || !rest[..idx]
                .chars()
                .next_back()
                .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_');
        let after = &rest[idx + 14..];
        let Some(end) = after.find('`') else { break };
        let key = &after[..end];
        rest = &after[end + 1..];
        if pre_ok
            && !key.is_empty()
            && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            && seen_cols.insert(key)
        {
            cols.push(key.to_string());
        }
    }
    if cols.len() >= 2 {
        chains.push(cols);
    }

    // grammar 2: `key: `k`,` immediately followed by `name: `Label`` —
    // one options-array literal, names in source order
    let mut names: Vec<String> = Vec::new();
    let mut seen_names = HashSet::new();
    let mut rest = text;
    while let Some(idx) = rest.find("key: `") {
        let pre_ok = idx == 0
            || !rest[..idx]
                .chars()
                .next_back()
                .is_some_and(|c| c.is_ascii_alphanumeric() || c == '_');
        let after = &rest[idx + 6..];
        let Some(kend) = after.find('`') else { break };
        let tail = &after[kend + 1..];
        rest = tail;
        if !pre_ok {
            continue;
        }
        // the very next property must be `name:` with a backtick literal
        let Some(t) = tail.strip_prefix(',') else { continue };
        let t = t.trim_start();
        let Some(t) = t.strip_prefix("name: `") else { continue };
        let Some(nend) = t.find('`') else { break };
        let name = &t[..nend];
        if !name.is_empty() && !name.contains("${") && seen_names.insert(name) {
            names.push(name.to_string());
        }
    }
    if names.len() >= 2 {
        chains.push(names);
    }

    chains
}

/// Component containment edges: `from "./Child.<hash>.js"` inside a chunk is a
/// real usage edge "Parent>Child". Only Capitalized children (components).
/// The surface's interaction primitive, from unambiguous compiled signals
/// (issue #213 slice 1, corpus recon on Linear 1.32.4):
/// - `export { … as pageMetadata }` — the routed-page chunk contract
///   (LoopsManagementPage, LoopLimitsPage, the settings pages) → "page".
/// - a `role: `dialog`` JSX prop (AutomationNewDialog, AgentPanel) → "dialog".
/// Anything else — including `onRequestClose` alone, which openers like
/// AutomationNewButton also carry — is NO fact: an unverifiable value stays
/// unmarked, never guessed (audit rule; SPECS/ui-parity.md).
fn extract_primitive(text: &str) -> Option<String> {
    let is_dialog = has_dialog_jsx_prop(text);
    // pageMetadata must appear inside an `export { … }` list, not merely as a
    // word (dozens of chunks IMPORT it; the routed page chunk EXPORTS it).
    let is_page = exports_page_metadata(text);
    match (is_page, is_dialog) {
        (true, false) => Some("page".to_string()),
        (false, true) => Some("dialog".to_string()),
        _ => None, // neither, or both (ambiguous): no fact, never a guess
    }
}

/// True when `role: `dialog`` occurs in PROPERTY POSITION inside an object
/// literal: the nearest non-whitespace byte before it is `{` or `,` and the
/// nearest after is `,` or `}`. A whole-chunk substring also matches string
/// constants and comments (#229 review); property position excludes both
/// (a string match is preceded by a quote, a line comment by its own text).
/// A distance-bounded jsx( opener window was tried and rejected: AgentPanel's
/// prop sits >300 bytes into a large animation-props object, and any window
/// size is a guess. Measured on 1.32.4: identical result set (2 dialog
/// surfaces: AutomationNewDialog, AgentPanel), zero false positives.
fn has_dialog_jsx_prop(text: &str) -> bool {
    let needle = "role: `dialog`";
    let mut from = 0;
    while let Some(rel) = text[from..].find(needle) {
        let at = from + rel;
        let before_ok = text[..at]
            .chars()
            .rev()
            .find(|c| !c.is_whitespace())
            .is_some_and(|c| c == '{' || c == ',');
        let after_ok = text[at + needle.len()..]
            .chars()
            .find(|c| !c.is_whitespace())
            .is_some_and(|c| c == ',' || c == '}');
        if before_ok && after_ok {
            return true;
        }
        from = at + needle.len();
    }
    false
}

/// True when the exact identifier `pageMetadata` appears inside an
/// `export { … }` list. Word-boundary matched: an alias such as
/// `as pageMetadataV2` is a DIFFERENT export and not the routed-page
/// contract (#229 review).
fn exports_page_metadata(text: &str) -> bool {
    let mut rest = text;
    while let Some(idx) = rest.find("export {") {
        let after = &rest[idx + 8..];
        let Some(end) = after.find('}') else { return false };
        let list = &after[..end];
        let mut search = 0;
        while let Some(rel) = list[search..].find("pageMetadata") {
            let at = search + rel;
            let before_ok = at == 0
                || !list[..at].chars().next_back().is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
            let tail = &list[at + "pageMetadata".len()..];
            let after_ok = !tail.chars().next().is_some_and(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$');
            if before_ok && after_ok {
                return true;
            }
            search = at + "pageMetadata".len();
        }
        rest = &after[end..];
    }
    false
}

fn extract_edges(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(idx) = rest.find("from \"./") {
        let after = &rest[idx + 8..];
        let Some(end) = after.find('"') else { break };
        let target = &after[..end];
        rest = &after[end..];
        if let Some(stripped) = target.strip_suffix(".js") {
            if let Some((comp, _hash)) = stripped.rsplit_once('.') {
                if comp.chars().next().is_some_and(|c| c.is_ascii_uppercase())
                    && comp.chars().all(|c| c.is_ascii_alphanumeric())
                {
                    out.push(comp.to_string());
                }
            }
        }
    }
    out
}

/// Semantic theme-token usage: `tokenName: \`var(--sx-…)\`` assignments (the
/// ThemeProvider pattern). Values stay the documented CSS-asset seam.
fn extract_tokens(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;
    while let Some(idx) = rest.find(": `var(--") {
        // walk back to the token name start
        let before = &rest[..idx];
        let name: String = before
            .chars()
            .rev()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect::<String>()
            .chars()
            .rev()
            .collect();
        if !name.is_empty() && name.chars().next().is_some_and(|c| c.is_ascii_lowercase()) {
            out.push(name);
        }
        rest = &rest[idx + 9..];
    }
    out
}

#[cfg(test)]
mod security_tests {
    use super::*;

    #[test]
    fn distinct_order_keys_preserve_order_and_deduplicate_at_scale() {
        let text = (0..20_000).map(|i| format!("orderingKey: `k{i}`, orderingKey: `k{i}`,\n"))
            .collect::<String>();
        let chains = extract_order(&text);
        assert_eq!(chains.len(), 1);
        assert_eq!(chains[0].len(), 20_000);
        assert_eq!(chains[0][0], "k0");
        assert_eq!(chains[0][19_999], "k19999");
        let names = extract_order("key: `a`, name: `Alpha`, key: `b`, name: `Beta`, key: `a`, name: `Alpha`");
        assert_eq!(names, vec![vec!["Alpha", "Beta"]]);
    }

    #[test]
    fn oversized_chunk_is_rejected_before_extraction() {
        let path = std::env::temp_dir().join(format!("parity-large-chunk-{}", std::process::id()));
        let file = fs::File::create(&path).unwrap();
        file.set_len(MAX_CHUNK_BYTES + 1).unwrap();
        let result = read_chunk(&path);
        fs::remove_file(&path).unwrap();
        assert!(result.unwrap_err().contains("exceeds 16 MiB"));
    }
}
