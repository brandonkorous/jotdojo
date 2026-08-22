/**
 * Lasso selection geometry. docs/08-ink.md lists Select as a first-class tool,
 * and ADR-033 settles what "selected" means.
 *
 * These are pure functions, so this needs no database and no browser -- which
 * is exactly why they are worth testing here. Containment is the kind of rule
 * that misbehaves quietly: the wrong answer is a selection that looks plausible
 * and takes the wrong strokes with it when someone drags.
 */
import type { Point, Stroke } from "@jotdojo/domain";
import {
  inBounds, pointInPolygon, strokeBounds, strokeInPolygon, translateStroke,
} from "../lib/ink-geometry";
import { restyle } from "../lib/ink-edit";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const pt = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];
const stroke = (...xy: [number, number][]): Stroke => ({
  tool: "pen", color: "#1A1817", width: 2, pts: xy.map(([x, y]) => pt(x, y)),
});

/** A square loop from (0,0) to (100,100). */
const square: Point[] = [pt(0, 0), pt(100, 0), pt(100, 100), pt(0, 100)];

console.log("\na point against a closed loop");
check("a point in the middle is inside", pointInPolygon(square, 50, 50));
check("a point well outside is not", !pointInPolygon(square, 150, 50));
check("a point above the loop is not", !pointInPolygon(square, 50, -10));

/**
 * A lasso is almost never convex -- people draw around words, not boxes. This
 * is a C shape: the gap between the arms must NOT count as inside.
 */
const cShape: Point[] = [
  pt(0, 0), pt(100, 0), pt(100, 30), pt(30, 30),
  pt(30, 70), pt(100, 70), pt(100, 100), pt(0, 100),
];
console.log("\na concave lasso, which is the normal case");
check("inside the upper arm", pointInPolygon(cShape, 50, 15));
check("inside the spine", pointInPolygon(cShape, 10, 50));
check("the notch between the arms is OUTSIDE", !pointInPolygon(cShape, 60, 50));

console.log("\nwhole-stroke containment (ADR-033)");
const inside = stroke([10, 10], [20, 20], [30, 15]);
const outside = stroke([200, 200], [210, 210]);
const straddling = stroke([50, 50], [150, 50]);
check("a stroke entirely within is selected", strokeInPolygon(square, inside));
check("a stroke entirely outside is not", !strokeInPolygon(square, outside));
check(
  "a stroke crossing the boundary is NOT selected",
  !strokeInPolygon(square, straddling),
  "partial containment would drag an underline along with the words above it",
);
check("an empty stroke is never selected", !strokeInPolygon(square, stroke()));

console.log("\nthe marquee around a selection");
const box = strokeBounds([inside, stroke([40, 5], [45, 60])]);
check("bounds span every point", !!box && box.x === 10 && box.y === 5
  && box.x + box.w === 45 && box.y + box.h === 60,
  JSON.stringify(box));
check("no strokes means no marquee", strokeBounds([]) === null);
check("a point inside the marquee is covered", !!box && inBounds(box, 20, 20));
check("a point outside it is not", !!box && !inBounds(box, 20, 90));

console.log("\nmoving a selection");
const moved = translateStroke(inside, 5, -3);
check("x and y shift", moved.pts[0]![0] === 15 && moved.pts[0]![1] === 7);
check(
  "timestamp, pressure and tilt survive the move",
  moved.pts[0]![2] === inside.pts[0]![2] && moved.pts[0]![3] === inside.pts[0]![3]
  && moved.pts[0]![4] === inside.pts[0]![4] && moved.pts[0]![5] === inside.pts[0]![5],
  "those are what a better model reads later. docs/08",
);
check("the original is untouched", inside.pts[0]![0] === 10);
check("tool and colour survive", moved.tool === "pen" && moved.color === "#1A1817");

console.log("\nrestyling what the lasso caught. ADR-045");
const inked = stroke([0, 0], [10, 10]);
const marked: Stroke = { tool: "highlighter", color: "#F2D648", width: 18, pts: [pt(0, 0)] };

check("recolouring reports that something changed",
  restyle([inked], { color: "#E0432F" }) === true);
check("...and the stroke is the new colour", inked.color === "#E0432F");
check("recolouring to the SAME colour changes nothing, so no resend",
  restyle([inked], { color: "#E0432F" }) === false);

check("resizing a pen works", restyle([inked], { width: 3.6 }) === true && inked.width === 3.6);
check("a marker keeps its width, because a marker has one",
  restyle([marked], { width: 1.4 }) === false && marked.width === 18);
check("...but a marker CAN be recoloured",
  restyle([marked], { color: "#6FD6A8" }) === true && marked.color === "#6FD6A8");
check("the strokes keep their identity, so the marquee still points at them",
  inked.tool === "pen" && inked.pts.length === 2);


console.log(failures === 0
  ? "\nlasso smoke: all checks passed"
  : `\nlasso smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
