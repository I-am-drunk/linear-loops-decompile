// Hand-written stub for PullRequestsFeatureHelper.woc0KNxh.js (G7; original
// code). The entry chunk imports `{t as e}` and calls exactly ONE member:
// e.areReviewsEnabledForUser(user). The real chunk cannot execute in the
// sandbox (its transitive closure — types.7f0h45Sh.js, ClientStorage — reads
// `window` at module scope), so the helper is stubbed at the entry's import
// seam. The pinned body is NOT invented: it is the helper's own raw source,
// verified by hand in PullRequestsFeatureHelper.woc0KNxh.js (`var ce=class e{
// static areReviewsEnabledForUser(e){return e.settings.showReviewsInbox}…`,
// exported `ce as t`): the method reads only user.settings.showReviewsInbox.
// Any OTHER member read throws loudly, so the golden can never silently rely
// on unpinned helper behavior.
export const t = new Proxy(
  { areReviewsEnabledForUser: (user) => user.settings.showReviewsInbox },
  {
    get(target, key) {
      if (key in target || typeof key === `symbol`) return target[key];
      throw new Error(`G7 stub: unpinned PullRequestsFeatureHelper member read: ${String(key)} — verify it against the raw helper source and extend the stub`);
    },
  },
);
