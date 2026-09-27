//! The fact model: what "the same UI" decomposes into (SPECS/ui-parity.md).
//! Both sides of a comparison — the corpus reference and our slice's declared
//! facts — use this one shape.

use crate::json::{self, Value};
use std::collections::BTreeMap;

pub const FACT_VERSION: i64 = 1;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Surface {
    /// Exact route paths (e.g. "/:orgKey/loop/:loopId/runs").
    pub routes: Vec<String>,
    /// User-visible strings, exact-compared.
    pub copy: Vec<String>,
    /// Containment facts, "Parent>Child" component edges.
    pub structure: Vec<String>,
    /// Semantic theme-token names used by the surface (values are a P3 seam).
    pub tokens: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct FactFile {
    pub surfaces: BTreeMap<String, Surface>,
}

impl Surface {
    pub fn normalize(&mut self) {
        for list in [&mut self.routes, &mut self.copy, &mut self.structure, &mut self.tokens] {
            list.sort();
            list.dedup();
        }
    }
    pub fn is_empty(&self) -> bool {
        self.routes.is_empty() && self.copy.is_empty() && self.structure.is_empty() && self.tokens.is_empty()
    }
}

pub fn to_value(f: &FactFile) -> Value {
    let mut surfaces = Vec::new();
    for (name, s) in &f.surfaces {
        surfaces.push((
            name.clone(),
            json::obj(vec![
                ("routes", json::str_arr(&s.routes)),
                ("copy", json::str_arr(&s.copy)),
                ("structure", json::str_arr(&s.structure)),
                ("tokens", json::str_arr(&s.tokens)),
            ]),
        ));
    }
    Value::Obj(vec![
        ("version".to_string(), Value::Num(FACT_VERSION as f64)),
        ("surfaces".to_string(), Value::Obj(surfaces)),
    ])
}

pub fn from_value(v: &Value) -> Result<FactFile, String> {
    let mut f = FactFile::default();
    let surfaces = v
        .get("surfaces")
        .ok_or("fact file: missing \"surfaces\"")?;
    let pairs = match surfaces {
        Value::Obj(p) => p,
        _ => return Err("fact file: \"surfaces\" must be an object".to_string()),
    };
    for (name, sv) in pairs {
        let mut s = Surface::default();
        for (family, target) in [
            ("routes", &mut s.routes),
            ("copy", &mut s.copy),
            ("structure", &mut s.structure),
            ("tokens", &mut s.tokens),
        ] {
            if let Some(fv) = sv.get(family) {
                let arr = fv
                    .as_arr()
                    .ok_or_else(|| format!("surface '{}': '{}' must be an array of strings", name, family))?;
                for item in arr {
                    match item.as_str() {
                        Some(x) => target.push(x.to_string()),
                        None => return Err(format!("surface '{}': {} must be strings", name, family)),
                    }
                }
            }
        }
        s.normalize();
        f.surfaces.insert(name.clone(), s);
    }
    Ok(f)
}

pub fn parse_file(text: &str) -> Result<FactFile, String> {
    from_value(&json::parse(text)?)
}

/// `.parity/tolerances.json` — strict defaults; loosening is a PR decision.
#[derive(Debug, Clone)]
pub struct Tolerances {
    /// Max |Δ| in px for rendered spacing measures (P2/P3; P1 compares no
    /// numeric values).
    pub spacing_px: f64,
    /// Color tolerance in ΔE units for rendered color measures (P3).
    pub color_delta_e: f64,
}

impl Default for Tolerances {
    fn default() -> Self {
        Tolerances { spacing_px: 1.0, color_delta_e: 0.0 }
    }
}

pub fn tolerances_from_value(v: &Value) -> Result<Tolerances, String> {
    let d = Tolerances::default();
    Ok(Tolerances {
        spacing_px: v.get("spacingPx").and_then(Value::as_num).unwrap_or(d.spacing_px),
        color_delta_e: v.get("colorDeltaE").and_then(Value::as_num).unwrap_or(d.color_delta_e),
    })
}

/// `tools/parity/policy/improvements.json` — the ONLY sanctioned deviation
/// channel. A deviation entry matches (surface, family, fact) exactly. The
/// convention `family: "surface"`, `fact: <surface name>` declares a whole
/// ours-only surface (e.g. our Settings page) as a deliberate addition.
#[derive(Debug, Clone, PartialEq)]
pub struct Improvement {
    pub surface: String,
    /// "routes" | "copy" | "structure" | "tokens"
    pub family: String,
    /// The reference fact we deliberately diverge from — or, for additions,
    /// the fact only our side has.
    pub fact: String,
    pub reason: String,
    pub issue: Option<u64>,
}

pub fn improvements_from_value(v: &Value) -> Result<Vec<Improvement>, String> {
    let arr = v.as_arr().ok_or("improvements file must be a JSON array")?;
    let mut out = Vec::new();
    for item in arr {
        let get_str = |k: &str| -> Result<String, String> {
            item.get(k)
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| format!("improvement entry missing string field '{}'", k))
        };
        out.push(Improvement {
            surface: get_str("surface")?,
            family: get_str("family")?,
            fact: get_str("fact")?,
            reason: get_str("reason")?,
            issue: item.get("issue").and_then(Value::as_num).map(|n| n as u64),
        });
    }
    Ok(out)
}
