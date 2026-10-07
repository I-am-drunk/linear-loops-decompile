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

Required as a first-class provider, with pairing and model configuration in
Linear-style settings. The current adapter is a prototype over our own
transport; compatibility with a real T3 environment is **UNVERIFIED**.

`docs/plan/t3-code-connect.md` records the inspected T3 protocol, the mismatch
in PR #359, and the live pairing/turn/reconnect acceptance criteria. Do not
promote mocked RPC responses into a compatibility claim.

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
| IN4 | versioned T3 Code Connect bridge; real pairing, turn, cancel and replay |
| IN5 | per-automation and per-chain-step selection |
| IN6 | cost accounting into run records |
