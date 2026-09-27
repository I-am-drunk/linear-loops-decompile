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

use crate::model::{FactFile, Surface};
use std::fs;
use std::path::Path;

pub struct ExtractStats {
    pub surfaces: usize,
    pub chunks_read: usize,
    pub routes: usize,
    pub copy: usize,
    pub edges: usize,
    pub tokens: usize,
}

pub fn run(corpus: &Path, matrix: &Path, out: &Path) -> Result<ExtractStats, String> {
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
        .ok_or_else(|| format!("{}: expected a top-level JSON array of route entries", routes_path.display()))?;
    let mut app_routes: Vec<String> = Vec::new();
    for item in routes_arr {
        let Some(path) = item.get("path").and_then(|v| v.as_str()) else {
            continue;
        };
        if path.starts_with('/') && is_loops_route(path) {
            app_routes.push(path.to_string());
        }
    }
    if !app_routes.is_empty() {
        facts.surfaces.insert(
            "app.routes".to_string(),
            Surface { routes: { let mut r = app_routes.clone(); r.sort(); r.dedup(); r }, ..Default::default() },
        );
    }

    // --- surfaces from the feature matrix ------------------------------------
    let matrix_text = fs::read_to_string(matrix)
        .map_err(|e| format!("read {}: {}", matrix.display(), e))?;
    let components = matrix_components(&matrix_text);

    let client_dir = corpus.join("pretty/client");
    let mut stats = ExtractStats { surfaces: 0, chunks_read: 0, routes: 0, copy: 0, edges: 0, tokens: 0 };

    for comp in &components {
        let mut surface = Surface::default();
        // chunk files for this component (hashes rotate; match by name prefix)
        let mut matched_any = false;
        let entries = match fs::read_dir(&client_dir) {
            Ok(e) => e,
            Err(e) => return Err(format!("read {}: {}", client_dir.display(), e)),
        };
        for entry in entries {
            let entry = entry.map_err(|e| format!("read dir entry in {}: {}", client_dir.display(), e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            if !chunk_matches(&name, comp) {
                continue;
            }
            matched_any = true;
            stats.chunks_read += 1;
            let text = fs::read_to_string(entry.path())
                .map_err(|e| format!("read {}: {}", entry.path().display(), e))?;
            surface.copy.extend(extract_copy(&text));
            surface.structure.extend(extract_edges(&text));
            surface.tokens.extend(extract_tokens(&text));
        }
        surface.normalize();
        if matched_any || !surface.is_empty() {
            stats.copy += surface.copy.len();
            stats.edges += surface.structure.len();
            stats.tokens += surface.tokens.len();
            facts.surfaces.insert(comp.clone(), surface);
            stats.surfaces += 1;
        }
    }

    // --- theme: the semantic token namespace is one synthetic surface -------
    // (values are the documented served-CSS seam; names come from the
    // ThemeProvider chunks' `name: \`var(--sx-…)\`` definitions).
    let mut theme = Surface::default();
    for entry in fs::read_dir(&client_dir).map_err(|e| format!("read {}: {}", client_dir.display(), e))? {
        let entry = entry.map_err(|e| format!("read dir entry in {}: {}", client_dir.display(), e))?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !chunk_matches(&name, "ThemeProvider") {
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

    let parent = out.parent().ok_or("out path has no parent dir")?;
    fs::create_dir_all(parent).map_err(|e| format!("mkdir {}: {}", parent.display(), e))?;
    fs::write(out, crate::json::to_string(&crate::model::to_value(&facts)))
        .map_err(|e| format!("write {}: {}", out.display(), e))?;
    Ok(stats)
}

/// Absolute routes that belong to the Loops/agent surfaces.
fn is_loops_route(path: &str) -> bool {
    let p = path.to_ascii_lowercase();
    p.contains("loop") || p.contains("automation") || p.contains("agent")
}

/// Chunk file belongs to component: "AutomationNewDialog.Wu-wKkiY.js" matches
/// "AutomationNewDialog". Hashes rotate between corpus versions, so the match
/// is a strict "<Name>." prefix.
fn chunk_matches(filename: &str, component: &str) -> bool {
    filename.len() > component.len() + 1
        && filename.starts_with(component)
        && filename.as_bytes()[component.len()] == b'.'
        && filename.ends_with(".js")
}

/// Surface inventory from the feature matrix: backticked `Component.HASH.js`
/// names, deduped by component prefix. Non-chunk backticks are ignored by the
/// ".js" requirement.
fn matrix_components(matrix: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = matrix;
    while let Some(start) = rest.find('`') {
        let after = &rest[start + 1..];
        let Some(end) = after.find('`') else { break };
        let tok = &after[..end];
        rest = &after[end + 1..];
        if let Some(stripped) = tok.strip_suffix(".js") {
            if let Some((comp, hash)) = stripped.rsplit_once('.') {
                if !hash.is_empty()
                    && comp.chars().next().is_some_and(|c| c.is_ascii_uppercase())
                    && comp.chars().all(|c| c.is_ascii_alphanumeric())
                    && !out.contains(&comp.to_string())
                {
                    out.push(comp.to_string());
                }
            }
        }
    }
    out.sort();
    out
}

/// User-visible copy candidates from a prettified chunk. Heuristic by design
/// (facts catalog, not code): keep string literals that read like UI copy —
/// capitalized words or multi-word phrases — and drop identifiers, paths,
/// URLs, keys, hashes, and colors. A committed deny-list to curate the tail is
/// future work (none exists yet — do not reference one).
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
    // must be mostly letters/spaces/punctuation people read
    if !t.chars().next().is_some_and(|c| c.is_ascii_uppercase()) && !t.chars().any(|c| c.is_ascii_uppercase()) {
        return false;
    }
    let letters = t.chars().filter(|c| c.is_ascii_alphabetic() || c.is_whitespace()).count();
    letters * 2 >= t.len()
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
