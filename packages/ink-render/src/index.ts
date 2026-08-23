/**
 * Rendering ink for a model to read, and for a person to glance at.
 *
 * Four modules, four jobs: `geometry` decides where the INK is, `text-geometry`
 * where the typed notes are and what colour they have to be, `svg` what one
 * frame looks like, and `tiles` how many frames there are. ADR-053, ADR-079.
 */

export {
  bounds, contentBounds, strokesBounds, strokeBounds, intersects, union,
  medianWidth, widthAt, control,
  type Bounds,
} from "./geometry";

export {
  textBounds, textContentHeight, cardBounds, inkOn, TEXT_LINE_HEIGHT, CARD_PAD,
} from "./text-geometry";

export { toSvg, scaleFor, type RenderOptions } from "./svg";

export { tiles, type Tile, type TileOptions } from "./tiles";
