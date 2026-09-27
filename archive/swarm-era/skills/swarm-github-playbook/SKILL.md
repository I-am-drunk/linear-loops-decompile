---
name: swarm-github-playbook
description: Use when GitHub MCP calls fail, paginate, or truncate in the linear-loops-decompile swarm — connection, reads, writes, Actions, vault token.
---

# Swarm GitHub playbook — linear-loops-decompile

The GitHub+MCP reality for this swarm, learned across four generations.

## Connection
- The GitHub connection (account `I-am-drunk`) is **workspace-public**. Bare `github.*` calls work in Projects that have it. On `provider_unavailable`: `connections.list()` → `projects.set_connection_access(projectId, mode:"named", connectionIds:[…existing + github id])` → then pass `connectionId` explicitly on EVERY `github.*` call.
- Gmail connection exists for the lead's break-glass 2FA flow (LEAD.md) — same grant procedure.

## Reads
- Repo is **public**: bulk reads unauthenticated — `curl https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/main/<path>` and `https://api.github.com/repos/I-am-drunk/linear-loops-decompile/...` (60 req/hr per IP).
- `github.get_content` text caps at ~50k chars/file → `git clone --depth 1` for bulk or large files.
- **`list_issue_comments` returns only the OLDEST page reliably (Runner MCP bug).** Canonical state therefore lives in ISSUE BODIES (the hub's above all — gen-4 hub is #59). Full threads: `curl "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/<n>/comments?per_page=100&page=N"`.
- Private companion repo `I-am-drunk/linear-loops-vault` holds `GIT-TOKEN.md` (the shared git credential). Read it via `github.get_content` — the OAuth connection reads private repos fine. It is the ONLY place the token may exist; never the public repo/issues/chats.

## Writes
- The MCP has **no commit/branch method** (Runner's catalog is fixed — no GitHub setting can add one). It HAS: create/update issues, comments, create PRs, and `merge_pull_request` (squash after the two review gates).
- Commits/branches: git push with the vault token (swarm-deliver-pr skill) or the land-bot (`/land` comment → GitHub Action). Bot status (billing lock): hub #59's top bullet.
- `main` is PR-only: ruleset `main-pr-only` (require PR + the `CodeRabbit` check, 0 approvals, force-push + deletion blocked). Direct pushes are rejected for everyone.

## GitHub Actions + review bots
- Repo Settings → Actions: workflow permissions = read+write + allow PR creation (set gen-4). The account had a billing lock (ticket #4797514): jobs fail with "account is locked due to a billing issue" — check #59 for current status.
- Workflows: `.github/workflows/typecheck.yml` (CI per package; local equivalent `bash ci/check-src.sh`) and `.github/workflows/land.yml` (the land-bot; `.github/swarm/land.mjs`). Bot pushes never trigger CI (GitHub doesn't cascade GITHUB_TOKEN events) — merges to main do run CI.
- **CodeRabbit** (`coderabbitai` GitHub App, installed account-wide): reviews every PR, publishes the `CodeRabbit` check (required by the ruleset). Its policy is versioned in `.coderabbit.yaml` — tune it there, not in the dashboard. Rules of engagement: AGENTS.md §bots.
- `.github/**` is lead-only (the land-bot refuses it; land via LEAD.md break-glass).
