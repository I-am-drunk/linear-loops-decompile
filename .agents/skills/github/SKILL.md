---
name: github
description: GitHub access recipes for linear-loops-decompile — Code Mode methods, curl fallbacks, token handling, common misuses.
---

# github — read/write the repo without tripping

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

- Read the shared token from the PRIVATE vault:
  `github.get_content({owner:"I-am-drunk", repo:"linear-loops-vault", path:"GIT-TOKEN.md"})`.
- Push without ever printing it:
  ```bash
  export GIT_TOKEN='<value>'
  git -c credential.helper='!f() { echo username=x-access-token; echo password=$GIT_TOKEN; }; f' push origin <branch>
  unset GIT_TOKEN
  ```
- The token never appears in the public repo, issues, PRs, chat, cloud files, or
  command output. `main` is PR-only; the token cannot bypass that
  (ruleset `main-pr-only`).

## Merging

- `github.merge_pull_request` with `method: "squash"`, after gate evidence and the
  legal audit (see the `ship` skill).

## Never

- No browser for repo work, no passwords or PATs in chat, no minted personal
  tokens. If you are truly blocked, ask the user.
