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

## Merging

- `github.merge_pull_request` with `method: "squash"`, after gate evidence and the
  legal audit (see the `ship` skill).

## Never

- No browser for repo work, no minted personal tokens (use the vault token).
  If you are truly blocked, ask the user.
