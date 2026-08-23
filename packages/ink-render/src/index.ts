/**
 * Rendering ink for a model to read, and for a person to glance at.
 *
 * Split three ways because the geometry, the drawing and the partitioning are
 * three jobs: `geometry` decides where the ink is, `svg` decides what one frame
 * looks like, and `tiles` decides how many frames there are. ADR-053.
 */

export {
  bounds, contentBounds, textBounds, strokesBounds, strokeBounds, intersects, union,
  medianWidth, widthAt, control,
  type Bounds,
} from "./geometry";

export { toSvg, scaleFor, type RenderOptions } from "./svg";

export { tiles, type Tile, type TileOptions } from "./tiles";
