//! Markdown report — the PR evidence artifact.

use crate::compare::Outcome;

pub fn render(out: &Outcome) -> String {
    let mut s = String::new();
    let violations = out.violations();
    s.push_str("# parity check\n\n");
    if violations.is_empty() && out.untracked.is_empty() {
        s.push_str("**PASS** — every compared fact matches the reference within the declared tolerances and improvements.\n\n");
    } else {
        let mut parts = Vec::new();
        if !violations.is_empty() {
            parts.push(format!("{} undeclared deviation(s)", violations.len()));
        }
        if !out.untracked.is_empty() {
            parts.push(format!("{} undeclared ours-only surface(s)", out.untracked.len()));
        }
        s.push_str(&format!("**FAIL** — {}.\n\n", parts.join(", ")));
    }

    if !violations.is_empty() {
        s.push_str("## Violations (undeclared deviations)\n\n");
        s.push_str("| Surface | Family | Kind | Fact |\n|---|---|---|---|\n");
        for d in &violations {
            s.push_str(&format!("| {} | {} | {} | {} |\n", d.surface, d.family, d.kind, escape(&d.fact)));
        }
        s.push_str("\nFix the slice to match the reference, or — only for a deliberate,\nreviewed improvement — declare it in `tools/parity/policy/improvements.json`.\n\n");
    }

    let covered: Vec<_> = out.deviations.iter().filter(|d| d.covered_by.is_some()).collect();
    if !covered.is_empty() {
        s.push_str("## Declared improvements applied\n\n");
        s.push_str("| Surface | Family | Kind | Fact | Reason |\n|---|---|---|---|---|\n");
        for d in covered {
            s.push_str(&format!(
                "| {} | {} | {} | {} | {} |\n",
                d.surface, d.family, d.kind, escape(&d.fact),
                escape(d.covered_by.as_deref().unwrap_or(""))
            ));
        }
        s.push('\n');
    }

    if !out.stale_improvements.is_empty() {
        s.push_str("## Stale improvements (self-cleaning)\n\nThese declared improvements no longer match any deviation — remove them:\n\n");
        for i in &out.stale_improvements {
            s.push_str(&format!("- `{}` / {} / `{}` ({})\n", i.surface, i.family, escape(&i.fact), escape(&i.reason)));
        }
        s.push('\n');
    }

    if !out.untracked.is_empty() {
        s.push_str("## Undeclared ours-only surfaces (FAIL — the invented-UI guard)\n\nThese surfaces exist on our side with no corpus reference and no declaration.\nDeclare a deliberate addition in `tools/parity/policy/improvements.json` as\n`{ \"surface\": \"<Name>\", \"family\": \"surface\", \"fact\": \"<Name>\", \"reason\": …, \"issue\": … }`:\n\n");
        for n in &out.untracked {
            s.push_str(&format!("- {}\n", n));
        }
        s.push('\n');
    }
    if !out.declared_new.is_empty() {
        s.push_str("## Declared new surfaces (ours by design, reviewed)\n\n");
        for (n, reason) in &out.declared_new {
            s.push_str(&format!("- {} — {}\n", n, escape(reason)));
        }
        s.push('\n');
    }
    if !out.not_built.is_empty() {
        s.push_str("## Reference surfaces not yet built\n\n");
        for n in &out.not_built {
            s.push_str(&format!("- {}\n", n));
        }
        s.push('\n');
    }
    s
}

fn escape(s: &str) -> String {
    s.replace('|', "\\|").replace('\n', " ")
}
