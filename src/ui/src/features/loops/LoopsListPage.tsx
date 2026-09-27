/**
 * Loops list page (T-701) — the default landing view.
 *
 * Layout parity targets (issue #20): toolbar with search + "New loop",
 * grouped rows with icon tile / name / trigger·owner / last-run chip /
 * enabled switch, and the two empty states (no inference configured →
 * settings CTA; configured but no loops → create CTA). Copy is terse,
 * sentence-case (SPECS/loops.md §ui-inventory).
 *
 * Search is client-side over the props — the list is small (per-workspace)
 * and the container stays dumb until R9 lands.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { LoopsListPageProps } from "./types.ts";
import { filterLoops, groupLoops } from "./grouping.ts";
import { LoopRow } from "./LoopRow.tsx";
import { PlusIcon } from "../../shell/icons.tsx";

export function LoopsListPage(props: LoopsListPageProps): JSX.Element {
  const [query, setQuery] = useState("");
  const now = new Date();

  if (!props.inferenceConfigured) {
    return (
      <div className="ll-empty" data-testid="loops-empty-inference">
        <h1>Connect your AI to run loops</h1>
        <p>
          Loops run on your own inference. Add a provider (OpenRouter, LiteLLM,
          vLLM, Ollama…) to enable them.
        </p>
        <p>
          <button type="button" className="btn primary" onClick={props.onOpenInferenceSettings}>
            Connect inference
          </button>
        </p>
      </div>
    );
  }

  const visible = filterLoops(props.loops, query);
  const groups = groupLoops(visible);
  const searching = query.trim().length > 0;

  return (
    <div className="ll-page">
      <div className="ll-toolbar">
        <input
          type="search"
          className="ll-search"
          placeholder="Search loops"
          aria-label="Search loops"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn primary" onClick={props.onNewLoop}>
          <PlusIcon /> New loop
        </button>
      </div>

      {props.loops.length === 0 ? (
        <div className="ll-empty" data-testid="loops-empty-none">
          <h1>No loops yet</h1>
          <p>Loops automate repeated work: triage, summaries, follow-ups.</p>
          <p>
            <button type="button" className="btn primary" onClick={props.onNewLoop}>
              <PlusIcon /> New loop
            </button>
          </p>
        </div>
      ) : searching && visible.length === 0 ? (
        <div className="ll-empty" data-testid="loops-empty-search">
          <h1>No loops match “{query.trim()}”</h1>
          <p>
            <button type="button" className="btn" onClick={() => setQuery("")}>
              Clear search
            </button>
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="ll-group" data-group={group.label}>
            <h2 className="ll-group-title">{group.label}</h2>
            <div className="ll-group-rows">
              {group.loops.map((loop) => (
                <LoopRow
                  key={loop.id}
                  loop={loop}
                  now={now}
                  onOpen={props.onOpen}
                  onToggle={props.onToggle}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
