import { useEffect, useState } from "react";
import { usePath, navigate } from "./router.ts";
import { call, getToken, clearToken } from "./rpc.ts";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { LoopsPage } from "./pages/LoopsPage.tsx";
import { StubPage } from "./pages/StubPage.tsx";

const NAV = [
  { path: "/loops", label: "Loops" },
  { path: "/runs", label: "Runs" },
  { path: "/templates", label: "Templates" },
  { path: "/settings", label: "Settings" },
];

export function App() {
  const path = usePath();
  const [up, setUp] = useState<boolean | null>(null);

  useEffect(() => {
    if (path === "/") navigate("/loops");
  }, [path]);

  useEffect(() => {
    let live = true;
    if (!getToken()) { setUp(false); return; }
    call("env.describe")
      .then(() => live && setUp(true))
      .catch(() => live && setUp(false));
    return () => { live = false; };
  }, []);

  if (!getToken()) {
    return (
      <div className="shell"><div className="content"><div className="page">
        <h1>Pair this device</h1>
        <p className="lede">
          Start the server (<code>node --experimental-strip-types src/server/start.ts</code>)
          and open the deep link it prints (<code>?connectToken=...</code>).
        </p>
      </div></div></div>
    );
  }

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="workspace">
          <span className={`dot ${up ? "up" : ""}`} />
          loops
        </div>
        {NAV.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={path.startsWith(item.path) ? "active" : ""}
            onClick={(e) => { e.preventDefault(); navigate(item.path); }}
          >
            {item.label}
          </a>
        ))}
        <div className="spacer" />
        <div className="hint">
          <a href="#" onClick={(e) => { e.preventDefault(); clearToken(); location.reload(); }}>
            Unpair
          </a>
        </div>
      </nav>
      <main className="content">
        {path === "/loops" && <LoopsPage />}
        {path === "/loops/new" && (
          <StubPage title="New loop" note="The editor lands in slice R4.2 (trigger picker, schedule, conditions, prompt)." />
        )}
        {path.startsWith("/loop/") && (
          <StubPage title="Loop" note="Loop detail lands in slice R4.2; runs stream in R6.2." />
        )}
        {path === "/runs" && (
          <StubPage title="Runs" note="Run history lands with the runtime slices (R6)." />
        )}
        {path === "/templates" && (
          <StubPage title="Templates" note="The template library lands in slice R4.3." />
        )}
        {path === "/settings" && <SettingsPage />}
      </main>
    </div>
  );
}
