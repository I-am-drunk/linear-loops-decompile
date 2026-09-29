/**
 * LoopCreationTracker — clean reimplementation of the corpus chunk
 * `LoopCreationTracker.BAiVgMLN.js` export `t` (matrix §A "AI-assisted loop
 * compose" row). Original code; the behavior is verified byte-for-byte
 * against the committed corpus-executed golden
 * (`golden/loop-creation-tracker.lifecycle.expected.json`) — see
 * `corpus-manifest.json` and the golden test, which replays the exact driver
 * lifecycle against this class.
 *
 * Corpus behavior reproduced exactly:
 * - static start(user, opts): new entry {setupId: uuid(), templateKey:
 *   opts.template?.key, creationPath, entryPoint, sourceScope, startedAt:
 *   Date.now()}; fires `Loop Creation Started` then trackTemplate
 *   `Loop Template Selected`.
 * - static scratchEntryPoint(e): `template-library`/`template-modal` pass
 *   through; anything else -> `create-form`.
 * - static forDraft(user, draft): entry for draft.id, only when present and
 *   not converted.
 * - attachDraft(id) sets entry.draftId and saves; started/failed are
 *   trackTemplate-only events; converted/abandoned are guarded once (and
 *   abandoned also refuses after converted), save before tracking.
 * - track() payload: {setupId, creationPath: entry.creationPath ?? `template`,
 *   templateKey, entryPoint, sourceScope, draftId, elapsedMs:
 *   Date.now() - startedAt, ...extra} via user.store.analytics?.track.
 * - trackTemplate fires only when entry.templateKey is set.
 * - save(): no-op without draftId; else writes the full entry map under
 *   `loopTemplateSetups:${user.id}`, sorted by startedAt DESCENDING and
 *   capped to the 100 newest.
 * - readEntries(): drops entries with startedAt <= Date.now() - 6048e5
 *   (the 7-day window).
 *
 * The storage and uuid seams are constructor-injected here (the corpus binds
 * them by import; injection is the clean module's boundary — the golden test
 * injects the same recording fakes the corpus case's declared stubs used, so
 * the byte oracle covers the seam traffic too). Strip-only TS: no parameter
 * properties, explicit field assignments (AGENTS.md).
 */

/**
 * Optional fields are `string | undefined`, not merely absent: the corpus
 * start() writes every key (some as undefined), and the tagged-v2 grammar
 * distinguishes a present-undefined key from a missing one — the golden's
 * event payloads carry `templateKey: undefined` as bytes.
 */
export interface LoopCreationEntry {
  setupId: string;
  templateKey?: string | undefined;
  creationPath?: string | undefined;
  entryPoint?: string | undefined;
  sourceScope?: string | undefined;
  startedAt: number;
  draftId?: string | undefined;
  converted?: boolean | undefined;
  abandoned?: boolean | undefined;
}

export interface TrackerUser {
  id: string;
  store: { analytics?: { track: (event: string, props: Record<string, unknown>) => void } };
}

export interface TrackerStorage {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => boolean;
}

export interface StartOptions {
  template?: { key: string };
  creationPath?: string;
  entryPoint?: string;
  sourceScope?: string;
}

const STORAGE_KEY = `loopTemplateSetups`;
const MAX_ENTRIES = 100;
const MAX_AGE_MS = 6048e5; // 7 days, the corpus literal

/** The injected seams (corpus: ClientStorage + uuid-v4 imports). */
export interface TrackerDeps {
  storage: TrackerStorage;
  uuid: () => string;
  now: () => number;
}

export class LoopCreationTracker {
  user: TrackerUser;
  entry: LoopCreationEntry;
  deps: TrackerDeps;

  constructor(user: TrackerUser, entry: LoopCreationEntry, deps: TrackerDeps) {
    this.user = user;
    this.entry = entry;
    this.deps = deps;
  }

  static start(user: TrackerUser, opts: StartOptions, deps: TrackerDeps): LoopCreationTracker {
    const tracker = new LoopCreationTracker(user, {
      setupId: deps.uuid(),
      templateKey: opts.template?.key,
      creationPath: opts.creationPath,
      entryPoint: opts.entryPoint,
      sourceScope: opts.sourceScope,
      startedAt: deps.now(),
    }, deps);
    tracker.track(`Loop Creation Started`);
    tracker.trackTemplate(`Loop Template Selected`);
    return tracker;
  }

  static scratchEntryPoint(entryPoint: string): string {
    return entryPoint === `template-library` || entryPoint === `template-modal` ? entryPoint : `create-form`;
  }

  static forDraft(user: TrackerUser, draft: { id: string } | undefined, deps: TrackerDeps): LoopCreationTracker | undefined {
    if (!draft) return;
    const entry = LoopCreationTracker.readEntries(user, deps)[draft.id];
    return entry && !entry.converted ? new LoopCreationTracker(user, entry, deps) : undefined;
  }

  attachDraft(draftId: string): void {
    this.entry.draftId = draftId;
    this.save();
  }

  started(conversationId: string): void {
    this.trackTemplate(`Loop Template Setup Started`, { conversationId });
  }

  failed(stage: string, reason: string): void {
    this.trackTemplate(`Loop Template Setup Failed`, { stage, reason });
  }

  converted(workflowDefinitionId: string): void {
    if (this.entry.converted) return;
    this.entry.converted = true;
    this.save();
    this.track(`Loop Created`, { workflowDefinitionId });
    this.trackTemplate(`Loop Template Converted`, { workflowDefinitionId });
  }

  abandoned(reason: string): void {
    if (this.entry.converted || this.entry.abandoned) return;
    this.entry.abandoned = true;
    this.save();
    this.trackTemplate(`Loop Template Setup Abandoned`, { reason });
  }

  trackTemplate(event: string, extra: Record<string, unknown> = {}): void {
    if (this.entry.templateKey) this.track(event, extra);
  }

  track(event: string, extra: Record<string, unknown> = {}): void {
    const { setupId, templateKey, entryPoint, sourceScope, draftId, startedAt } = this.entry;
    this.user.store.analytics?.track(event, {
      setupId,
      creationPath: this.entry.creationPath ?? `template`,
      templateKey,
      entryPoint,
      sourceScope,
      draftId,
      elapsedMs: this.deps.now() - startedAt,
      ...extra,
    });
  }

  save(): void {
    if (!this.entry.draftId) return;
    const merged: Record<string, LoopCreationEntry> = {
      ...LoopCreationTracker.readEntries(this.user, this.deps),
      [this.entry.draftId]: this.entry,
    };
    this.deps.storage.set(
      `${STORAGE_KEY}:${this.user.id}`,
      Object.fromEntries(Object.entries(merged).sort(([, a], [, b]) => b.startedAt - a.startedAt).slice(0, MAX_ENTRIES)),
    );
  }

  static readEntries(user: TrackerUser, deps: TrackerDeps): Record<string, LoopCreationEntry> {
    const raw = (deps.storage.get(`${STORAGE_KEY}:${user.id}`) ?? {}) as Record<string, LoopCreationEntry>;
    return Object.fromEntries(Object.entries(raw).filter(([, e]) => e.startedAt > deps.now() - MAX_AGE_MS));
  }
}
