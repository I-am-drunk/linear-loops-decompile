/**
 * T-1104 — live containers for the loops pages. They own every effect
 * (load, poll, subscribe, intents) and feed the presentational pages
 * (T-701/T-703) plain props — the pages themselves are untouched.
 *
 * Demo fallback: with no configured server (or an unreachable one) the
 * containers render the same fixtures the registry used pre-T-1104, so the
 * UI is always openable and every existing smoke keeps passing. A one-line
 * note marks demo vs live.
 *
 * Protocol notes (v1):
 * - The wire has no "runs.created" broadcast, so the runs LIST polls while
 *   live (POLL_MS). runs.subscribe covers the detail page fully.
 * - runs.get carries no stream seq, so the detail page loads first and
 *   subscribes after; an event firing in that gap is missed until the next
 *   visit (a partAppended would risk rendering twice). runs.get returning
 *   lastSeq is the documented T-1103 protocol fix.
 * - FollowUpBox mapping (settled copy, hub #21 00:14:52Z): awaitingInput →
 *   runs.steer (the v1 channel has no runs.respond — steer IS the answer
 *   channel, src/connect/channel.ts RuntimeCommands); pending/waiting/active
 *   → runs.steer; complete/error/canceled → runs.continue.
 */
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { Run } from "../../../runtime/types.ts";
import { navigate } from "../useHashRoute.ts";
import { LoopsListPage } from "../features/loops/LoopsListPage.tsx";
import type { LoopSummary } from "../features/loops/types.ts";
import { demoLoops } from "../features/loops/fixtures.ts";
import { RunsListPage } from "../features/loops/runs/RunsListPage.tsx";
import { RunDetailPage } from "../features/loops/runs/RunDetailPage.tsx";
import type { RunDetail, RunSummary } from "../features/loops/runs/types.ts";
import { demoRunDetail, demoRuns } from "../features/loops/runs/fixtures.ts";
import { getSharedSource } from "./source.ts";
import type { LiveSource } from "./source.ts";
import {
  applyRunEventToDetail,
  applyRunEventToSummary,
  loopsViewOf,
  narrowStreamEvent,
  runDetailOf,
  runSummaryOf,
} from "./mappers.ts";
/** Runs-list refresh cadence while live (see header note). */
const POLL_MS = 5_000;

/** Containers resolve the shared client unless a test injects a source. */
type SourceProp = { readonly source?: LiveSource | null | undefined };

interface ViewState<T> {
  readonly kind: "demo" | "live";
  readonly data: T;
  readonly note?: string | undefined;
}

const DEMO_NOTE = "Demo data — connect a server (Settings → Environment) for live loops.";

/** Small status line above the page content. */
export function LiveNote(props: { readonly live: boolean; readonly text: string }): JSX.Element {
  return (
    <div className={`live-note${props.live ? " live-note-on" : ""}`} role="status">
      {props.text}
    </div>
  );
}

// ---- loops list ----------------------------------------------------------

export function LoopsListLive(props: SourceProp): JSX.Element {
  const [state, setState] = useState<ViewState<readonly LoopSummary[]>>({ kind: "demo", data: demoLoops });

  useEffect(() => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    if (source === null) return; // demo
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const [loopsRes, runsRes] = await Promise.all([source.listLoops(), source.listRuns({})]);
        if (cancelled) return;
        setState({ kind: "live", data: loopsViewOf(loopsRes.loops, runsRes.runs as Run[], new Date()) });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          kind: "demo",
          data: s.data,
          note: `Server unreachable (${err instanceof Error ? err.message : String(err)}) — showing demo data.`,
        }));
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.source]);

  const onToggle = (id: string, enabled: boolean): void => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    if (source === null) return; // demo: server-authoritative, no local flip
    source
      .setLoopEnabled(id, enabled)
      .then(async () => {
        const [loopsRes, runsRes] = await Promise.all([source.listLoops(), source.listRuns({})]);
        setState({ kind: "live", data: loopsViewOf(loopsRes.loops, runsRes.runs as Run[], new Date()) });
      })
      .catch((err: unknown) => {
        setState((s) => ({
          ...s,
          note: `Toggle failed: ${err instanceof Error ? err.message : String(err)}`,
        }));
      });
  };

  return (
    <>
      <LiveNote live={state.kind === "live"} text={state.kind === "live" ? "Live" : (state.note ?? DEMO_NOTE)} />
      <LoopsListPage
        loops={state.data}
        // v1: the harness-configured gate rides settings.get (R6/T-1103
        // shape unsettled) — same as the pre-live fixture registry, we show
        // the list. Tracked on the T-1104 claim issue.
        inferenceConfigured={true}
        onToggle={onToggle}
        onOpen={(id) => navigate({ name: "loop-detail", loopId: id })}
        onNewLoop={() => navigate({ name: "loop-new" })}
        onOpenInferenceSettings={() => navigate({ name: "settings-inference" })}
      />
    </>
  );
}

// ---- runs list -----------------------------------------------------------

export interface RunsListLiveProps extends SourceProp {
  /** Route param: a loop id, or "all" for the aggregate view. */
  readonly loopId: string;
}

export function RunsListLive(props: RunsListLiveProps): JSX.Element {
  const [state, setState] = useState<ViewState<readonly RunSummary[]>>({ kind: "demo", data: demoRuns });

  useEffect(() => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    if (source === null) return; // demo
    let cancelled = false;
    const params = props.loopId === "all" ? {} : { loopId: props.loopId };
    const load = async (): Promise<void> => {
      try {
        const [loopsRes, runsRes] = await Promise.all([source.listLoops(), source.listRuns(params)]);
        if (cancelled) return;
        const names = new Map(loopsRes.loops.map((l) => [l.id, l.name]));
        const now = new Date();
        setState({
          kind: "live",
          data: (runsRes.runs as Run[]).map((r) => runSummaryOf(r, names.get(r.loopId), now)),
        });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          kind: "demo",
          data: s.data,
          note: `Server unreachable (${err instanceof Error ? err.message : String(err)}) — showing demo data.`,
        }));
      }
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.source, props.loopId]);

  return (
    <>
      <LiveNote live={state.kind === "live"} text={state.kind === "live" ? "Live" : (state.note ?? DEMO_NOTE)} />
      <RunsListPage
        runs={state.data}
        onOpenRun={(loopId, runId) => navigate({ name: "run-detail", loopId, runId })}
      />
    </>
  );
}

// ---- run detail ----------------------------------------------------------

export interface RunDetailLiveProps extends SourceProp {
  readonly loopId: string;
  readonly runId: string;
}

export function RunDetailLive(props: RunDetailLiveProps): JSX.Element {
  const [state, setState] = useState<ViewState<RunDetail>>({ kind: "demo", data: demoRunDetail });

  useEffect(() => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    if (source === null) return; // demo
    let cancelled = false;
    const { runId } = props;

    const foldEvent = (raw: Record<string, unknown> & { type: string }): void => {
      const event = narrowStreamEvent(raw);
      if (event === null) return;
      setState((s) =>
        s.kind === "live" ? { ...s, data: applyRunEventToDetail(s.data, event) } : s,
      );
    };

    const load = async (): Promise<void> => {
      try {
        const [loopsRes, detailRes] = await Promise.all([source.listLoops(), source.getRun(runId)]);
        if (cancelled) return;
        const loopName = loopsRes.loops.find((l) => l.id === detailRes.run.loopId)?.name;
        setState({
          kind: "live",
          data: runDetailOf(detailRes.run, detailRes.turns, loopName, new Date()),
        });
        const sub = await source.subscribe(runId, foldEvent);
        if (sub.truncated) {
          // The retained window could not cover our gap — resync from scratch.
          const fresh = await source.getRun(runId);
          if (cancelled) return;
          const name = loopsRes.loops.find((l) => l.id === fresh.run.loopId)?.name;
          setState({ kind: "live", data: runDetailOf(fresh.run, fresh.turns, name, new Date()) });
        }
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          kind: "demo",
          data: s.data,
          note: `Server unreachable (${err instanceof Error ? err.message : String(err)}) — showing demo data.`,
        }));
      }
    };
    void load();
    return () => {
      cancelled = true;
      source.unsubscribe(runId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.source, props.runId]);

  const run = state.data;
  const onCancel = (runId: string): void => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    void source?.cancel(runId).catch(() => {});
  };
  const onSend = (runId: string, text: string): void => {
    const source = props.source !== undefined ? props.source : getSharedSource();
    if (source === null) return;
    const terminal = run.status === "complete" || run.status === "error" || run.status === "canceled";
    const intent = terminal ? source.continue(runId, text) : source.steer(runId, text);
    void intent.catch((err: unknown) => {
      setState((s) => ({ ...s, note: `Send failed: ${err instanceof Error ? err.message : String(err)}` }));
    });
  };

  return (
    <>
      <LiveNote live={state.kind === "live"} text={state.kind === "live" ? "Live" : (state.note ?? DEMO_NOTE)} />
      <RunDetailPage run={run} onCancel={onCancel} onSend={onSend} />
    </>
  );
}

// Re-exported so the registry mounts one <style> block for the notes.
export { LiveStyles } from "./styles.tsx";
