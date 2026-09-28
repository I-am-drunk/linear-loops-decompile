// Hand-written drive-mode driver for useLoopTemplateLauncher.O9-_gagH.js
// export `r` (G22; original code) — chunk-local class `G`, the template-card
// presenter statics:
//   G.triggerLabel(template) — the card's trigger copy: schedule cadence
//     (Hourly/Daily/Weekly, unknown cadence throws the REAL
//     UnreachableCaseError) or issue event (`On new issue` / `On triage` /
//     `On issue change`), unknown trigger type throws.
//   G.iconColor(template, theme) — ColorConverter.toCss("RGB",
//     ColorConverter.fromCss(theme.color[template.color])): the REAL corpus
//     ColorConverter executes (its chunk is import-free), chaining provenance
//     to the H2 color-math goldens.
// Exports `n` (draft/conversation builders) and `t` (the launcher hook) are
// out of this golden's scope — every seam they need is a throw-on-use bomb.
export default async ({ entry }) => {
  const Presenter = entry.r;

  const label = (trigger) => Presenter.triggerLabel({ trigger });
  const threw = (fn) => {
    try { fn(); return null; } catch (e) { return { name: e.name, message: e.message, isError: e instanceof Error }; }
  };

  return {
    triggerLabel: {
      scheduleHourly: label({ type: `schedule`, cadence: `hourly` }),
      scheduleDaily: label({ type: `schedule`, cadence: `daily` }),
      scheduleWeekly: label({ type: `schedule`, cadence: `weekly` }),
      scheduleUnknownCadenceThrows: threw(() => label({ type: `schedule`, cadence: `fortnightly` })),
      issueCreated: label({ type: `issue`, event: `entityCreated` }),
      issueTriage: label({ type: `issue`, event: `entityInTriage` }),
      issueOtherEvent: label({ type: `issue`, event: `entityUpdated` }),
      unknownTypeThrows: threw(() => label({ type: `webhook` })),
    },
    iconColor: {
      // theme.color[template.color] — the REAL ColorConverter round-trips the
      // CSS color (hex and lch(), the two formats corpus themes carry; see
      // src/ui-theme/golden). Provenance chains to the H2 color-math goldens.
      fromHex: Presenter.iconColor({ color: `blue` }, { color: { blue: `#6771c5` } }),
      fromLch: Presenter.iconColor({ color: `red` }, { color: { red: `lch(52.607% 63.6 29)` } }),
      // fromCss returns [0,0,0] for a format outside its hex/lch/p3 grammar —
      // a real corpus fallback worth pinning (rgb() is not a theme format).
      unparseableFallsBackToBlack: Presenter.iconColor({ color: `x` }, { color: { x: `rgb(200, 50, 25)` } }),
    },
  };
};
