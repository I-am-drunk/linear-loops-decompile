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
    assert!(text.contains("canaries: 4/4 pass"), "canary enforcement ran: {}", text);
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

    // order (H3 #207): orderingKey chain extracted in source order; the
    // identifier-suffixed decoy (activeOrderingKey) and the shorter key/name
    // chain do not displace it (longest chain wins)
    assert!(
        text.contains(r#""name",
        "started",
        "duration"
      ]"#),
        "order chain extracted: {}",
        text
    );
    assert!(!text.contains("decoy"), "activeOrderingKey decoy leaked into order");

    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn order_mismatch_is_a_violation_and_order_canary_fails_loudly() {
    let tmp = std::env::temp_dir().join(format!("parity-test-order-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let reference = extract(&tmp);

    // ours declares the same items in the WRONG order: containment would
    // pass, the order family must fail (the family's reason to exist)
    let facts = tmp.join("ui-facts-wrong-order.json");
    let clean = std::fs::read_to_string(fixtures().join("ours/ui-facts-clean.json")).unwrap();
    let wrong = clean.replace(
        "\"name\",\n        \"started\",",
        "\"started\",\n        \"name\",",
    );
    assert_ne!(clean, wrong, "fixture replace must hit");
    std::fs::write(&facts, wrong).unwrap();
    let out = bin()
        .arg("check")
        .arg("--facts").arg(&facts)
        .arg("--ref").arg(&reference)
        .output()
        .expect("run parity check");
    assert_eq!(out.status.code(), Some(1), "wrong order must fail: {}", String::from_utf8_lossy(&out.stdout));
    let stdout = String::from_utf8_lossy(&out.stdout);
    assert!(stdout.contains("name > started > duration"), "reference chain named: {}", stdout);

    // an order canary that does not match the extracted chain fails extract
    let bad_canaries = tmp.join("canaries-bad-order.txt");
    std::fs::write(&bad_canaries, "order:AutomationRunsPage=name > duration > started\n").unwrap();
    let out = bin()
        .arg("extract")
        .arg("--corpus").arg(fixtures().join("corpus"))
        .arg("--matrix").arg(fixtures().join("docs/feature-matrix.md"))
        .arg("--out").arg(tmp.join("ref2.json"))
        .arg("--canaries").arg(&bad_canaries)
        .output()
        .expect("run parity extract");
    assert!(!out.status.success(), "mismatched order canary must fail extract");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("order canary"), "loud order-canary failure: {}", stderr);

    // a canary for a surface with NO extracted chain also fails
    let none_canaries = tmp.join("canaries-no-chain.txt");
    std::fs::write(&none_canaries, "order:AutomationNewDialog=a > b\n").unwrap();
    let out = bin()
        .arg("extract")
        .arg("--corpus").arg(fixtures().join("corpus"))
        .arg("--matrix").arg(fixtures().join("docs/feature-matrix.md"))
        .arg("--out").arg(tmp.join("ref3.json"))
        .arg("--canaries").arg(&none_canaries)
        .output()
        .expect("run parity extract");
    assert!(!out.status.success(), "no-chain order canary must fail extract");
    assert!(String::from_utf8_lossy(&out.stderr).contains("extracted NO chain"));

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

/// Copy the fixture corpus into tmp so a test can perturb it.
fn copy_corpus(tmp: &std::path::Path) -> PathBuf {
    let src = fixtures().join("corpus");
    let dst = tmp.join("corpus");
    std::fs::create_dir_all(dst.join("analysis")).unwrap();
    std::fs::create_dir_all(dst.join("pretty/client")).unwrap();
    for sub in ["analysis", "pretty/client"] {
        for entry in std::fs::read_dir(src.join(sub)).unwrap() {
            let entry = entry.unwrap();
            std::fs::copy(entry.path(), dst.join(sub).join(entry.file_name())).unwrap();
        }
    }
    dst
}

fn extract_on(corpus: &std::path::Path, matrix: &std::path::Path, out: &std::path::Path) -> std::process::Output {
    bin()
        .arg("extract")
        .arg("--corpus").arg(corpus)
        .arg("--matrix").arg(matrix)
        .arg("--out").arg(out)
        .arg("--canaries").arg(fixtures().join("policy/canaries.txt"))
        .output()
        .expect("run parity extract")
}

#[test]
fn extract_fails_loudly_on_partial_corpus() {
    // chunks.json names a chunk that pretty/client does not carry → a partial
    // or stale corpus copy. Extract must FAIL, never emit a silent partial
    // reference (#162 INFRA ALERT, #205).
    let tmp = std::env::temp_dir().join(format!("parity-test-integrity-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let corpus = copy_corpus(&tmp);
    std::fs::write(
        corpus.join("analysis/chunks.json"),
        r#"[
  { "file": "AutomationNewDialog.Wu-wKkiY.js", "bytes": 100, "components": [] },
  { "file": "AutomationRunsPage.CwJzxL5C.js", "bytes": 100, "components": [] },
  { "file": "ThemeProvider.BNrg3wTr.js", "bytes": 100, "components": [] },
  { "file": "LoopsManagementPage.BAhf8Ti3.js", "bytes": 100, "components": [] }
]"#,
    )
    .unwrap();
    let out = extract_on(&corpus, &fixtures().join("docs/feature-matrix.md"), &tmp.join("reference.json"));
    assert_ne!(out.status.code(), Some(0), "partial corpus must fail extract");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("corpus integrity"), "names the failure: {}", stderr);
    assert!(stderr.contains("1/4"), "counts the shortfall: {}", stderr);
    assert!(stderr.contains("LoopsManagementPage.BAhf8Ti3.js"), "names the missing chunk: {}", stderr);
    assert!(!tmp.join("reference.json").exists(), "no reference written on integrity failure");

    // a COMPLETE chunks.json passes (same corpus, inventory matching disk)
    std::fs::write(
        corpus.join("analysis/chunks.json"),
        r#"[
  { "file": "AutomationNewDialog.Wu-wKkiY.js", "bytes": 100, "components": [] },
  { "file": "AutomationRunsPage.CwJzxL5C.js", "bytes": 100, "components": [] },
  { "file": "ThemeProvider.BNrg3wTr.js", "bytes": 100, "components": [] }
]"#,
    )
    .unwrap();
    let out = extract_on(&corpus, &fixtures().join("docs/feature-matrix.md"), &tmp.join("reference.json"));
    assert!(out.status.success(), "complete inventory passes: {}", String::from_utf8_lossy(&out.stderr));
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn extract_fails_loudly_on_unmatched_matrix_surface() {
    // A matrix component with zero matching chunks must FAIL extract (the
    // reference used to silently omit it; every check then passed vacuously —
    // #205). Also pins the matrix-parser fixes: a `.md` token and a
    // parenthesized op-shorthand token must NOT become phantom surfaces.
    let tmp = std::env::temp_dir().join(format!("parity-test-unmatched-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let matrix = tmp.join("feature-matrix.md");
    std::fs::write(
        &matrix,
        "# fixture matrix — see `KNOWLEDGE.md`\n\n\
         | Feature | Corpus evidence | Status |\n|---|---|---|\n\
         | New-loop dialog | `AutomationNewDialog.Wu-wKkiY.js` | corpus |\n\
         | Runs page | `AutomationRunsPage.CwJzxL5C.js` | corpus |\n\
         | Trusted sources | ops `AutomationTrustedSources(WithUsage)` | corpus |\n\
         | Gone page | `RemovedInThisRelease.Cabc1234.js` | corpus |\n",
    )
    .unwrap();
    let out = extract_on(&fixtures().join("corpus"), &matrix, &tmp.join("reference.json"));
    assert_ne!(out.status.code(), Some(0), "unmatched surface must fail extract");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("zero matching chunks"), "names the failure: {}", stderr);
    assert!(stderr.contains("RemovedInThisRelease"), "names the surface: {}", stderr);
    assert!(!stderr.contains("KNOWLEDGE"), "a .md token is not a surface: {}", stderr);
    assert!(!stderr.contains("AutomationTrustedSources"), "op shorthand is not a surface: {}", stderr);

    // without the stale row, the same matrix extracts clean
    std::fs::write(
        &matrix,
        "# fixture matrix — see `KNOWLEDGE.md`\n\n\
         | Feature | Corpus evidence | Status |\n|---|---|---|\n\
         | New-loop dialog | `AutomationNewDialog.Wu-wKkiY.js` | corpus |\n\
         | Runs page | `AutomationRunsPage.CwJzxL5C.js` | corpus |\n\
         | Trusted sources | ops `AutomationTrustedSources(WithUsage)` | corpus |\n",
    )
    .unwrap();
    let out = extract_on(&fixtures().join("corpus"), &matrix, &tmp.join("reference.json"));
    assert!(out.status.success(), "clean matrix passes: {}", String::from_utf8_lossy(&out.stderr));
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn extract_rejects_malformed_inventory_entry() {
    // A chunks.json record without a string `file` is a broken inventory,
    // not a skippable row: skipping could hide a missing chunk the matrix
    // does not name and write an incomplete reference (CodeRabbit #210).
    let tmp = std::env::temp_dir().join(format!("parity-test-badinv-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let corpus = copy_corpus(&tmp);
    std::fs::write(
        corpus.join("analysis/chunks.json"),
        r#"[
  { "file": "AutomationNewDialog.Wu-wKkiY.js", "bytes": 100, "components": [] },
  { "bytes": 100, "components": [] },
  { "file": "AutomationRunsPage.CwJzxL5C.js", "bytes": 100, "components": [] },
  { "file": "ThemeProvider.BNrg3wTr.js", "bytes": 100, "components": [] }
]"#,
    )
    .unwrap();
    let out = extract_on(&corpus, &fixtures().join("docs/feature-matrix.md"), &tmp.join("reference.json"));
    assert_ne!(out.status.code(), Some(0), "malformed inventory must fail extract");
    let stderr = String::from_utf8_lossy(&out.stderr);
    assert!(stderr.contains("malformed inventory entry"), "names the failure: {}", stderr);
    assert!(!tmp.join("reference.json").exists(), "no reference written");
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn matrix_js_substring_token_is_not_a_surface() {
    // `.js` must be a SUFFIX to make a token a chunk pattern: a token like
    // `Component.js.md` in an alternate --matrix must not create a phantom
    // surface that then fails the unmatched guard (CodeRabbit #210).
    let tmp = std::env::temp_dir().join(format!("parity-test-jsmid-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    std::fs::create_dir_all(&tmp).unwrap();
    let matrix = tmp.join("feature-matrix.md");
    std::fs::write(
        &matrix,
        "# alt matrix — notes in `Component.js.md`\n\n\
         | Feature | Corpus evidence | Status |\n|---|---|---|\n\
         | New-loop dialog | `AutomationNewDialog.Wu-wKkiY.js` | corpus |\n\
         | Runs page | `AutomationRunsPage.CwJzxL5C.js` | corpus |\n",
    )
    .unwrap();
    let out = extract_on(&fixtures().join("corpus"), &matrix, &tmp.join("reference.json"));
    assert!(
        out.status.success(),
        "mid-token .js must not become a surface: {}",
        String::from_utf8_lossy(&out.stderr)
    );
    let _ = std::fs::remove_dir_all(&tmp);
}
