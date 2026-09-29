/**
 * LinearAgentEmptyStateHero — clean reimplementation of the corpus chunk
 * `LinearAgentEmptyStateHero.Cu9P_j7X.js` export `t` (matrix §E "Session UI"
 * row, the `LinearAgentEmptyState*` (+Hero) evidence): the Linear Agent
 * empty-state hero — a 23-column x 11-row grid of 253 small agent icons
 * (one hidden cell behind the center) under a single gradient center icon,
 * with per-cell CSS custom properties driving the ripple animation.
 * Original code; every value below is verified byte-for-byte against the
 * committed corpus-executed golden
 * (`golden/empty-state-hero.expected.json`) — see `corpus-manifest.json`
 * and the golden test.
 *
 * The golden's observation is the flattened host tree with the icon seam
 * held as a declared string marker (the icon lives in the
 * ContextualMenuActions chunk and is its own ledger surface — the G16
 * boundary), so this module mirrors that boundary: it takes the icon
 * component as an argument and reproduces everything else exactly —
 * the grid layout math, the sin-hash pseudo-random channel offsets, the
 * JS `toFixed` formatting (including `(-0).toFixed(2) === "0.00"` on the
 * zero-x column), the `${row}-${col}` keys, the computed-member class
 * tables keyed by `!!shouldAnimate << 1 | !!isHidden << 0` (grid cells)
 * and `!!shouldAnimate << 0` (center), and both icon call shapes
 * ({size:14, color:'labelFaint'} per cell; {size:14, gradient:true}
 * center). The class strings are pinned facts verified via the golden
 * bytes.
 *
 * Zero runtime deps: elements carry the standard registered React element
 * symbol (G4 precedent), so the tree is indistinguishable as a VALUE from
 * the corpus output and the golden byte oracle applies.
 */

const ELEMENT: unique symbol = Symbol.for(`react.transitional.element`) as never;

export interface HostElement {
  $$typeof: typeof ELEMENT;
  type: unknown;
  key: string | null;
  props: Record<string, unknown>;
}

function h(type: unknown, props: Record<string, unknown>, key: string | null = null): HostElement {
  return { $$typeof: ELEMENT, type, key, props };
}

// Grid geometry (corpus module-level constants, in source order).
const GRID_COLUMNS = 23;
const CELL_SIZE = 24;
const CELL_ICON_SIZE = 14;
const CENTER_ICON_SIZE = 14;
const HIDDEN_CELL_COLUMN = Math.floor(GRID_COLUMNS / 2); // 11
const HIDDEN_CELL_ROW = 10;
const BASE_DELAY_SECONDS = 0.4;
const DELAY_DISTANCE_DIVISOR = 360;
const PUSH_OUT_DISTANCE = 10;
const CELL_COUNT = 253; // 23 columns x 11 rows
// The ripple origin the per-cell distance is measured from (px).
const ORIGIN_X = 276;
const ORIGIN_Y = 252;

/** The corpus's deterministic pseudo-random hash: frac(sin(i * 12.9898) * 43758.5453). */
function pseudoRandom(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

interface GridCell {
  key: string;
  isHidden: boolean;
  style: Record<string, string>;
}

// Module-eval grid table, exactly as the corpus computes it at import time.
const GRID_CELLS: GridCell[] = Array.from({ length: CELL_COUNT }, (unused, index) => {
  void unused;
  const row = Math.floor(index / GRID_COLUMNS);
  const column = index % GRID_COLUMNS;
  const centerX = column * CELL_SIZE + CELL_SIZE / 2;
  const centerY = row * CELL_SIZE + CELL_SIZE / 2;
  const dx = centerX - ORIGIN_X;
  const dy = centerY - ORIGIN_Y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const delay = BASE_DELAY_SECONDS + distance / DELAY_DISTANCE_DIVISOR;
  const peakSeed = pseudoRandom(index);
  return {
    key: `${row}-${column}`,
    isHidden: row === HIDDEN_CELL_ROW && column === HIDDEN_CELL_COLUMN,
    style: {
      "--peak": (0.332 + peakSeed * 0.216).toFixed(3),
      "--peak2": (0.276 + pseudoRandom(index + 71) * 0.108).toFixed(3),
      "--trough": (0.232 + pseudoRandom(index + 37) * 0.126).toFixed(3),
      "--tx": `${(distance > 0 ? -(dx / distance) * PUSH_OUT_DISTANCE : 0).toFixed(2)}px`,
      "--ty": `${(distance > 0 ? -(dy / distance) * PUSH_OUT_DISTANCE : 0).toFixed(2)}px`,
      animationDelay: `${delay.toFixed(3)}s`,
    },
  };
});

// Computed-member class tables, exactly as the corpus writes them
// (cells keyed by !!shouldAnimate << 1 | !!isHidden << 0; center by
// !!shouldAnimate << 0). Each entry is a pinned source literal.
const CELL_CLASS_TABLE: Record<number, { className: string }> = {
  0: { className: `sx-78zum5 sx-6s0dn4 sx-l56j7k sx-14svvqe sx-nz22vk` },
  2: { className: `sx-78zum5 sx-6s0dn4 sx-l56j7k sx-g01cxk sx-jagms sx-nz22vk sx-gvmadx sx-1op9djp sx-1aquc0h sx-1c74tu6 sx-skzprw sx-1wqtlb8` },
  1: { className: `sx-78zum5 sx-6s0dn4 sx-l56j7k sx-14svvqe sx-nz22vk sx-lshs6z sx-1a5igra` },
  3: { className: `sx-78zum5 sx-6s0dn4 sx-l56j7k sx-g01cxk sx-jagms sx-nz22vk sx-gvmadx sx-1c74tu6 sx-skzprw sx-1wqtlb8 sx-lshs6z sx-1a5igra` },
};

const CENTER_CLASS_TABLE: Record<number, { className: string }> = {
  0: { className: `sx-10l6tqk sx-1dbmry8 sx-1oomx0e sx-78zum5 sx-6s0dn4 sx-l56j7k sx-6jxa94 sx-1v9usgg sx-1hvvaxa sx-47corl sx-1hc1fzr sx-3oybdh` },
  1: { className: `sx-10l6tqk sx-1dbmry8 sx-1oomx0e sx-78zum5 sx-6s0dn4 sx-l56j7k sx-6jxa94 sx-1v9usgg sx-1hvvaxa sx-47corl sx-1hc1fzr sx-3oybdh sx-cexje7 sx-1aquc0h sx-1jh9esf sx-1o94a5v sx-skzprw sx-1v7wizp sx-1esw782` },
};

const OUTER_CLASS = `sx-1n2onr6 sx-bwjon8 sx-193iq5w sx-xat1px sx-yorhqc`;
const GRID_CLASS = `sx-10l6tqk sx-13vifvy sx-1nrll8i sx-rvj5dj sx-f49nek sx-oamupz sx-bwjon8 sx-1l76qip sx-uuh30 sx-1uxdgec sx-47corl`;

export interface LinearAgentEmptyStateHeroProps {
  shouldAnimate: boolean;
  /** The agent icon component — the ContextualMenuActions seam (its own ledger surface). */
  icon: unknown;
}

export function LinearAgentEmptyStateHero(props: LinearAgentEmptyStateHeroProps): HostElement {
  const { shouldAnimate, icon } = props;
  return h(`div`, {
    className: OUTER_CLASS,
    children: [
      h(`div`, {
        className: GRID_CLASS,
        "aria-hidden": true,
        children: GRID_CELLS.map((cell) =>
          h(
            `div`,
            {
              ...CELL_CLASS_TABLE[(Number(!!shouldAnimate) << 1) | Number(!!cell.isHidden)],
              style: cell.style,
              children: h(icon, { size: CELL_ICON_SIZE, color: `labelFaint` }),
            },
            cell.key,
          ),
        ),
      }),
      h(`div`, {
        ...CENTER_CLASS_TABLE[Number(!!shouldAnimate)],
        "aria-hidden": true,
        children: h(icon, { size: CENTER_ICON_SIZE, gradient: true }),
      }),
    ],
  });
}
