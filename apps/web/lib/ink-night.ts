import { pageIsDark } from "./theme";

/**
 * What each ink becomes on a charcoal page. ADR-116, issue 043.
 *
 * Stored stroke colour is user data and is never rewritten (docs/10: "the one
 * sanctioned exception is stroke colour inside the ink canvas"). This maps it
 * at PAINT time only, so a note drawn at night and exported by day is the
 * colours its author picked.
 *
 * The rule is ADR-089's, applied to ink: the mark is whichever the ground is
 * not. Three of the five come straight from the brand -- charcoal is "the ink"
 * and the ink flips to warm paper, violet is the theme's own night accent, and
 * mint is the brand mint. The other two are lifted at their own hue until they
 * clear 4.5:1 on the night page.
 */

/** The writing surface at night: base-100, the true charcoal, not base-300.
 *  Every figure below is measured against this. */
export const NIGHT_PAPER = "#111418";


const NIGHT: Readonly<Record<string, string>> = {
  "#1A1817": "#F7F3EA", // Charcoal -> warm paper. The ink flips.        16.68:1
  "#6A39FF": "#8A63FF", // Violet   -> the theme's own night accent       4.67:1
  "#00A38D": "#00C2A8", // Mint     -> the brand mint                     8.16:1
  "#3F6B4A": "#498C5B", // Moss     -> lifted, hue kept                   4.55:1
  "#A2593B": "#C46239", // Clay     -> lifted, hue kept                   4.54:1

  // Markers go the OTHER way: deeper, not lighter. A wash is read THROUGH, so
  // it must tint without blinding the ink on top. Alpha accumulates toward 1
  // wherever a stroke crosses itself, so each is dark enough to keep the ink
  // at 4.5:1 even fully saturated, and still show at one light pass.
  "#F2D648": "#816F06", // Yellow
  "#6FD6A8": "#0B7F58", // Mint
  "#7EC8F0": "#0F77A1", // Sky
  "#F58BB0": "#CC2C75", // Rose
};

/**
 * A colour the palette does not know is left alone.
 *
 * The blend goes with it. `multiply` is right on paper and wrong on charcoal,
 * where there is nothing to darken -- and `screen` is wrong too, because it
 * compounds without a ceiling and a crossed stroke ends up brighter than the
 * words. On a dark page the wash is plain, and the ceiling is the colour.
 */
export function nightInk(color: string): string {
  return NIGHT[color.toUpperCase()] ?? color;
}

/** The colour to actually paint. Asks the page rather than being told, so no
 *  caller has to thread a boolean through the frame loop. */
export const inkFor = (color: string): string =>
  (paperIsDark() ? nightInk(color) : color);

/**
 * Whether the page under the ink is charcoal, read once and then watched.
 *
 * It reads the APPLIED theme rather than the operating system, because the two
 * are different questions the moment somebody picks a theme for themselves --
 * `color-scheme` is what both `paper-night` and an explicit choice set.
 */
let dark: boolean | null = null;
const onFlip = new Set<() => void>();

function flipped() {
  const now = pageIsDark();
  if (now === dark) return;
  dark = now;
  for (const cb of onFlip) cb();
}

export function paperIsDark(): boolean {
  if (dark !== null) return dark;
  dark = pageIsDark();
  if (typeof window !== "undefined") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", flipped);
    // And the attribute, which is how a chosen theme arrives. ADR-116.
    new MutationObserver(flipped)
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
  return dark;
}

/** Say when the page flips, because everything already drawn is now the wrong
 *  colour. Returns the way to stop listening. */
export function watchPaper(cb: () => void): () => void {
  paperIsDark();
  onFlip.add(cb);
  return () => { onFlip.delete(cb); };
}
