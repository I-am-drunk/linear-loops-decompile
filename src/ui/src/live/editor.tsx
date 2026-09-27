/**
 * T-805 — live editor container: the T-702 loop editor over the T-1104
 * connect seam. loop-new starts a blank draft and publishes to a fresh id
 * (then navigates to loop-detail); loop-detail loads the loop via loops.get
 * and publishes edits through saveLoop (upsert→publish). Offline/no-server
 * renders the fixture demo on the same markers the pre-T-805 smoke asserts;
 * failures surface inline.
 *
 * Safety rules (CodeRabbit #112 pass):
 * - Under a LIVE source the fixture draft is never publishable: until the
 *   requested loop's record loads, the route shows a loading state (and on
 *   failure, a load error) instead of demo data with a live Publish button.
 * - A publish captures the submitted draft; the post-save reload updates
 *   baseline/version and only replaces the draft when nothing was typed
 *   after submission. A failed reload after a successful publish says so —
 *   it never reports the write itself as failed.
 * - Source selection retries after a failed initial connect, so a
 *   transient failure doesn't pin the mounted editor to demo mode.
 *
 * v1 boundaries (deliberately small, revisited after T-1103):
 * - No loops.delete on the wire (METHOD_SCOPES) — the danger zone is a
 *   no-op that says so; delete is a post-T-1103 contract addition.
 * - Pick-lists (teams/projects/trusted sources) stay fixture — the server
 *   has no directory endpoint yet (contract.ts's ownerName note).
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { LoopConfig } from "../../../model/index.ts";
import { defaultLoopConfig } from "../../../model/index.ts";
import { LoopEditorPage } from "../features/loops/editor/LoopEditorPage.tsx";
import { LoopEditorStyles } from "../features/loops/editor/styles.tsx";
import {
  demoEditorConfig,
  demoProjects,
  demoTeams,
  demoTrustedSources,
} from "../features/loops/editor/fixtures.ts";
import { navigate } from "../useHashRoute.ts";
import { getSharedClient } from "./client.ts";
import { FixtureLoopsSource, selectSources } from "./sources.ts";
import type { LoopsSource } from "./sources.ts";

export interface EditorContainerProps {
  /** The route's loop id; null in the new-loop flow. */
  readonly loopId: string | null;
  /** Test seam: inject a source directly (skips the shared-client swap). */
  readonly source?: LoopsSource | undefined;
}

/** Retry cadence after a failed initial connect (the client itself retries
 *  an established socket; this covers the initial failure only). */
const SOURCE_RETRY_MS = 5_000;

/** Fixture first, swapping to the live loops source once the client opens;
 *  retries while an initial connect keeps failing. */
function useLoopsSource(injected: LoopsSource | undefined): LoopsSource {
  const [source, setSource] = useState<LoopsSource>(injected ?? new FixtureLoopsSource());
  const [retryTick, setRetryTick] = useState(0);
  useEffect(() => {
    if (injected !== undefined) {
      setSource(injected);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = getSharedClient();
    if (pending === null) return;
    pending
      .then((client) => {
        if (!cancelled) setSource(selectSources(client).loops);
      })
      .catch(() => {
        // Initial connect failed — the helper cleared the singleton, so a
        // retry resolves a fresh client; keep the fixtures meanwhile.
        if (!cancelled) timer = setTimeout(() => setRetryTick((t) => t + 1), SOURCE_RETRY_MS);
      });
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [injected, retryTick]);
  return source;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function EditorContainer(props: EditorContainerProps): JSX.Element {
  const isNew = props.loopId === null;
  const source = useLoopsSource(props.source);
  const [draft, setDraft] = useState<LoopConfig>(() => (isNew ? defaultLoopConfig() : demoEditorConfig));
  const [baseline, setBaseline] = useState<LoopConfig>(() => (isNew ? defaultLoopConfig() : demoEditorConfig));
  const [version, setVersion] = useState<number | undefined>(isNew ? undefined : 3);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState<string | undefined>(undefined);
  /** The loop id whose record the draft currently mirrors (fixture demo
   *  counts — a fixture publish is refused with the demo note). */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  // Load the loop into the draft. The fixture source resolves immediately
  // (same demo record — an identity set); the live source reloads when it
  // arrives. New-loop flow has nothing to load.
  useEffect(() => {
    const loopId = props.loopId;
    if (loopId === null) return;
    let cancelled = false;
    setLoadError(undefined);
    source
      .getLoop(loopId)
      .then((rec) => {
        if (cancelled) return;
        setDraft(rec.config);
        setBaseline(rec.config);
        setVersion(rec.version);
        setLoadedFor(loopId);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadedFor(null);
          setLoadError(message(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, props.loopId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const onPublish = (): void => {
    const submitted = draft;
    setPublishing(true);
    setNote(undefined);
    source
      .saveLoop(props.loopId, submitted)
      .then(async (id) => {
        if (props.loopId === null) {
          // Created — open the detail route (its container loads the row).
          navigate({ name: "loop-detail", loopId: id });
          return;
        }
        // The write succeeded even if the reload below fails.
        setBaseline(submitted);
        try {
          const rec = await source.getLoop(props.loopId);
          setBaseline(rec.config);
          setVersion(rec.version);
          // Preserve anything typed after the publish click.
          setDraft((current) => (current === submitted ? rec.config : current));
        } catch (err) {
          setNote(`Published — but reloading the loop failed: ${message(err)}`);
        }
      })
      .catch((err: unknown) => {
        setNote(`Publish failed: ${message(err)}`);
      })
      .finally(() => {
        setPublishing(false);
      });
  };

  const onDelete = (): void =>
    setNote("Delete isn't on the wire yet (v1) — tracked for the post-T-1103 contract pass.");

  // Under a live source an existing loop shows NO demo editor: the fixture
  // draft must never be publishable over a real loop (CodeRabbit #112).
  if (!isNew && source.kind === "live" && loadedFor !== props.loopId) {
    return (
      <>
        <LoopEditorStyles />
        {loadError !== undefined ? (
          <p role="alert">{`Couldn't load the loop: ${loadError}`}</p>
        ) : (
          <p role="status">{`Loading loop ${props.loopId}…`}</p>
        )}
      </>
    );
  }

  return (
    <>
      <LoopEditorStyles />
      {note !== undefined ? (
        <p role="alert" className="live-editor-note">
          {note}
        </p>
      ) : null}
      <LoopEditorPage
        draft={draft}
        onChange={setDraft}
        onPublish={onPublish}
        onDelete={onDelete}
        teams={demoTeams}
        projects={demoProjects}
        trustedSources={demoTrustedSources}
        dirty={dirty}
        publishing={publishing}
        publishedVersion={version}
      />
    </>
  );
}
