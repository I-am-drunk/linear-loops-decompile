---
name: swarm-deliver-pr
description: Use when delivering code, opening, or merging PRs in the linear-loops-decompile swarm — FILE blocks, vault-token git flow, land-bot, PR template, merge rules.
---

# Swarm deliver + PR — linear-loops-decompile

`main` is PR-only (ruleset `main-pr-only`); one task = one branch = one PR. CodeRabbit's `CodeRabbit` check gates merges; a buddy review with reproduced evidence gates judgment.

## 1. Deliver durably FIRST
The moment code works, publish it as FILE blocks on the task issue (`[T-NNN] <title>`) — sandboxes die at account reset. Format, each file in order:

```
### FILE: <repo-relative path>
```<lang>
<content>
```
```

Above the blocks: verification evidence (`tsc --noEmit` summary, test counts, Node version). Latest-wins on duplicate paths; suffix notes legal: `### FILE: x.ts (v2 — supersedes)`. Keep the issue BODY lean: state, evidence, file index, PR link — code's durable home is the branch + PR.

## 2. Commit — pick the first path that works
1. **Vault-token git push** (everyday): fetch the token from the private vault (`github.get_content({owner:"I-am-drunk", repo:"linear-loops-vault", path:"GIT-TOKEN.md"})`), then:
   ```bash
   git clone https://x-access-token:<TOKEN>@github.com/I-am-drunk/linear-loops-decompile.git
   git checkout -B agent-NN/tNNN-slug origin/main   # during generation overlap: gen<N>/agent-NN/tNNN-slug
   git commit -m "T-NNN: <what> (agent-NN)"
   git push -u origin agent-NN/tNNN-slug
   GH_TOKEN=<TOKEN> gh pr create --base main --head agent-NN/tNNN-slug --title "T-NNN: <title>" --body <pr-body>
   ```
2. **Land-bot** (zero-credential, when Actions runs — hub #59 tracks the billing lock): comment `/land branch=agent-NN/tNNN-slug from=#NN pr="T-NNN: <title>"` on the task issue, FILE blocks in the same comment (they apply last). `from=#A,#B` pulls every FILE block from those issues (body, then comments oldest→newest). Bot never writes `main` or `.github/**`; allowlist: `src/ work/ docs/ SPECS/ extracts/ pipeline/ ci/`, root `*.md`.
3. **Lead break-glass**: post on #59 asking the lead to land your FILE blocks.

## 3. PR body template
```
## T-NNN — <title>
Task issue: #NN · Author: agent-NN (gen N)

### Files
- `src/<pkg>/foo.ts` — <what it does>

### Verification (fresh clone, Node 22.x)
- `bash ci/check-src.sh` → tsc clean · NN/NN tests green (paste the summary)

### Review checklist (buddy: agent-NN, R?↔R? pair)
- [ ] Correct vs SPECS/<section>
- [ ] Original code (no transliterated Linear material)
- [ ] Package tsconfig is truth; conventions per work/LANDING.md
```

## 4. Review gates (two, both documented on the PR)
- **CodeRabbit** (`coderabbitai`) reviews every PR and its `CodeRabbit` check gates the merge. Address every finding with a fix commit or a reasoned rebuttal. Out-of-scope bot comments (re-litigating settled architecture) get one line: "out of scope per AGENTS.md §bots".
- **Buddy review** (R2↔R5, R3↔R4, R6↔R9, R7↔R8, R1↔R10): one review comment with reproduced evidence (fresh clone + `bash ci/check-src.sh`).

## 5. Merge
Both gates green + `github.get_pull_request` shows `mergeable` → `github.merge_pull_request({number, method:"squash"})`. Blocked/conflicting → post on issue #2, never force. After merging, note it on hub #59; the lead's truth pass updates `work/STATUS.md` + `work/LOG.md`.

## Never
No direct pushes to `main`. No tokens in the public repo/issues/chats. No heavy new runtime deps without a `work/LOG.md` justification (`zod` is pre-approved).
