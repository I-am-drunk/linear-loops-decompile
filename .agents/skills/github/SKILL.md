---
name: github
description: GitHub access recipes for linear-loops-decompile: Code Mode methods, curl fallbacks, token handling, common misuses.
---

# github: read/write the repo without tripping

## Reads

- File or dir: `github.get_content({owner, repo, path, ref?})`. Text caps at about
  50k chars; for bulk or binary use `git clone --depth 1` (public repo, no auth)
  or `curl https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/<ref>/<path>`.
- Issue/PR bodies: `github.get_issue` / `github.get_pull_request`.
- Comment THREADS: `github.list_issue_comments` returns the OLDEST page first and
  paging through it is clumsy. For the tail of a long thread use unauthenticated
  curl and page until a short page:
  `curl -s "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/<N>/comments?per_page=100&page=<K>"`
- RAW vs PRETTY (binding for value-laden reads, 2026-09-29): the corpus
  prettifier rewrites template-literal interiors, so string values read from
  `pipeline/corpus/pretty/` can be byte-wrong. Cite raw `client/*.js` offsets
  or corpus-executed output for any copy string, label, or other value-laden
  literal; use `pretty/` only for structure and identifiers. Proof case:
  `labelForTeams`'s `+ ${n-3}` (no space before `+`) — correct in raw,
  corrupted in pretty (PR #307).
- Open PRs and issues: the REST list endpoints via curl, or
  `github.search_issues`.

## Writes (comments, issues, PRs, merges)

- A write either runs live or stages for user approval, depending on account
  settings. The return value says which: `{queued: true, ref}` means staged.
  Never describe a staged action as done.
- On `provider_unavailable`: the connection exists but is not granted to this
  Project. `connections.list()`, then pass `connectionId` explicitly on every
  call.

## Pushing code (the only auth you ever need)

- Read the shared token from the vault:
  `github.get_content({owner:"I-am-drunk", repo:"linear-loops-vault", path:"GIT-TOKEN.md"})`.
- Push with it however is convenient, e.g.:
  ```bash
  git remote set-url origin https://x-access-token:<TOKEN>@github.com/I-am-drunk/linear-loops-decompile.git
  git push origin <branch>
  ```
- This account exists for agents (owner directive 2026-09-27): handling the token
  in chat, transcripts, or command output is fine. The one real constraint:
  do not COMMIT it to this public repo — GitHub secret scanning auto-revokes a
  classic PAT found in a public repo, which breaks every session's push access.
  `main` is PR-only regardless (ruleset `main-pr-only`).

## Reviewing (shared-account facts, verified 2026-09-29)

- Formal approval is IMPOSSIBLE on our own PRs: GitHub rejects an author
  approving their own PR, and every session is the same account, so
  `POST /pulls/<N>/reviews` with `event: APPROVE` returns
  `422 "Can not approve your own pull request"` on every PR the shared
  account authored — which is every PR in this repo today (verified on
  #307; a PR from an outside fork could still be formally approved).
  Post verdicts as `event: COMMENT` reviews. Consequences:
  - No shared-account PR ever reaches an approved review state. The feedback
    gate keys on review TEXT (scan for the verdict + evidence), never on
    review state. Tooling that waits for an approval waits forever.
  - `mergeable_state: blocked` is therefore EXPECTED on our PRs, but the
    field does not say WHICH blocker it is — before merging, still check
    the gate's status checks, the applicable rulesets, and the feedback
    threads rather than attributing `blocked` to the approval quirk.

## Merging

- `github.merge_pull_request` with `method: "squash"`, after gate evidence and the
  legal audit (see the `ship` skill).

## Never

- No browser for repo work, no minted personal tokens (use the vault token).
  If you are truly blocked, ask the user.
