/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts), must byte-match the
 * committed corpus-executed golden. Fixtures mirror the golden driver
 * (golden/notif-copy-driver.mjs) line-for-line, including the drive-time
 * "today" computation — the golden's determinism rests on branch-invariant
 * fixtures, not a frozen clock (see the driver's determinism note and the
 * #295 input posted with the claim).
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import {
  buildFailureCopy,
  buildResponseCopy,
  buildUserMessageCopy,
  type AgentAutomationFailureLike,
} from "./notif-copy.ts";

const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `notif-copy.grid.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: unknown };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

const todayIn = (timeZone: string): string => {
  // Assembled from formatToParts, mirroring the module and the driver
  // (PR #304 review thread).
  const parts = new Intl.DateTimeFormat(`en-CA`, {
    timeZone,
    year: `numeric`,
    month: `2-digit`,
    day: `2-digit`,
  }).formatToParts(new Date());
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? ``;
  return `${part(`year`)}-${part(`month`)}-${part(`day`)}`;
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (failure/response/user-message grids)`, () => {
  const failure: Record<string, string> = {};
  const reasons = [`creditsExhausted`, `usageLimitReached`, `untrustedSource`, `skillUnavailable`, `error`];
  for (const r of reasons) failure[`single:${r}`] = buildFailureCopy({ reasons: { [r]: 1 } });
  failure[`noReasons`] = buildFailureCopy({});
  failure[`undefinedInput`] = buildFailureCopy(undefined);
  failure[`zeroValuedReason`] = buildFailureCopy({ reasons: { error: 0 } });
  failure[`mixedReasons`] = buildFailureCopy({ reasons: { creditsExhausted: 2, error: 1 } });
  failure[`singleWithPeriod`] = buildFailureCopy({ reasons: { error: 1 } }, { includeTrailingPeriod: true });
  failure[`count3:noBucketDate`] = buildFailureCopy({ failureCount: 3, reasons: { error: 1 }, bucketTimezone: `UTC` });
  failure[`count3:noBucketTimezone`] = buildFailureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: `2000-01-02` });
  failure[`count3:todayUTC`] = buildFailureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: todayIn(`UTC`), bucketTimezone: `UTC` });
  failure[`count3:todayChicago`] = buildFailureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: todayIn(`America/Chicago`), bucketTimezone: `America/Chicago` });
  failure[`count3:staleBucket`] = buildFailureCopy({ failureCount: 3, reasons: { error: 1 }, bucketDate: `2000-01-02`, bucketTimezone: `UTC` });
  failure[`count1:todayUTC`] = buildFailureCopy({ failureCount: 1, reasons: { error: 1 }, bucketDate: todayIn(`UTC`), bucketTimezone: `UTC` });
  failure[`count2:staleMixedPeriod`] = buildFailureCopy(
    { failureCount: 2, reasons: { creditsExhausted: 1, error: 1 }, bucketDate: `2000-01-02`, bucketTimezone: `UTC` },
    { includeTrailingPeriod: true },
  );

  const response = {
    plainMessage: buildResponseCopy({ message: `Here is the summary you asked for.` }),
    defaultNoApproval: buildResponseCopy({}),
    defaultAwaitingApproval: buildResponseCopy({ awaitingApproval: true }),
    undefinedInput: buildResponseCopy(undefined),
    emptyMessageAwaitingApproval: buildResponseCopy({ message: ``, awaitingApproval: true }),
    emptyMessageNoApproval: buildResponseCopy({ message: `` }),
  };

  const userMessage = {
    plainMessage: buildUserMessageCopy({ message: `Ping from your loop.` }),
    defaultMissing: buildUserMessageCopy({}),
    undefinedInput: buildUserMessageCopy(undefined),
    emptyMessage: buildUserMessageCopy({ message: `` }),
  };

  const ours = serialize({ failure, response, userMessage });
  assert.equal(bytes(ours), bytes(golden.output));
});

test(`single-positive-reason collapse: mixed and zero-valued buckets go BARE, never the max`, () => {
  assert.equal(buildFailureCopy({ reasons: { creditsExhausted: 5, error: 1 } }), `Loop failed to run`);
  assert.equal(buildFailureCopy({ reasons: { error: 0 } }), `Loop failed to run`);
  // A single positive reason next to zero-valued ones still counts as single.
  assert.equal(
    buildFailureCopy({ reasons: { creditsExhausted: 0, error: 2 } }),
    `Loop failed to run because of an error`,
  );
});

test(`the "today" suffix is a day-bucket test, not a recency test`, () => {
  const base: AgentAutomationFailureLike = { failureCount: 2, reasons: { error: 1 } };
  // Missing bucket fields count as today.
  assert.equal(buildFailureCopy({ ...base }), `Loop failed to run 2 times today because of an error`);
  // A fixed past bucket drops only the word "today", never the count.
  assert.equal(
    buildFailureCopy({ ...base, bucketDate: `2000-01-02`, bucketTimezone: `UTC` }),
    `Loop failed to run 2 times because of an error`,
  );
});

test(`fallback asymmetry: response || swallows empty strings, user-message ?? preserves them`, () => {
  assert.equal(buildResponseCopy({ message: ``, awaitingApproval: true }), `Loop run needs your approval to continue.`);
  assert.equal(buildUserMessageCopy({ message: `` }), ``);
});

test(`the five reason strings are exact, including the U+2019 apostrophes`, () => {
  assert.equal(
    buildFailureCopy({ reasons: { untrustedSource: 1 } }),
    `Loop failed to run because the triggering issue source isn\u2019t trusted`,
  );
  assert.equal(
    buildFailureCopy({ reasons: { skillUnavailable: 1 } }),
    `Loop failed to run because a referenced skill isn\u2019t accessible within the configured team access`,
  );
});
