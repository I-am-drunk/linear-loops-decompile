/**
 * T-702 — trigger block: type picker (schedule / chat / event), the schedule
 * builder, and the event config (entity, kind, activation mode). Switching
 * types swaps in a valid default; entity/kind stay consistent (inTriage is
 * issue-only, mirrored from the zod refinement).
 */
import type { JSX } from "react";
import type { LoopConfig, LoopTrigger } from "../../../../../model/index.ts";
import {
  LOOP_ACTIVATION_MODES,
  LOOP_EVENT_ENTITIES,
  LOOP_EVENT_KINDS,
} from "../../../../../model/index.ts";
import { Block, Field } from "./controls.tsx";
import { ScheduleBuilder } from "./ScheduleBuilder.tsx";
import { DEFAULT_LOOP_SCHEDULE } from "../../../../../model/index.ts";

export interface TriggerBlockProps {
  readonly config: LoopConfig;
  readonly onChange: (next: LoopConfig) => void;
}

const TRIGGER_LABELS: Record<LoopTrigger["type"], string> = {
  schedule: "Schedule",
  chat: "Chat",
  event: "Event",
};

const EVENT_ENTITY_LABELS: Record<string, string> = {
  issue: "Issue",
  project: "Project",
  initiative: "Initiative",
  document: "Document",
  comment: "Comment",
  team: "Team",
  cycle: "Cycle",
  release: "Release",
};

const EVENT_KIND_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  inTriage: "enters triage",
};

function defaultTrigger(type: LoopTrigger["type"], prev: LoopTrigger): LoopTrigger {
  switch (type) {
    case "schedule":
      return {
        type: "schedule",
        schedule: prev.type === "schedule" ? prev.schedule : DEFAULT_LOOP_SCHEDULE,
      };
    case "chat":
      return { type: "chat" };
    case "event":
      return {
        type: "event",
        event: { entity: "issue", kind: "created" },
        activationMode: "collectionChanged",
      };
  }
}

export function TriggerBlock(props: TriggerBlockProps): JSX.Element {
  const { config, onChange } = props;
  const trigger = config.trigger;

  return (
    <Block title="Trigger">
      <div className="le-segment" role="radiogroup" aria-label="Trigger type">
        {(Object.keys(TRIGGER_LABELS) as LoopTrigger["type"][]).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={trigger.type === t}
            className={`le-segment-btn${trigger.type === t ? " on" : ""}`}
            onClick={() => onChange({ ...config, trigger: defaultTrigger(t, trigger) })}
          >
            {TRIGGER_LABELS[t]}
          </button>
        ))}
      </div>

      {trigger.type === "schedule" ? (
        <ScheduleBuilder
          schedule={trigger.schedule}
          onChange={(schedule) => onChange({ ...config, trigger: { type: "schedule", schedule } })}
        />
      ) : null}

      {trigger.type === "chat" ? (
        <p className="le-hint">
          Wakes when the loop is @mentioned or messaged in an enabled channel. Trusted
          sources (below) narrow who may wake it.
        </p>
      ) : null}

      {trigger.type === "event" ? (
        <div className="le-row">
          <Field label="Entity">
            <select
              className="le-input"
              value={trigger.event.entity}
              onChange={(e) => {
                const entity = e.target.value as typeof trigger.event.entity;
                const kind =
                  trigger.event.kind === "inTriage" && entity !== "issue"
                    ? ("updated" as const)
                    : trigger.event.kind;
                onChange({ ...config, trigger: { ...trigger, event: { entity, kind } } });
              }}
            >
              {LOOP_EVENT_ENTITIES.map((ent) => (
                <option key={ent} value={ent}>{EVENT_ENTITY_LABELS[ent] ?? ent}</option>
              ))}
            </select>
          </Field>
          <Field label="When it is">
            <select
              className="le-input"
              value={trigger.event.kind}
              onChange={(e) =>
                onChange({
                  ...config,
                  trigger: {
                    ...trigger,
                    event: { ...trigger.event, kind: e.target.value as typeof trigger.event.kind },
                  },
                })
              }
            >
              {LOOP_EVENT_KINDS.filter(
                (k) => k !== "inTriage" || trigger.event.entity === "issue",
              ).map((k) => (
                <option key={k} value={k}>{EVENT_KIND_LABELS[k] ?? k}</option>
              ))}
            </select>
          </Field>
          <Field label="Activate when">
            <select
              className="le-input"
              value={trigger.activationMode}
              onChange={(e) =>
                onChange({
                  ...config,
                  trigger: {
                    ...trigger,
                    activationMode: e.target.value as (typeof LOOP_ACTIVATION_MODES)[number],
                  },
                })
              }
            >
              <option value="collectionChanged">membership changes</option>
              <option value="watchedPropertyChanged">a watched property changes</option>
            </select>
          </Field>
        </div>
      ) : null}
    </Block>
  );
}
