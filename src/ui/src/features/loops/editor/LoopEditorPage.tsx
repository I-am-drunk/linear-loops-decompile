/**
 * T-702 — the loop editor page: identity, scope, trigger, conditions,
 * prompt, capabilities, danger zone, plus the publish bar. Validation runs
 * live (validate.ts mirrors the server's zod gate); Publish is disabled
 * with the first issue named while invalid. Server-side issues from the
 * last failed publish are shown above the button.
 */
import type { JSX } from "react";
import type { LoopEditorProps } from "./types.ts";
import { validateLoopConfig } from "./validate.ts";
import { IdentityBlock, ScopeBlock } from "./IdentityScope.tsx";
import { TriggerBlock } from "./TriggerBlock.tsx";
import { ConditionsBlock } from "./ConditionsBlock.tsx";
import { PromptBlock } from "./PromptBlock.tsx";
import { CapabilitiesBlock } from "./CapabilitiesBlock.tsx";
import { DangerZone } from "./DangerZone.tsx";

export function LoopEditorPage(props: LoopEditorProps): JSX.Element {
  const issues = validateLoopConfig(props.draft);
  const first = issues[0] ?? null;
  const serverIssues = props.serverIssues ?? [];

  return (
    <div className="le-page">
      <div className="le-head">
        <div className="le-head-main">
          <h1 className="le-title">{props.draft.name.trim() || "Untitled loop"}</h1>
          <span className="le-hint">
            {props.publishedVersion !== undefined
              ? `v${props.publishedVersion}${props.dirty ? " — unpublished changes" : " — published"}`
              : "New loop — not published yet"}
          </span>
        </div>
        <span className="le-publish">
          {first ? (
            <span className="le-error le-first-issue" title={first.path}>
              {first.message}
            </span>
          ) : null}
          <button
            type="button"
            className="btn primary"
            disabled={first !== null || props.publishing === true}
            onClick={props.onPublish}
          >
            {props.publishing === true ? "Publishing…" : "Publish"}
          </button>
        </span>
      </div>

      {serverIssues.length > 0 ? (
        <div className="le-server-issues" role="alert">
          <span className="le-error">The server rejected the last publish:</span>
          <ul>
            {serverIssues.map((i, n) => (
              <li key={n} className="le-error">{i.path}: {i.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <IdentityBlock config={props.draft} onChange={props.onChange} />
      <ScopeBlock
        config={props.draft}
        onChange={props.onChange}
        teams={props.teams}
        projects={props.projects}
      />
      <TriggerBlock config={props.draft} onChange={props.onChange} />
      <ConditionsBlock config={props.draft} onChange={props.onChange} />
      <PromptBlock config={props.draft} onChange={props.onChange} />
      <CapabilitiesBlock
        config={props.draft}
        onChange={props.onChange}
        trustedSources={props.trustedSources}
      />
      <DangerZone onDelete={props.onDelete} />
    </div>
  );
}
