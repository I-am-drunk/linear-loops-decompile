/**
 * T-703 — display formatting for runs. Pure; strip-types safe.
 */

/** "41s" · "2m 10s" · "1h 3m"; live runs get a trailing ellipsis feel via caller. */
export function formatDuration(ms: number): string {
  if (ms < 0) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) return remS === 0 ? `${m}m` : `${m}m ${remS}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM === 0 ? `${h}h` : `${h}h ${remM}m`;
}

/** "$0.0042" for small spends, "$1.23" past a dollar. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** "1.2k in · 340 out" for the usage line. */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

/** Status chip copy — same vocabulary as the list (T-701). */
export function statusLabel(status: string): string {
  switch (status) {
    case "pending":
    case "waiting":
      return "Queued";
    case "active":
      return "Running";
    case "awaitingInput":
      return "Waiting for input";
    case "complete":
      return "Complete";
    case "error":
      return "Failed";
    case "canceled":
      return "Canceled";
    case "stale":
      return "Unresponsive";
    default:
      return status;
  }
}

/** Live statuses pulse in the header / list. */
export function isLiveStatus(status: string): boolean {
  return status === "pending" || status === "waiting" || status === "active" || status === "awaitingInput";
}

/** Cancelable statuses (cooperative cancel; waiting = dequeue). */
export function isCancelable(status: string): boolean {
  return isLiveStatus(status);
}

/** Follow-up box copy per run status (settled design, hub #21 00:14:52Z). */
export function followUpCopy(status: string): { placeholder: string; button: string } {
  switch (status) {
    case "awaitingInput":
      return { placeholder: "Answer the loop…", button: "Send answer" };
    case "pending":
    case "waiting":
    case "active":
      return { placeholder: "Steer this run…", button: "Steer" };
    default:
      return { placeholder: "Send a follow-up to continue this run…", button: "Continue" };
  }
}
