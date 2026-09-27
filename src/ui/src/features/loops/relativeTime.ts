/**
 * Relative "x ago" formatting for the last-run chip. Pure; no deps.
 * Kept free of enums/namespaces so `node --experimental-strip-types` runs it.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Ran 1h ago" style timestamp. Under 45s reads "just now"; under a week uses
 * the largest whole unit (m/h/d); beyond that a short absolute date — the
 * chip stays useful for loops that haven't run in months.
 */
export function relativeAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const diff = now.getTime() - then;
  if (diff < 0) return "just now"; // clock skew: never show the future
  if (diff < 45_000) return "just now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m ago`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.round(diff / DAY)}d ago`;
  const d = new Date(then);
  const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()];
  return `${month} ${d.getUTCDate()}`;
}

/** Chip copy for one last run: status verb + when (or duration for live runs). */
export function lastRunLabel(
  run: { readonly status: string; readonly at: string; readonly durationMs?: number | undefined },
  now: Date,
): string {
  const ago = relativeAgo(run.at, now);
  switch (run.status) {
    case "complete":
      return `Ran ${ago}`;
    case "error":
      return `Failed ${ago}`;
    case "canceled":
      return `Canceled ${ago}`;
    case "stale":
      return `Unresponsive ${ago}`;
    case "active":
      return "Running…";
    case "awaitingInput":
      return "Waiting for input";
    case "pending":
    case "waiting":
      return "Queued";
    default:
      return `Last run ${ago}`;
  }
}
