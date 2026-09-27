/**
 * T-1104 — containers: connect the presentational loops/runs pages to a data
 * source (house rule: pages never fetch; containers speak T3 connect).
 *
 * Progressive enhancement, SSR-safe: first render is always the fixture
 * source (offline demo — exactly the pre-T-1104 registry behavior, which the
 * shell smoke asserts). In a browser with a configured connect token the
 * effect swaps in the live source and reloads. Pages are untouched.
 */
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { LoopsListPage } from "../features/loops/LoopsListPage.tsx";
import { demoHarnesses } from "../features/settings/fixtures.ts";
import { RunsListPage } from "../features/loops/runs/RunsListPage.tsx";
import { RunDetailPage } from "../features/loops/runs/RunDetailPage.tsx";
import type { RunDetail, RunSummary } from "../features/loops/runs/types.ts";
import type { LoopSummary } from "../features/loops/types.ts";
import { navigate } from "../useHashRoute.ts";
import { getSharedClient } from "./client.ts";
import {
  FixtureLoopsSource,
  FixtureRunsSource,
  selectSources,
  type LoopsSource,
  type RunsSource,
  type Sources,
} from "./sources.ts";

const FIXTURE_SOURCES: Sources = {
  loops: new FixtureLoopsSource(),
  runs: new FixtureRunsSource(),
};

/** Resolve the live sources once the shared client connects; fixture until
 *  then (and forever when no token is configured). */
function useSources(): Sources {
  const [sources, setSources] = useState<Sources>(FIXTURE_SOURCES);
  useEffect(() => {
    const pending = getSharedClient();
    if (pending === null) return;
    let cancelled = false;
    pending
      .then((client) => {
        if (!cancelled) setSources(selectSources(client));
      })
      .catch(() => {
        // Connect failed — stay on fixtures; the client retries on its own.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return sources;
}

export interface LoopsListContainerProps {
  /** Test seam: inject a source directly (skips the shared-client swap). */
  readonly source?: LoopsSource | undefined;
}

export function LoopsListContainer(props: LoopsListContainerProps): JSX.Element {
  const auto = useSources();
  const source = props.source ?? auto.loops;
  const [loops, setLoops] = useState<readonly LoopSummary[] | null>(() => source.peekLoops?.() ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    source
      .listLoops()
      .then((list) => {
        if (!cancelled) {
          setLoops(list);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, reloadKey]);

  const onToggle = (id: string, enabled: boolean): void => {
    // Server-authoritative: the row flips only when the reload confirms.
    void source.setEnabled(id, enabled).then(() => setReloadKey((k) => k + 1));
  };

  if (error !== null) {
    return <p role="alert">Couldn't load loops: {error}</p>;
  }
  if (loops === null) {
    return <p role="status">Loading loops…</p>;
  }
  return (
    <LoopsListPage
      loops={loops}
      // The inference empty state is settings-driven; a connected server
      // implies a configured brain until settings.get lands (T-1103+).
      inferenceConfigured={source.kind === "live" ? true : demoHarnesses.length > 0}
      onToggle={onToggle}
      onOpen={(id) => navigate({ name: "loop-detail", loopId: id })}
      onNewLoop={() => navigate({ name: "loop-new" })}
      onOpenInferenceSettings={() => navigate({ name: "settings-inference" })}
    />
  );
}

export interface RunsListContainerProps {
  /** Route loopId; "all" (or absent) = the aggregate view. */
  readonly loopId?: string | undefined;
  readonly source?: RunsSource | undefined;
}

export function RunsListContainer(props: RunsListContainerProps): JSX.Element {
  const auto = useSources();
  const source = props.source ?? auto.runs;
  const loopId = props.loopId === "all" ? undefined : props.loopId;
  const [runs, setRuns] = useState<readonly RunSummary[] | null>(() => source.peekRuns?.(loopId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    source
      .listRuns(loopId)
      .then((list) => {
        if (!cancelled) {
          setRuns(list);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [source, loopId]);

  if (error !== null) {
    return <p role="alert">Couldn't load runs: {error}</p>;
  }
  if (runs === null) {
    return <p role="status">Loading runs…</p>;
  }
  return (
    <RunsListPage
      runs={runs}
      onOpenRun={(runLoopId, runId) => navigate({ name: "run-detail", loopId: runLoopId, runId })}
    />
  );
}

export interface RunDetailContainerProps {
  readonly loopId: string;
  readonly runId: string;
  readonly source?: RunsSource | undefined;
}

export function RunDetailContainer(props: RunDetailContainerProps): JSX.Element {
  const auto = useSources();
  const source = props.source ?? auto.runs;
  const { runId } = props;
  const [detail, setDetail] = useState<RunDetail | null>(() => source.peekRun?.(runId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    source
      .watchRun(runId, (next) => {
        if (!cancelled) {
          setDetail(next);
          setError(null);
        }
      })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [source, runId]);

  const onCancel = (id: string): void => {
    void source.cancel(id);
  };
  const onSend = (id: string, text: string): void => {
    // Page-level send semantics (types.ts): awaitingInput answers the
    // elicitation, live statuses steer, finished continues. The channel maps
    // both answer and follow-up onto runs.continue; steer is its own method.
    if (detail !== null && (detail.status === "active" || detail.status === "pending" || detail.status === "waiting")) {
      void source.steer(id, text);
    } else {
      void source.continueRun(id, text);
    }
  };

  if (error !== null) {
    return (
      <p role="alert">{`Couldn't load run ${runId}: ${error}`}</p>
    );
  }
  if (detail === null) {
    return <p role="status">{`Loading run ${runId}…`}</p>;
  }
  return <RunDetailPage run={detail} onCancel={onCancel} onSend={onSend} />;
}
