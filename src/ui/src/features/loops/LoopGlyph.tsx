/**
 * The loop's icon tile: a rounded square tinted with the loop's color,
 * showing its emoji/glyph (or the loop glyph when unset). Original artwork;
 * the Linear UI shows the same idea (colored tile + chosen icon).
 */
import type { CSSProperties, JSX } from "react";
import { LoopIcon } from "../../shell/icons.tsx";

export interface LoopGlyphProps {
  readonly icon?: string | undefined;
  readonly color?: string | undefined;
  readonly name: string;
}

export function LoopGlyph(props: LoopGlyphProps): JSX.Element {
  const style: CSSProperties = {};
  if (props.color) {
    style.backgroundColor = props.color;
    style.borderColor = "transparent";
  }
  const glyph = props.icon?.trim();
  return (
    <span className="ll-tile" style={style} aria-hidden="true">
      {glyph && glyph.length > 0 ? (
        <span className="ll-tile-emoji">{glyph}</span>
      ) : (
        <LoopIcon />
      )}
    </span>
  );
}
