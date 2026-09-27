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
         \n\
         defaults: --corpus pipeline/corpus · --matrix docs/feature-matrix.md\n\
         \x20 --out .parity/reference.json · --facts src/ui/ui-facts.json\n\
         \x20 --ref .parity/reference.json · --report parity-report.md"
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
    canaries: Option<PathBuf>,
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
            canaries: None,
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
            "--canaries" => o.canaries = Some(PathBuf::from(take(&mut i)?)),
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
    let canaries = o.canaries.clone().or_else(|| {
        let p = PathBuf::from("tools/parity/policy/canaries.txt");
        p.exists().then_some(p)
    });
    match extract::run(&o.corpus, &o.matrix, &o.out, canaries.as_deref()) {
        Ok(stats) => {
            println!(
                "extract: {} surfaces · {} chunks · {} routes · {} copy · {} edges · {} tokens · {} order chains → {}",
                stats.surfaces,
                stats.chunks_read,
                stats.routes,
                stats.copy,
                stats.edges,
                stats.tokens,
                stats.order,
                o.out.display()
            );
            if let Some((passed, total)) = stats.canaries {
                println!("canaries: {}/{} pass", passed, total);
            }
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
    let tolerances_path = o.tolerances.clone().or_else(|| {
        let p = PathBuf::from("tools/parity/policy/tolerances.json");
        p.exists().then_some(p)
    });
    let improvements_path = o.improvements.clone().or_else(|| {
        let p = PathBuf::from("tools/parity/policy/improvements.json");
        p.exists().then_some(p)
    });
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
        "check: {} deviation(s) ({} covered by declared improvements) · {} not-built · {} stale improvements",
        outcome.deviations.len(),
        outcome.deviations.len() - violations.len(),
        outcome.not_built.len(),
        outcome.stale_improvements.len()
    );
    if outcome.pass() {
        println!("PASS");
        ExitCode::SUCCESS
    } else {
        println!("FAIL: {} undeclared deviation(s):", violations.len());
        for d in violations.iter().take(25) {
            println!("  [{}:{}:{}] {}", d.surface, d.family, d.kind, d.detail.as_deref().unwrap_or(&d.fact));
        }
        if violations.len() > 25 {
            println!("  … and {} more (see report)", violations.len() - 25);
        }
        ExitCode::from(1)
    }
}
