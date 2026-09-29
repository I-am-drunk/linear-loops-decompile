/**
 * SettingsSections — clean reimplementation of the corpus chunk
 * `WorkflowAgentAutomationSettingsConstants.DhHHohXQ.js` (matrix §F "Workflow
 * automation settings" row): the settings-page section/card/row primitives
 * plus the permissions anchor id. Original code; every value below is
 * verified byte-for-byte against the committed corpus-executed golden
 * (`golden/settings-sections.branches.expected.json`) through the tagged-v2
 * serializer as the declared observation driver — see `corpus-manifest.json`
 * and the golden test.
 *
 * The golden's observation is the driver's projected host tree (the G13
 * discipline): hook-free corpus composites (Flex, Text) executed and
 * flattened, the three hook/forwardRef-bearing ContextualMenuActions seams
 * (MP settings-item content, VP themed card, ZP list row) kept as declared
 * string-marker leaves. This module therefore produces that projected tree
 * directly: same element tags and seam markers, same prop KEY ORDER, same
 * merged stylex class strings and CSS-var styles, same sx-table values —
 * each a corpus fact pinned by the golden bytes.
 */

export type ProjectedNode = {
  element: string;
  key: null;
  props: Record<string, unknown>;
};

/**
 * The node vocabulary this module operates in: the PROJECTED space the golden
 * was recorded in (strings, numbers, null/undefined, projected elements, and
 * arrays thereof) — NOT raw React elements. A raw host element passed here
 * would serialize differently than the golden driver's recursive projection
 * (CodeRabbit finding on #274), so the types refuse it: callers project
 * first, exactly as the observation driver does.
 */
export type ProjectedChild = string | number | boolean | null | undefined | ProjectedNode | ProjectedChild[];

const el = (element: string, props: Record<string, unknown>): ProjectedNode => ({ element, key: null, props });

/** The seam markers the golden pins (ContextualMenuActions stubs, G13 style). */
export const seams = {
  settingsItemContent: `stub:ContextualMenuActions.MP(settings-item-content)`,
  settingsCard: `stub:ContextualMenuActions.VP(settings-card)`,
  settingsListRow: `stub:ContextualMenuActions.ZP(settings-list-row)`,
} as const;

/** The section anchor constant (corpus export `t`, chunk-local `f`). */
export const AGENT_AUTOMATION_PERMISSIONS_ANCHOR = `agent-automation-permissions`;

// ---- pinned corpus class/style facts (each verified via the golden) -------
const SECTION_CLASS = `sx-78zum5 sx-dt5ytf sx-1v2ro7d sx-1ghz6dp sx-1nuxya2`;
const HEADER_FLEX_CLASS = `sx-78zum5 sx-vx4679 sx-1q0g3np sx-uk3077 sx-1qughib sx-1a02dak sx-1v2ro7d sx-h8yej3 sc2sx-Flex-d11c8f6e`;
const TITLE_H3_CLASS = `sx-1j61x8r sx-ggjnk3 sx-84vug0 sx-11mg1s0 sx-ek0tjz sx-13jp3wb sx-3d248p sx-1wuuqhr sx-dpxx8g sx-1ghz6dp sx-1lliihq sc2sx-Text-c50a30fa`;
const ACCESSORY_DIV_CLASS = `sx-78zum5 sx-13a6bvl sx-5ij27j sx-8x9d4c sx-18y5l3o sx-2lah0s sx-14atkfc sx-b5nk4f`;
const ROW_DIVIDED_CLASS = `sx-1n2onr6 sx-1cpjm7i sx-1hmns74 sx-1y3wzot sx-1elnft9 sx-w8i89x sx-dogwlo sx-nvurfn sx-1xizm9w sx-kk1bqk sx-12maryy`;
const ROW_PLAIN_CLASS = `sx-1n2onr6`;
const ROW_TITLE_FLEX_CLASS = `sx-78zum5 sx-vx4679 sx-1q0g3np sx-6s0dn4 sx-euugli sx-1jnr06f sc2sx-Flex-d11c8f6e`;
const ROW_TITLE_TEXT_CLASS = `sx-1j61x8r sx-ggjnk3 sx-1srpx65 sx-11mg1s0 sx-ek0tjz sx-13jp3wb sx-3d248p sx-1wuuqhr sx-dpxx8g sx-1mzt3pk sx-1fzhlzt sc2sx-Text-c50a30fa`;
const DESCRIPTION_TEXT_CLASS = `sx-1j61x8r sx-167xe44 sx-1nzvdvg sx-ek0tjz sx-13jp3wb sx-3d248p sx-1wuuqhr sx-dpxx8g sx-1mzt3pk sx-1fzhlzt sx-d4r4e8 sc2sx-Text-c50a30fa`;
/** Text color CSS vars: labelMuted and the default label color. */
const LABEL_MUTED_VAR = `var(--sx-1dd5bcf)`;
const LABEL_DEFAULT_VAR = `var(--sx-ys2i3t)`;
// Corpus sx tables (entry-local `d`), passed through the card seam verbatim.
const SX_CARD = { kmVPX3: `sx-yjmnpe`, kUOVxO: `sx-1qleswr sx-333qjd`, $$css: true };
const SX_CARD_FLUSH = { kmVPX3: `sx-1717udv`, $$css: true };
const SX_ROW = { kAzted: `sx-u0aao5`, $$css: true };

export interface SettingsSectionProps {
  id?: string;
  title?: ProjectedChild;
  accessory?: ProjectedChild;
  children?: ProjectedChild;
  ref?: unknown;
}

/** Corpus export `r` (chunk-local `s`): the titled settings section. */
export function SettingsSection(props: SettingsSectionProps): ProjectedNode {
  const { id, title, accessory, children, ref } = props;
  return el(`section`, {
    id,
    ref,
    className: SECTION_CLASS,
    children: [
      title
        ? el(`div`, {
            ref: undefined,
            className: HEADER_FLEX_CLASS,
            style: undefined,
            children: [
              el(`h3`, {
                ref: undefined,
                className: TITLE_H3_CLASS,
                style: { "--x-4xs81a": LABEL_MUTED_VAR },
                children: title,
              }),
              accessory ? el(`div`, { className: ACCESSORY_DIV_CLASS, children: accessory }) : null,
            ],
          })
        : null,
      children,
    ],
  });
}

export interface SettingsCardProps {
  id?: string;
  flush?: boolean;
  sx?: unknown;
  children?: ProjectedChild;
  ref?: unknown;
}

/** Corpus export `n` (chunk-local `c`): the themed settings card seam. */
export function SettingsCard(props: SettingsCardProps): ProjectedNode {
  const { id, flush, sx, children, ref } = props;
  return el(seams.settingsCard, {
    id,
    ref,
    // The corpus composes `[d.card, r && d.cardFlush, s]` verbatim.
    sx: [SX_CARD, flush && SX_CARD_FLUSH, sx],
    children,
  });
}

export interface SettingsLabeledRowProps {
  title?: ProjectedChild;
  description?: ProjectedChild;
  labelFor?: string;
  descriptionId?: string;
  divided?: boolean;
  children?: ProjectedChild;
}

/** Corpus export `a` (chunk-local `l`): the labeled settings row. */
export function SettingsLabeledRow(props: SettingsLabeledRowProps): ProjectedNode {
  const { title, description, labelFor, descriptionId, divided, children } = props;
  return el(`div`, {
    // The corpus computed-member trick `{0:{...},1:{...}}[!!divided<<0]`.
    className: divided ? ROW_DIVIDED_CLASS : ROW_PLAIN_CLASS,
    children: el(seams.settingsListRow, {
      as: `div`,
      sx: SX_ROW,
      children: [
        el(seams.settingsItemContent, {
          children: [
            el(`div`, {
              ref: undefined,
              className: ROW_TITLE_FLEX_CLASS,
              style: undefined,
              children: labelFor
                ? el(`label`, {
                    ref: undefined,
                    htmlFor: labelFor,
                    className: ROW_TITLE_TEXT_CLASS,
                    style: { "--x-4xs81a": LABEL_DEFAULT_VAR },
                    children: title,
                  })
                : el(`span`, {
                    ref: undefined,
                    className: ROW_TITLE_TEXT_CLASS,
                    style: { "--x-4xs81a": LABEL_DEFAULT_VAR },
                    children: title,
                  }),
            }),
            description
              ? el(`span`, {
                  ref: undefined,
                  id: descriptionId,
                  className: DESCRIPTION_TEXT_CLASS,
                  style: { "--x-4xs81a": LABEL_MUTED_VAR },
                  children: description,
                })
              : null,
          ],
        }),
        children,
      ],
    }),
  });
}

export interface SettingsDescriptionRowProps {
  divided?: boolean;
  children?: ProjectedChild;
}

/** Corpus export `i` (chunk-local `u`): the description-only row. */
export function SettingsDescriptionRow(props: SettingsDescriptionRowProps): ProjectedNode {
  const { divided, children } = props;
  return el(`div`, {
    className: divided ? ROW_DIVIDED_CLASS : ROW_PLAIN_CLASS,
    children: el(seams.settingsListRow, {
      as: `div`,
      sx: SX_ROW,
      children: el(`span`, {
        ref: undefined,
        className: DESCRIPTION_TEXT_CLASS,
        style: { "--x-4xs81a": LABEL_MUTED_VAR },
        children,
      }),
    }),
  });
}
