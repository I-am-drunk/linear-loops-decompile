/**
 * Relay-style connection helpers.
 *
 * Linear's public API paginates list fields with the standard connection
 * shape (`nodes` / `pageInfo { hasNextPage, endCursor }`). These types and
 * the `paginate` generator keep cursor plumbing out of typed read ops
 * (T-302 builds on this).
 */

/** Minimal connection shape every paginated Linear field satisfies. */
export interface Connection<TNode> {
  nodes: TNode[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage?: boolean;
    endCursor?: string | null;
    startCursor?: string | null;
  };
}

export interface Page<TNode> {
  nodes: TNode[];
  endCursor: string | null;
  hasNextPage: boolean;
}

/**
 * Drive a "fetch one page given a cursor" function to exhaustion (or a cap).
 *
 * `fetchPage(after)` must return one connection-shaped slice. The generator
 * yields individual nodes so callers can `for await` without caring about
 * page boundaries; `maxPages` bounds runaway loops (default 100 — generous
 * for any loop trigger query, still a circuit breaker).
 */
export async function* paginate<TNode>(
  fetchPage: (after: string | null) => Promise<Connection<TNode>>,
  opts: { maxPages?: number; signal?: AbortSignal } = {},
): AsyncGenerator<TNode, void, undefined> {
  const maxPages = opts.maxPages ?? 100;
  let after: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    if (opts.signal?.aborted) return;
    const conn = await fetchPage(after);
    for (const node of conn.nodes) yield node;
    if (!conn.pageInfo.hasNextPage) return;
    after = conn.pageInfo.endCursor ?? null;
    if (after === null) return; // server claims more pages but gave no cursor — stop, don't spin
  }
}

/** Collect a paginated generator into an array (small, bounded result sets). */
export async function collect<TNode>(
  gen: AsyncGenerator<TNode, void, undefined>,
  maxItems = 10_000,
): Promise<TNode[]> {
  const out: TNode[] = [];
  for await (const item of gen) {
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

