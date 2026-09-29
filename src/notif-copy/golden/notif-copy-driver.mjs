// Hand-written drive-mode driver for Issue.DRYymPCa.js (NOTIF-COPY claim,
// #225 2026-09-29 20:38:02Z; original code). Drives the three loop-notification
// copy-builder exports (pretty L9848–9877):
//   ub (local yee) — failure copy: five-reason vocabulary, single-positive-
//                    reason collapse, tz-sensitive "N times today" bucketing.
//   db (local bee) — run-response copy: awaitingApproval fork, `||` fallback
//                    (an empty-string message falls through to the default).
//   fb (local xee) — user-message copy: `??` fallback (an empty string is
//                    preserved).
//
// DETERMINISM (the #295 input posted with the claim): yee's "today" test reads
// the wall clock — `Rt(new Date, e.bucketTimezone).format('yyyy-MM-dd') ===
// e.bucketDate` (L9851). Fixtures are chosen so the BRANCH is invariant across
// runs, so the recorded OUTPUT bytes never depend on when the golden runs:
//   - `i = true` invariantly: bucketDate absent, bucketTimezone absent (both
//     short-circuit), or the live leg where bucketDate is computed AT DRIVE
//     TIME as today-in-tz (en-CA Intl date format IS yyyy-MM-dd). The fixture
//     varies per run; the output string is byte-stable.
//   - `i = false` invariantly: a fixed past bucketDate (2000-01-02) that can
//     never equal today again.
// The live leg uses UTC (no tz-database drift between Intl and the corpus's
// bundled spacetime) plus one named zone (America/Chicago) documenting that
// the two databases agree on "today".
const todayIn = (timeZone) =>
  new Intl.DateTimeFormat(`en-CA`, { timeZone, year: `numeric`, month: `2-digit`, day: `2-digit` })
    .format(new Date);

export default async ({ entry }) => {
  const failureCopy = entry.ub;
  const responseCopy = entry.db;
  const userMessageCopy = entry.fb;

  const reasons = [`creditsExhausted`, `usageLimitReached`, `untrustedSource`, `skillUnavailable`, `error`];

  const failure = {};
  // The five single-reason messages, count 1, no period (the bare lattice).
  for (const r of reasons) failure[`single:${r}`] = failureCopy({ reasons: { [r]: 1 } });
  // Reason-collapse pins: no reasons; empty reasons; a zero-valued reason
  // (filtered out); a MIXED positive bucket (collapses to the BARE form, not
  // the max — the 14:45:25Z reconciliation's single-positive-reason rule).
  failure[`noReasons`] = failureCopy({});
  failure[`undefinedInput`] = failureCopy(undefined);
  failure[`zeroValuedReason`] = failureCopy({ reasons: { error: 0 } });
  failure[`mixedReasons`] = failureCopy({ reasons: { creditsExhausted: 2, error: 1 } });
  // Trailing-period option.
  failure[`singleWithPeriod`] = failureCopy({ reasons: { error: 1 } }, { includeTrailingPeriod: true });
  // Count suffix forks: today-leg via the two short-circuits…
  failure[`count3:noBucketDate`] = failureCopy({ failureCount: 3, reasons: { error: 1 }, bucketTimezone: `UTC` });
  failure[`count3:noBucketTimezone`] = failureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: `2000-01-02` });
  // …and via the live legs (bucketDate computed at drive time = today).
  failure[`count3:todayUTC`] = failureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: todayIn(`UTC`), bucketTimezone: `UTC` });
  failure[`count3:todayChicago`] = failureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: todayIn(`America/Chicago`), bucketTimezone: `America/Chicago` });
  // Stale-bucket leg: fixed past date, real tz — never "today" again.
  failure[`count3:staleBucket`] = failureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: `2000-01-02`, bucketTimezone: `UTC` });
  // Count 1 never gets the suffix even with a live today bucket.
  failure[`count1:todayUTC`] = failureCopy({ failureCount: 1, reasons: { error: 1 }, bucketDate: todayIn(`UTC`), bucketTimezone: `UTC` });
  // Count + mixed reasons + period: suffix and period compose with the bare form.
  failure[`count2:staleMixedPeriod`] = failureCopy(
    { failureCount: 2, reasons: { creditsExhausted: 1, error: 1 }, bucketDate: `2000-01-02`, bucketTimezone: `UTC` },
    { includeTrailingPeriod: true },
  );

  const response = {
    plainMessage: responseCopy({ message: `Here is the summary you asked for.` }),
    defaultNoApproval: responseCopy({}),
    defaultAwaitingApproval: responseCopy({ awaitingApproval: true }),
    undefinedInput: responseCopy(undefined),
    // The `||` probe: an EMPTY message falls through to the approval-aware default.
    emptyMessageAwaitingApproval: responseCopy({ message: ``, awaitingApproval: true }),
    emptyMessageNoApproval: responseCopy({ message: `` }),
  };

  const userMessage = {
    plainMessage: userMessageCopy({ message: `Ping from your loop.` }),
    defaultMissing: userMessageCopy({}),
    undefinedInput: userMessageCopy(undefined),
    // The `??` probe: an EMPTY message is PRESERVED (unlike db's `||`).
    emptyMessage: userMessageCopy({ message: `` }),
  };

  return { failure, response, userMessage };
};
