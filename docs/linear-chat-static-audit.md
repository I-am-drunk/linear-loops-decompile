# Linear chat static audit — 2026-10-12

This is SOURCE evidence, not a live compatibility result. Reviewed parent
`24e088e` against all 15 artifacts in
`tools/linear-chat-probe/evidence/sources.json`: hashes, lengths and every
landmark match. Read `KNOWLEDGE.md` §§4–6, 8/8a as historical leads, not facts
overriding the artifacts. The requested pipeline reader (`read.mjs`) is absent at that revision;
used byte-bounded reads of the original owner's ignored corpus instead.
No corpus files or upstream implementation are included in this change.

## S1: official SDL gaps

All references below are to `extracts/linear-official/schema.graphql`,
upstream `689ccc1e905d`, SHA-256
`dcfdea8bdd8134d5afa7a7161d78c60c67e10290a4434d4ffaa61ca4ba63aeb7`.
Line ranges are one-based in the checked-in extract.

| Locator | Finding and adapter implication |
|---|---|
| `AiConversation`, 1566–1668 | `parts: [AiConversationPart!]` is nullable; absent hydration is not an empty successful reply. `iterationId` is nullable. The status field explicitly describes a conversation-level summary, not the assistant lifecycle. |
| `AiConversationPartMetadata`, 2749–2776 | `turnId` is required; phase is nullable `answer`/`commentary`. Correlate parts to the returned assistant turn, not simply “all text after send.” Phase is not completion. |
| `AiConversationBaseToolCall`, 1724–1738; `AiConversationToolCall`, 3768–3817 | `rawArgs`/`rawResult` are nullable JSON, not guaranteed strings. The union has 48 members, but is not a list of locally executable tools or supported models. |
| `AiConversationErrorPart`, 2244–2290 | `errorType` is nullable (documented default unknown); message is required. Scope, reset and retry resolution are nullable. Preserve unknown rather than relabeling every error as billing or transport failure. |
| `AiConversationElicitationOption`/`Part`, 1952–2014 | Option prompt can be null: selecting an option may dismiss without replying. Scope, reconnect integration, server URL and selection metadata are optional. A visible label alone does not establish a wire response. |
| `AiConversationElicitationResponsePart`, 2029–2055 | Response has an elicitation ID and typed data; user/bodyData can be null. Do not fabricate actor attribution; authorize our actor before a new submission. |
| `AiConversationPart`/`PartType`, 2734–2799 | Ten stored union members versus eleven enum values; `widgetPlaceholder` has no stored object member. Keep transient placeholders separate from GraphQL fragments. |

Whole-file checks find no `type AiConversationTurn`, no
`input AiConversationSendMessageInput` and no `aiConversation*` root fields.
S2's turn statuses therefore remain **client-artifact evidence**, not official
turn SDL. These absences prove only the pinned public surface, not private
endpoint behavior or rejection of every credential type.

## S4: two compression layers, not one

`RefreshManager.DpVjn8XM.js`, SHA-256
`4ae55015ff6cb1d529edef8947b64f97c1cf51bbd38a24b54ba904e49968f613`.
Offsets below are zero-based UTF-8, end-exclusive.

| Byte range / landmark | Rechecked behavior |
|---|---|
| 282200–284990, `initConnection` / `unpackBinaryFrame` | URL `syncCompression=zstd-v1` depends on decoder support and `!zstdFailed`; handshake `compressionDictionaryVersion` separately depends on `enableSyncMessageCompression`. KNOWLEDGE §4 conflates these gates. |
| 284712–284985, `unpackBinaryFrame` | Without the handshake dictionary version, the entire binary frame goes to MessagePack unchanged. Only with that version does marker value 1 select dictionary-compressed payload after two prefix bytes, or marker value 0 strip one prefix byte. Other prefixes remain unchanged. Never apply unconditional prefix stripping. |
| 265900–267100, `decode` / `setDictionary` | Message-level `syncDictionary` is nonempty bytes, at most 65,536 bytes, with SHA-256 matching dictionaryId. `syncCompressed` must reference that installed ID. Unknown IDs fail; dictionary transport is not an authentication credential. |
| 264194–265660, `Ud` / `contentSize` | Message-level decompression has a 64 MiB budget and requires declared content size. This is not a recommended budget for our adapter. |
| 283400–284060, `onmessage` | Text parses as JSON, binary unpacks as MessagePack; unrequested message-level compressed commands throw. Omitting compression does not prove the server will stream JSON. |

DESIGN: our future decoder negotiates each layer independently, validates
bounds before allocation and fails closed on unsupported frames. The current
contract passes normalized replacement snapshots only, never raw steps.
JSON-only acceptance, reconnect behavior and replay guarantees remain
**UNVERIFIED** until the live probe records them.

## Historical claims deliberately not promoted

The map correctly retracts KNOWLEDGE §8a's “only way in,” exportable
“login-born token,” common workflow send operation and wrapper-only billing
claims. S3 proves one caller path; S2/S10 show workflow model persistence;
S4 selects no session-token issuance field; S11 is an accounting query, not
a pricing promise. No source-only audit can close those live acceptance gaps.
The coding harness model names in KNOWLEDGE §5 describe adjacent agent
sessions, not Linear chat model discovery. No such names or defaults are
installed in the shared adapter contract.

## S2/S3: creation hints do not prove send-time model selection

S2 (`Issue.DRYymPCa.js`, SHA-256
`6d08004c61b2e89c58ef9aaa7d6716ede5ef528e6efb3da59216490210962039`)
bytes 1331150–1331770 set `promptPresetKey` in local conversation creation;
1334460–1334630 declare it virtual and `createOnly`. S3's send construction
at 6472 (see the parent source manifest) does not pass that field.
This is not an established model selector or a verified private send input.
E5 remains open; model discovery and accepted options must be measured rather
than inferred from a local creation hint.
