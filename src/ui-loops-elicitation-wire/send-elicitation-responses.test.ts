/**
 * Golden test (G0 acceptance bar): our clean module's observable wire
 * behavior, projected through the SAME tagged-v2 grammar the corpus
 * execution was recorded with (tools/corpus-exec/serialize.ts — the declared
 * observation driver), must byte-match the committed corpus-executed golden.
 * The projection mirrors the golden driver line-for-line (same fixtures,
 * same recording client).
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { sendElicitationResponses, type ElicitationResponseData } from "./send-elicitation-responses.ts";

type TaggedObject = { tag: string; properties: Array<{ key: string; value: unknown }> };
const golden = JSON.parse(
  readFileSync(join(import.meta.dirname, `golden`, `send-elicitation-responses.wire.expected.json`), `utf8`),
) as { provenance: { serializer: string }; output: TaggedObject };

const bytes = (v: unknown): string => JSON.stringify(v, null, 2);

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(golden.provenance.serializer, SERIALIZER_VERSION);
});

test(`clean module byte-matches the corpus-executed golden (whole wire surface)`, async () => {
  const calls: Array<{ document: string; variables: Record<string, unknown> }> = [];
  const client = {
    mutate: (document: string, variables: Record<string, unknown>) => {
      calls.push({ document, variables });
      return Promise.resolve(`sentinel` as unknown);
    },
  };

  const returned = await sendElicitationResponses(client, {
    conversationId: `conv-1`,
    extraTopLevel: `kept`,
    responses: [
      // extraPerResponse must be dropped by the per-response narrowing.
      { elicitationId: `el-1`, extraPerResponse: `dropped`, data: { kind: `multipleChoice`, selectedOptionIndex: 2 } } as never,
      // test-only cast: the corpus IGNORES the caller's value (hardcodes true);
      // the type deliberately refuses `false` so a typed caller cannot send a
      // negative confirmation — this fixture pins the ignore-quirk.
      { elicitationId: `el-2`, data: { kind: `confirmation`, confirmed: false } as unknown as ElicitationResponseData },
      { elicitationId: `el-3`, data: { kind: `entitySelection`, selectedEntityIds: [`ent-a`, `ent-b`] } },
      { elicitationId: `el-4`, data: { kind: `mcpServerConnection`, integrationId: `int-9` } },
    ],
  });

  let unknownKind: { name: string; message: string; isError: boolean } | null = null;
  try {
    await sendElicitationResponses(
      { mutate: () => Promise.resolve(undefined) },
      { responses: [{ elicitationId: `el-x`, data: { kind: `not-a-kind` } as unknown as ElicitationResponseData }] },
    );
  } catch (e) {
    unknownKind = { name: (e as Error).name, message: (e as Error).message, isError: e instanceof Error };
  }

  const ours = serialize({
    mutateReturnPassedThrough: returned,
    calls,
    unknownKind,
  });
  assert.equal(bytes(ours), bytes(golden.output));
});
