/**
 * Grouping + filtering for the loops list. Pure; strip-types safe.
 *
 * Settled behavior (hub #21 23:01:44Z / 23:47:11Z, SPECS/loops.md
 * §ui-inventory): groups by `groupName`, falling back to team, then the
 * catch-all "Workspace". Groups sort A→Z with Workspace last; loops sort
 * A→Z by name inside a group. Search matches name, description, team, and
 * owner, case-insensitive.
 */
import type { LoopSummary } from "./types.ts";

export interface LoopGroup {
  readonly label: string;
  /** True for the catch-all group — renders last regardless of alphabet. */
  readonly isWorkspace: boolean;
  readonly loops: readonly LoopSummary[];
}

export const WORKSPACE_GROUP = "Workspace";

export function groupOf(loop: LoopSummary): string {
  return loop.groupName ?? loop.teamName ?? WORKSPACE_GROUP;
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function compareGroupLabels(a: string, b: string): number {
  const aw = a === WORKSPACE_GROUP;
  const bw = b === WORKSPACE_GROUP;
  if (aw !== bw) return aw ? 1 : -1; // Workspace last
  return collator.compare(a, b);
}

/** Group + sort. Input order is irrelevant; output is fully deterministic. */
export function groupLoops(loops: readonly LoopSummary[]): LoopGroup[] {
  const byLabel = new Map<string, LoopSummary[]>();
  for (const loop of loops) {
    const label = groupOf(loop);
    const bucket = byLabel.get(label);
    if (bucket) bucket.push(loop);
    else byLabel.set(label, [loop]);
  }
  const groups: LoopGroup[] = [];
  for (const [label, members] of byLabel) {
    members.sort((a, b) => collator.compare(a.name, b.name));
    groups.push({ label, isWorkspace: label === WORKSPACE_GROUP, loops: members });
  }
  groups.sort((a, b) => compareGroupLabels(a.label, b.label));
  return groups;
}

/**
 * Case-insensitive substring match over the fields a user scans for:
 * name, description, group, team, owner. Empty/blank query keeps everything.
 */
export function filterLoops(loops: readonly LoopSummary[], query: string): LoopSummary[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [...loops];
  return loops.filter((loop) =>
    [loop.name, loop.description, loop.groupName, loop.teamName, loop.ownerName]
      .some((field) => field !== undefined && field.toLowerCase().includes(q)),
  );
}
