# SPEC — Product contract and scope boundary

## The decision

We build an **original, self-hosted implementation of Linear Loops only**. It is
not a self-hosted Linear replacement and not a general Linear client.

“Exact” remains the acceptance bar, but it applies to every Linear Loops surface
we deliberately ship: its UI, behavior, values, and run semantics must be
verified against the corpus through the golden-test process. Exactness does not
expand the product into Linear's tracker, global navigation, or Linear Settings.

The product must be useful as a standalone loop operator, **used in parallel to
Linear** (owner directive 2026-09-28, issue #295): the owner keeps using
first-party Linear normally — inbox, notifications, tracker — and opens OUR
self-hosted app when they want Loops, where every Loops feature works exactly
as in Linear, through Linear's public API wherever a public surface exists.

1. connect the user's Linear account;
2. create, publish, enable, inspect, and run Loops;
3. choose the Linear entities a Loop operates on — including **selecting the
   team** a loop is configured against, within a **workspace context**;
4. review streamed runs and audited write-back; and
5. configure the self-hosted server.

That is the entire scope test. Build a view or capability only when it is needed
for one of those five jobs and evidence shows it is part of the corresponding
Linear Loops experience.

Scope widening under job 3 (issue #295): **Workspaces** and **Teams** are in
scope in ADAPTED form — not full workspace/team administration, but the
workspace notion Loops operates within and the ability to SELECT a team for a
loop (team eligibility, boundary/scope policy, default-team resolution — the
corpus kernels are enumerated in `docs/remap/`). Some team-related behavior
deliberately differs from first-party because we carry only what Loops needs;
each such delta is declared in the remap ledger as an ADAPT row (exact client
algorithm + exact degraded-state rendering over a declared reduced data
source). **Settings** is a first-class build target (our server's settings,
plus the Loops-hosted settings surfaces the corpus places under
`/settings/...`).

## What appears in our app

The sidebar contains only:

- **Loops** and Loops-required views, such as the list, editor/detail, runs,
  and templates when those slices are built; and
- **Settings**, which includes *our server's* configuration surface and the
  corpus-scoped Loops-hosted settings surfaces (the `/settings/...` routes the
  remap ledger places in scope, e.g. loops management, agent automation,
  team-scoped loop settings).

The exact label/order/visual behavior of each Loops view comes from the corpus.
The existence of a Settings entry does not mean copying Linear's general
Settings: our own server-configuration pages are ours, and the Loops-hosted
settings pages are limited to the ledger's in-scope rows — no general Linear
workspace administration.

Do **not** add Linear tracker destinations—Inbox, My issues, teams, projects,
cycles, documents, search, generic workspace administration—or a general Linear
sidebar merely because the connected account has those data. Entity selection
and context that a Loop needs are in scope; recreating their standalone Linear
screens is not.

## The three connections are deliberately distinct

| Connection | Purpose | Credential boundary | What it must not be mistaken for |
| --- | --- | --- | --- |
| **Linear account / public API** | Read the user's Linear data needed by Loops; receive supported events; make audited, idempotent Loop write-back. | PAT or OAuth to the documented public API. | It is not an AI credential and cannot call the normal chat route. |
| **Linear chat session / golden goose** | Primary brain for a Loop: drive normal Linear AI chat rather than the credit-metered Loops wrapper. | Separately stored, write-only interactive user-session bridge to the client API and minimal chat sync reader. | It is not public API access, and its lifetime/refresh details remain E1 live-capture work. |
| **Fallback inference** | Keep a loop runnable if the chat bridge is unavailable or the user deliberately disables it. | A separately configured external provider key. | It is not the product thesis or an equivalent replacement for the golden goose. |

A Settings screen must display these as separate states. It must never imply
that connecting a PAT/OAuth token enables the golden goose, or that the fallback
is the intended primary brain.

## Architecture consequence

Linear remains the user's system of record. Our server owns Loop definitions,
versions, run/turn state, audit records, idempotency, and self-hosted settings.
The public API is the data plane. The golden goose is a bounded brain adapter:
client-api send/poll first, then only the minimal original sync reader required
for chat streaming. It is not a project to reimplement the broader Linear sync
engine.

The implementation stays original. We use the locally generated, gitignored
corpus as evidence and oracle; we never serve, redistribute, or commit Linear
client code. We reimplement the scoped Loops product in clean code and prove
its exactness with corpus-executed goldens.

## Decision checklist for every slice

Before claiming a UI or server slice, answer all four questions in its issue/PR:

1. **Loop job:** Which of the five Loop-operator jobs above requires this?
2. **Scope:** Is it a Loops-required view/control or our own Settings—not a
   generic Linear product feature?
3. **Authority:** Is the relevant behavior from the corpus, public API docs, or
   the separately documented golden-goose trace? Public-API and chat-session
   assertions must not be conflated.
4. **Proof:** What corpus-executed golden will verify the scoped UI/behavior?

If the first two answers are not explicit, the slice is out of scope. If the
last two are incomplete, it is research or documentation work, not feature code.

## Current implementation constraint

The freeze exited 2026-09-28 (PR #256 ack), and the #295 directive set the
effort split at 60% UI assembly / 40% harness with ~80% of UI work non-golden.
Non-golden is not un-evidenced: assembly slices follow the remap ledger's
transcription rule (corpus-transcribed structure and copy, cited per chunk)
and seam rule (owner-licensed changes only in seam implementations on the
closed seam list). Goldens remain required for the rows the ledger marks
golden-required. E1 (the live golden-goose experiment) remains ON HOLD.

## Related authorities

- `README.md` — short product statement and operator-facing explanation.
- `PLAN.md` — implementation sequence and freeze exit.
- `docs/remap/` — the #295 disposition ledger: every feature of the widened
  scope with disposition, data plane, golden requirement, and owner decisions.
- `SPECS/target-architecture.md` — component/data/credential architecture.
- `docs/golden-goose-chat-route.md` — corpus-derived chat-route facts and E1
  unknowns; facts there take precedence over product shorthand here.
- `AGENTS.md` — mandatory execution rule for every session.
