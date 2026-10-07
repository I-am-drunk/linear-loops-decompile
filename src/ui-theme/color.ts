/**
 * Color math: exact reproduction of the corpus ColorConverter
 * (`ColorConverter.CVwFbLBP.js`, Linear v1.32.4). Every constant, matrix,
 * ordering, and clamp is reproduced precisely so downstream theme tokens are
 * byte-for-byte equal to Linear's computed tokens (issue #168; verified
 * against golden vectors executed from the corpus generator).
 *
 * Color values are LCH tuples `[l, c, h, a?]` (CSS lch(); D50-adapted Lab
 * underneath, exactly as the corpus computes it).
 */

export type Lch = number[];

/** Numeric clamp (corpus export `n`). */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type ColorFormat = "RGB" | "LCH" | "P3";

export interface AdjustDelta {
  l?: number;
  c?: number;
  h?: number;
  a?: number;
}

// D50 white point, exactly as the corpus writes it: [.3457/.3585, 1, .2958/.3585]
const D50: number[] = [0.3457 / 0.3585, 1, 0.2958 / 0.3585];

/** Round to 3 decimals via toFixed (corpus helper used by lch() printing). */
function round3(value: number): number {
  return parseFloat(value.toFixed(3));
}

/** lch()/display-p3/hex CSS string for an LCH tuple (corpus `toCss`). */
export function toCss(format: ColorFormat, color: Lch): string {
  const [l, c, h, a] = color;
  if (format === "LCH") {
    return `lch(${round3(l)}% ${round3(c)} ${round3(h)}${a === undefined ? `` : ` / ` + round3(a)})`;
  }
  if (format === "P3") {
    return lchToP3String(color);
  }
  return lchToRgbString(color);
}

const HEX_REGEX_LOOSE = /#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?/i;
const HEX_REGEX = new RegExp(`^${HEX_REGEX_LOOSE.source}$`, `i`);
const HEX_REGEX_SMALL_LOOSE = /#?([a-f\d])([a-f\d])([a-f\d])/i;
const HEX_REGEX_SMALL = new RegExp(`^${HEX_REGEX_SMALL_LOOSE.source}$`, `i`);
const LCH_REGEX_LOOSE = /lch\((\d{1,3}(?:\.\d+)?)\% (\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)(?: \/ ([1|0](?:\.\d+)?)?)?\)/i;
const LCH_REGEX = new RegExp(`^${LCH_REGEX_LOOSE.source}$`, `i`);
const P3_REGEX_LOOSE = /color\(display-p3 (\d{1,3}(?:\.\d+)?)\ (\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)(?: \/ ([1|0](?:\.\d+)?)?)?\)/i;
const P3_REGEX = new RegExp(`^${P3_REGEX_LOOSE.source}$`, `i`);
const ANY_COLOR_REGEX_LOOSE = new RegExp(`(?:${HEX_REGEX_LOOSE.source})|(?:${LCH_REGEX_LOOSE.source})|(?:${P3_REGEX_LOOSE.source})`, `i`);
export const ANY_COLOR_REGEX = new RegExp(`^${ANY_COLOR_REGEX_LOOSE.source}$`, `i`);

/** Parse hex/lch()/display-p3 CSS into an LCH tuple (corpus `fromCss`). */
export function fromCss(css: string): Lch {
  let m = HEX_REGEX.exec(css);
  if (m === null) {
    const small = HEX_REGEX_SMALL.exec(css);
    if (small) {
      m = small;
      m[1] += m[1];
      m[2] += m[2];
      m[3] += m[3];
    }
  }
  if (m) {
    const out = rgbToLch([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]);
    if (m[4] && !/ff/i.test(m[4])) out[3] = parseInt(m[4], 16) / 255;
    return out;
  }
  const lch = LCH_REGEX.exec(css);
  if (lch) {
    const out: Lch = [parseFloat(lch[1]), parseFloat(lch[2]), parseFloat(lch[3])];
    if (lch[4] && lch[4] !== `1`) out[3] = parseFloat(lch[4]);
    return out;
  }
  const p3 = P3_REGEX.exec(css);
  if (p3) {
    const out = p3ToLch([parseFloat(p3[1]), parseFloat(p3[2]), parseFloat(p3[3])]);
    if (p3[4] && p3[4] !== `1`) out[3] = parseFloat(p3[4]);
    return out;
  }
  return [0, 0, 0];
}

/** Black or white for text on a background, in LCH (corpus `getTextColor`). */
export function getTextColor(bg: Lch): Lch {
  const [l, c, h] = bg;
  return [l - c * 0.075 > 65 ? 0 : 100, Math.min(c / 2, c), h];
}

// APCA (corpus constants: blkThrs .022, blkClmp 1.414, W offset .027)
const BLK_THRS = 0.022;
const BLK_CLMP = 1.414;

function apcaSoftClamp(y: number): number {
  return y >= BLK_THRS ? y : y + (BLK_THRS - y) ** BLK_CLMP;
}

/** APCA-style contrast between two LCH colors (corpus `apcaContrast`). */
export function apcaContrast(a: Lch, b: Lch): number {
  const offset = 0.027;
  const bgY = apcaSoftClamp(a[0] / 100);
  const txtY = apcaSoftClamp(b[0] / 100);
  let sapc: number;
  const txtBrighter = txtY > bgY;
  if (Math.abs(txtY - bgY) < 5e-4) {
    sapc = 0;
  } else if (txtBrighter) {
    sapc = (txtY ** 0.56 - bgY ** 0.57) * 1.14;
  } else {
    sapc = (txtY ** 0.65 - bgY ** 0.62) * 1.14;
  }
  const clamped = Math.abs(sapc) < 0.1 ? 0 : sapc > 0 ? sapc - offset : sapc + offset;
  return Math.abs(clamped * 100);
}

export function sufficientContrastForText(a: Lch, b: Lch, threshold = 38): boolean {
  return apcaContrast(a, b) > threshold;
}

/** Relative adjust with the corpus clamps: l 0-100, c 0-132, h 0-360, a 0-1. */
export function adjust(color: Lch, delta: AdjustDelta): Lch {
  const [l, c, h, a = 1] = color;
  return [
    clamp(l + (delta.l ?? 0), 0, 100),
    clamp(c + (delta.c ?? 0), 0, 132),
    clamp(h + (delta.h ?? 0), 0, 360),
    clamp(a + (delta.a ?? 0), 0, 1),
  ];
}

/** Absolute adjust (corpus `adjustTo`). */
export function adjustTo(color: Lch, target: AdjustDelta): Lch {
  const [l, c, h, a = 1] = color;
  return [
    clamp(target.l ?? l, 0, 100),
    clamp(target.c ?? c, 0, 132),
    clamp(target.h ?? h, 0, 360),
    clamp(target.a ?? a, 0, 1),
  ];
}

/** Linear interpolation in Lab space with alpha lerp (corpus `mix`). */
export function mix(a: Lch, b: Lch, ratio: number): Lch {
  const alphaA = a[3] ?? 1;
  const alphaB = b[3] ?? 1;
  const [x1, y1, z1] = labToXyz(lchToLab(a));
  const [x2, y2, z2] = labToXyz(lchToLab(b));
  const [l, c, h] = labToLch(
    xyzToLab([x1 * (1 - ratio) + ratio * x2, y1 * (1 - ratio) + ratio * y2, z1 * (1 - ratio) + ratio * z2]),
  );
  return [clamp(l, 0, 100), clamp(c, 0, 132), clamp(h, 0, 360), alphaA * (1 - ratio) + alphaB * ratio];
}

/** #rrggbb(aa) string for an LCH tuple (corpus `lchToRgbString`). */
export function lchToRgbString(color: Lch): string {
  const hex = lchToRgb(color)
    .map((v) => v.toString(16).split(`.`)[0])
    .map((v) => (v.length === 1 ? `0` + v : v));
  const alpha =
    color[3] !== undefined && color[3] !== 1 ? pad2((color[3] * 255).toString(16).split(`.`)[0]) : ``;
  return `#${hex[0]}${hex[1]}${hex[2]}${alpha}`;
}

function pad2(s: string): string {
  return s.length === 1 ? `0` + s : s;
}

function lchToP3String(color: Lch): string {
  const p3 = lchToP3(color);
  return `color(display-p3 ${p3[0]} ${p3[1]} ${p3[2]}${color[3] === undefined ? `` : ` / ${color[3].toString(10)}`})`;
}

function lchToP3(color: Lch): number[] {
  return xyzToLinearP3(d50ToD65(labToXyz(lchToLab(color))))
    .map(gammaEncode)
    .map((v) => clamp(v, 0, 1));
}

/** sRGB [0-255] to LCH (corpus `rgbToLch`). */
export function rgbToLch(rgb: number[]): Lch {
  return labToLch(xyzToLab(d65ToD50(linearRgbToXyz(srgbLinear(rgb)))));
}

function p3ToLch(p3: number[]): Lch {
  // The pinned converter passes parsed P3 channels through its 0–255
  // transfer function as-is (ColorConverter.CVwFbLBP.js R -> $).
  return labToLch(xyzToLab(d65ToD50(linearP3ToXyz(srgbLinear(p3)))));
}

/** LCH to sRGB [0-255] (corpus `lchToRgb`), with the exact-white special case. */
export function lchToRgb(color: Lch): number[] {
  const lab = lchToLab(color);
  if (lab[0] === 100 && lab[1] === 0 && lab[2] === 0) return [255, 255, 255];
  return xyzLinearRgb(d50ToD65(labToXyz(lab)))
    .map((v) => 255 * gammaEncode(v))
    .map((v) => clamp(v, 0, 255));
}

export function multiplyMatrix(m: number[][], v: number[]): number[] {
  const [[a, b, c], [d, e, f], [g, h, i]] = m;
  const [x, y, z] = v;
  return [a * x + b * y + c * z, d * x + e * y + f * z, g * x + h * y + i * z];
}

function gammaEncode(v: number): number {
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  return abs > 0.0031308 ? sign * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * v;
}

function linearRgbToXyz(rgb: number[]): number[] {
  return multiplyMatrix(
    [
      [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
      [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
      [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
    ],
    rgb,
  );
}

function linearP3ToXyz(p3: number[]): number[] {
  return multiplyMatrix(
    [
      [0.4865709486482162, 0.26566769316909306, 0.1982172852343625],
      [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
      [0, 0.04511338185890264, 1.043944368900976],
    ],
    p3,
  );
}

function xyzLinearRgb(xyz: number[]): number[] {
  return multiplyMatrix(
    [
      [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
      [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
      [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
    ],
    xyz,
  );
}

function xyzToLinearP3(xyz: number[]): number[] {
  return multiplyMatrix(
    [
      [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
      [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
      [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
    ],
    xyz,
  );
}

function d50ToD65(xyz: number[]): number[] {
  return multiplyMatrix(
    [
      [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
      [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
      [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
    ],
    xyz,
  );
}

function d65ToD50(xyz: number[]): number[] {
  return multiplyMatrix(
    [
      [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
      [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
      [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
    ],
    xyz,
  );
}

function xyzToLab(xyz: number[]): number[] {
  const f = xyz
    .map((v, i) => v / D50[i])
    .map((v) => (v > 0.008856451679035631 ? Math.cbrt(v) : (903.2962962962963 * v + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

function labToXyz(lab: number[]): number[] {
  const kappa = 24389 / 27;
  const epsilon = 216 / 24389;
  const f: number[] = [];
  f[1] = (lab[0] + 16) / 116;
  f[0] = lab[1] / 500 + f[1];
  f[2] = f[1] - lab[2] / 200;
  return [
    f[0] ** 3 > epsilon ? f[0] ** 3 : (116 * f[0] - 16) / kappa,
    lab[0] > kappa * epsilon ? ((lab[0] + 16) / 116) ** 3 : lab[0] / kappa,
    f[2] ** 3 > epsilon ? f[2] ** 3 : (116 * f[2] - 16) / kappa,
  ].map((v, i) => v * D50[i]);
}

function labToLch(lab: number[]): Lch {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return [lab[0], Math.sqrt(lab[1] ** 2 + lab[2] ** 2), h >= 0 ? h : h + 360, 1];
}

export function lchToLab(color: Lch): number[] {
  return [color[0], color[1] * Math.cos((color[2] * Math.PI) / 180), color[1] * Math.sin((color[2] * Math.PI) / 180)];
}

function srgbLinearOne(v: number): number {
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  return abs < 0.04045 ? v / 12.92 : sign * ((abs + 0.055) / 1.055) ** 2.4;
}

function srgbLinear(rgb: number[]): number[] {
  return rgb.map((v) => srgbLinearOne(v / 255));
}
