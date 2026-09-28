// Hand-written drive-mode driver for
// aiConversationSendElicitationResponsesMutation.CEPAjw5J.js (G15; original
// code). The chunk's only export (`export{r as t}`) is
//   t(client, input) — serializes the elicitation responses and calls
//   client.mutate(document, { input: {...} }).
// The driver passes a RECORDING fake client whose mutate captures its exact
// arguments and returns a sentinel; the golden therefore pins the full wire
// contract: the GraphQL document string, the input spread, and the per-kind
// response payload serialization — including two behavioral quirks worth
// pinning verbatim:
//   - the confirmation branch HARDCODES { confirmed: true } (the input's own
//     confirmed field, if any, is ignored);
//   - the per-response map keeps ONLY {elicitationId, data} (extra fields on
//     a response entry are dropped), while the TOP-level input spread keeps
//     every field (conversationId etc. pass through).
// The default branch throws the real UnreachableCaseError (the 521 B zero-
// import chunk executes REAL); the driver pins its message.
export default async ({ entry }) => {
  const send = entry.t;

  const record = () => {
    const calls = [];
    return {
      calls,
      client: { mutate: (document, variables) => { calls.push({ document, variables }); return Promise.resolve(`sentinel`); } },
    };
  };

  // All four kinds in one call: the wire shape for each, plus passthrough of
  // top-level input fields and the drop of extra per-response fields.
  const r1 = record();
  const returned = await send(r1.client, {
    conversationId: `conv-1`,
    extraTopLevel: `kept`,
    responses: [
      { elicitationId: `el-1`, extraPerResponse: `dropped`, data: { kind: `multipleChoice`, selectedOptionIndex: 2 } },
      { elicitationId: `el-2`, data: { kind: `confirmation`, confirmed: false } },
      { elicitationId: `el-3`, data: { kind: `entitySelection`, selectedEntityIds: [`ent-a`, `ent-b`] } },
      { elicitationId: `el-4`, data: { kind: `mcpServerConnection`, integrationId: `int-9` } },
    ],
  });

  // The unknown-kind default: the real UnreachableCaseError throws.
  let unknownKind = null;
  try {
    await send(record().client, { responses: [{ elicitationId: `el-x`, data: { kind: `not-a-kind` } }] });
  } catch (e) {
    unknownKind = { name: e.name, message: e.message, isError: e instanceof Error };
  }

  return {
    mutateReturnPassedThrough: returned,
    calls: r1.calls,
    unknownKind,
  };
};
