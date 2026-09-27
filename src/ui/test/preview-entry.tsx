// Renders the loops list (fixtures) + theme into preview.html at the repo
// root of the ui package. Build artifact for reviewers — never shipped.
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync, readFileSync } from "node:fs";
import { LoopsListPage, LoopsStyles, demoLoops } from "../src/features/loops/index.ts";

const noop = (): void => {};
const body = renderToStaticMarkup(
  <>
    <LoopsStyles />
    <LoopsListPage
      loops={demoLoops}
      inferenceConfigured={true}
      onToggle={noop}
      onOpen={noop}
      onNewLoop={noop}
      onOpenInferenceSettings={noop}
    />
  </>,
);
const theme = readFileSync("src/theme.css", "utf8");
writeFileSync(
  "preview.html",
  `<!doctype html><html><head><meta charset="utf-8"><title>Loops list preview</title><style>${theme}</style></head><body><main class="content">${body}</main></body></html>`,
);
console.log("preview.html written");
