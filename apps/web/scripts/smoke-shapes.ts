/**
 * Was that meant to be a circle? ADR-066.
 *
 * THE FALSE-POSITIVE CASES MATTER MORE THAN THE TRUE-POSITIVE ONES, and they
 * come first below for that reason. A snap nobody asked for silently replaces
 * what somebody drew; a snap that did not happen leaves the page exactly as
 * they left it. Only one of those is recoverable.
 *
 * Pure, so this needs no browser. Snapping needs a device to judge; being
 * SILENT does not, and being silent is most of the job.
 */
import type { Point } from "@jotacular/domain";
import { classify, snap } from "../lib/ink-shapes";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const p = (x: number, y: number, t = 0): Point => [x, y, t, 0.5, 0, 0];

/** A hand is never exact. Everything below is drawn with a wobble. */
const wobble = (n: number, amount = 2) => Math.sin(n * 2.7) * amount;

const circle = (cx: number, cy: number, r: number, jitter = 2, steps = 40): Point[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + wobble(i, jitter);
    return p(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, i);
  });

const line = (x0: number, y0: number, x1: number, y1: number, jitter = 1): Point[] =>
  Array.from({ length: 24 }, (_, i) => {
    const s = i / 23;
    return p(x0 + (x1 - x0) * s + wobble(i, jitter), y0 + (y1 - y0) * s + wobble(i + 3, jitter), i);
  });

const polygon = (corners: Array<[number, number]>, per = 12, jitter = 2): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const [x0, y0] = corners[i]!;
    const [x1, y1] = corners[(i + 1) % corners.length]!;
    for (let s = 0; s < per; s++) {
      const f = s / per;
      out.push(p(x0 + (x1 - x0) * f + wobble(out.length, jitter),
        y0 + (y1 - y0) * f + wobble(out.length + 5, jitter), out.length));
    }
  }
  out.push(p(corners[0]![0], corners[0]![1], out.length));
  return out;
};

console.log("\nthings that are NOT shapes, which is most of what anybody draws");
{
  // Handwriting. If this fired, writing on the canvas would be impossible.
  const letterO = circle(50, 50, 9, 2, 20);
  check("a small letter O is left alone", classify(letterO) === null,
    JSON.stringify(classify(letterO)));

  const scribble: Point[] = Array.from({ length: 60 }, (_, i) =>
    p(100 + i * 3 + Math.sin(i) * 22, 100 + Math.cos(i * 1.7) * 30, i));
  check("a scribble is left alone", classify(scribble) === null,
    JSON.stringify(classify(scribble)));

  // Closed, roughly round, and deliberately lumpy. A recogniser that snapped
  // this would flatten somebody's drawing into geometry.
  const blob = circle(200, 200, 80, 26);
  check("a deliberately lumpy loop is left alone", classify(blob) === null,
    JSON.stringify(classify(blob)));

  const wiggly = line(0, 0, 300, 0, 26);
  check("a wavy line is not a line", classify(wiggly) === null,
    JSON.stringify(classify(wiggly)));

  check("a tick is too small to be anything", classify(line(0, 0, 10, 8)) === null);
  check("three points are not enough to judge",
    classify([p(0, 0), p(10, 10), p(20, 0)]) === null);
  check("nothing is nothing", classify([]) === null);
}

console.log("\nthings that are");
{
  const round = classify(circle(200, 200, 90));
  check("a round loop reads as a circle", round?.kind === "circle", JSON.stringify(round));
  check("...with real confidence", (round?.confidence ?? 0) >= 0.72, JSON.stringify(round));

  const straight = classify(line(0, 0, 400, 120));
  check("a straight stroke reads as a line", straight?.kind === "line", JSON.stringify(straight));

  const rect = classify(polygon([[0, 0], [300, 0], [300, 180], [0, 180]]));
  check("four corners read as a rectangle", rect?.kind === "rectangle", JSON.stringify(rect));

  const tri = classify(polygon([[150, 0], [300, 200], [0, 200]]));
  check("three read as a triangle", tri?.kind === "triangle", JSON.stringify(tri));
}

console.log("\nsteadier hands get more confidence than shaky ones");
{
  const steady = classify(circle(200, 200, 90, 1))?.confidence ?? 0;
  const shaky = classify(circle(200, 200, 90, 8))?.confidence ?? 0;
  check("a cleaner circle scores higher", steady > shaky, `${steady} vs ${shaky}`);
}

console.log("\nwhat a snap replaces it with");
{
  const drawn = circle(200, 200, 90);
  const snapped = snap(drawn, "circle");
  check("a snapped circle stays where it was drawn",
    Math.abs(snapped[0]![0] - drawn[0]![0]) < 20, `${snapped[0]![0]} vs ${drawn[0]![0]}`);
  check("...and is closed",
    Math.hypot(snapped[0]![0] - snapped[snapped.length - 1]![0],
      snapped[0]![1] - snapped[snapped.length - 1]![1]) < 1);
  // Pressure and tilt are CARRIED, not invented: they are what a better
  // recogniser reads later, and a snapped shape with fabricated pressure is a
  // stroke claiming to have been drawn.
  check("pressure comes from the real stroke", snapped[10]![3] === drawn[0]![3]);
  check("...and so does tilt", snapped[10]![4] === drawn[0]![4]);

  const straightened = snap(line(0, 0, 400, 120), "line");
  check("a snapped line is two points", straightened.length === 2);
  check("...between the real ends",
    Math.abs(straightened[1]![0] - 400) < 5, String(straightened[1]![0]));

  const boxed = snap(polygon([[0, 0], [300, 0], [300, 180], [0, 180]]), "rectangle");
  check("a snapped rectangle has points along its edges", boxed.length > 20, String(boxed.length));
  // Sharp corners survive Catmull-Rom only if there are points either side of
  // them. A four-point rectangle comes back as a rounded blob.
  check("...and returns to its start",
    Math.abs(boxed[0]![0] - boxed[boxed.length - 1]![0]) < 1);
}

console.log(failures === 0 ? "\nshapes: all good\n" : `\nshapes: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
