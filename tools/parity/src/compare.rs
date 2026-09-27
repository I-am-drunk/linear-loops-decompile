//! `parity check`: compare our declared facts against the corpus reference,
//! applying tolerances and the declared-improvements list. Pure function of
//! files; exits 1 on any undeclared deviation.

use crate::model::{FactFile, Improvement, Surface, Tolerances};
use std::collections::BTreeSet;

pub const FAMILIES: [&str; 4] = ["routes", "copy", "structure", "tokens"];

#[derive(Debug, Clone)]
pub struct Deviation {
    pub surface: String,
    pub family: String,
    /// "missing" (reference has it, we don't) | "extra" (we have it, reference doesn't)
    pub kind: &'static str,
    pub fact: String,
    /// Some(reason) when a declared improvement covers this deviation.
    pub covered_by: Option<String>,
}

#[derive(Debug, Default)]
pub struct Outcome {
    pub deviations: Vec<Deviation>,
    /// Reference surfaces we have no facts for yet (iterative building).
    pub not_built: Vec<String>,
    /// Our surfaces absent from the reference AND not declared in
    /// improvements.json — the invented-UI guard: these fail the check.
    pub untracked: Vec<String>,
    /// Our surfaces absent from the reference but declared via a
    /// family:"surface" improvements entry: (surface, reason).
    pub declared_new: Vec<(String, String)>,
    /// Declared improvements that no longer match any deviation.
    pub stale_improvements: Vec<Improvement>,
}

impl Outcome {
    pub fn violations(&self) -> Vec<&Deviation> {
        self.deviations.iter().filter(|d| d.covered_by.is_none()).collect()
    }
}

fn family_list<'a>(s: &'a Surface, family: &str) -> &'a [String] {
    match family {
        "routes" => &s.routes,
        "copy" => &s.copy,
        "structure" => &s.structure,
        "tokens" => &s.tokens,
        _ => &[],
    }
}

pub fn check(ours: &FactFile, reference: &FactFile, improvements: &[Improvement], _tol: &Tolerances) -> Outcome {
    let mut out = Outcome::default();
    let mut used: BTreeSet<usize> = BTreeSet::new();

    let covers = |surface: &str, family: &str, fact: &str| -> Option<usize> {
        improvements.iter().position(|i| {
            i.surface == surface && i.family == family && i.fact == fact
        })
    };

    for (name, our_surface) in &ours.surfaces {
        let Some(ref_surface) = reference.surfaces.get(name) else {
            // Ours-only surface: the invented-UI guard. It is red unless the
            // slice declares it as a deliberate addition:
            // { "surface": "<Name>", "family": "surface", "fact": "<Name>", … }
            match covers(name, "surface", name) {
                Some(i) => {
                    used.insert(i);
                    out.declared_new.push((name.clone(), improvements[i].reason.clone()));
                }
                None => out.untracked.push(name.clone()),
            }
            continue;
        };
        for family in FAMILIES {
            let theirs: BTreeSet<&String> = family_list(ref_surface, family).iter().collect();
            let mine: BTreeSet<&String> = family_list(our_surface, family).iter().collect();
            for fact in theirs.difference(&mine) {
                let cov = covers(name, family, fact);
                if let Some(i) = cov {
                    used.insert(i);
                }
                out.deviations.push(Deviation {
                    surface: name.clone(),
                    family: family.to_string(),
                    kind: "missing",
                    fact: (*fact).clone(),
                    covered_by: cov.map(|i| improvements[i].reason.clone()),
                });
            }
            for fact in mine.difference(&theirs) {
                let cov = covers(name, family, fact);
                if let Some(i) = cov {
                    used.insert(i);
                }
                out.deviations.push(Deviation {
                    surface: name.clone(),
                    family: family.to_string(),
                    kind: "extra",
                    fact: (*fact).clone(),
                    covered_by: cov.map(|i| improvements[i].reason.clone()),
                });
            }
        }
    }
    for name in reference.surfaces.keys() {
        if !ours.surfaces.contains_key(name) {
            out.not_built.push(name.clone());
        }
    }
    for (i, imp) in improvements.iter().enumerate() {
        if !used.contains(&i) {
            out.stale_improvements.push(imp.clone());
        }
    }
    out
}
