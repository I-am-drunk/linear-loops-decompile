import { navigate } from "../router.ts";

/**
 * Loops list. The list RPC lands in R4.1; until then this is the corpus-shaped
 * empty state (SPECS/loops.md §UI inventory: grouped list, New loop button,
 * terse sentence-case copy).
 */
export function LoopsPage() {
  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ flex: 1 }}>Loops</h1>
        <button className="primary" onClick={() => navigate("/loops/new")}>New loop</button>
      </div>
      <p className="lede">Automations that run on a schedule, on Linear events, or from chat.</p>
      <div className="empty">
        <h2>No loops yet</h2>
        <p>Create your first loop to automate work in Linear.</p>
      </div>
    </div>
  );
}
