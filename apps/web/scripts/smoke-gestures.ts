/**
 * The gesture state machine: what a finger, a second finger and a wheel do to
 * the camera. ADR-054.
 *
 * Split from smoke-viewport because that file is arithmetic and this one is a
 * state machine, and the two go wrong in completely different ways. Neither
 * needs a DOM -- ViewGestures only ever asked its host for a rect, so a stub
 * element and plain objects shaped like PointerEvents exercise all of it.
 *
 * What this CANNOT check is whether any of it feels right under a thumb.
 */
import { InkViewport } from "../lib/ink-viewport";
import { ViewGestures, wheelPixels, wheelZoom } from "../lib/ink-gestures";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9;

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

console.log(failures === 0 ? "\ngestures: all good\n" : `\ngestures: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
