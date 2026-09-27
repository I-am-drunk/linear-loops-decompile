/**
 * T-702 — identity + scope blocks: name, icon, color, group, description,
 * team/project scoping, sub-team inheritance. Controlled; emits whole-config
 * updates via onChange.
 */
import type { JSX } from "react";
import type { LoopConfig } from "../../../../../model/index.ts";
import type { NamedId } from "./types.ts";
import { Block, Field } from "./controls.tsx";

export interface IdentityProps {
  readonly config: LoopConfig;
  readonly onChange: (next: LoopConfig) => void;
}

const orUndef = (v: string): string | undefined => (v.trim().length === 0 ? undefined : v);

export function IdentityBlock(props: IdentityProps): JSX.Element {
  const { config, onChange } = props;
  return (
    <Block title="Identity">
      <Field label="Name">
        <input
          className="le-input"
          value={config.name}
          onChange={(e) => onChange({ ...config, name: e.target.value })}
          placeholder="Loop name"
        />
      </Field>
      <div className="le-row">
        <Field label="Icon" hint="Emoji, optional">
          <input
            className="le-input le-icon"
            value={config.icon ?? ""}
            onChange={(e) => onChange({ ...config, icon: orUndef(e.target.value) })}
            placeholder="🔁"
          />
        </Field>
        <Field label="Color" hint="#rrggbb">
          <input
            className="le-input le-color"
            value={config.color ?? ""}
            onChange={(e) => onChange({ ...config, color: orUndef(e.target.value) })}
            placeholder="#5e6ad2"
          />
        </Field>
        <Field label="Group" hint="List grouping label">
          <input
            className="le-input"
            value={config.groupName ?? ""}
            onChange={(e) => onChange({ ...config, groupName: orUndef(e.target.value) })}
            placeholder="Support"
          />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          className="le-input le-textarea-sm"
          value={config.description ?? ""}
          onChange={(e) => onChange({ ...config, description: orUndef(e.target.value) })}
          placeholder="What this loop does, in one line"
        />
      </Field>
    </Block>
  );
}

export interface ScopeProps extends IdentityProps {
  readonly teams: readonly NamedId[];
  readonly projects: readonly NamedId[];
}

export function ScopeBlock(props: ScopeProps): JSX.Element {
  const { config, onChange } = props;
  return (
    <Block title="Scope">
      <div className="le-row">
        <Field label="Team" hint="Optional">
          <select
            className="le-input"
            value={config.teamId ?? ""}
            onChange={(e) =>
              onChange({ ...config, teamId: orUndef(e.target.value), applyToSubTeams: false })
            }
          >
            <option value="">Whole workspace</option>
            {props.teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Project" hint="Optional">
          <select
            className="le-input"
            value={config.projectId ?? ""}
            onChange={(e) => onChange({ ...config, projectId: orUndef(e.target.value) })}
          >
            <option value="">Any project</option>
            {props.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
      </div>
      {config.teamId ? (
        <label className="le-check">
          <input
            type="checkbox"
            checked={config.applyToSubTeams}
            onChange={(e) => onChange({ ...config, applyToSubTeams: e.target.checked })}
          />
          Also fire on events in sub-teams
        </label>
      ) : null}
    </Block>
  );
}
