# Inference providers

An automation needs a model. Which model, from where, is configurable — and T3
Code Connect is a first-class option, not a special case.

## The registry

One interface, several implementations. A provider supplies: a list of models,
a chat/completion call with streaming, and a cost estimate per call.

| Provider | Auth | Notes |
|---|---|---|
| **T3 Code Connect** | pairing | the owner's own inference path; first-class |
| Anthropic API | API key | direct |
| OpenAI-compatible | API key + base URL | covers OpenRouter, LiteLLM, vLLM, together |
| Local | base URL | Ollama, llama.cpp |

Providers are configured in Settings (`settings.md`) and selected per
automation — and, with prompt chaining, per chain step.

## T3 Code Connect

Pairing-based rather than key-based: the server pairs with a Code Connect
environment and gets a scoped session token, so no long-lived API key sits in
our database. The pairing exchange and the channel are **`wss:` only** — the
transport sends the token in its first frame after the socket opens, so a
`ws:` URL would put it on the wire in cleartext. IN4 rejects a non-TLS URL
rather than warning about it. The transport pattern already exists in this repo
(`src/connect`, `SPECS/t3-connect.md`) — descriptor fetch, pairing exchange,
scoped token, WebSocket channel. The provider adapter wraps that channel in the
registry's interface.

Settings for it: environment label, pairing state, the models it offers, and a
reachability test.

## Credentials

Write-only. A key goes in and never comes back out — the API returns presence
and a masked hint, never the value. Already how `settings.*` behaves
server-side (R3.3); the provider registry keeps it.

## Failure

A provider that is unreachable when an automation fires does not silently skip
the run. The run records `provider_unavailable` with the provider named, and
the automation's next scheduled fire is unaffected. If an automation names a
fallback provider, it is tried in order.

## What changed

Earlier eras treated Linear's own chat route as "the brain" and external
inference as a grudging fallback, with a live experiment (E1) gating
everything. That inverts: the owner has their own inference, so the provider
registry is the primary path and the Linear chat route is one more provider —
unbuilt, and not blocking anything.

## Slices

| Slice | Scope |
|---|---|
| IN1 | provider interface + registry + settings CRUD |
| IN2 | OpenAI-compatible adapter (unblocks everything with one key) |
| IN3 | Anthropic adapter |
| IN4 | T3 Code Connect adapter over `src/connect` |
| IN5 | per-automation and per-chain-step selection |
| IN6 | cost accounting into run records |
