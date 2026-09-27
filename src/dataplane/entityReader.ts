/**
 * EntityReader — the runtime's context seam, implemented over the dataplane.
 *
 * Contract (settled in SPECS/agent.md + issue #40): the runtime's context
 * assembler (R5) depends on this interface, never on the transport:
 *
 *   readEntity(target) → { title, description?, comments?, url? } | null
 *
 * - `null` means the target is gone or unreadable — the run proceeds with
 *   prompt-only context (`entityIncluded: false`).
 * - Errors PROPAGATE: a broken dataplane must fail the run visibly (the
 *   Runner surfaces it as `error`), never silently degrade. This class
 *   therefore does no try/catch — LinearApiError subclasses from ./errors.js
 *   reach the caller as-is.
 *
 * Structural typing, deliberately: this file does NOT import from
 * src/runtime (that would couple the dataplane to the runtime's build).
 * `DataplaneEntityReader` is assignable to the runtime's `EntityReader`
 * because `readEntity` accepts a WIDER target (entity: string covers the
 * LoopEventEntity union; id: string covers EntityId) and returns the exact
 * EntityContext shape. The server (T-1101) wires the two; a drift in the
 * runtime's interface surfaces there as a type error.
 *
 * Scope (YAGNI — mirrors the typed reads that exist): issue (full: title +
 * description + recent comments + url), project (title + url), team (title).
 * Every other entity kind returns null for now — a prompt-only run beats
 * erroring every run of a loop whose target type we cannot read yet.
 * "comment" targets are unsupported on purpose: a comment-triggered run's
 * useful context is the PARENT issue, and the engine owns that mapping
 * (it has the parent id in the event payload).
 *
 * Budget note: an issue read costs ≤ 2 API requests (issue + first comments
 * page); project/team reads cost 1 small list request each.
 */

import type { LinearClient } from "./client.js";
import { getIssue, listComments, listProjects, listTeams } from "./reads.js";

/** Mirrors the runtime's EntityContext (src/runtime/context.ts). Keep in sync. */
export interface EntityContextText {
  title: string;
  description?: string | undefined;
  comments?: readonly { author: string | null; body: string }[] | undefined;
  url?: string | undefined;
}

/** Wider than the runtime's RunTarget on purpose (parameter contravariance). */
export interface ReadTarget {
  /** The loop trigger's entity kind (issue | project | team | …). */
  entity: string;
  /** UUID or human identifier ("ENG-123" works for issues). */
  id: string;
  label?: string | undefined;
}

export interface EntityReaderOptions {
  /** Cap on comments included for issue targets; the MOST RECENT win. Default 20. */
  maxComments?: number | undefined;
  /** Page size for the comments read. Default 50. */
  commentPageSize?: number | undefined;
}

export class DataplaneEntityReader {
  private readonly client: LinearClient;
  private readonly maxComments: number;
  private readonly commentPageSize: number;

  constructor(client: LinearClient, options: EntityReaderOptions = {}) {
    this.client = client;
    this.maxComments = options.maxComments ?? 20;
    this.commentPageSize = options.commentPageSize ?? 50;
  }

  /** The runtime contract. See the file header for null/error semantics. */
  async readEntity(target: ReadTarget): Promise<EntityContextText | null> {
    switch (target.entity) {
      case "issue":
        return this.readIssue(target.id);
      case "project":
        return this.readProject(target.id);
      case "team":
        return this.readTeam(target.id);
      default:
        // Unsupported read shape — prompt-only context, never a thrown run.
        return null;
    }
  }

  private async readIssue(idOrIdentifier: string): Promise<EntityContextText | null> {
    const issue = await getIssue(this.client, idOrIdentifier);
    if (!issue) return null;
    const comments: { author: string | null; body: string }[] = [];
    for await (const c of listComments(this.client, issue.id, {
      pageSize: this.commentPageSize,
      maxPages: 1,
    })) {
      comments.push({ author: c.user?.displayName ?? null, body: c.body });
    }
    // listComments yields oldest-first; the most recent comments carry the
    // context that matters, so cap from the tail.
    const recent = comments.slice(-this.maxComments);
    return {
      title: issue.title,
      description: issue.description ?? undefined,
      comments: recent,
      url: issue.url,
    };
  }

  private async readProject(id: string): Promise<EntityContextText | null> {
    const projects = await listProjects(this.client);
    const project = projects.find((p) => p.id === id || p.name === id);
    if (!project) return null;
    return { title: project.name, url: project.url };
  }

  private async readTeam(idOrKey: string): Promise<EntityContextText | null> {
    const teams = await listTeams(this.client);
    const team = teams.find((t) => t.id === idOrKey || t.key === idOrKey);
    if (!team) return null;
    return { title: team.name };
  }
}

