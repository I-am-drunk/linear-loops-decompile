/**
 * Golden test (G0 acceptance bar): our clean module's observable behavior,
 * projected through the SAME tagged-v2 grammar the corpus execution was
 * recorded with (tools/corpus-exec/serialize.ts — the declared observation
 * driver), must byte-match the committed corpus-executed golden. Fixtures
 * mirror the golden driver line-for-line.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { TemplateCardPresenter, type TemplateTrigger } from "./template-card-presenter.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `template-presenter.copy.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: TaggedObject };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (whole presenter surface)`, () => {
  const label = (trigger: TemplateTrigger) => TemplateCardPresenter.triggerLabel({ trigger });
  const threw = (fn: () => unknown) => {
    try {
      fn();
      return null;
    } catch (e) {
      return { name: (e as Error).name, message: (e as Error).message, isError: e instanceof Error };
    }
  };

  const ours = serialize({
    triggerLabel: {
      scheduleHourly: label({ type: `schedule`, cadence: `hourly` }),
      scheduleDaily: label({ type: `schedule`, cadence: `daily` }),
      scheduleWeekly: label({ type: `schedule`, cadence: `weekly` }),
      scheduleUnknownCadenceThrows: threw(() => label({ type: `schedule`, cadence: `fortnightly` } as unknown as TemplateTrigger)),
      issueCreated: label({ type: `issue`, event: `entityCreated` }),
      issueTriage: label({ type: `issue`, event: `entityInTriage` }),
      issueOtherEvent: label({ type: `issue`, event: `entityUpdated` }),
      unknownTypeThrows: threw(() => label({ type: `webhook` } as unknown as TemplateTrigger)),
    },
    iconColor: {
      fromHex: TemplateCardPresenter.iconColor({ color: `blue` }, { color: { blue: `#6771c5` } }),
      fromLch: TemplateCardPresenter.iconColor({ color: `red` }, { color: { red: `lch(52.607% 63.6 29)` } }),
      unparseableFallsBackToBlack: TemplateCardPresenter.iconColor({ color: `x` }, { color: { x: `rgb(200, 50, 25)` } }),
    },
  });
  assert.equal(bytes(ours), bytes(golden.output));
});
