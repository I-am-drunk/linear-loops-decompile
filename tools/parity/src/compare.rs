//! `parity check`: compare our declared facts against the corpus reference,
//! applying tolerances and the declared-improvements list. Pure function of
//! files; exit 1 on any undeclared deviation.
//!
//! Ramp rule: a family compares only where the REFERENCE surface carries at
//! least one fact in it. Empty-reference families are report notes
//! ("uncovered"), never violations — the bar binds where we can measure.

use crate::model::{FactFile, Improvement, Tolerances, SET_FAMILIES};
use std::collections::BTreeSet;

#[derive(Debug, Clone)]
pub struct Deviation {
    pub surface: String,
    pub family: String,
    /// "missing" (reference has it, we don't) | "extra" (we have it, reference doesn't)
    /// | "differs" (scalar/sequence mismatch)
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
    /// Our surfaces absent from the reference (new surfaces of ours).
    pub untracked: Vec<String>,
    /// surface/family pairs skipped because the reference has no facts there.
    pub uncovered: Vec<String>,
    /// Declared improvements that no longer match any deviation.
    pub stale_improvements: Vec<Improvement>,
}

impl Outcome {
    pub fn violations(&self) -> Vec<&Deviation> {
        self.deviations.iter().filter(|d| d.covered_by.is_none()).collect()
    }
    pub fn pass(&self) -> bool {
        self.violations().is_empty()
    }
}

pub fn check(ours: &FactFile, reference: &FactFile, improvements: &[Improvement], _tol: &Tolerances) -> Outcome {
    let mut out = Outcome::default();
    let mut used: BTreeSet<usize> = BTreeSet::new();

    for (name, our_surface) in &ours.surfaces {
        let Some(ref_surface) = reference.surfaces.get(name) else {
            out.untracked.push(name.clone());
            continue;
        };
        // set families
        for (family, ref_list) in SET_FAMILIES.iter().zip(ref_surface.set_lists()) {
            if ref_list.is_empty() {
                let ours_list = our_surface.set_list(family).unwrap();
                if !ours_list.is_empty() {
                    out.uncovered.push(format!("{}:{}", name, family));
                }
                continue;
            }
            let theirs: BTreeSet<&String> = ref_list.iter().collect();
            let mine: BTreeSet<&String> = our_surface.set_list(family).unwrap().iter().collect();
            for fact in theirs.difference(&mine) {
                push_deviation(&mut out, improvements, &mut used, name, family, "missing", (*fact).clone());
            }
            for fact in mine.difference(&theirs) {
                push_deviation(&mut out, improvements, &mut used, name, family, "extra", (*fact).clone());
            }
        }
        // order: one whole-sequence fact ("a > b > c")
        if !ref_surface.order.is_empty() {
            let theirs = ref_surface.order.join(" > ");
            let mine = our_surface.order.join(" > ");
            if theirs != mine {
                push_deviation(&mut out, improvements, &mut used, name, "order", "differs", format!("reference [{}] vs ours [{}]", theirs, mine));
            }
        } else if !our_surface.order.is_empty() {
            out.uncovered.push(format!("{}:order", name));
        }
        // primitive: exact scalar
        if let Some(theirs) = &ref_surface.primitive {
            let mine = our_surface.primitive.clone().unwrap_or_default();
            if *theirs != mine {
                push_deviation(
                    &mut out,
                    improvements,
                    &mut used,
                    name,
                    "primitive",
                    "differs",
                    format!("reference '{}' vs ours '{}'", theirs, if mine.is_empty() { "(undeclared)" } else { &mine }),
                );
            }
        } else if our_surface.primitive.is_some() {
            out.uncovered.push(format!("{}:primitive", name));
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

fn push_deviation(
    out: &mut Outcome,
    improvements: &[Improvement],
    used: &mut BTreeSet<usize>,
    surface: &str,
    family: &str,
    kind: &'static str,
    fact: String,
) {
    let cov = improvements
        .iter()
        .position(|i| i.surface == surface && i.family == family && i.fact == fact);
    if let Some(i) = cov {
        used.insert(i);
    }
    out.deviations.push(Deviation {
        surface: surface.to_string(),
        family: family.to_string(),
        kind,
        fact,
        covered_by: cov.map(|i| improvements[i].reason.clone()),
    });
}
