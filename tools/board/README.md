# Live coordination board

Run `node tools/board/main.mjs --feedback` with authenticated `gh`.
It only reads GitHub and prints a report. No issue or PR is changed.

PRs appear oldest first, with open parent branches and current head commits.
Every endpoint uses pagination. Lane tails show the last three comments.
Feedback counts include issue comments, formal reviews and inline comments,
including bots; counts never imply approval or resolution.

Use `--json` for complete fetched bodies and lane histories, `--repo owner/name`
for another repository, or `--help`. Without `--feedback`, review bodies are
not fetched. An API, authentication, parsing or later-page error fails the
command instead of presenting an incomplete queue as empty.

Read the linked discussions before claiming or merging. This tool does not
arbitrate claims or replace the branch/feedback checks in AGENTS.md.

Tests: `node --test tools/board/board.test.mjs`.
