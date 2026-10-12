# Automations list reference

This is a partial implementation of Cursor 3.23.12's desktop list, with its
compiled default flags. It has not passed an authenticated screenshot comparison.
The pinned [reference facts](https://github.com/I-am-drunk/cursor-decompile/blob/2d7c435c1c1b4c761fd9fc4c4c86221fe01f2ff3/facts/automations-desktop-list.md)
record the artifact hashes, source ranges and selectors. `ui-facts.json` binds
each consumed metric to this package's selectors.

The previous implementation borrowed metrics from unrelated Linear screens.
Those citations and the extra model, trigger and last-run columns are removed.
The list now follows the reference's four columns, Mine/Team controls,
name/owner substring search, stable active-first ordering, 25-row pages and
separate empty card. Creation time is inline beside the owner.

## Host contract

Pass the signed-in numeric `viewerId` for the default Mine tab. Team shows the
host's authorized rows. This presentation filter is not an access-control
boundary. `access` defaults to full for existing summary producers; limited
records do not expose their creation date. Supply `createdAtLabel` using the
host's formatter; this package does not claim to reproduce relative-time rules.

The host handles `data-act` events, resets page to 1 on tab/search changes,
and supplies `openMenuFor` after a menu action. Render `renderRowActions(id)`
in the host overlay, outside the table's clipped container. Clear search uses mouse-down
with prevented default and retained input focus in the reference. Persistence,
menu keyboard/focus management and application navigation are AU10 work.

The shell supplies Linear's font and camel-case `--t-*` theme variables.
Color-role adaptation is our product choice, not evidence of Cursor colors.
Keep rem values in rem; the reference's effective root font is unobserved.

## Remaining gaps

| Area | Limit |
|---|---|
| Full page | Managed-agent overview and template gallery are not implemented. |
| Assets | Tool icons, status marks and menu/chevron artwork are not reproduced; tool names and simple glyphs are explicit fallbacks. |
| Menus | Popup geometry and keyboard/focus behavior still need the reference primitive. |
| Variants | Evals, rollout-off states, compact cloud panel and loading/error states are not covered. |
| Runtime | Rendering and pure query functions exist; application event wiring and saved state are separate slices. |
| Exactness | No authenticated paired screenshots, current web-state capture or effective reference font measurement exists. |

These gaps remain open. Passing declaration checks establishes cited coverage,
not full-page parity. The source version and compiled flag defaults are fixed;
an account override or later Cursor release may render a different surface.
