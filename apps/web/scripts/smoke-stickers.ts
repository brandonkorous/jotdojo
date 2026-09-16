/**
 * Where a sticker lands. ADR-115.
 *
 * Pure, like smoke-lasso.ts and smoke-objects.ts beside it. The rule under test
 * is the one that was wrong when stickers first shipped: a sticker goes where
 * somebody TAPPED, centred on that point, and nowhere else -- not in the middle
 * of the view, and not at the origin.
 */
import { placeSticker } from "@jotacular/ink-render";
import {
  STICKER_FRACTION, stickerCorner, stickerScreenSize,
} from "../lib/ink-sticker-layer";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

/** Where the middle of a placed sticker ends up. */
const centreOf = (at: { x: number; y: number }, size: number) => {
  const c = stickerCorner(at, size);
  return { x: c.x + size / 2, y: c.y + size / 2 };
};

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("\nstickers -- where one lands\n");

// --- centred on the tap, which is the whole feature -------------------------

for (const [x, y, size] of [
  [0, 0, 80], [250, 400, 80], [-1200, -940, 120], [17.5, -3.25, 64], [9e5, 9e5, 40],
] as const) {
  const c = centreOf({ x, y }, size);
  check(
    `a sticker tapped at (${x}, ${y}) is centred there`,
    near(c.x, x) && near(c.y, y),
    `centre landed at (${c.x}, ${c.y})`,
  );
}

check(
  "the corner is half a sticker up and left of the tap",
  (() => {
    const c = stickerCorner({ x: 500, y: 300 }, 100);
    return c.x === 450 && c.y === 250;
  })(),
);

// --- the two bugs this replaced --------------------------------------------

check(
  "a tap at the origin does NOT leave the sticker at the origin",
  (() => {
    const c = stickerCorner({ x: 0, y: 0 }, 96);
    return c.x === -48 && c.y === -48;
  })(),
  "a sticker stored by its corner and placed at the raw point sits down-right of the aim",
);

check(
  "placement reads nothing but the tap and the size",
  // The old call took a ViewSnapshot and a screen rect, so the SAME tap landed
  // somewhere different after a pan. Two calls, no camera between them.
  (() => {
    const a = stickerCorner({ x: 640, y: 480 }, 72);
    const b = stickerCorner({ x: 640, y: 480 }, 72);
    return a.x === b.x && a.y === b.y;
  })(),
);

check(
  "a sticker is never placed by the middle of the view",
  // A marked page has stickers all over it. If any two taps at different points
  // produced the same corner, placement would be ignoring the point.
  (() => {
    const a = stickerCorner({ x: 100, y: 100 }, 80);
    const b = stickerCorner({ x: 300, y: 100 }, 80);
    return a.x !== b.x && a.y === b.y;
  })(),
);

// --- how big a new one is ---------------------------------------------------

check(
  "a new sticker is a mark on something, not a poster over it",
  STICKER_FRACTION > 0 && STICKER_FRACTION < 0.25,
  `STICKER_FRACTION is ${STICKER_FRACTION}`,
);

check(
  "size comes off the SHORTER side, on a wide screen",
  stickerScreenSize({ w: 1440, h: 800 }) === 800 * STICKER_FRACTION,
);

check(
  "size comes off the SHORTER side, on a phone held upright",
  stickerScreenSize({ w: 390, h: 844 }) === 390 * STICKER_FRACTION,
);

check(
  "a square surface gives the same answer either way round",
  stickerScreenSize({ w: 600, h: 600 }) === stickerScreenSize({ h: 600, w: 600 }),
);

// --- the ghost and the thing it becomes are the same size -------------------

/**
 * What `InkOpen.placeSticker` does: a screen size divided by the zoom.
 * The ghost is drawn at the screen size with no camera arithmetic at all, so
 * these two agreeing at every zoom is what makes the preview honest.
 */
const worldSize = (screen: { w: number; h: number }, k: number) =>
  stickerScreenSize(screen) / k;

for (const k of [0.25, 0.5, 1, 2, 4.75]) {
  const screen = { w: 1200, h: 900 };
  const onGlass = worldSize(screen, k) * k;
  check(
    `at zoom ${k} the sticker is the size the ghost promised`,
    near(onGlass, stickerScreenSize(screen)),
    `${onGlass} on glass vs ${stickerScreenSize(screen)} drawn`,
  );
}

check(
  "pulling the camera back makes the sticker bigger in the document",
  worldSize({ w: 1200, h: 900 }, 0.5) > worldSize({ w: 1200, h: 900 }, 2),
);

// --- the two together -------------------------------------------------------

check(
  "a tap while zoomed out is still centred on the tap",
  (() => {
    const size = worldSize({ w: 1200, h: 900 }, 0.4);
    const c = centreOf({ x: -880, y: 1240 }, size);
    return near(c.x, -880) && near(c.y, 1240);
  })(),
);

// --- the preview and the result are drawn by ONE function -------------------

/**
 * How far the picture actually reaches inside its box, white edge included.
 *
 * The tray glyph, the ghost, the plane and the exporter all call
 * `placeSticker`, so this is the one number deciding whether a preview is
 * honest. Measured rather than asserted: the ghost once drew the artwork at the
 * full box and let the edge hang outside it, making it 16% too big.
 */
const drawnExtent = (size: number): number | null => {
  const p = placeSticker({ id: "g", name: "fire", x: 0, y: 0, size, color: "#111" });
  if (!p) return null;
  const longest = Math.max(p.art.w, p.art.h);
  // Half the stroke sits under the fill; the other half is the visible edge.
  return longest * p.k + p.stroke * p.k;
};

for (const size of [40, 96, 300]) {
  const reach = drawnExtent(size);
  check(
    `a sticker of ${size} draws its white edge INSIDE its own box`,
    reach !== null && reach <= size,
    `reached ${reach} of ${size}`,
  );
  check(
    `a sticker of ${size} still fills the box it was given`,
    reach !== null && reach > size * 0.95,
    `reached ${reach} of ${size}`,
  );
}

check(
  "the picture is placed by the size alone, so every preview scales together",
  (() => {
    const a = drawnExtent(100);
    const b = drawnExtent(200);
    return a !== null && b !== null && near(b, a * 2);
  })(),
);

console.log(`\n${failures === 0 ? "all ok" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
