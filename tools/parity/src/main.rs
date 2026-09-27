//! parity — the UI parity harness CLI (SPECS/ui-parity.md).
//!
//!   parity extract [--corpus pipeline/corpus] [--matrix docs/feature-matrix.md]
//!                  [--out .parity/reference.json]
//!   parity check   [--facts src/ui/ui-facts.json] [--ref .parity/reference.json]
//!                  [--tolerances tools/parity/policy/tolerances.json]
//!                  [--improvements tools/parity/policy/improvements.json]
//!                  [--report parity-report.md]
//!
//! Exit codes: 0 pass · 1 parity violations · 2 usage/tooling error.

mod compare;
mod extract;
mod json;
mod model;
mod report;

use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = args.first() else {
        usage();
        return ExitCode::from(2);
    };
    match cmd.as_str() {
        "extract" => cmd_extract(&args[1..]),
        "check" => cmd_check(&args[1..]),
        "--help" | "-h" | "help" => {
            usage();
            ExitCode::SUCCESS
        }
        other => {
            eprintln!("unknown command: {}", other);
            usage();
            ExitCode::from(2)
        }
    }
}

fn usage() {
    eprintln!(
        "parity — compute that our Loops UI matches Linear's compiled client\n\
         \n\
         usage:\n\
         \x20 parity extract [--corpus DIR] [--matrix FILE] [--out FILE]\n\
         \x20 parity check   [--facts FILE] [--ref FILE] [--tolerances FILE]\n\
         \x20                 [--improvements FILE] [--report FILE]\n\
         \n\
         extract: corpus → reference facts (gitignored output)\n\
         check:   our facts vs reference; exit 1 on undeclared deviation\n\
         \x20        (incl. ours-only surfaces undeclared in improvements.json)\n\
         \n\
         defaults: --corpus pipeline/corpus · --matrix docs/feature-matrix.md\n\
         \x20 --out .parity/reference.json · --facts src/ui/ui-facts.json\n\
         \x20 --ref .parity/reference.json · --report parity-report.md\n\
         \x20 --tolerances tools/parity/policy/tolerances.json\n\
         \x20 --improvements tools/parity/policy/improvements.json (committed policy)"
    );
}

struct Opts {
    corpus: PathBuf,
    matrix: PathBuf,
    out: PathBuf,
    facts: PathBuf,
    reference: PathBuf,
    tolerances: Option<PathBuf>,
    improvements: Option<PathBuf>,
    report: Option<PathBuf>,
}

impl Default for Opts {
    fn default() -> Self {
        Opts {
            corpus: "pipeline/corpus".into(),
            matrix: "docs/feature-matrix.md".into(),
            out: ".parity/reference.json".into(),
            facts: "src/ui/ui-facts.json".into(),
            reference: ".parity/reference.json".into(),
            tolerances: None,
            improvements: None,
            report: None,
        }
    }
}

fn parse_opts(args: &[String]) -> Result<Opts, String> {
    let mut o = Opts::default();
    let mut i = 0;
    while i < args.len() {
        let (flag, inline_val) = match args[i].split_once('=') {
            Some((f, v)) => (f.to_string(), Some(v.to_string())),
            None => (args[i].clone(), None),
        };
        let take = |i: &mut usize| -> Result<String, String> {
            if let Some(v) = &inline_val {
                return Ok(v.clone());
            }
            *i += 1;
            args.get(*i).cloned().ok_or_else(|| format!("{} needs a value", flag))
        };
        match flag.as_str() {
            "--corpus" => o.corpus = PathBuf::from(take(&mut i)?),
            "--matrix" => o.matrix = PathBuf::from(take(&mut i)?),
            "--out" => o.out = PathBuf::from(take(&mut i)?),
            "--facts" => o.facts = PathBuf::from(take(&mut i)?),
            "--ref" => o.reference = PathBuf::from(take(&mut i)?),
            "--tolerances" => o.tolerances = Some(PathBuf::from(take(&mut i)?)),
            "--improvements" => o.improvements = Some(PathBuf::from(take(&mut i)?)),
            "--report" => o.report = Some(PathBuf::from(take(&mut i)?)),
            other => return Err(format!("unknown flag: {}", other)),
        }
        i += 1;
    }
    Ok(o)
}

fn cmd_extract(args: &[String]) -> ExitCode {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("error: {}", e);
            return ExitCode::from(2);
        }
    };
    match extract::run(&o.corpus, &o.matrix, &o.out) {
        Ok(stats) => {
            println!(
                "extract: {} surfaces · {} chunks · {} routes · {} copy · {} edges · {} tokens → {}",
                stats.surfaces,
                stats.chunks_read,
                stats.routes,
                stats.copy,
                stats.edges,
                stats.tokens,
                o.out.display()
            );
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("extract failed: {}", e);
            ExitCode::from(2)
        }
    }
}

fn cmd_check(args: &[String]) -> ExitCode {
    let o = match parse_opts(args) {
        Ok(o) => o,
        Err(e) => {
            eprintln!("error: {}", e);
            return ExitCode::from(2);
        }
    };
    let read = |p: &PathBuf, what: &str| -> Result<String, String> {
        std::fs::read_to_string(p).map_err(|e| format!("read {} ({}): {}", p.display(), what, e))
    };
    let ours = match read(&o.facts, "our facts; declare your slice's facts here").and_then(|t| model::parse_file(&t)) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("check failed: {}", e);
            return ExitCode::from(2);
        }
    };
    let reference = match read(&o.reference, "reference; run `parity extract` first").and_then(|t| model::parse_file(&t)) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("check failed: {}", e);
            return ExitCode::from(2);
        }
    };
    // Policy files: explicit flags win; otherwise the committed policy under
    // tools/parity/policy/ is REQUIRED (never silently empty — an unapplied
    // improvements list turns declared deviations into false reds).
    let policy_default = |flag: &str, p: &str| -> Result<PathBuf, ExitCode> {
        let pb = PathBuf::from(p);
        if pb.exists() {
            Ok(pb)
        } else {
            eprintln!(
                "check failed: committed policy file {} not found (run from the repo root, or pass {} explicitly)",
                p, flag
            );
            Err(ExitCode::from(2))
        }
    };
    let tolerances_path = match o.tolerances.clone() {
        Some(p) => Some(p),
        None => match policy_default("--tolerances", "tools/parity/policy/tolerances.json") {
            Ok(p) => Some(p),
            Err(c) => return c,
        },
    };
    let improvements_path = match o.improvements.clone() {
        Some(p) => Some(p),
        None => match policy_default("--improvements", "tools/parity/policy/improvements.json") {
            Ok(p) => Some(p),
            Err(c) => return c,
        },
    };
    println!(
        "policy: tolerances={} improvements={}",
        tolerances_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "(none)".into()),
        improvements_path.as_ref().map(|p| p.display().to_string()).unwrap_or_else(|| "(none)".into()),
    );
    let tolerances = match &tolerances_path {
        Some(p) => match read(p, "tolerances").and_then(|t| json::parse(&t)).and_then(|v| model::tolerances_from_value(&v)) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("check failed: {}", e);
                return ExitCode::from(2);
            }
        },
        None => model::Tolerances::default(),
    };
    let improvements = match &improvements_path {
        Some(p) => match read(p, "improvements").and_then(|t| json::parse(&t)).and_then(|v| model::improvements_from_value(&v)) {
            Ok(i) => i,
            Err(e) => {
                eprintln!("check failed: {}", e);
                return ExitCode::from(2);
            }
        },
        None => Vec::new(),
    };

    let outcome = compare::check(&ours, &reference, &improvements, &tolerances);
    let md = report::render(&outcome);
    if let Some(p) = &o.report {
        if let Err(e) = std::fs::write(p, &md) {
            eprintln!("check: could not write report {}: {}", p.display(), e);
            return ExitCode::from(2);
        }
    }

    let violations = outcome.violations();
    println!(
        "check: {} deviation(s) ({} covered by declared improvements) · {} untracked (undeclared new surfaces) · {} declared-new · {} not-built · {} stale improvements",
        outcome.deviations.len(),
        outcome.deviations.len() - violations.len(),
        outcome.untracked.len(),
        outcome.declared_new.len(),
        outcome.not_built.len(),
        outcome.stale_improvements.len()
    );
    if violations.is_empty() && outcome.untracked.is_empty() {
        println!("PASS");
        ExitCode::SUCCESS
    } else {
        if !violations.is_empty() {
            println!("FAIL: {} undeclared deviation(s):", violations.len());
            for d in violations.iter().take(25) {
                println!("  [{}:{}:{}] {}", d.surface, d.family, d.kind, d.fact);
            }
            if violations.len() > 25 {
                println!("  … and {} more (see report)", violations.len() - 25);
            }
        }
        if !outcome.untracked.is_empty() {
            println!("FAIL: {} ours-only surface(s) with no reference and no declaration:", outcome.untracked.len());
            for s in outcome.untracked.iter().take(25) {
                println!("  {} — invented-UI guard: declare it in tools/parity/policy/improvements.json (family \"surface\") with reason + issue", s);
            }
        }
        ExitCode::from(1)
    }
}
