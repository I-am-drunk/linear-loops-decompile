/**
 * The served document, built at request time so a theme switch needs no
 * rebuild. Inlines theme variables and the shell stylesheet — two fewer
 * round-trips on a self-hosted box, and no FOUC on first paint.
 */
import { themeCss, presetInput, type PresetName } from "./theme-css.ts";
import { SHELL_CSS } from "./shell.css.ts";

export function indexHtml(preset: PresetName = "darkDefault", clientSrc = "/ui/client.js"): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Automations</title>
<style>
${themeCss(presetInput(preset))}
${SHELL_CSS}</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="${clientSrc}"></script>
</body>
</html>
`;
}
