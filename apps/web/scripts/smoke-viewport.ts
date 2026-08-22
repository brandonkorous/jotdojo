/**
 * The camera, the dot grid and the gesture state machine. ADR-053.
 *
 * There is no browser or DOM harness in this repo, and these three are exactly
 * the code that fails quietly: a viewport that drifts a pixel per pinch, a
 * grid that jumps a whole cell at the origin, a gesture that hands the finger
 * left over from a pinch a stroke it never started. All three are pure
 * arithmetic and a small state machine, so all three can be checked here.
 *
 * What this CANNOT check is whether any of it feels right under a thumb. That
 * needs a real phone.
 */
import { InkViewport, MAX_ZOOM, MIN_ZOOM } from "../lib/ink-viewport";
import {
  GRID_WORLD, MAX_SCREEN, MIN_SCREEN, gridStep, gridVars, wrap,
} from "../lib/ink-grid";
import { ViewGestures, wheelPixels, wheelZoom } from "../lib/ink-gestures";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const EPS = 1e-9;
const near = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps;

console.log("\nzooming holds the point under the cursor");
{
  const v = new InkViewport();
  v.panBy(37, -12);
  const before = { x: v.toWorldX(300), y: v.toWorldY(220) };
  v.zoomAbout(300, 220, 2.5);
  check("the world point under the cursor does not move",
    near(v.toWorldX(300), before.x) && near(v.toWorldY(220), before.y),
    `${v.toWorldX(300)} vs ${before.x}`);
  check("the zoom actually changed", near(v.k, 2.5));

  // Round-tripping is what makes a wheel feel like a wheel rather than a
  // ratchet: in, out, and you are back where you were.
  v.zoomAbout(300, 220, 1 / 2.5);
  check("zooming back returns to k = 1", near(v.k, 1));
  check("and returns to the same pan", near(v.x, 37) && near(v.y, -12));
}

console.log("\nthe zoom is clamped, and says so");
{
  const v = new InkViewport();
  v.zoomAbout(0, 0, 1000);
  check("clamped at MAX_ZOOM", v.k === MAX_ZOOM);
  check("a zoom that changes nothing returns false", v.zoomAbout(0, 0, 1000) === false);
  v.zoomAbout(0, 0, 1e-6);
  check("clamped at MIN_ZOOM", v.k === MIN_ZOOM);
  check("and again returns false", v.zoomAbout(0, 0, 1e-6) === false);
}

console.log("\na pinch with unchanged spread is a pure pan");
{
  const v = new InkViewport();
  const pinch = { wx: v.toWorldX(200), wy: v.toWorldY(200), d0: 120, k0: v.k };
  const changed = v.applyPinch(pinch, 260, 190, 120);
  check("the zoom did not change", changed === false && near(v.k, 1));
  check("the page moved by exactly the midpoint delta",
    near(v.x, 60) && near(v.y, -10), `${v.x}, ${v.y}`);
}

console.log("\na pinch that spreads zooms about its own midpoint");
{
  const v = new InkViewport();
  v.panBy(-40, 25);
  const anchor = { x: v.toWorldX(200), y: v.toWorldY(200) };
  const pinch = { wx: anchor.x, wy: anchor.y, d0: 100, k0: v.k };
  v.applyPinch(pinch, 200, 200, 300);
  check("the spread ratio became the zoom", near(v.k, 3));
  check("the anchored world point is still under the midpoint",
    near(v.toWorldX(200), anchor.x) && near(v.toWorldY(200), anchor.y));
}

console.log("\nfitting to content");
{
  const empty = new InkViewport();
  empty.panBy(500, 500);
  empty.zoomAbout(0, 0, 4);
  empty.fitTo(null, 800, 600);
  check("an empty page lands exactly where it always did",
    empty.atHome, `${empty.x}, ${empty.y}, ${empty.k}`);

  // The cap is the point: blowing a three-word note up to fill a monitor
  // makes somebody's handwriting look like a billboard.
  const small = new InkViewport();
  small.fitTo({ x: 0, y: 0, w: 20, h: 20 }, 800, 600);
  check("a tiny note is not blown up past 1:1", small.k === 1);
  check("but it is still centred",
    near(small.x, 400 - 10) && near(small.y, 300 - 10));

  const big = new InkViewport();
  big.fitTo({ x: -1000, y: -500, w: 4000, h: 2000 }, 800, 600);
  check("a wide page is scaled down to fit", big.k < 1);
  const seen = big.visible(800, 600);
  check("and the whole box is on screen",
    seen.x <= -1000 && seen.y <= -500
    && seen.x + seen.w >= 3000 && seen.y + seen.h >= 1500);
}

console.log("\nresizing anchors rather than re-frames");
{
  const v = new InkViewport();
  v.panBy(-300, -200);
  v.zoomAbout(400, 300, 2);
  const centre = { x: v.toWorldX(400), y: v.toWorldY(300) };
  v.keepCentre(800, 600, 800, 400);
  check("the middle of the view is still the middle",
    near(v.toWorldX(400), centre.x) && near(v.toWorldY(200), centre.y));
  const noop = new InkViewport();
  noop.keepCentre(0, 0, 800, 600);
  check("a resize from nothing does not move the page", noop.atHome);
}

console.log("\nthe grid ladder keeps dots legible at every zoom");
{
  let worst = "";
  let ok = true;
  for (let k = MIN_ZOOM; k <= MAX_ZOOM; k += 0.01) {
    const screen = gridStep(k) * k;
    if (screen >= MIN_SCREEN - EPS && screen <= MAX_SCREEN + EPS) continue;
    ok = false;
    worst = `k=${k.toFixed(2)} -> ${screen.toFixed(2)}px`;
  }
  check(`screen spacing stays within [${MIN_SCREEN}, ${MAX_SCREEN}]px`, ok, worst);

  // Doubling rather than any old scale factor: every dot of the coarse grid
  // sits on a dot of the fine one, so stepping never looks like sliding.
  let powers = true;
  for (let k = MIN_ZOOM; k <= MAX_ZOOM; k += 0.01) {
    const ratio = gridStep(k) / GRID_WORLD;
    if (!near(Math.log2(ratio), Math.round(Math.log2(ratio)), 1e-9)) powers = false;
  }
  check("every step is a power-of-two multiple of GRID_WORLD", powers);
  check("a nonsense zoom falls back rather than looping forever",
    gridStep(0) === GRID_WORLD && gridStep(Number.NaN) === GRID_WORLD);
}

console.log("\nthe grid phase survives panning past the origin");
{
  // JS `%` keeps the sign of the dividend. The raw remainder is -8 here, and
  // a negative background-position jumps the grid a whole cell.
  check("a negative offset wraps forward", near(wrap(-8, 24), 16));
  check("a positive offset is unchanged", near(wrap(8, 24), 8));
  check("an exact multiple is zero", near(wrap(-48, 24), 0));
  check("a degenerate step does not divide by zero", wrap(-8, 0) === 0);

  const v = new InkViewport();
  v.panBy(-1, 0);
  const g = gridVars(v);
  check("panning one pixel left moves the grid one pixel, not a whole cell",
    near(g.x, g.step - 1), `${g.x} of ${g.step}`);
}

console.log("\nwheel deltas are read in the unit the browser reported");
{
  check("pixels pass through",
    wheelPixels({ deltaX: 3, deltaY: -9, deltaMode: 0 }).dy === -9);
  check("lines are scaled",
    wheelPixels({ deltaX: 0, deltaY: 3, deltaMode: 1 }).dy === 48);
  check("pages are scaled",
    wheelPixels({ deltaX: 0, deltaY: 1, deltaMode: 2 }).dy === 800);

  // One notched detent is 100+ deltaY. Unclamped that is exp(120/320) per
  // notch compounding on a trackpad's stream of them.
  check("a single detent cannot zoom more than 1.25x", wheelZoom(-1000) <= 1.25);
  check("or shrink more than 0.8x", wheelZoom(1000) >= 0.8);
  check("no scroll is no zoom", wheelZoom(0) === 1);
}

console.log("\ntwo fingers take the canvas; one finger keeps drawing");
{
  const el = {
    addEventListener() {}, removeEventListener() {},
  } as unknown as HTMLElement;

  let aborts = 0;
  const view = new InkViewport();
  const gestures = new ViewGestures(el, {
    view,
    rect: () => ({ left: 0, top: 0 }),
    abortInput: () => { aborts++; },
    onView: () => {},
  });

  const touch = (id: number, x: number, y: number) =>
    ({ pointerType: "touch", pointerId: id, clientX: x, clientY: y }) as PointerEvent;
  const pen = (x: number, y: number) =>
    ({ pointerType: "pen", pointerId: 9, clientX: x, clientY: y }) as PointerEvent;

  check("one finger is not consumed", gestures.down(touch(1, 100, 100)) === false);
  check("and neither is its movement", gestures.move(touch(1, 110, 100)) === false);
  check("a pen is never consumed", gestures.down(pen(50, 50)) === false);

  check("the second finger claims the gesture", gestures.down(touch(2, 300, 100)) === true);
  check("and aborts the stroke already in progress", aborts === 1);

  // Both fingers 100px down, spread untouched. Fingers report one at a time,
  // so the page really does zoom a little on the first of these and back on
  // the second -- what has to hold is where it ends up.
  gestures.move(touch(1, 110, 200));
  gestures.move(touch(2, 300, 200));
  check("the pinch panned the page", near(view.y, 100), `${view.y}`);
  check("with no zoom, because the spread came back", near(view.k, 1));
  check("and no sideways drift", near(view.x, 0), `${view.x}`);

  // The whole point of `claimed`: the survivor of a pinch must not suddenly
  // start drawing a line from wherever the fingers happened to end up.
  check("lifting one finger stays claimed", gestures.up(touch(2, 300, 200)) === true);
  check("the survivor still cannot draw", gestures.move(touch(1, 150, 250)) === true);
  check("lifting the last finger releases", gestures.up(touch(1, 150, 250)) === true);
  check("and then one finger draws again", gestures.down(touch(1, 100, 100)) === false);
  check("with no second abort", aborts === 1);

  gestures.destroy();
}

console.log(failures === 0 ? "\nviewport: all good\n" : `\nviewport: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
