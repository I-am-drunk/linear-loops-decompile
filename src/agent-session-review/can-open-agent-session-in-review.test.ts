/**
 * Golden test (the G0 acceptance bar): our clean guard, driven through the
 * SAME fixtures the committed drive-mode driver used
 * (golden/can-open-review-driver.mjs, mirrored line-for-line) and projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the declared observation driver), must
 * byte-match the committed corpus-executed golden.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { canOpenAgentSessionInReview, type ReviewUser } from "./can-open-agent-session-in-review.ts";

const goldenPath = join(import.meta.dirname, `golden`, `can-open-review.branches.expected.json`);
const golden = JSON.parse(readFileSync(goldenPath, `utf8`)) as {
  provenance: { serializer: string };
  output: unknown;
};

/** The same branch fixtures the corpus-side driver applies. */
function surface(): unknown {
  const user = (showReviewsInbox: boolean): ReviewUser => ({ settings: { showReviewsInbox } });

  const noPr = canOpenAgentSessionInReview({
    latestPullRequest: null,
    get store(): { user: ReviewUser } {
      throw new Error(`branch violation: store read on the no-PR path`);
    },
  });

  const reviewsDisabled = canOpenAgentSessionInReview({
    latestPullRequest: { userCan(): boolean { throw new Error(`branch violation: userCan consulted while reviews are disabled`); } },
    store: { user: user(false) },
  });

  const allowedUser = user(true);
  let received: { sameUserObject: boolean; permission: string } | null = null;
  const grantedPr = {
    userCan(u: ReviewUser, permission: string): boolean {
      received = { sameUserObject: u === allowedUser, permission };
      return true;
    },
  };
  const allowedAndGranted = canOpenAgentSessionInReview({ latestPullRequest: grantedPr, store: { user: allowedUser } });

  const enabledButDenied = canOpenAgentSessionInReview({
    latestPullRequest: { userCan: () => false },
    store: { user: user(true) },
  });

  return { noPr, reviewsDisabled, allowedAndGranted, enabledButDenied, userCanReceived: received };
}

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean guard byte-matches the corpus-executed golden (branch fixtures)`, () => {
  const ours = serialize(surface());
  assert.equal(
    `${JSON.stringify(ours, null, 2)}\n`,
    `${JSON.stringify(golden.output, null, 2)}\n`,
  );
});
