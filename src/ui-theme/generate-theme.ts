/**
 * `generateTheme`: exact reproduction of Linear's runtime theme generator
 * (corpus chunk `ThemeHelper.CeMKYPhf.js`, Linear v1.32.4; issue #168).
 *
 * Linear's theme is a FUNCTION, not a palette: 116 color tokens + 18 shell
 * values are computed from `{ base, accent, colorFormat, contrast }` (LCH
 * tuples) at runtime, plus lazily-derived elevated/sub/menu/selected/focus/
 * sidebar themes. Every coefficient, branch, ordering, and clamp below is
 * reproduced precisely from the corpus so our tokens are byte-for-byte equal
 * to Linear's computed tokens — verified against golden vectors executed
 * from the corpus generator itself (golden/*.json; see the tests).
 *
 * The single environment input is the retina flag (upstream:
 * `window.matchMedia("min-device-pixel-ratio: 2 …").matches` imported from
 * `ThemeProvider`); it selects the *Thin border tokens. It is a constructor
 * parameter here so both branches are testable, and it is deliberately NOT
 * part of the memo hash — exactly as upstream, where it is module state.
 *
 * The four first-party parametrizations (corpus `lightThemeRefresh.DyWCsE3P.js`):
 *   dark default:  base [5.52, .4, 272],  accent [47.917542332560124, 59.30267706856808, 288.42138382943733], contrast 27
 *   dark HC:       base [8, .75, 272],    same accent, contrast 90
 *   light default: base [97.94, .5, 282], accent [53, 52.26, 286.91], contrast 30
 *   light HC:      base [98.7, .5, 282.86346318829925], same accent, contrast 90
 */

import {
  ANY_COLOR_REGEX,
  adjust,
  adjustTo,
  clamp,
  fromCss,
  getTextColor,
  mix,
  sufficientContrastForText,
  toCss,
  type AdjustDelta,
  type ColorFormat,
  type Lch,
} from "./color.ts";
import { themeObjectHash } from "./hash.ts";

export interface ThemeInput {
  base: Lch;
  accent: Lch;
  colorFormat: ColorFormat;
  contrast: number;
  elevation?: number;
  baseTheme?: Theme;
  sidebarInput?: { base: Lch; [key: string]: unknown };
  _themeType?: string;
}

export type ThemeColors = Record<string, string>;

export interface Theme {
  hash: string;
  shadowColor: string;
  contrast: number;
  colorFormat: ColorFormat;
  focusShadow: string;
  shadowLow: string;
  shadowBorder: string;
  shadowMedium: string;
  shadowHigh: string;
  shadowInset: string;
  inputPadding: string;
  inputPaddingBlock: string;
  inputPaddingInline: string;
  inputBackground: string;
  inputBorder: string;
  inputBorderRadius: string;
  inputFontSize: string;
  color: ThemeColors;
  isDark: boolean;
  highlightVariant: (css: string) => string;
  textHighlight: (css: string, ratio: number) => string;
  elevatedTheme: () => Theme;
  subTheme: () => Theme;
  sidebarTheme: () => Theme;
  menuTheme: () => Theme;
  selectedTheme: () => Theme;
  focusTheme: () => Theme;
  baseTheme: Theme | undefined;
}

/** mapValues (corpus helper `s`). */
function mapValues<T, U>(obj: Record<string, T>, fn: (value: T, key: string) => U): Record<string, U> {
  const out: Record<string, U> = {};
  Object.keys(obj).forEach((key) => {
    out[key] = fn(obj[key]!, key);
  });
  return out;
}

/**
 * Bisection for a candidate color's L that clears the APCA text-contrast bar
 * against `text` (corpus helper `l`). Falls back through reduced chroma when
 * no L at the candidate's chroma suffices; may return undefined.
 */
function contrastLevel(candidate: Lch, text: Lch): Lch | undefined {
  const [origL, c, h] = candidate;
  const [textL] = text;
  let lo = 0;
  let hi = 100;
  let found = hi;
  let ok = false;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    const probe: Lch = [mid, c, h];
    if (sufficientContrastForText(text, probe)) {
      ok = true;
      found = mid;
      if (textL > mid) lo = mid;
      else hi = mid;
    } else if (textL > mid) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  if (ok) return [found, c, h];
  const fallbackChromas = [c * 0.75, c * 0.5, c * 0.25, 0];
  for (const chroma of fallbackChromas) {
    lo = origL;
    hi = 100;
    found = hi;
    ok = false;
    while (hi - lo > 0.1) {
      const mid = (lo + hi) / 2;
      const probe: Lch = [mid, chroma, h];
      if (sufficientContrastForText(probe, text)) {
        ok = true;
        found = mid;
        hi = mid;
      } else {
        lo = mid;
      }
    }
    if (ok) return [found, chroma, h];
  }
  return undefined;
}

/** Memo key: the input with baseTheme collapsed to its hash (corpus `u`). */
export function themeInputHash(input: ThemeInput): string {
  const baseHash = input.baseTheme?.hash;
  const hashable = typeof baseHash === `string` ? { ...input, baseTheme: baseHash } : input;
  return themeObjectHash(hashable);
}

/**
 * Build the memoized generator (corpus `c(a)` + module retina state).
 * Upstream memoizes per module load; we memoize per generator instance.
 */
export function makeGenerateTheme(retina: boolean): (input: ThemeInput) => Theme {
  const cache = new Map<string, Theme>();
  const generateTheme = (input: ThemeInput): Theme => {
    const key = themeInputHash(input);
    const cached = cache.get(key);
    if (cached) return cached;
    const theme = buildTheme(input, key);
    cache.set(key, theme);
    return theme;
  };

  function buildTheme(e: ThemeInput, hash: string): Theme {
    const o = e.base;
    const c = o[0] > 50; // bright base
    const u = c && o[0] > 97 && o[1] < 8; // near-white base
    const d = Math.min(e.contrast, 30) + Math.max(e.contrast - 30, 0) * 0.25;
    const ee = ((c ? -1 : 1) * d) / 30;
    const f = (color: Lch, delta: AdjustDelta): Lch =>
      adjust(color, mapValues(delta as Record<string, number | undefined>, (v) => v && v * ee));
    const te = Math.min(e.contrast, 30) + Math.max(e.contrast - 30, 0) * 0.25;
    const ne = ((c ? -0.8 : 1) * te) / 70;
    const p = (color: Lch, delta: AdjustDelta): Lch =>
      adjust(color, mapValues(delta as Record<string, number | undefined>, (v) => v && v * ne));
    const m = ((c ? -0.9 : 0.8) * (e.contrast + Math.max(e.contrast - 30, 0) * 0.4)) / 10;
    const h = (color: Lch, delta: AdjustDelta): Lch =>
      adjust(color, { ...delta, l: delta.l && delta.l * m, c: (delta.c ?? 0) * m });
    const re = ((c ? -1 : 1) * (3 + (100 - e.contrast) / 70)) / 4;
    const g = (color: Lch, delta: AdjustDelta, target?: AdjustDelta): Lch => {
      const adjusted = adjust(getTextColor(color), { ...delta, l: delta.l && delta.l * re });
      return target ? adjustTo(adjusted, target) : adjusted;
    };
    const alphaScale = Math.max(1, 1 + Math.max(e.contrast - 30, 0) / (c ? 50 : 10));
    const v = (alpha: number): string => toCss(e.colorFormat, [0, 0, 0, alpha * alphaScale]);
    const y = (1 + Math.abs(o[0] - 50) / 50) / 2;

    const ie = f(o, c ? { l: 3.5 } : { l: 4.25, c: 0.5 });
    const b = f(o, c ? { l: 3.5 } : { l: -3.25, c: 0 });
    const ae = f(b, c ? { l: 5 } : { l: 2.5, c: 3 });
    const x = f(o, c ? { l: 5.5 } : { l: 2, c: 0.5 });
    const oe = f(x, c ? { l: 1.5 } : { l: 1, c: 0.5 });
    const S = h(o, c ? { l: 3.5, c: 1 } : { l: 4, c: 0.5 });
    const se = h(o, c ? { l: 4.5, c: 1 } : { l: 5, c: 0.5 });
    const ce = retina ? h(o, c ? { l: 3, c: 1 } : { l: 6, c: 0.5 }) : S;
    const C = h(o, c ? { l: 1, c: 1 } : { l: 2, c: 0.5 });
    const le = h(o, c ? { l: 2, c: 1 } : { l: 2.75, c: 0.5 });
    const ue = retina ? h(o, c ? { l: 3, c: 1 } : { l: 3.5, c: 0.5 }) : C;
    const w = h(o, c ? { l: 5, c: 1 } : { l: 5, c: 0.5 });
    const de = h(o, c ? { l: 9, c: 1 } : { l: 7, c: 0.5 });
    const T = retina ? h(o, c ? { l: 5, c: 1 } : { l: 10, c: 0.5 }) : w;
    const E = h(o, c ? { l: 17, c: 1 } : { l: 20, c: 0.5 });
    const D = h(o, c ? { l: 21, c: 1 } : { l: 24, c: 0.5 });
    const fe = retina ? h(o, c ? { l: 17, c: 1 } : { l: 26, c: 0.5 }) : E;
    const O = (color: Lch): Lch => {
      const t = c ? ((o[0] - color[0]) / o[0]) * 1.09 : (color[0] - o[0]) / (100 - o[0]);
      return [c ? 0 : 100, 0, 0, clamp(t, 0, 1)];
    };
    const k = mix(o, e.accent, (1 + o[1] / 30) * (c ? 0.18 : 0.05));
    const pe = f(k, c ? { l: 2 } : { l: 2.5, c: 2 });
    const A = g(o, { l: c ? -10 * y : 10 }, { c: 0 });
    const j = g(o, { l: (c ? -20 : -10) * y, c: 1 });
    const M = g(o, { l: -40 * y, c: 1 });
    const N = g(o, { l: -66 * y, c: 1 });
    const me = g(o, { l: -45 * y }, { h: e.accent[2], c: 70 });
    const he = 1 + Math.max(e.contrast - 30, 0) / 70;
    const ge = (c ? 30 : 15) * he;
    const P = (color: Lch): Lch => {
      const t = ge * (Math.abs(color[0] - o[0]) / 100);
      return adjust(color, { l: color[0] > 100 - t ? -t : t });
    };
    const F = e.accent;
    const I = p(o, c ? { l: -6 } : { l: 12, c: 0.75 });
    const _e = p(o, c ? { l: -6 } : { l: 12, c: 0.5 });
    const ve = p(o, c ? { l: 9 } : { l: 22, c: 0.5 });
    const ye = p(o, c ? { l: 13, c: 0 } : { l: 29, c: 1.5 });
    const L: Lch = [48, 59.31, 288.43]; // purple
    const R = e.baseTheme ? fromCss(e.baseTheme.color.focusColor ?? ``) : e.accent;
    const be = R[1] > 50 && (c ? R[0] < 90 : R[0] > 30);
    const z = R[1] < 20 ? L[2] : R[2];
    const xe = be ? R : adjustTo(R, c ? { l: 70, c: 90, h: z } : { l: 50, c: 120, h: z });
    const B: Lch = [80, 70, 267]; // blue
    const V: Lch = [67.5, 45, 210]; // teal
    const H: Lch = c ? [68, 64.37, 141.95] : [60, 64.37, 141.95]; // green
    const U: Lch = [80, 90, 85]; // yellow
    const W: Lch = [66, 80, 48]; // orange
    const G: Lch = [58, 73, 29]; // red
    const Se = contrastLevel(L, A) || L;
    const Ce = contrastLevel(B, A) || B;
    const we = contrastLevel(V, A) || V;
    const Te = contrastLevel(H, A) || H;
    const Ee = contrastLevel(U, A) || U;
    const De = contrastLevel(W, A) || W;
    const Oe = contrastLevel(G, A) || G;
    const K = c ? 0.2 : 0.03;

    const q: Record<string, Lch> = {
      bgSub: b,
      bgSubHover: ae,
      bgBase: o,
      bgBaseHover: ie,
      bgShade: x,
      bgShadeHover: oe,
      bgSelected: k,
      bgSelectedHover: pe,
      bgFocus: f(o, c ? { l: 5 } : { l: 9, c: 0.5 }),
      bgBorder: S,
      bgBorderHover: se,
      bgBorderThin: ce,
      bgBorderFaint: C,
      bgBorderFaintHover: le,
      bgBorderFaintThin: ue,
      bgBorderSolid: w,
      bgBorderSolidHover: de,
      bgBorderSolidThin: T,
      bgBorderStrong: E,
      bgBorderStrongHover: D,
      bgBorderStrongThin: fe,
      bgBorderAlpha: O(S),
      bgBorderAlphaHover: O(se),
      bgBorderAlphaThin: O(ce),
      bgBorderFaintAlpha: O(C),
      bgBorderFaintAlphaHover: O(le),
      bgBorderFaintAlphaThin: O(ue),
      bgBorderSolidAlpha: O(w),
      bgBorderSolidAlphaHover: O(de),
      bgBorderSolidAlphaThin: O(T),
      bgBorderStrongAlpha: O(E),
      bgBorderStrongAlphaHover: O(D),
      bgBorderStrongAlphaThin: O(fe),
      bgSelectedBorder: h(k, { l: 3.5, c: 1 }),
      bgSelectedBorderHover: h(k, { l: 4.5, c: 1 }),
      labelBase: j,
      labelBaseHover: P(j),
      labelFaint: N,
      labelLink: me,
      labelMuted: M,
      labelMutedHover: P(M),
      labelTitle: A,
      labelTitleHover: P(A),
      bgModalOverlay: [0, 0, 0, clamp((c ? 0.25 : 0.4) * alphaScale, 0, 0.8)],
      controlPrimary: F,
      controlPrimaryHover: f(F, { l: c ? 6 : 5, c: 2 }),
      controlPrimaryLabel: g(e.accent, {}, { c: Math.min(5, e.accent[1]) }),
      controlSecondary: I,
      controlSecondaryHover: p(I, { l: 12, c: 1 }),
      controlSecondarySelected: p(I, c ? { l: 15, c: 1 } : { l: 22, c: 1 }),
      controlSecondaryLabel: j,
      controlTertiary: _e,
      controlTertiaryHover: ve,
      controlTertiaryLabel: j,
      controlTertiarySelected: ye,
      scrollbarBg: adjust(N, { l: 0.3 }),
      scrollbarBgHover: adjust(N, c ? { l: 0.8 } : { l: 0.4 }),
      scrollbarBgActive: N,
      chromeTabBg: f(o, { l: c ? -2.5 : 5, c: c ? 0 : 2 }),
      chromeTabBgHover: f(o, { l: c ? -5 : 7, c: c ? 0 : 2 }),
      chromeTabBgActive: f(o, { l: c ? -8 : 10, c: c ? 0 : 2 }),
      blueBase: B,
      blueBaseHover: f(B, { l: 5 }),
      blueBg: Ce,
      blueMid: f(B, { l: 8 }),
      blueText: g(B, {}, { l: c ? 50 : 80, c: 80 }),
      blueForeground: getTextColor(Ce),
      blueTint: mix(o, B, K),
      greenBase: H,
      greenBaseHover: f(H, { l: 5 }),
      greenBg: Te,
      greenMid: f(H, { l: 8 }),
      greenText: g(H, {}, { l: c ? 50 : 80, c: 80 }),
      greenForeground: getTextColor(Te),
      greenTint: mix(o, H, K),
      orangeBase: W,
      orangeBaseHover: f(W, { l: 5 }),
      orangeBg: De,
      orangeMid: f(W, { l: 8 }),
      orangeText: g(W, {}, { l: c ? 50 : 80, c: 80 }),
      orangeForeground: getTextColor(De),
      orangeTint: mix(o, W, K),
      purpleBase: L,
      purpleBaseHover: f(L, { l: 5 }),
      purpleBg: Se,
      purpleMid: f(L, { l: 8 }),
      purpleText: g(L, {}, { l: c ? 50 : 80, c: 80 }),
      purpleForeground: getTextColor(Se),
      purpleTint: mix(o, L, K),
      redBase: G,
      redBaseHover: f(G, { l: 5 }),
      redBg: Oe,
      redMid: f(G, { l: 8 }),
      redText: g(G, {}, { l: c ? 50 : 80, c: 80 }),
      redForeground: getTextColor(Oe),
      redTint: mix(o, G, K),
      tealBase: V,
      tealBaseHover: f(V, { l: 5 }),
      tealBg: we,
      tealMid: f(V, { l: 8 }),
      tealText: g(V, {}, { l: c ? 50 : 80, c: 80 }),
      tealForeground: getTextColor(we),
      tealTint: mix(o, V, K),
      yellowBase: U,
      yellowBaseHover: f(U, { l: 5 }),
      yellowBg: Ee,
      yellowMid: f(U, { l: 8 }),
      yellowText: g(U, {}, { l: c ? 50 : 80, c: 80 }),
      yellowForeground: getTextColor(Ee),
      yellowTint: mix(o, U, K),
      scrollBackground: c ? [100, 0, 0, 0] : [0, 0, 0, 0.004],
      shadowColor: h(c ? [0, 0, 0, 0.03] : [0, 0, 0, 0.15], { l: 1 }),
      focusColor: xe,
      githubLogo: M,
      sidebarLinkBg: f(o, c ? { l: 2.8 } : { l: 6.5, c: 1 }),
      sidebarLinkBgActive: f(o, c ? { l: 4.9 } : { l: 12.5, c: 1 }),
    };

    const J = mapValues(q, (color) => toCss(e.colorFormat, color));
    const cssOf = (token: string): string => J[token]!;

    let elevatedMemo: Theme | undefined;
    let subMemo: Theme | undefined;
    let sidebarMemo: Theme | undefined;
    let menuMemo: Theme | undefined;
    let focusMemo: Theme | undefined;
    let selectedMemo: Theme | undefined;

    const Pe = v(0.02);
    const X = v(0.04);
    const Fe = v(0.06);
    const Ie = v(0.07);
    const Le = v(0.08);
    const Z = v(0.1);
    const Q = v(0.125);
    const Re = v(0.3);
    const ze = (css: string): Lch => (css === cssOf(`bgBase`) ? o : ANY_COLOR_REGEX.test(css) ? fromCss(css) : o);

    const theme: Theme = {
      hash,
      shadowColor: cssOf(`shadowColor`),
      contrast: e.contrast,
      colorFormat: e.colorFormat,
      focusShadow: `0 0 0 1px ${cssOf(`focusColor`)}`,
      shadowLow: c ? `0px 3px 6px -2px ${Pe}, 0px 1px 1px ${X}` : `0px 0.5px 1px 1px ${Re}`,
      shadowBorder: `0 0 0 0.5px ` + cssOf(`bgBorder`),
      shadowMedium: c
        ? `0 6px 18px ${Pe}, 0 3px 9px ${X}, 0 1px 1px ${X}`
        : `0 3px 8px ${Q}, 0 2px 5px ${Q}, 0 1px 1px ${Q}`,
      shadowHigh: c
        ? `0 9px 48px ${Le}, 0 6px 24px ${Z},  0 1px 1px ${X}`
        : `0 4px 40px ${Z}, 0 3px 20px ${Q},0 3px 12px ${Q}, 0 2px 8px ${Q}, 0 1px 1px ${Q}`,
      shadowInset: `0 1px 1px inset ${Ie}, 0 1px 3px inset ${Ie}, 0 2px 5px inset ${Z}`,
      inputPadding: `6px 12px`,
      inputPaddingBlock: `6px`,
      inputPaddingInline: `12px`,
      inputBackground: cssOf(`bgBase`),
      inputBorder: `1px solid ${cssOf(`bgBorder`)}`,
      inputBorderRadius: `8px`,
      inputFontSize: `0.8125rem`,
      color: J,
      isDark: !c,
      highlightVariant: (css: string): string => {
        const parsed = fromCss(css);
        const delta: AdjustDelta = u ? (parsed[1] > 2 ? { l: -5, c: 6 } : { l: -8 }) : { l: 8, c: 5 };
        return toCss(e.colorFormat, adjust(parsed, delta));
      },
      textHighlight(css: string, ratio: number): string {
        return toCss(
          e.colorFormat,
          mix(ze(this.color.bgBase ?? ``), c ? adjust(fromCss(css), { l: 7, c: 8 }) : fromCss(css), ratio),
        );
      },
      elevatedTheme: () =>
        (elevatedMemo ||=
          e.elevation === -1 && e.baseTheme
            ? e.baseTheme
            : generateTheme({
                ...e,
                elevation: (e.elevation ?? 0) + 1,
                baseTheme: theme,
                _themeType: `elevated`,
                base: f(q.bgBase!, { l: c ? -8 : 4.125, c: c && !u ? 0 : 0.5 }),
              })),
      subTheme: () =>
        (subMemo ||=
          !u && e.elevation === 1 && e.baseTheme
            ? e.baseTheme
            : {
                ...generateTheme({
                  ...e,
                  elevation: (e.elevation ?? 0) - 1,
                  base: b,
                  baseTheme: theme,
                  _themeType: `sub`,
                }),
              }),
      sidebarTheme: () => {
        if (!sidebarMemo) {
          sidebarMemo = e.sidebarInput
            ? generateTheme({ ...e, ...e.sidebarInput, baseTheme: theme, _themeType: `sidebar` })
            : theme.subTheme();
          const t = e.sidebarInput ? sidebarMemo.elevatedTheme() : theme;
          const n = e.sidebarInput ? e.sidebarInput.base[0] > 50 : c;
          const r = e.sidebarInput
            ? n && e.sidebarInput.base[0] > 97 && e.sidebarInput.base[1] < 8
            : u;
          sidebarMemo.color.controlTertiaryHover = n ? Fe : t.color.controlSecondary!;
          sidebarMemo.color.controlSecondary = r ? t.color.bgBase! : n ? t.color.bgShade! : t.color.controlSecondary!;
          sidebarMemo.color.controlSecondaryHover = r
            ? t.color.bgBaseHover!
            : n
              ? t.color.bgShadeHover!
              : t.color.controlSecondaryHover!;
        }
        return sidebarMemo;
      },
      menuTheme: () =>
        (menuMemo ||=
          (theme.baseTheme !== undefined &&
            ![`base`, `elevated`].includes(e._themeType ?? ``) &&
            theme.baseTheme?.menuTheme()) ||
          generateTheme({
            ...e,
            baseTheme: theme,
            _themeType: `menu`,
            base: f(q.bgBase!, { l: c ? -8 : 8, c: c && !u ? 0 : 0.5 }),
          })),
      selectedTheme: () =>
        (selectedMemo ||= generateTheme({ ...e, base: q.bgSelected!, baseTheme: theme, _themeType: `selected` })),
      focusTheme: () =>
        (focusMemo ||= generateTheme({ ...e, base: q.bgFocus!, baseTheme: theme, _themeType: `focus` })),
      baseTheme: e.baseTheme,
    };
    return theme;
  }

  return generateTheme;
}

/** The four first-party parametrizations (corpus `lightThemeRefresh.DyWCsE3P.js`). */
export const themePresets = {
  darkDefault: {
    base: [5.52, 0.4, 272] as Lch,
    accent: [47.917542332560124, 59.30267706856808, 288.42138382943733] as Lch,
    contrast: 27,
  },
  darkHighContrast: {
    base: [8, 0.75, 272] as Lch,
    accent: [47.917542332560124, 59.30267706856808, 288.42138382943733] as Lch,
    contrast: 90,
  },
  lightDefault: {
    base: [97.94, 0.5, 282] as Lch,
    accent: [53, 52.26, 286.91] as Lch,
    contrast: 30,
  },
  lightHighContrast: {
    base: [98.7, 0.5, 282.86346318829925] as Lch,
    accent: [53, 52.26, 286.91] as Lch,
    contrast: 90,
  },
} as const;
