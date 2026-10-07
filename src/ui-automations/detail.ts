/**
 * The automation detail frame (AU2).
 *
 * docs/plan/automations.md: "Sections are a registry, not a hardcoded
 * sequence, so a feature adds a section without touching the page." This file
 * is that registry plus the dirty/save machinery around it, and deliberately
 * knows nothing about triggers, prompts or tools — those register themselves
 * in AU3/AU4/AU5.
 *
 * State lives here as plain data so save/discard is testable without a DOM.
 */

import type { Row, Section } from "../ui-settings/rows.ts";

/** One registered section. `build` turns the draft into rows at render time. */
export type SectionSpec = {
  id: string;
  title: string;
  blurb?: string;
  /** Lower sorts first. Ties fall back to registration order. */
  order: number;
  build: (draft: Draft) => Row[];
};

/** The automation being edited. Opaque to the frame: sections own their keys. */
export type Draft = Record<string, unknown>;

export type Registry = {
  register(spec: SectionSpec): void;
  /** Registered sections, ordered. */
  specs(): SectionSpec[];
};

export function makeRegistry(): Registry {
  const specs: SectionSpec[] = [];
  const seen = new Set<string>();

  return {
    register(spec: SectionSpec): void {
      if (seen.has(spec.id)) {
        // Silent replacement would hide a double-registration until a
        // section mysteriously rendered the wrong rows.
        throw new Error(`automations: section already registered: ${spec.id}`);
      }
      seen.add(spec.id);
      specs.push(spec);
    },

    specs(): SectionSpec[] {
      // Index as the tiebreak keeps registration order stable for equal
      // `order` values, so the page does not reshuffle between renders.
      return specs
        .map((s, i) => ({ s, i }))
        .sort((a, b) => (a.s.order - b.s.order) || (a.i - b.i))
        .map(({ s }) => s);
    },
  };
}

/**
 * Stable structural comparison for dirty tracking.
 *
 * `JSON.stringify` alone is wrong here: it is key-order sensitive, so
 * round-tripping a draft through a form that rebuilds objects would report
 * dirty with nothing changed. Sorting keys at every level makes the
 * comparison about values.
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === `object`) {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonical(x)]),
    );
  }
  return v;
}

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

export type Editor = {
  /** Current draft. */
  draft(): Draft;
  /** The last saved state, for discard and comparison. */
  saved(): Draft;
  dirty(): boolean;
  /** Which registered sections differ from saved. */
  dirtySections(): string[];
  /** Apply a field change. Returns true if it actually changed anything. */
  set(key: string, value: unknown): boolean;
  /** Accept the draft as saved. */
  commit(): void;
  /** Throw the draft away. */
  discard(): void;
  /** Sections to render, built from the current draft. */
  sections(): Section[];
};

export function makeEditor(registry: Registry, initial: Draft): Editor {
  // Deep copies, so the caller's object cannot mutate our saved baseline and
  // make a dirty draft look clean.
  let savedState: Draft = structuredClone(initial);
  let draftState: Draft = structuredClone(initial);

  return {
    draft: () => draftState,
    saved: () => savedState,
    dirty: () => !same(draftState, savedState),

    dirtySections(): string[] {
      return registry
        .specs()
        .filter((s) => !same(s.build(draftState), s.build(savedState)))
        .map((s) => s.id);
    },

    set(key, value): boolean {
      if (same(draftState[key], value)) return false;
      draftState = { ...draftState, [key]: value };
      return true;
    },

    commit(): void {
      savedState = structuredClone(draftState);
    },

    discard(): void {
      draftState = structuredClone(savedState);
    },

    sections(): Section[] {
      return registry.specs().map((s) => ({
        id: s.id,
        title: s.title,
        ...(s.blurb === undefined ? {} : { blurb: s.blurb }),
        rows: s.build(draftState),
      }));
    },
  };
}
