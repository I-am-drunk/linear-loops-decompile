# Anthropic text provider

IN3 implements the non-streaming Messages API behind IN1's text-only contract.
`fetchImpl` is injected; native `fetch` is supported. Live Anthropic and custom
gateway interoperability remain **UNVERIFIED**.

| Behavior | Source, read 2026-10-07 |
| --- | --- |
| `x-api-key`, `anthropic-version: 2023-06-01`, top-level `system`, required `max_tokens` | [Messages reference](https://platform.claude.com/docs/en/api/messages/create) |
| `display_name`, `has_more`, `last_id` and `after_id` model pagination | [List models](https://platform.claude.com/docs/en/api/models/list) |
| Stop reasons, empty responses and continuation | [Handling stop reasons](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) |
| Separate cache counts and rates | [Messages usage](https://platform.claude.com/docs/en/api/messages/create), [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching#pricing) |

The adapter joins multiple system messages with blank lines in input order and
defaults `max_tokens` to 1024. These are local defaults, not API requirements.
Model listing follows each cursor under one deadline; malformed pages and
repeated cursors return `unavailable` without exposing an incomplete catalog.
For compatibility, an omitted `has_more` ends the list.

| API stop reason | Provider result |
| --- | --- |
| `end_turn`, `stop_sequence` | `end` |
| `max_tokens`, `model_context_window_exceeded` | `length` |
| `refusal` | `refusal` |
| Tool calls, `pause_turn`, missing or unknown reason | `rejected` |

Text blocks are concatenated. Tool and unsupported blocks are rejected before
returning any accompanying text. Thinking metadata may accompany valid text;
it is not returned. The local contract requires a text block, which may hold
an empty string; a response containing no text blocks is rejected even though
the API can produce an empty response.

`Usage.known: false` marks absent or invalid counts and usage with nonzero
cache categories that the initial two-rate accounting contract cannot fully
represent. In those cases token fields are partial counts or zero placeholders,
and `cost()` returns unknown. Complete measured zero counts remain known.
Cost uses operator-supplied prices; the offline character-based estimate is
approximate and its accuracy is **UNVERIFIED**.

Credentialed requests require HTTPS. Invalid URLs, unsupported schemes,
userinfo, queries and fragments in the configured endpoint root return
`unconfigured` before dispatch. Requests disable redirects; injected fetch
implementations must honor `redirect: "error"`. Native-fetch regressions cover
redirect refusal and deadlines. DNS/destination policy remains tracked in
[#365](https://github.com/I-am-drunk/linear-loops-decompile/issues/365).

`timeoutMs` defaults to 120,000 and accepts integers from 1 to 2,147,483,647.
The deadline covers the request, body read and every model page. Expiry aborts
the active request; completed calls clear their timers. HTTP 401/403 map to
`unconfigured`, 429 to `rateLimited`, 5xx (including 529) to `unavailable`, and
other failures to `rejected`. Interrupted error bodies retain that status.
Configured keys are redacted before truncating failure details; keys of four
characters or fewer have no hint. These policies follow the local
[credentials and failure contract](../../docs/plan/inference.md).

No POST is retried automatically. Durable retry identity belongs to the
execution layer, especially after a timeout with an uncertain provider outcome.
