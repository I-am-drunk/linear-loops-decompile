// Hand-written drive-mode driver for canOpenAgentSessionInReview.BbTwURTH.js
// (G7; original code). The chunk's only export (`export{t}`) is the guard
//   t(session) — true iff the agent session's latest pull request can be
//   opened in the review UI by the store user.
// Corpus source, verified by hand (three branches):
//   let n = t.latestPullRequest; if (!n) return !1;
//   let r = t.store.user;
//   return e.areReviewsEnabledForUser(r) ? n.userCan(r, `review`) : !1
// The driver pins each branch with plain-object fixtures, plus the two
// behavioral guarantees a boolean alone would not pin:
//   - the no-PR early return never touches `session.store` (a throwing getter
//     proves it: reaching it would crash the run);
//   - the reviews-disabled branch never consults `userCan` (a throwing
//     function proves it);
//   - the allowed branch passes the SAME user object from `store.user` and
//     the literal permission string `review` to `userCan` (recorded).
export default async ({ entry }) => {
  const canOpen = entry.t;

  const user = (showReviewsInbox) => ({ settings: { showReviewsInbox } });

  // 1. No latest PR: early false. `store` throws if touched.
  const noPr = canOpen({
    latestPullRequest: null,
    get store() { throw new Error(`branch violation: store read on the no-PR path`); },
  });

  // 2. Reviews disabled for the store user: false. `userCan` throws if consulted.
  const reviewsDisabled = canOpen({
    latestPullRequest: { userCan() { throw new Error(`branch violation: userCan consulted while reviews are disabled`); } },
    store: { user: user(false) },
  });

  // 3. Reviews enabled and the PR grants review: delegates to userCan (true),
  //    recording the arguments the corpus code passed.
  const allowedUser = user(true);
  let received = null;
  const grantedPr = { userCan(u, permission) { received = { sameUserObject: u === allowedUser, permission }; return true; } };
  const allowedAndGranted = canOpen({ latestPullRequest: grantedPr, store: { user: allowedUser } });

  // 4. Reviews enabled but the PR denies review: userCan's false propagates.
  const enabledButDenied = canOpen({
    latestPullRequest: { userCan: () => false },
    store: { user: user(true) },
  });

  return { noPr, reviewsDisabled, allowedAndGranted, enabledButDenied, userCanReceived: received };
};
