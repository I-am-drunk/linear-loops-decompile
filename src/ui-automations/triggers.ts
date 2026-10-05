/**
 * Triggers (AU3, docs/plan/automations.md).
 *
 * An automation holds a LIST of triggers, any of which fires it. Each is a
 * kind plus that kind's options. This slice ships `schedule` and `manual`;
 * integration-event and webhook triggers are later rows and slot into the
 * same union without touching this file's logic.
 *
 * Duplicate triggers are rejected: same kind plus same options is the same
 * trigger. Two identical schedules would fire the automation twice for one
 * tick, which is the kind of bug that costs money quietly.
 */

import { validateCron } from "./cron.ts";
import type { Draft, SectionSpec } from "./detail.ts";
import type { Row } from "../ui-settings/rows.ts";

export type Trigger =
  | { kind: `schedule`; cron: string; timezone?: string }
  | { kind: `manual` };

/** The draft key the Triggers section owns. */
export const TRIGGERS_KEY = `triggers`;

/**
 * Identity for dedupe. Schedules are normalized through the validator so
 * `@daily` and `0 0 * * *` are the SAME trigger, and so are two expressions
 * differing only in whitespace. Timezone is part of identity: 09:00 Oslo
 * and 09:00 Tokyo are different schedules.
 */
export function triggerKey(t: Trigger): string {
  if (t.kind === `manual`) return `manual`;
  const v = validateCron(t.cron);
  const fields = v.ok ? v.fields : t.cron.trim().replace(/\s+/g, ` `);
  return `schedule:${fields}:${t.timezone ?? ``}`;
}

export type AddResult =
  | { ok: true; triggers: Trigger[] }
  | { ok: false; reason: `duplicate` | `invalid`; detail: string };

/** Read the list off a draft, tolerating a missing or malformed key. */
export function triggersOf(draft: Draft): Trigger[] {
  const v = draft[TRIGGERS_KEY];
  return Array.isArray(v) ? (v as Trigger[]) : [];
}

/**
 * Add a trigger, refusing duplicates and invalid schedules. Returns a NEW
 * list; the editor's set() does the dirty tracking, so this stays pure.
 */
export function addTrigger(list: readonly Trigger[], t: Trigger): AddResult {
  if (t.kind === `schedule`) {
    const v = validateCron(t.cron);
    if (!v.ok) return { ok: false, reason: `invalid`, detail: v.detail };
  }
  const key = triggerKey(t);
  if (list.some((x) => triggerKey(x) === key)) {
    return { ok: false, reason: `duplicate`, detail: `already has ${key}` };
  }
  return { ok: true, triggers: [...list, t] };
}

export const removeTrigger = (list: readonly Trigger[], index: number): Trigger[] =>
  list.filter((_, i) => i !== index);

/** One row per trigger plus the add controls; registered into AU2's frame. */
function triggerRows(draft: Draft): Row[] {
  const list = triggersOf(draft);
  const rows: Row[] = list.map((t, i) =>
    t.kind === `manual`
      ? { kind: `connection`, id: `trigger.${i}`, label: `Manual`, state: `connected`, detail: `Run button` }
      : {
          kind: `connection`, id: `trigger.${i}`, label: `Schedule`,
          state: validateCron(t.cron).ok ? `connected` : `error`,
          detail: `${t.cron}${t.timezone ? ` · ${t.timezone}` : ``}`,
        },
  );
  if (list.length === 0) {
    rows.push({ kind: `text`, id: `trigger.none`, label: `No triggers`, value: ``,
      description: `This automation will only run when you press run.`, disabled: true });
  }
  return rows;
}

/** The section AU2 renders. `order: 10` puts it first, per the plan's table. */
export const TRIGGERS_SECTION: SectionSpec = {
  id: `triggers`,
  title: `Triggers`,
  blurb: `Any of these fires the automation.`,
  order: 10,
  build: triggerRows,
};
