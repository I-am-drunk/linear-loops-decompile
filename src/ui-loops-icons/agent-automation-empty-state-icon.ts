/**
 * AgentAutomationEmptyStateIcon — clean reimplementation of the corpus chunk
 * `AgentAutomationEmptyStateIcon.BW9M5hMw.js` export `t` (matrix §A "Empty
 * states" row). Original code; every value below is verified byte-for-byte
 * against the committed corpus-executed golden
 * (`golden/agent-automation-empty-state-icon.darkDefault.expected.json`,
 * PR #243) — see `corpus-manifest.json` and the golden test.
 *
 * The corpus component reads the three label tokens from the theme context
 * (`useTheme().color`); this module takes the theme as an argument so it stays
 * a pure value function (the context wiring belongs to the future UI shell
 * slice). It returns the exact host React element tree the corpus component
 * returns: same tag, same prop KEY ORDER (fill, viewBox, width, height,
 * className, children; per path: d, fill), same three `d` path literals.
 *
 * Zero runtime deps: elements are created with the standard registered React
 * element symbol (`Symbol.for("react.transitional.element")` — what the
 * corpus's own jsx-runtime emits on React 19), so the tree is
 * indistinguishable as a VALUE from the corpus output and the golden byte
 * oracle applies. Corpus evidence for the shape: chunk source jsxs/jsx calls.
 */

const ELEMENT: unique symbol = Symbol.for(`react.transitional.element`) as never;

export interface HostElement {
  $$typeof: typeof ELEMENT;
  type: string;
  key: null;
  props: Record<string, unknown>;
}

function h(type: string, props: Record<string, unknown>): HostElement {
  return { $$typeof: ELEMENT, type, key: null, props };
}

/** The three theme tokens this icon reads (corpus: `t.color.labelMuted` etc). */
export interface IconTheme {
  color: {
    labelMuted: string;
    labelBase: string;
    labelFaint: string;
  };
}

const PATH_0 = `M37.7132 31.1843C37.7671 32.1543 38.2969 33.1087 39.3131 33.8792C39.3549 34.7083 39.4751 35.3982 39.598 35.7506C39.7893 36.2991 40.1995 36.8146 40.8299 37.2381L56.7939 47.9602C57.4687 48.3698 58.7783 48.6328 60.2421 48.6243C61.7111 48.6158 63.0247 48.3357 63.7041 47.8928L80.2403 36.8686C81.2327 36.2069 81.7311 35.3468 81.7369 34.4984C81.7385 34.2748 81.7613 33.9077 81.7849 33.49C82.9912 32.5772 83.5662 31.4188 83.49 30.2832C83.56 30.7154 83.5917 31.1902 83.5996 31.6563C83.6097 32.2516 83.585 32.8515 83.5577 33.3583C83.5298 33.877 83.5014 34.2761 83.4998 34.5058C83.4918 35.6585 82.8147 36.8188 81.4855 37.705L64.9355 48.7383C63.7952 49.4818 61.9487 49.7946 60.2604 49.8045C58.5732 49.8143 56.7324 49.5229 55.5928 48.8227C55.5833 48.8169 55.5736 48.8109 55.5645 48.8047L39.5818 38.0702C38.7112 37.4853 38.145 36.7714 37.8818 36.017C37.6361 35.3125 37.4514 33.782 37.5742 32.2491C37.6025 31.8957 37.6473 31.5373 37.7132 31.1843Z`;

const PATH_1 = `M47.8541 28.5562C46.01 27.3176 42.9275 27.3262 40.969 28.6318C39.0104 29.9375 38.9863 32.0001 40.8304 33.2387L56.813 43.9732C58.6572 45.2116 61.7389 45.2027 63.6973 43.8971L80.24 32.8686C82.1984 31.563 82.2231 29.501 80.3794 28.2623C78.5352 27.0237 75.4528 27.0322 73.4943 28.3379L61.0875 36.6091C60.7429 36.8389 60.1847 36.8379 59.8408 36.607L47.8541 28.5562ZM60.4663 35.3568L72.2491 27.5016C74.8588 25.7618 79.0582 25.7046 81.6275 27.4303C84.1964 29.156 84.0947 31.9653 81.4852 33.705L64.9425 44.7334C62.3329 46.4731 58.1343 46.5307 55.5649 44.8053L39.5823 34.0707C37.013 32.3451 37.1141 29.5353 39.7238 27.7955C42.3335 26.0558 46.5329 25.9985 49.1022 27.7242L60.4663 35.3568Z`;

const PATH_2 = `M99.5217 13.636C77.8888 -0.893535 42.3944 -0.728589 20.2429 14.039C-0.400678 27.8017 -2.13412 49.3683 15.237 63.9985C15.5163 64.2337 15.4875 64.5714 15.17 64.7831L8.93202 68.9418C6.7776 70.378 8.2733 72.7516 11.2037 72.737L32.5925 72.6309C34.4418 72.6217 35.9634 71.6073 35.9841 70.3699L36.2221 56.0581C36.2546 54.0973 32.7132 53.0876 30.5588 54.5239L24.2892 58.7036C24.1081 58.8244 23.8575 58.8868 23.6023 58.8741C23.347 58.8612 23.1118 58.7744 22.9591 58.6367C9.88254 46.8555 11.5891 29.9831 27.8455 19.1452C45.6661 7.26487 74.2652 7.10996 91.7228 18.8352C109.18 30.5605 108.843 49.6974 91.0228 61.5778C83.1194 66.8466 73.1134 69.8054 62.8866 70.4503C59.8774 70.6401 57.623 72.4263 57.8502 74.4318C58.0763 76.428 60.6771 77.894 63.6728 77.7053C76.3622 76.9051 88.8116 73.2253 98.6246 66.6834C120.776 51.9158 121.155 28.1655 99.5217 13.636ZM100.77 12.8039C123.114 27.811 122.687 52.3084 99.8698 67.5198C89.7592 74.26 76.926 78.0546 63.8412 78.8797C59.8685 79.1302 56.3926 77.1785 56.0913 74.5195C55.7911 71.8696 58.7588 69.5256 62.7182 69.2759C72.5494 68.6559 82.1716 65.812 89.7776 60.7414C106.933 49.3048 107.221 30.9149 90.4748 19.6672C73.7282 8.4196 46.2456 8.54496 29.0907 19.9816C13.698 30.2436 11.8849 46.1058 23.7753 57.3798L29.3136 53.6876C32.5325 51.5416 38.036 53.0053 37.9849 56.0731L37.7469 70.3849C37.7154 72.2645 35.4174 73.7965 32.6083 73.8106L11.2195 73.9167C6.63477 73.9395 4.46791 70.2514 7.68681 68.1054L13.3738 64.3141C-4.04552 49.2143 -2.0741 27.2508 18.9977 13.2027C41.8148 -2.00869 78.4258 -2.20317 100.77 12.8039Z`;

export function AgentAutomationEmptyStateIcon(theme: IconTheme): HostElement {
  return h(`svg`, {
    fill: `none`,
    viewBox: `0 0 120 81`,
    width: `120`,
    height: `80`,
    className: `sx-ygnafs`,
    children: [
      h(`path`, { d: PATH_0, fill: theme.color.labelMuted }),
      h(`path`, { d: PATH_1, fill: theme.color.labelBase }),
      h(`path`, { d: PATH_2, fill: theme.color.labelFaint }),
    ],
  });
}
