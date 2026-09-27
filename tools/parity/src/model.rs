//! The fact model: what "the same UI" decomposes into (SPECS/ui-parity.md).
//! Both sides of a comparison — the corpus reference and our slice's declared
//! facts — use this one shape.
//!
//! Family semantics:
//! - set families (routes, copy, structure, tokens, bindings, icons, behavior,
//!   states): compared as sorted sets; missing/extra are deviations.
//! - `order`: ONE ordered fact per surface, rendered "a > b > c" — compared
//!   whole (order is the point; containment alone misses it — #162 consult).
//! - `primitive`: the surface's interaction primitive (dialog|page|popover|
//!   drawer|view…), exact-compared; a route can be exact while the primitive
//!   is wrong.
//!
//! A family is only COMPARED where the reference carries facts for it
//! (iterative ramp: the bar binds where we can measure; coverage gaps print
//! as report notes, never silent greens and never false reds).

use crate::json::{self, Value};
use std::collections::BTreeMap;

pub const FACT_VERSION: i64 = 2;

/// Set-compared families.
pub const SET_FAMILIES: [&str; 8] = [
    "routes", "copy", "structure", "tokens", "bindings", "icons", "behavior", "states",
];

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Surface {
    /// Exact route paths (app-level: the Loops/agent route table).
    pub routes: Vec<String>,
    /// User-visible strings, exact-compared (placeholders per spec grammar).
    pub copy: Vec<String>,
    /// Containment facts: component names a surface uses.
    pub structure: Vec<String>,
    /// Semantic theme-token names (values: the theme-extractor slice).
    pub tokens: Vec<String>,
    /// Field bindings: model fields the surface displays/edits.
    pub bindings: Vec<String>,
    /// Icon identity: icon-set membership per slot.
    pub icons: Vec<String>,
    /// Behavior facts: "event -> effect" (click X navigates Y; toggle calls Z).
    pub behavior: Vec<String>,
    /// State-conditional visibility facts (empty/loading/disabled/…).
    pub states: Vec<String>,
    /// Ordered presentation facts (sidebar items, column order), kept in
    /// declared order — NOT sorted.
    pub order: Vec<String>,
    /// Interaction primitive (dialog, page, popover, drawer, view).
    pub primitive: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct FactFile {
    pub surfaces: BTreeMap<String, Surface>,
}

impl Surface {
    /// Sort + dedup the set families; `order` keeps declared sequence.
    pub fn normalize(&mut self) {
        for list in [
            &mut self.routes, &mut self.copy, &mut self.structure, &mut self.tokens,
            &mut self.bindings, &mut self.icons, &mut self.behavior, &mut self.states,
        ] {
            list.sort();
            list.dedup();
        }
        self.order.dedup();
    }
    pub fn set_lists(&self) -> [&Vec<String>; 8] {
        [
            &self.routes, &self.copy, &self.structure, &self.tokens,
            &self.bindings, &self.icons, &self.behavior, &self.states,
        ]
    }
    pub fn set_list(&self, family: &str) -> Option<&Vec<String>> {
        Some(match family {
            "routes" => &self.routes,
            "copy" => &self.copy,
            "structure" => &self.structure,
            "tokens" => &self.tokens,
            "bindings" => &self.bindings,
            "icons" => &self.icons,
            "behavior" => &self.behavior,
            "states" => &self.states,
            _ => return None,
        })
    }
    fn set_list_mut(&mut self, family: &str) -> Option<&mut Vec<String>> {
        Some(match family {
            "routes" => &mut self.routes,
            "copy" => &mut self.copy,
            "structure" => &mut self.structure,
            "tokens" => &mut self.tokens,
            "bindings" => &mut self.bindings,
            "icons" => &mut self.icons,
            "behavior" => &mut self.behavior,
            "states" => &mut self.states,
            _ => return None,
        })
    }
}

pub fn to_value(f: &FactFile) -> Value {
    let mut surfaces = Vec::new();
    for (name, s) in &f.surfaces {
        let mut pairs = vec![
            ("routes", json::str_arr(&s.routes)),
            ("copy", json::str_arr(&s.copy)),
            ("structure", json::str_arr(&s.structure)),
            ("tokens", json::str_arr(&s.tokens)),
            ("bindings", json::str_arr(&s.bindings)),
            ("icons", json::str_arr(&s.icons)),
            ("behavior", json::str_arr(&s.behavior)),
            ("states", json::str_arr(&s.states)),
            ("order", json::str_arr(&s.order)),
        ];
        if let Some(p) = &s.primitive {
            pairs.push(("primitive", Value::Str(p.clone())));
        }
        surfaces.push((name.clone(), Value::Obj(pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect())));
    }
    Value::Obj(vec![
        ("version".to_string(), Value::Num(FACT_VERSION as f64)),
        ("surfaces".to_string(), Value::Obj(surfaces)),
    ])
}

pub fn from_value(v: &Value) -> Result<FactFile, String> {
    let mut f = FactFile::default();
    let surfaces = v.get("surfaces").ok_or("fact file: missing \"surfaces\"")?;
    let pairs = match surfaces {
        Value::Obj(p) => p,
        _ => return Err("fact file: \"surfaces\" must be an object".to_string()),
    };
    for (name, sv) in pairs {
        if !matches!(sv, Value::Obj(_)) {
            return Err(format!("surface '{}': must be an object", name));
        }
        let mut s = Surface::default();
        for family in SET_FAMILIES {
            if let Some(v) = sv.get(family) {
                let arr = v
                    .as_arr()
                    .ok_or_else(|| format!("surface '{}': '{}' must be an array of strings", name, family))?;
                let target = s.set_list_mut(family).unwrap();
                for item in arr {
                    match item.as_str() {
                        Some(x) => target.push(x.to_string()),
                        None => return Err(format!("surface '{}': {} must be strings", name, family)),
                    }
                }
            }
        }
        if let Some(v) = sv.get("order") {
            let arr = v
                .as_arr()
                .ok_or_else(|| format!("surface '{}': 'order' must be an array of strings", name))?;
            for item in arr {
                match item.as_str() {
                    Some(x) => s.order.push(x.to_string()),
                    None => return Err(format!("surface '{}': order must be strings", name)),
                }
            }
        }
        if let Some(p) = sv.get("primitive").and_then(Value::as_str) {
            s.primitive = Some(p.to_string());
        }
        s.normalize();
        f.surfaces.insert(name.clone(), s);
    }
    Ok(f)
}

pub fn parse_file(text: &str) -> Result<FactFile, String> {
    from_value(&json::parse(text)?)
}

/// `tools/parity/policy/tolerances.json` — strict defaults; loosening is a PR
/// decision.
#[derive(Debug, Clone)]
pub struct Tolerances {
    /// Max |Δ| in px for rendered spacing measures (P2/P3).
    pub spacing_px: f64,
    /// Color tolerance in ΔE for rendered color measures (P3; the static
    /// theme-token compare is exact).
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
/// channel.
#[derive(Debug, Clone, PartialEq)]
pub struct Improvement {
    pub surface: String,
    /// a set family, or "order", or "primitive"
    pub family: String,
    /// The reference fact we deliberately diverge from — or, for additions,
    /// the fact only our side has. For "order": the full "a > b > c" chain.
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
