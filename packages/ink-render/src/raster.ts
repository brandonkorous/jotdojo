import sharp from "sharp";
import type { InkDocument } from "@jotdojo/domain";
import { toSvg, type RenderOptions } from "./svg";

/**
 * Ink to PNG -- and a SEPARATE ENTRY POINT, which is the point of the file.
 *
 * `sharp` is a native binary. apps/web imports this package for its geometry
 * (ink-framing, ink-index, ink-viewport), so putting sharp behind the main
 * export would drag a platform-specific `.node` into every consumer for the
 * sake of two lines the browser can never run. Reach it as
 * `@jotdojo/ink-render/raster`, and only from somewhere with a filesystem.
 *
 * PNG rather than JPEG, everywhere: handwriting is thin high-contrast lines,
 * and JPEG ringing around them is exactly the artefact that turns an l into a 1.
 */

export async function toPng(doc: InkDocument, options: RenderOptions): Promise<Buffer> {
  return svgToPng(toSvg(doc, options));
}

/** For a caller that already holds the SVG -- a recognition tile, or a page
 *  rendered down to one lasso's worth of strokes. */
export async function svgToPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 6 }).toBuffer();
}
