/**
 * Golden test: the shim's surfaced pageMetadata must be the SAME builder the
 * G20 golden verified (identity through the alias, mirroring the corpus
 * shim), and the shim golden's metadata/probes regions must byte-match the
 * G20 golden's (the alias adds no behavior).
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pageMetadata } from "./coding-agent-settings-shim.ts";
import { codingAgentSettingsMetadata } from "./coding-agent-settings-metadata.ts";

const read = (name: string): { output: { properties: Array<{ key: string; value: unknown }> } } =>
  JSON.parse(readFileSync(join(import.meta.dirname, `golden`, name), `utf8`)) as never;

const region = (g: { output: { properties: Array<{ key: string; value: unknown }> } }, key: string): string =>
  JSON.stringify(g.output.properties.find((p) => p.key === key)?.value);

test(`the shim surfaces the exact golden-backed metadata builder (alias identity)`, () => {
  assert.equal(pageMetadata, codingAgentSettingsMetadata);
});

test(`the shim golden's metadata and probes regions byte-match the G20 golden's (the alias adds no behavior)`, () => {
  const shim = read(`coding-agent-settings-shim.expected.json`);
  const target = read(`coding-agent-settings-metadata.expected.json`);
  assert.equal(region(shim, `metadata`), region(target, `metadata`));
  assert.equal(region(shim, `probes`), region(target, `probes`));
});
