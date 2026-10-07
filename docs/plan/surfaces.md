# Whole-UI roadmap

These groups partition work; they do not claim complete route coverage or
verified product copy. SH owns the shared inventory and workspace surfaces;
ST owns settings; AU owns the Cursor-layout exception. Expand each group into
one route/state per claim on its existing lane issue.

| Slice family | Surfaces | First useful slice |
|---|---|---|
| SH4 | Composition, shell, routes, themes | Serve one route with real navigation |
| UI1 | Workspace/team navigation | Switch context and retain route state |
| UI2 | Issues, lists, boards | Read an issue list and open its detail |
| UI3 | Issue detail and editing | Edit one field with persistence/error state |
| UI4 | Search, filters, command menu | One scoped search with keyboard selection |
| UI5 | My issues, inbox, notifications | Read list, open item, update unread state |
| UI6 | Projects, milestones, initiatives | Project list and detail |
| UI7 | Cycles, backlog, team workflow | Cycle list and selected cycle |
| UI8 | Documents, comments, attachments | Read/render one document with evidence |
| UI9 | Views, grouping, display preferences | Save and restore one view configuration |
| ST6+ | Account, workspace, team and administration settings | One persisted settings section at a time |
| AU1–AU11 | Automation list/editor, runs, triggers and tools | Full runnable path in delivery.md |

Shared overlays, menus, editors, loading/empty/error states, keyboard behavior,
permissions, and responsive/theme variants belong to the surface using them.
Billing/account-management screens require an explicit local behavior contract;
a visual replica must not pretend to change a first-party subscription.

## Evidence and completion

Maintain a versioned inventory of observed routes/states. For each implemented
state record: reference build, route, viewport, theme, locale, permissions,
fixture data, source citations and available render/behavior captures. Capture
failures and unexpected fallback/error output must fail the comparison.

A slice is complete when its route is reachable in the served app, its intended
interaction persists or produces the documented result, and the actual output
matches the reference state. Verify focus, keyboard behavior, failures and
empty/loading states as well as the populated screenshot.

Citation presence is a prerequisite, not proof. Track structured citation
targets (file plus key/selector and property) as evidence-tool work on #314;
today's free-form citations require manual source review. Record missing
reference access as UNVERIFIED and leave the unsupported claim out.

The Cursor sibling owns versioned automation reference evidence and the handoff
contract. Consume a reviewed reference revision; do not copy guessed layout
facts or treat the MCP protocol as evidence of Cursor's visual layout.
