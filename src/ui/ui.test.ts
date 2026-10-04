import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pathFromHash, matchRoute, navRoutes, ROUTES, DEFAULT_PATH } from "./routes.ts";
import { cssVarName, themeCss, themeFor, themeDeclarations } from "./theme-css.ts";
import { SHELL_CSS } from "./shell.css.ts";
import { indexHtml } from "./index-html.ts";
import { render, start, registerSurface } from "./shell.ts";
import { makeHost, FakeDocument, type FakeHost } from "./fake-dom.ts";

const asShellHost = (h: FakeHost) => h as unknown as Parameters<typeof render>[0];

test(`pathFromHash normalizes and defaults`, () => {
  assert.equal(pathFromHash(""), DEFAULT_PATH);
  assert.equal(pathFromHash("#"), DEFAULT_PATH);
  assert.equal(pathFromHash("#/"), DEFAULT_PATH);
  assert.equal(pathFromHash("#settings"), "settings");
  assert.equal(pathFromHash("#/settings/mcp/"), "settings/mcp");
});

test(`matchRoute prefers the longest prefix`, () => {
  assert.equal(matchRoute("automations")?.path, "automations");
  assert.equal(matchRoute("automations/new")?.path, "automations/new");
  // An unknown child resolves to its nearest parent, not to nothing.
  assert.equal(matchRoute("settings/inference/deep")?.path, "settings/inference");
  assert.equal(matchRoute("automations/abc123")?.path, "automations");
  assert.equal(matchRoute("nope"), undefined);
});

test(`every nav route is reachable and every route has a lane`, () => {
  for (const r of ROUTES) {
    assert.equal(matchRoute(r.path)?.path, r.path, `${r.path} must match itself`);
    assert.ok(r.lane.length > 0, `${r.path} needs an owning lane`);
  }
  assert.ok(navRoutes("main").length > 0);
  assert.ok(navRoutes("settings").length > 0);
});

test(`cssVarName kebab-cases token names`, () => {
  assert.equal(cssVarName("bgBase"), "--t-bg-base");
  assert.equal(cssVarName("bgBorderFaintAlphaHover"), "--t-bg-border-faint-alpha-hover");
  assert.equal(cssVarName("labelTitle"), "--t-label-title");
});

test(`theme CSS carries all 116 colour tokens plus shell tokens`, () => {
  const theme = themeFor("darkDefault");
  const decls = themeDeclarations(theme);
  const colorCount = Object.keys(theme.color).length;
  assert.equal(colorCount, 116);
  assert.ok(decls.length > colorCount, "shell tokens must be emitted too");
  const css = themeCss();
  assert.match(css, /color-scheme: dark/);
  for (const token of Object.keys(theme.color)) {
    assert.ok(css.includes(`${cssVarName(token)}:`), `missing ${token}`);
  }
});

test(`light and dark presets differ, and light declares its scheme`, () => {
  const dark = themeFor("darkDefault");
  const light = themeFor("lightDefault");
  assert.equal(dark.isDark, true);
  assert.equal(light.isDark, false);
  assert.notEqual(dark.color.bgBase, light.color.bgBase);
});

test(`no literal colour in the shell stylesheet — tokens are the only source`, () => {
  // The whole point of the token set: a hex or rgb() here is a bug.
  assert.equal(/#[0-9a-f]{3,8}\b/i.test(SHELL_CSS), false, "hex colour in SHELL_CSS");
  assert.equal(/\b(rgba?|hsla?|oklch)\(/i.test(SHELL_CSS), false, "colour function in SHELL_CSS");
});

test(`indexHtml inlines theme + shell css and mounts #root`, () => {
  const html = indexHtml();
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /--t-bg-base:/);
  assert.match(html, /\.sidebar \{/);
  assert.match(html, /type="module" src="\/ui\/client\.js"/);
});

test(`render builds sidebar + content and marks the current route`, () => {
  const host = makeHost("#settings/inference");
  render(asShellHost(host));
  const root = host.document.getElementById("root")!;
  assert.equal(root.queryClass("sidebar").length, 1);
  assert.equal(root.queryClass("content-slot").length, 1);
  const current = root.queryClass("nav-item").filter((a) => a.getAttribute("aria-current") === "page");
  assert.equal(current.length, 1);
  assert.equal(current[0]!.textContent, "Inference");
  assert.equal(host.document.title, "Inference · Automations");
});

test(`an unknown route falls back to the default surface`, () => {
  const host = makeHost("#does/not/exist");
  render(asShellHost(host));
  assert.equal(host.document.title, "Automations · Automations");
});

test(`unclaimed routes show an honest placeholder naming their slice`, () => {
  const host = makeHost("#runs");
  render(asShellHost(host));
  const slot = host.document.getElementById("root")!.queryClass("content-slot")[0]!;
  assert.match(slot.textContent, /Not built yet — slice AU6\./);
});

test(`a registered surface replaces the placeholder`, () => {
  registerSurface("runs", (slot, route) => {
    const el = slot.ownerDocument.createElement("p");
    el.textContent = `live:${route.lane}`;
    slot.replaceChildren(el);
  });
  const host = makeHost("#runs");
  render(asShellHost(host));
  const slot = host.document.getElementById("root")!.queryClass("content-slot")[0]!;
  assert.equal(slot.textContent, "live:AU6");
});

test(`start wires hashchange, and teardown unwires it`, () => {
  const host = makeHost("#automations");
  const stop = start(asShellHost(host) as never);
  assert.equal(host.document.title, "Automations · Automations");
  host.navigate("#settings/mcp");
  assert.equal(host.document.title, "MCP servers · Automations");
  stop();
  host.navigate("#automations");
  assert.equal(host.document.title, "MCP servers · Automations", "no re-render after teardown");
});

test(`render throws loudly when #root is absent`, () => {
  // A document with no #root seeded — mountRoot() deliberately not called.
  const bare = { document: new FakeDocument(), location: { hash: "" } };
  assert.throws(() => render(bare as never), /#root is missing/);
});

test(`#root passes the viewport height through to the layout`, () => {
  // Regression: `.layout { height: 100vh }` alone left the sidebar ~90px
  // short, because #root had no height for the grid to fill. Caught by
  // screenshotting the running shell, not by a unit test — hence this pin.
  assert.match(SHELL_CSS, /#root \{ height: 100%; \}/);
  assert.match(SHELL_CSS, /\.layout \{[^}]*height: 100%;/);
});
