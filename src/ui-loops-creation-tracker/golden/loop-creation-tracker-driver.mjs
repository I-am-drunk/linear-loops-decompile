// Hand-written drive-mode driver (G8; original code). Walks the corpus
// LoopCreationTracker class (entry export `t`) through its full lifecycle
// with a PINNED clock: the class reads ambient Date.now() in start()
// (startedAt), track() (elapsedMs), and readEntries() (the 7-day expiry
// filter `startedAt > Date.now() - 6048e5`). The driver replaces Date.now
// for the run's duration and restores it; every timestamp below is a declared
// constant, so the golden is ambient-invariant by construction (#225 ambient
// policy: pin at the seam, never normalize after the fact).
//
// The user fixture is an input, not a stub: the corpus reaches analytics as
// `this.user.store.analytics?.track(...)` and storage keys as
// `loopTemplateSetups:${user.id}`. The fixture records every track() call;
// the recorded events ARE the observed behavior (analytics payload shapes:
// setupId/creationPath/templateKey/entryPoint/sourceScope/draftId/elapsedMs).
// Storage traffic is recorded by the ClientStorage stub (see its header).
const T0 = 1_700_000_000_000; // pinned epoch: 2023-11-14T22:13:20.000Z

export default async ({ entry, load }) => {
  const Tracker = entry.t;
  const storageStub = await load(`ClientStorage`);

  const events = [];
  const makeUser = (id) => ({
    id,
    store: { analytics: { track: (name, props) => events.push({ name, props }) } },
  });

  const realNow = Date.now;
  let now = T0;
  Date.now = () => now;
  try {
    const user = makeUser(`user-1`);

    // 1. scratchEntryPoint — the static normalizer, all three branches.
    const scratchEntryPoint = {
      templateLibrary: Tracker.scratchEntryPoint(`template-library`),
      templateModal: Tracker.scratchEntryPoint(`template-modal`),
      other: Tracker.scratchEntryPoint(`sidebar-button`),
    };

    // 2. Full happy path: start -> attachDraft -> started -> converted.
    //    converted() twice proves the idempotence guard (no second event).
    const a = Tracker.start(user, {
      template: { key: `triage-rotation` },
      creationPath: `template`,
      entryPoint: `template-library`,
      sourceScope: `team`,
    });
    now = T0 + 1_000;
    a.attachDraft(`draft-a`);
    now = T0 + 2_500;
    a.started(`conv-1`);
    now = T0 + 10_000;
    a.converted(`wfd-1`);
    a.converted(`wfd-1-again`);

    // 3. Failure + abandonment path, template-less (trackTemplate must gate
    //    every `Loop Template *` event off; abandoned() after converted-less
    //    failure still fires exactly once).
    const b = Tracker.start(user, {
      creationPath: `scratch`,
      entryPoint: `create-form`,
      sourceScope: `workspace`,
    });
    now = T0 + 12_000;
    b.attachDraft(`draft-b`);
    b.failed(`setup`, `network`);
    now = T0 + 15_000;
    b.abandoned(`closed-dialog`);
    b.abandoned(`closed-dialog-again`);

    // 3b. Template-bearing failure + abandonment: the `Loop Template Setup
    //     Failed` (stage/reason) and `Loop Template Setup Abandoned` (reason)
    //     payloads are observable only with a templateKey; abandoned() twice
    //     proves its idempotence guard.
    const d = Tracker.start(user, {
      template: { key: `bug-triage` },
      creationPath: `template`,
      entryPoint: `template-modal`,
      sourceScope: `workspace`,
    });
    now = T0 + 16_000;
    d.attachDraft(`draft-d`);
    d.failed(`setup`, `network`);
    now = T0 + 18_000;
    d.abandoned(`closed-dialog`);
    d.abandoned(`closed-dialog-again`);

    // 4. forDraft: resolves the unconverted entry from storage, returns
    //    undefined for a converted one and for an unknown draft.
    const forDraftB = Tracker.forDraft(user, { id: `draft-b` });
    const forDraft = {
      unconvertedFound: forDraftB !== undefined,
      refoundEntryDraftId: forDraftB?.entry?.draftId,
      convertedIsUndefined: Tracker.forDraft(user, { id: `draft-a` }) === undefined,
      unknownIsUndefined: Tracker.forDraft(user, { id: `draft-zzz` }) === undefined,
      noDraftIsUndefined: Tracker.forDraft(user, undefined) === undefined,
    };

    // 5. The 7-day expiry filter: advance the clock past 6048e5 ms; the
    //    stale entries vanish from readEntries (observed via forDraft) while
    //    a fresh tracker's save keeps only itself.
    now = T0 + 6048e5 + 20_000; // 7 days + a hair past every startedAt above
    const expiry = {
      staleGoneAfterSevenDays: Tracker.forDraft(user, { id: `draft-b` }) === undefined,
    };
    const c = Tracker.start(user, {
      template: { key: `standup-summary` },
      creationPath: `template`,
      entryPoint: `template-modal`,
      sourceScope: `team`,
    });
    c.attachDraft(`draft-c`);
    expiry.freshSurvives = Tracker.forDraft(user, { id: `draft-c` }) !== undefined;

    // 6. The 100-entry cap with sort-by-startedAt: 105 saved entries on a
    //    separate user; the cap keeps the 100 NEWEST (descending startedAt),
    //    so the 5 oldest drafts are evicted.
    const capEvents = [];
    const capUser = { id: `user-cap`, store: { analytics: { track: (name, props) => capEvents.push(name) } } };
    const capBase = now;
    for (let i = 0; i < 105; i++) {
      now = capBase + i * 1_000;
      const t = Tracker.start(capUser, { creationPath: `scratch`, entryPoint: `create-form`, sourceScope: `team` });
      t.attachDraft(`cap-draft-${i}`);
    }
    now = capBase + 200_000;
    const cap = {
      oldestEvicted: Tracker.forDraft(capUser, { id: `cap-draft-0` }) === undefined,
      fifthEvicted: Tracker.forDraft(capUser, { id: `cap-draft-4` }) === undefined,
      sixthKept: Tracker.forDraft(capUser, { id: `cap-draft-5` }) !== undefined,
      newestKept: Tracker.forDraft(capUser, { id: `cap-draft-104` }) !== undefined,
    };
    // 105 identical template-less start() events carry no extra information:
    // project them to a count + the single distinct name (declared projection).
    const capEventSummary = { count: capEvents.length, distinctNames: [...new Set(capEvents)] };

    // Project the user-1 storage traffic: the LAST write is the durable
    // persisted shape (full history of writes is large and repetitive; the
    // driver declares this projection, the write COUNT pins the cadence).
    const userWrites = storageStub.writes.filter((w) => w.key === `loopTemplateSetups:user-1`);

    return {
      scratchEntryPoint,
      events,
      forDraft,
      expiry,
      cap,
      capEventSummary,
      storage: {
        user1WriteCount: userWrites.length,
        user1LastWrite: userWrites.at(-1),
        capUserWriteCount: storageStub.writes.filter((w) => w.key === `loopTemplateSetups:user-cap`).length,
      },
    };
  } finally {
    Date.now = realNow;
  }
};
