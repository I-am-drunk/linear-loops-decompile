/**
 * Loop-notification copy builders — clean reimplementation of the three
 * exported copy kernels from the corpus chunk `Issue.DRYymPCa.js` (pretty
 * L9848–9877; export map `yee as ub, bee as db, xee as fb`). Original code;
 * behavior is verified byte-for-byte against the committed corpus-executed
 * golden (`golden/notif-copy.grid.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * Research provenance (issue #295, settled 2×: the 14:41:10Z NOTIFICATIONS
 * leg + the 14:42:39Z LOOP NOTIFICATION leg, reconciled 14:45:25Z):
 *   - These builders are shared byte-identical by the inbox-row and
 *     standalone notification presenters — one golden family covers both.
 *   - The five-reason failure vocabulary (creditsExhausted, usageLimitReached,
 *     untrustedSource, skillUnavailable, error) is a SERVER contract: our
 *     engine's run-outcome events must emit exactly these reason keys or the
 *     copy collapses to the bare form.
 *   - Single-positive-reason rule: the reasoned message is used only when
 *     EXACTLY ONE reason has a positive count. Mixed buckets and zero-valued
 *     buckets collapse to the bare "Loop failed to run" form — never the max.
 *   - The "N times today" suffix is tz-sensitive: "today" means the stored
 *     bucketDate equals the current date in the stored bucketTimezone
 *     (spacetime). A missing bucketDate or bucketTimezone counts as today.
 *   - Fallback asymmetry: the response builder uses `||` (an empty-string
 *     message falls through to the awaitingApproval-aware default), while
 *     the user-message builder uses `??` (an empty string is preserved).
 *
 * Copy strings are transcription-rule DATA: preserved to the character,
 * including the U+2019 apostrophe in "isn’t".
 */

/** The failure-notification metadata shape the builder reads
 * (`metadata.agentAutomationFailure` — field-for-field our failure-aggregation
 * schema, 14:42:39Z leg §2). All fields optional at the call sites. */
export interface AgentAutomationFailureLike {
  failureCount?: number | undefined;
  reasons?: Record<string, number | undefined> | undefined;
  /** `yyyy-MM-dd` in `bucketTimezone`. */
  bucketDate?: string | undefined;
  /** IANA zone name the day bucket was recorded in. */
  bucketTimezone?: string | undefined;
}

export interface FailureCopyOptions {
  includeTrailingPeriod?: boolean | undefined;
}

/** The run-outcome metadata shape the response/user-message builders read
 * (`metadata.agentAutomationRun`). */
export interface AgentAutomationRunLike {
  message?: string | undefined;
  awaitingApproval?: boolean | undefined;
}

/** Current date as `yyyy-MM-dd` in an IANA zone. The corpus computes this
 * through its bundled spacetime (`Rt(new Date, tz).format('yyyy-MM-dd')`,
 * L9851); Intl's en-CA date pattern is the same `yyyy-MM-dd` projection of
 * the same IANA database. Behavioral equivalence is pinned by the golden's
 * live legs (UTC + America/Chicago), which execute the corpus's real
 * spacetime against a bucketDate computed through THIS formatter. */
const todayIn = (timeZone: string): string =>
  new Intl.DateTimeFormat(`en-CA`, {
    timeZone,
    year: `numeric`,
    month: `2-digit`,
    day: `2-digit`,
  }).format(new Date());

/**
 * Failure copy (`yee`, L9848): "Loop failed to run[ N times[ today]]
 * [because <reason>][.]" — the reasoned tail only for a single positive
 * reason; the count suffix only for failureCount > 1; "today" per the
 * day-bucket test above.
 */
export function buildFailureCopy(
  failure?: AgentAutomationFailureLike,
  options: FailureCopyOptions = {},
): string {
  const count = failure?.failureCount ?? 1;
  const period = options.includeTrailingPeriod ? `.` : ``;
  const isToday =
    !failure?.bucketDate ||
    !failure.bucketTimezone ||
    todayIn(failure.bucketTimezone) === failure.bucketDate;
  const times = count > 1 ? ` ${count} times${isToday ? ` today` : ``}` : ``;
  const positive = Object.entries(failure?.reasons ?? {}).filter(([, n]) => (n ?? 0) > 0);
  switch (positive.length === 1 ? positive[0]?.[0] : undefined) {
    case `creditsExhausted`:
      return `Loop failed to run${times} because the workspace is out of AI credits${period}`;
    case `usageLimitReached`:
      return `Loop failed to run${times} because a usage limit was reached${period}`;
    case `untrustedSource`:
      return `Loop failed to run${times} because the triggering issue source isn’t trusted${period}`;
    case `skillUnavailable`:
      return `Loop failed to run${times} because a referenced skill isn’t accessible within the configured team access${period}`;
    case `error`:
      return `Loop failed to run${times} because of an error${period}`;
    default:
      return `Loop failed to run${times}${period}`;
  }
}

/** Run-response copy (`bee`, L9871): the stored message, OR (`||` — empty
 * strings fall through) the awaitingApproval-aware default. */
export function buildResponseCopy(run?: AgentAutomationRunLike): string {
  const fallback = run?.awaitingApproval
    ? `Loop run needs your approval to continue.`
    : `Loop run finished with a response.`;
  return run?.message || fallback;
}

/** User-message copy (`xee`, L9876): the stored message, ?? the default —
 * an empty string is PRESERVED (the asymmetry vs buildResponseCopy). */
export function buildUserMessageCopy(run?: AgentAutomationRunLike): string {
  return run?.message ?? `Loop sent you a message.`;
}
