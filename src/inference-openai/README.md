# OpenAI-style text provider

The adapter implements `/models` and `/chat/completions` behind the text-only
IN1 contract. `fetchImpl` is injected; native `fetch` is supported. Live
interoperability with individual gateways is **UNVERIFIED**.

| Endpoint | Default token-limit field |
| --- | --- |
| `https://api.openai.com/v1` | `max_completion_tokens` |
| Other compatible endpoints, including local servers | `max_tokens` |

`tokenLimitField` explicitly overrides either default. Choose the field your
endpoint supports; only that field is sent, and only when `maxTokens` is set.
The other-endpoint default preserves this adapter's existing request shape.

Source: [OpenAI Chat Completions create reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create),
read 2026-10-07: `max_tokens` is deprecated in favor of
`max_completion_tokens` and incompatible with o-series models. The default
uses the documented field for the OpenAI endpoint without guessing from model
names. An explicit override is the operator's compatibility choice.

## Transport and failures

Credentialed requests require HTTPS. Unauthenticated local HTTP remains valid.
Malformed URLs, unsupported schemes and URL userinfo are rejected before
transport. `fetchImpl` must honor `redirect: "error"`; the native-fetch
regression proves redirects are not silently followed. Destination resolution
and shared egress policy remain tracked in [#365](https://github.com/I-am-drunk/linear-loops-decompile/issues/365);
this adapter does not claim to enforce those policies.

Interrupted successful bodies and malformed model responses are unavailable,
so registry fallback can proceed. Interrupted error bodies retain their HTTP
classification, including a rejection that must not fall through.

Configured keys are redacted from failure details before the 200-character
limit. Keys of four characters or fewer have no hint. These requirements come
from [inference credentials/failures](../../docs/plan/inference.md) and the
[delivery boundaries](../../docs/plan/delivery.md).
