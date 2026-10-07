# UI parity and evidence

Current acceptance rules are in [UI-EXACTNESS](../docs/UI-EXACTNESS.md) and the
[surface roadmap](../docs/plan/surfaces.md). Exact Linear UI remains the target;
Cursor supplies the automation layout inside it.

Run `bash ci/check-src.sh`. Its declaration checks are mandatory in CI, but a
passing source gate does not prove visual or behavioral parity. Each surface
also needs versioned reference states, meaningful behavior checks and an actual
render comparison. Missing evidence remains UNVERIFIED.

The corpus and analysis tools remain local reference tools. Do not treat a
skipped corpus check as verification, or replace source review with a citation
count. See [the pipeline](../pipeline/README.md) for current acquisition.

The [earlier harness design](../archive/2026-09-era/specs/ui-parity.md) records
past experiments and tool history; it is not the current delivery plan.
