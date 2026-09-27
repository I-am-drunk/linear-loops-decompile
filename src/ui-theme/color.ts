/**
 * Color math for theme generation: CIE LCh (D65) conversions, APCA contrast.
 *
 * The colorimetry is standard published math (CIE 15:2004, IEC 61966-2-1 sRGB,
 * the public APCA algorithm). The exact matrix/precision choices are verified
 * against the decompiled Linear client corpus (vault corpus,
 * pretty/client/ColorConverter chunk) so our output is byte-comparable with
 * Linear's computed theme. Original code; facts only.
 *
 * Convention: Lch = [L, C, H] with L 0..100, C 0..132, H 0..360 degrees.
 * Lcha adds alpha 0..1. All functions are total and clamped like the reference.
 */

export type Lch = [number, number, number];
export type Lcha = [number, number, number, number];

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** CSS number formatting used by the reference: 3 decimals, trailing zeros off. */
const fmt = (v: number): string => String(parseFloat(v.toFixed(3)));

const D65: Lch = [0.3457 / 0.3585, 1, 0.2958 / 0.3585];

const multiply = (m: [number, number, number][], v: [number, number, number]): [number, number, number] => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];

const srgbDecodeChannel = (v: number): number => {
  const x = v / 255;
  return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
};

const srgbEncodeChannel = (v: number): number => {
  const sign = v < 0 ? -1 : 1;
  const x = Math.abs(v);
  return x > 0.0031308 ? sign * (1.055 * Math.pow(x, 1 / 2.4) - 0.055) : 12.92 * v;
};

const LINEAR_SRGB_TO_XYZ: [number, number, number][] = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

const XYZ_TO_LINEAR_SRGB: [number, number, number][] = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];

/** Reference applies this between XYZ and Lab on the decode path (and its
 *  inverse on encode). Reproduced for byte parity even where near-identity. */
const XYZ_DECODE_ADAPT: [number, number, number][] = [
  [1.0479298208405488, 0.022946793341019088, -0.05019222954313557],
  [0.029627815688159344, 0.990434484573249, -0.01707382502938514],
  [-0.009243058152591178, 0.015055144896577895, 0.7518742899580008],
];

const XYZ_ENCODE_ADAPT: [number, number, number][] = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];

const xyzToLab = ([x, y, z]: [number, number, number]): [number, number, number] => {
  const f = [x / D65[0], y / D65[1], z / D65[2]].map((v) =>
    v > 0.008856451679035631 ? Math.cbrt(v) : (903.2962962962963 * v + 16) / 116,
  );
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
};

const labToXyz = ([l, a, b]: [number, number, number]): [number, number, number] => {
  const kappa = 24389 / 27;
  const eps = 216 / 24389;
  const fy = (l + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xr = Math.pow(fx, 3) > eps ? Math.pow(fx, 3) : (116 * fx - 16) / kappa;
  const yr = l > kappa * eps ? Math.pow((l + 16) / 116, 3) : l / kappa;
  const zr = Math.pow(fz, 3) > eps ? Math.pow(fz, 3) : (116 * fz - 16) / kappa;
  return [xr * D65[0], yr * D65[1], zr * D65[2]];
};

export const labToLch = ([l, a, b]: [number, number, number]): Lch => {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return [l, Math.sqrt(a * a + b * b), h >= 0 ? h : h + 360];
};

export const lchToLab = ([l, c, h]: Lch): [number, number, number] => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

/** sRGB bytes [r,g,b] (0..255) -> LCh. Mirrors the reference chain exactly. */
export const srgbToLch = (rgb: [number, number, number]): Lch =>
  labToLch(xyzToLab(multiply(XYZ_DECODE_ADAPT, multiply(LINEAR_SRGB_TO_XYZ, rgb.map(srgbDecodeChannel) as [number, number, number]))));

/** LCh -> sRGB bytes (floats, clamped 0..255). White shortcut matches the reference. */
export const lchToSrgb255 = (lch: Lch): [number, number, number] => {
  if (lch[0] === 100 && lch[1] === 0 && lch[2] === 0) return [255, 255, 255];
  const linear = multiply(
    XYZ_TO_LINEAR_SRGB,
    multiply(XYZ_ENCODE_ADAPT, labToXyz(lchToLab(lch))),
  );
  return linear.map((v) => clamp(255 * srgbEncodeChannel(v), 0, 255)) as [number, number, number];
};

export interface ChannelDelta { l?: number; c?: number; h?: number; a?: number }

/** Additive channel deltas, clamped (L 0..100, C 0..132, H 0..360, A 0..1). */
export const adjust = (color: Lcha, d: ChannelDelta): Lcha => [
  clamp(color[0] + (d.l ?? 0), 0, 100),
  clamp(color[1] + (d.c ?? 0), 0, 132),
  clamp(color[2] + (d.h ?? 0), 0, 360),
  clamp((color[3] ?? 1) + (d.a ?? 0), 0, 1),
];

/** Absolute channel assignment with the same clamps; absent channels keep. */
export const adjustTo = (color: Lcha, d: ChannelDelta): Lcha => [
  clamp(d.l ?? color[0], 0, 100),
  clamp(d.c ?? color[1], 0, 132),
  clamp(d.h ?? color[2], 0, 360),
  clamp(d.a ?? color[3] ?? 1, 0, 1),
];

/** Black/white text endpoint derived from a surface color (reference rule). */
export const getTextColor = ([l, c, h]: Lch): Lch => [l - c * 0.075 > 65 ? 0 : 100, Math.min(c / 2, c), h];

/** Linear mix in Lab space; ratio t = amount of b. Alpha mixes linearly. */
export const mix = (a: Lcha, b: Lcha, t: number): Lcha => {
  const aa = a[3] ?? 1;
  const bb = b[3] ?? 1;
  const la = lchToLab([a[0], a[1], a[2]]);
  const lb = lchToLab([b[0], b[1], b[2]]);
  const m: [number, number, number] = [
    la[0] * (1 - t) + t * lb[0],
    la[1] * (1 - t) + t * lb[1],
    la[2] * (1 - t) + t * lb[2],
  ];
  const lch = labToLch(m);
  return [clamp(lch[0], 0, 100), clamp(lch[1], 0, 132), clamp(lch[2], 0, 360), aa * (1 - t) + bb * t];
};

/** APCA black soft clamp (public algorithm constant). */
const apcaSoftClamp = (v: number): number => (v >= 0.022 ? v : v + Math.pow(0.022 - v, 1.414));

/**
 * APCA contrast magnitude (0..~106), polarity-aware. Text first, background
 * second. Matches the reference implementation's exponents and offsets.
 */
export const apcaContrast = (text: Lch, bg: Lch): number => {
  const t = apcaSoftClamp(text[0] / 100);
  const b = apcaSoftClamp(bg[0] / 100);
  const bgBrighter = b > t;
  let s: number;
  if (Math.abs(b - t) < 5e-4) {
    s = 0;
  } else if (bgBrighter) {
    s = (Math.pow(b, 0.56) - Math.pow(t, 0.57)) * 1.14;
  } else {
    s = (Math.pow(b, 0.65) - Math.pow(t, 0.62)) * 1.14;
  }
  const c = Math.abs(s) < 0.1 ? 0 : s > 0 ? s - 0.027 : s + 0.027;
  return Math.abs(c * 100);
};

export const sufficientContrastForText = (text: Lch, bg: Lch, threshold = 38): boolean =>
  apcaContrast(text, bg) > threshold;

export type ColorFormat = "LCH" | "RGB" | "P3";

/** LCh(a) -> hex string. Truncating hex conversion matches the reference. */
export const lchToHex = (color: Lcha): string => {
  const bytes = lchToSrgb255([color[0], color[1], color[2]]);
  const hex = bytes.map((v) => {
    const h = Math.trunc(v).toString(16);
    return h.length === 1 ? `0${h}` : h;
  });
  const alpha = color[3] !== undefined && color[3] !== 1
    ? (() => { const h = Math.trunc(color[3] * 255).toString(16); return h.length === 1 ? `0${h}` : h; })()
    : "";
  return `#${hex[0]}${hex[1]}${hex[2]}${alpha}`;
};

/** CSS string in the requested format. Alpha prints iff the tuple carries one. */
export const toCss = (format: ColorFormat, color: Lcha): string => {
  if (format === "RGB") return lchToHex(color);
  if (format === "P3") {
    // Linear P3 path (matrix pair verified against the reference chunk).
    const linear = multiply(
      [
        [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
        [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
        [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
      ],
      multiply(XYZ_ENCODE_ADAPT, labToXyz(lchToLab([color[0], color[1], color[2]]))),
    ).map((v) => clamp(srgbEncodeChannel(v), 0, 1));
    return `color(display-p3 ${linear[0]} ${linear[1]} ${linear[2]}${color[3] === undefined ? "" : ` / ${color[3].toString(10)}`})`;
  }
  return `lch(${fmt(color[0])}% ${fmt(color[1])} ${fmt(color[2])}${color[3] === undefined ? "" : ` / ${fmt(color[3])}`})`;
};

/** Parse #rgb/#rrggbb (reference regex shapes). 3 entries, or 4 with alpha. */
export const hexToLch = (hex: string): number[] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex)
    ?? (() => {
      const s = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
      return s ? [s[0], s[1] + s[1], s[2] + s[2], s[3] + s[3]] : null;
    })();
  if (!m) return [0, 0, 0];
  const lch = srgbToLch([parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]);
  const out: number[] = [lch[0], lch[1], lch[2]];
  if (m[4] && !/ff/i.test(m[4])) out.push(parseInt(m[4], 16) / 255);
  return out;
};
