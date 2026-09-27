//! End-to-end CLI tests against a fixture mini-corpus.

use std::path::PathBuf;
use std::process::Command;

fn bin() -> Command {
    Command::new(env!("CARGO_BIN_EXE_parity"))
}

fn fixtures() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

/// Run `parity extract` against the fixture corpus into a temp dir; return
/// the reference path.
fn extract(tmp: &std::path::Path) -> PathBuf {
    let f = fixtures();
    let reference = tmp.join("reference.json");
    let out = bin()
        .arg("extract")
        .arg("--corpus").arg(f.join("corpus"))
        .arg("--matrix").arg(f.join("docs/feature-matrix.md"))
        .arg("--out").arg(&reference)
        .arg("--canaries").arg(f.join("policy/canaries.txt"))
        .output()
        .expect("run parity extract");
    assert!(
        out.status.success(),
        "extract failed: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let text = String::from_utf8(out.stdout).unwrap();
    assert!(text.contains("extract:"), "unexpected stdout: {}", text);
    assert!(text.contains("canaries: 3/3 pass"), "canary enforcement ran: {}", text);
    reference
}

#[test]
fn extract_produces_expected_reference_facts() {
    let tmp = std::env::temp_dir().join(format!("parity-test-extract-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);
    let text = std::fs::read_to_string(&reference).unwrap();

    // routes: loops routes kept, non-loops and fragment routes dropped
    assert!(text.contains("/:orgKey/loop/:loopId/runs"));
    assert!(
        text.contains("/:orgKey/loops/:viewType?"),
        "optional-param matcher route extracted (issue #177)"
    );
    assert!(text.contains("/:orgKey/loop/:loopId"));
    assert!(text.contains("app.routes"), "routes surface present");
    assert!(text.contains("theme.tokens"), "theme surface present");
    assert!(text.contains("bgBase"), "token names extracted");
    assert!(!text.contains("settings/account"), "non-loops route leaked");
    assert!(!text.contains("weekday"), "route fragment leaked");

    // copy: real UI strings kept, identifiers/paths/colors dropped
    assert!(text.contains("Create a new loop"));
    assert!(text.contains("Close modal dialog"));
    assert!(!text.contains("aria-label"), "attribute key leaked into copy");
    assert!(!text.contains("#5e6ad2"), "color literal leaked into copy");
    assert!(!text.contains("quick brown fox"), "all-lowercase prose leaked");

    // structure: component import edge kept, lowercase util import dropped
    assert!(text.contains("LoopTemplateLibrary"));
    assert!(!text.contains("util-helpers"), "non-component import leaked");

    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn check_passes_when_facts_match() {
    let tmp = std::env::temp_dir().join(format!("parity-test-pass-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);
    let out = bin()
        .arg("check")
        .arg("--facts").arg(fixtures().join("ours/ui-facts-clean.json"))
        .arg("--ref").arg(&reference)
        .arg("--report").arg(tmp.join("report.md"))
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(0), "stdout: {}", String::from_utf8_lossy(&out.stdout));
    let report = std::fs::read_to_string(tmp.join("report.md")).unwrap();
    assert!(report.contains("**PASS**"), "report: {}", report);
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn check_fails_on_undeclared_deviation_and_passes_with_improvement() {
    let tmp = std::env::temp_dir().join(format!("parity-test-fail-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);
    let diverged = fixtures().join("ours/ui-facts-diverged.json");

    // without improvements: FAIL — missing "Close modal dialog", extra
    // "Inference harness", and AutomationRunsPage absent is fine (not built).
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&diverged)
        .arg("--ref").arg(&reference)
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(1), "expected FAIL, stdout: {}", String::from_utf8_lossy(&out.stdout));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("Close modal dialog"), "missing-copy violation reported");
    assert!(stdout.contains("Inference harness"), "extra-copy violation reported");

    // with improvements declaring the extra: still FAIL on the missing copy…
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&diverged)
        .arg("--ref").arg(&reference)
        .arg("--improvements").arg(fixtures().join("improvements.json"))
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(1));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("Close modal dialog"));
    assert!(!stdout.contains("[AutomationNewDialog:copy:extra] Inference harness"), "declared extra must not be a violation");
    assert!(stdout.contains("0 stale improvements"), "used improvement must not be stale: {}", stdout);
    assert!(stdout.contains("theme.tokens"), "synthetic surface omission is a violation: {}", stdout);
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn ours_only_surface_is_a_violation_unless_declared() {
    let tmp = std::env::temp_dir().join(format!("parity-test-surface-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);
    let facts = fixtures().join("ours/ui-facts-extra-surface.json");

    // undeclared: FAIL (invented-surface hole is closed)
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&facts)
        .arg("--ref").arg(&reference)
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(1), "ours-only surface must fail: {}", String::from_utf8_lossy(&out.stdout));
    assert!(String::from_utf8_lossy(&out.stdout).contains("HarnessSettingsPage"));

    // declared via improvements (family "surface"): PASS
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&facts)
        .arg("--ref").arg(&reference)
        .arg("--improvements").arg(fixtures().join("improvements-surface.json"))
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(0), "declared surface must pass: {}", String::from_utf8_lossy(&out.stdout));
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn check_rejects_non_object_surface_value() {
    // A malformed fact file (`"app.routes": null`) must be a parse error,
    // never an empty Surface that slides through as uncovered (CR #171).
    let tmp = std::env::temp_dir().join(format!("parity-test-nonobj-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);
    let facts = tmp.join("ui-facts-nonobj.json");
    std::fs::write(&facts, r#"{ "surfaces": { "app.routes": null } }"#).unwrap();
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&facts)
        .arg("--ref").arg(&reference)
        .output()
        .expect("run parity check");
    assert_ne!(out.status.code(), Some(0), "malformed facts must not pass");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("must be an object"), "expected parse error, got: {}", stderr);
    let _ = std::fs::remove_dir_all(&tmp);
}
