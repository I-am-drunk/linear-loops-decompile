/**
 * canOpenAgentSessionInReview — clean reimplementation of the corpus chunk
 * `canOpenAgentSessionInReview.BbTwURTH.js` (matrix §E "PR integration" row;
 * the guard deciding whether an agent session's latest pull request opens in
 * the review UI). Original code; the behavior is verified byte-for-byte
 * against the committed corpus-executed golden
 * (`golden/can-open-review.branches.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * Corpus source (the chunk's only export, `export{t}`), reproduced exactly:
 *   1. no `latestPullRequest` → false, and the store is never read
 *      (the corpus reads `t.store.user` only AFTER the early return);
 *   2. reviews disabled for the store user → false, and `userCan` is never
 *      consulted (the corpus ternary evaluates `areReviewsEnabledForUser`
 *      first). The helper call `PullRequestsFeatureHelper
 *      .areReviewsEnabledForUser(user)` reads exactly
 *      `user.settings.showReviewsInbox` (hand-verified in the raw helper
 *      chunk `PullRequestsFeatureHelper.woc0KNxh.js`), inlined here — this
 *      module has no helper class to delegate to, and the golden's
 *      reviews-disabled fixture pins the equivalence;
 *   3. otherwise delegate to `latestPullRequest.userCan(user, "review")` with
 *      the SAME user object read from `store.user` and the literal permission
 *      string `review` (both pinned by the golden's argument-identity probe).
 */

export interface ReviewUserSettings {
  showReviewsInbox: boolean;
}

export interface ReviewUser {
  settings: ReviewUserSettings;
}

export interface ReviewablePullRequest {
  userCan(user: ReviewUser, permission: string): boolean;
}

export interface AgentSessionLike {
  latestPullRequest: ReviewablePullRequest | null | undefined;
  store: { user: ReviewUser };
}

export function canOpenAgentSessionInReview(session: AgentSessionLike): boolean {
  const latestPullRequest = session.latestPullRequest;
  if (!latestPullRequest) return false;
  const user = session.store.user;
  return user.settings.showReviewsInbox ? latestPullRequest.userCan(user, `review`) : false;
}
