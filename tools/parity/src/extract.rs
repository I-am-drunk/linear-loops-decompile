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
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

pub struct ExtractStats {
    pub surfaces: usize,
    pub chunks_read: usize,
    pub routes: usize,
    pub copy: usize,
    pub edges: usize,
    pub tokens: usize,
    /// surfaces that carry an order chain
    pub order: usize,
    /// (passed, total) when a canary list was enforced.
    pub canaries: Option<(usize, usize)>,
}

pub fn run(corpus: &Path, matrix: &Path, out: &Path, canaries: Option<&Path>) -> Result<ExtractStats, String> {
    let mut facts = FactFile::default();

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
            let text = fs::read_to_string(entry.path())
                .map_err(|e| format!("read {}: {}", entry.path().display(), e))?;
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
    let mut stats = ExtractStats { surfaces: 0, chunks_read: 0, routes: 0, copy: 0, edges: 0, tokens: 0, order: 0, canaries: None };

    for (comp, exact) in &components {
        let mut surface = Surface::default();
        // order chains per matched chunk (a surface can match several chunk
        // builds; the longest chain wins — see below)
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
            let text = fs::read_to_string(entry.path())
                .map_err(|e| format!("read {}: {}", entry.path().display(), e))?;
            surface.copy.extend(extract_copy(&text));
            surface.structure.extend(extract_edges(&text));
            surface.tokens.extend(extract_tokens(&text));
            order_candidates.extend(extract_order(&text));
        }
        // A surface may match several chunk builds of the same component
        // (hash-rotated duplicates); their order chains are the same fact.
        // Keep the LONGEST chain (a stripped/duplicate build can carry a
        // truncated copy of the array literal; the fuller one is the fact).
        if let Some(best) = order_candidates.into_iter().max_by_key(Vec::len) {
            surface.order = best;
        }
        surface.normalize();
        if matched_any || !surface.is_empty() {
            stats.copy += surface.copy.len();
            stats.edges += surface.structure.len();
            stats.tokens += surface.tokens.len();
            stats.order += usize::from(!surface.order.is_empty());
            facts.surfaces.insert(comp.clone(), surface);
            stats.surfaces += 1;
        }
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

    // --- canaries: prove the copy grammar on every extraction --------------
    // A canary absent from the CORPUS = drift alarm (refresh canaries or
    // corpus); present in corpus but absent from the EXTRACTED reference =
    // copy-grammar regression. Both are loud failures (#162 consult).
    if let Some(canary_path) = canaries {
        let list_text = fs::read_to_string(canary_path)
            .map_err(|e| format!("read canaries {}: {}", canary_path.display(), e))?;
        // Three canary kinds: plain lines are COPY canaries; `route:` lines
        // are ROUTE canaries checked against app.routes (#177); `order:` lines
        // (H3 #207) are ORDER canaries — `order:<Surface>=<a> > <b> > …` —
        // checked against the surface's extracted whole-sequence chain, so an
        // order-grammar regression fails as loudly as a copy one.
        let mut order_canaries: Vec<(String, String)> = Vec::new(); // (surface, chain)
        let canary_list: Vec<(bool, String)> = list_text
            .lines()
            .map(str::trim)
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .filter_map(|l| {
                if let Some(o) = l.strip_prefix("order:") {
                    if let Some((surface, chain)) = o.split_once('=') {
                        order_canaries.push((surface.trim().to_string(), chain.trim().to_string()));
                    }
                    return None;
                }
                Some(match l.strip_prefix("route:") {
                    Some(r) => (true, r.trim().to_string()),
                    None => (false, l.to_string()),
                })
            })
            .collect();
        let mut order_problems: Vec<String> = Vec::new();
        let mut order_passed = 0;
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
        if !canary_list.is_empty() || !order_canaries.is_empty() {
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
            stats.canaries = Some((passed, canary_list.len() + order_canaries.len()));
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
/// - family prefix: any other Capitalized backticked token containing ".js",
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
        // exact: strip ".js", optional ".{…}" brace hash-list, then "Name.hash"
        let mut core = tok.strip_suffix(".js").unwrap_or(tok);
        let mut exact = false;
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
        if exact {
            let name = core.to_string();
            if !out.iter().any(|(p, _)| p == &name) {
                out.push((name, true));
            }
            continue;
        }
        // family prefix
        if tok.contains(".js") || tok.contains('*') || tok.contains('{') || tok.contains('(') {
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
            && !cols.contains(&key.to_string())
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
        if !name.is_empty() && !name.contains("${") && !names.contains(&name.to_string()) {
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
