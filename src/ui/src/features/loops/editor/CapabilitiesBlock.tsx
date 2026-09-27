/**
 * T-702 — capabilities + access block: what runs may DO (write activities),
 * code access level, who may edit, and trusted-source narrowing.
 * Mirrors SPECS/loops.md §settings-surfaces; the activities set is v1
 * (comment / issueUpdate / stateChange) from src/model LOOP_ACTIVITIES.
 */
import type { JSX } from "react";
import type { LoopConfig } from "../../../../../model/index.ts";
import { CODE_ACCESS_LEVELS, LOOP_ACTIVITIES, LOOP_EDIT_ACCESS } from "../../../../../model/index.ts";
import { Block, Field } from "./controls.tsx";
import type { TrustedSourceOption } from "./types.ts";

const ACTIVITY_LABELS: Record<(typeof LOOP_ACTIVITIES)[number], string> = {
  comment: "Post comments",
  issueUpdate: "Update issues",
  stateChange: "Change issue state",
};

const CODE_ACCESS_LABELS: Record<(typeof CODE_ACCESS_LEVELS)[number], string> = {
  none: "No code access",
  read: "Read code (code index)",
  write: "Read + write (coding sessions)",
};

const EDIT_ACCESS_LABELS: Record<(typeof LOOP_EDIT_ACCESS)[number], string> = {
  owner: "Only the owner",
  team: "Team members",
  organization: "Anyone in the workspace",
};

export function CapabilitiesBlock(props: {
  readonly config: LoopConfig;
  readonly onChange: (next: LoopConfig) => void;
  readonly trustedSources: readonly TrustedSourceOption[];
}): JSX.Element {
  const { config, onChange } = props;
  const toggleActivity = (a: (typeof LOOP_ACTIVITIES)[number], on: boolean): void =>
    onChange({
      ...config,
      activities: on
        ? [...config.activities, a]
        : config.activities.filter((x) => x !== a),
    });
  const toggleSource = (key: string, on: boolean): void =>
    onChange({
      ...config,
      trustedSourceKeys: on
        ? [...config.trustedSourceKeys, key]
        : config.trustedSourceKeys.filter((k) => k !== key),
    });

  return (
    <Block title="Capabilities">
      <Field label="This loop may" hint="At least one">
        <span className="le-col">
          {LOOP_ACTIVITIES.map((a) => (
            <label key={a} className="le-check">
              <input
                type="checkbox"
                checked={config.activities.includes(a)}
                onChange={(e) => toggleActivity(a, e.target.checked)}
              />
              {ACTIVITY_LABELS[a]}
            </label>
          ))}
        </span>
      </Field>
      <div className="le-row">
        <Field label="Code access">
          <select
            className="le-input"
            value={config.codeAccess}
            onChange={(e) =>
              onChange({ ...config, codeAccess: e.target.value as (typeof CODE_ACCESS_LEVELS)[number] })
            }
          >
            {CODE_ACCESS_LEVELS.map((c) => (
              <option key={c} value={c}>{CODE_ACCESS_LABELS[c]}</option>
            ))}
          </select>
        </Field>
        <Field label="Who can edit">
          <select
            className="le-input"
            value={config.editAccess}
            onChange={(e) =>
              onChange({ ...config, editAccess: e.target.value as (typeof LOOP_EDIT_ACCESS)[number] })
            }
          >
            {LOOP_EDIT_ACCESS.map((c) => (
              <option key={c} value={c}>{EDIT_ACCESS_LABELS[c]}</option>
            ))}
          </select>
        </Field>
      </div>
      {props.trustedSources.length > 0 ? (
        <Field label="Trusted sources" hint="Only these external sources may wake this loop">
          <span className="le-col">
            {props.trustedSources.map((s) => (
              <label key={s.key} className="le-check">
                <input
                  type="checkbox"
                  checked={config.trustedSourceKeys.includes(s.key)}
                  onChange={(e) => toggleSource(s.key, e.target.checked)}
                />
                {s.label}
              </label>
            ))}
          </span>
        </Field>
      ) : null}
    </Block>
  );
}
