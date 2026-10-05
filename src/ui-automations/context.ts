/**
 * Environment, memories, parameters (AU7, docs/plan/automations.md).
 *
 * The three remaining detail sections. Each is small, and each maps onto
 * ST2's existing row patterns rather than inventing a control:
 *
 *   Environment  — repo / branch / scope the automation runs against.
 *   Memories     — notes the automation accumulates across runs. The RUNNER
 *                  writes these; the UI shows them read-only, because a
 *                  memory a user can edit is no longer a record of what the
 *                  automation learned.
 *   Parameters   — typed inputs: boolean -> toggle, enum -> select,
 *                  text -> text. The type decides the row.
 *
 * Pure; registered into AU2's SectionSpec. No RPC.
 */

import type { Draft, SectionSpec } from "./detail.ts";
import type { Row } from "../ui-settings/rows.ts";

export type Environment = {
  repo?: string;
  branch?: string;
  /** What the automation may touch. Default is the narrowest. */
  scope: `read` | `write` | `admin`;
};

export type Parameter =
  | { name: string; type: `boolean`; value: boolean }
  | { name: string; type: `enum`; value: string; options: readonly string[] }
  | { name: string; type: `text`; value: string };

/** Written by the runner; shown read-only. `at` is ISO-8601. */
export type Memory = { at: string; note: string };

export const ENV_KEY = `environment`;
export const PARAMS_KEY = `parameters`;
export const MEMORIES_KEY = `memories`;

const SCOPES = [`read`, `write`, `admin`] as const;

export function environmentOf(draft: Draft): Environment {
  const v = draft[ENV_KEY] as Partial<Environment> | undefined;
  const scope = SCOPES.includes(v?.scope as Environment[`scope`]) ? (v?.scope as Environment[`scope`]) : `read`;
  return { scope, ...(v?.repo ? { repo: v.repo } : {}), ...(v?.branch ? { branch: v.branch } : {}) };
}

export const parametersOf = (draft: Draft): Parameter[] =>
  Array.isArray(draft[PARAMS_KEY]) ? (draft[PARAMS_KEY] as Parameter[]) : [];

export const memoriesOf = (draft: Draft): Memory[] =>
  Array.isArray(draft[MEMORIES_KEY]) ? (draft[MEMORIES_KEY] as Memory[]) : [];

/** Environment: three rows, scope as a select because the set is closed. */
function environmentRows(draft: Draft): Row[] {
  const env = environmentOf(draft);
  return [
    { kind: `text`, id: `env.repo`, label: `Repository`, value: env.repo ?? ``,
      placeholder: `owner/name`, description: `What the automation runs against.` },
    { kind: `text`, id: `env.branch`, label: `Branch`, value: env.branch ?? ``, placeholder: `main` },
    { kind: `select`, id: `env.scope`, label: `Scope`, value: env.scope,
      description: `What the automation may touch. Narrowest by default.`,
      options: SCOPES.map((s) => ({ value: s, label: s })) },
  ];
}

export const ENVIRONMENT_SECTION: SectionSpec = {
  id: `environment`,
  title: `Environment`,
  order: 40,
  build: environmentRows,
};

/** Parameters: the TYPE decides the row. Each maps onto an existing pattern. */
function parameterRow(p: Parameter): Row {
  const id = `param.${p.name}`;
  switch (p.type) {
    case `boolean`:
      return { kind: `toggle`, id, label: p.name, on: p.value };
    case `enum`:
      return { kind: `select`, id, label: p.name, value: p.value,
        options: p.options.map((o) => ({ value: o, label: o })) };
    case `text`:
      return { kind: `text`, id, label: p.name, value: p.value };
  }
}

export const PARAMETERS_SECTION: SectionSpec = {
  id: `parameters`,
  title: `Parameters`,
  blurb: `Typed inputs a run can read.`,
  order: 50,
  build: (draft) => {
    const ps = parametersOf(draft);
    if (ps.length === 0) {
      return [{ kind: `text`, id: `param.none`, label: `No parameters`, value: ``,
        description: `Add a boolean, enum or text input.`, disabled: true }];
    }
    return ps.map(parameterRow);
  },
};

/** Memories: the runner writes them, the UI reads them. Read-only on purpose. */
export const MEMORIES_SECTION: SectionSpec = {
  id: `memories`,
  title: `Memories`,
  blurb: `What this automation has noted across runs. Written by the runner.`,
  order: 55,
  build: (draft) => {
    const ms = memoriesOf(draft);
    if (ms.length === 0) {
      return [{ kind: `text`, id: `memory.none`, label: `No memories yet`, value: ``,
        description: `Notes appear here as runs accumulate them.`, disabled: true }];
    }
    // Newest first, read-only: a memory a user can edit is no longer a
    // record of what the automation learned.
    return [...ms]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .map((m, i) => ({ kind: `text` as const, id: `memory.${i}`, label: m.at, value: m.note, disabled: true }));
  },
};

/** All three, for a host that wants to register them in one call. */
export const CONTEXT_SECTIONS: readonly SectionSpec[] = [ENVIRONMENT_SECTION, PARAMETERS_SECTION, MEMORIES_SECTION];
