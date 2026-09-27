/**
 * T-805 — live editor container: the T-702 loop editor over the T-1104
 * connect seam. loop-new starts a blank draft and publishes to a fresh id
 * (then navigates to loop-detail); loop-detail loads the loop via loops.get
 * and publishes edits through saveLoop (upsert→publish). Offline/no-server
 * renders the same fixture demo as the pre-T-805 registry — first paint is
 * byte-identical; a failed or demo-mode publish surfaces inline.
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

/** Fixture first, swapping to the live loops source once the client opens. */
function useLoopsSource(injected: LoopsSource | undefined): LoopsSource {
  const [source, setSource] = useState<LoopsSource>(injected ?? new FixtureLoopsSource());
  useEffect(() => {
    if (injected !== undefined) {
      setSource(injected);
      return;
    }
    const pending = getSharedClient();
    if (pending === null) return;
    let cancelled = false;
    pending
      .then((client) => {
        if (!cancelled) setSource(selectSources(client).loops);
      })
      .catch(() => {
        // Connect failed — stay on fixtures; the client retries on its own.
      });
    return () => {
      cancelled = true;
    };
  }, [injected]);
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

  // Load the loop into the draft. Runs for the fixture source too (its
  // getLoop returns the same demo record — an identity set), and again when
  // the live source arrives mid-visit (the live swap reloads, like #94's
  // list containers). New-loop flow has nothing to load.
  useEffect(() => {
    if (isNew) return;
    const loopId = props.loopId;
    if (loopId === null) return;
    let cancelled = false;
    source
      .getLoop(loopId)
      .then((rec) => {
        if (cancelled) return;
        setDraft(rec.config);
        setBaseline(rec.config);
        setVersion(rec.version);
      })
      .catch((err: unknown) => {
        if (!cancelled) setNote(`Couldn't load the loop: ${message(err)} — editing demo data.`);
      });
    return () => {
      cancelled = true;
    };
  }, [source, isNew, props.loopId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  const onPublish = (): void => {
    setPublishing(true);
    setNote(undefined);
    source
      .saveLoop(props.loopId, draft)
      .then(async (id) => {
        if (props.loopId === null) {
          // Created — open the detail route (its container loads the row).
          navigate({ name: "loop-detail", loopId: id });
          return;
        }
        const rec = await source.getLoop(props.loopId);
        setBaseline(rec.config);
        setDraft(rec.config);
        setVersion(rec.version);
        setPublishing(false);
      })
      .catch((err: unknown) => {
        setPublishing(false);
        setNote(`Publish failed: ${message(err)}`);
      });
  };

  const onDelete = (): void =>
    setNote("Delete isn't on the wire yet (v1) — tracked for the post-T-1103 contract pass.");

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
