/**
 * Text boxes as things a lasso can catch. ADR-065.
 *
 * Pure, like smoke-lasso.ts beside it. The rule under test is that ONE
 * containment rule governs both kinds -- a mixed selection is only explicable
 * if strokes and boxes are caught by the same standard, and ADR-033 already
 * settled what that standard is.
 */
import type { Point, TextBox } from "@jotdojo/domain";
import { boxAt, boxBounds, boxesBounds, boxInPolygon, isEmpty, newBox, translateBoxes }
  from "../lib/ink-objects";
import { MIN_SIZE } from "../lib/ink-plane";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const box = (over: Partial<TextBox> = {}): TextBox => ({
  id: "t1", x: 100, y: 100, w: 120, size: 16, color: "#1F2933", text: "hello", ...over,
});

/** A rectangle as a lasso path. */
const loop = (x: number, y: number, w: number, h: number): Point[] =>
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) =>
    [px!, py!, 0, 0.5, 0, 0] as Point);

console.log("\nall four corners, or it is not caught");
{
  const b = box();
  const bounds = boxBounds(b);
  check("a loop right round it catches it", boxInPolygon(loop(80, 80, 300, 300), b));
  check("a loop nowhere near it does not", !boxInPolygon(loop(500, 500, 100, 100), b));

  // The case the rule exists for. A wide box crossing the edge of a loop would
  // otherwise come along with whatever was actually circled, and the person
  // would have no way to see why.
  const half = loop(80, 80, bounds.w / 2, 300);
  check("a loop over HALF of it does not catch it", !boxInPolygon(half, b),
    `box ${JSON.stringify(bounds)}`);

  // Height matters as much as width: a box wrapped onto three lines sticks out
  // below a loop drawn round its first line.
  const tall = box({ text: "a much longer piece of text that will wrap onto several lines here" });
  check("...nor does one that only covers the first line",
    !boxInPolygon(loop(90, 90, 200, 30), tall), JSON.stringify(boxBounds(tall)));
  check("...while one round the whole thing does",
    boxInPolygon(loop(90, 90, 400, 400), tall));

  check("a two-point path cannot enclose anything",
    !boxInPolygon([[0, 0, 0, 0, 0, 0], [999, 999, 0, 0, 0, 0]] as Point[], b));
}

console.log("\nhow big a box is");
{
  check("a one-line box is about one line tall",
    boxBounds(box()).h > 16 && boxBounds(box()).h < 30, String(boxBounds(box()).h));
  check("more text is taller",
    boxBounds(box({ text: "x".repeat(400) })).h > boxBounds(box()).h);
  check("explicit newlines count",
    boxBounds(box({ text: "a\nb\nc" })).h > boxBounds(box({ text: "a" })).h);
  // A measured height from the DOM wins: the estimate is what hit-testing uses
  // before layout has happened, not a second source of truth after it.
  check("a measured height overrides the estimate", boxBounds(box(), 999).h === 999);

  const many = boxesBounds([box({ x: 0, y: 0 }), box({ id: "t2", x: 400, y: 300 })]);
  check("several boxes union", (many?.w ?? 0) >= 520 && (many?.h ?? 0) >= 300, JSON.stringify(many));
  check("no boxes have no bounds", boxesBounds([]) === null);
}

console.log("\npicking one up");
{
  const boxes = [box({ id: "under", x: 0, y: 0 }), box({ id: "over", x: 0, y: 0 })];
  // Reversed, so the topmost wins -- which is the one drawn last and the one
  // the person can actually see.
  check("a tap lands on the box on top", boxAt(boxes, 10, 10)?.id === "over");
  check("a tap on bare canvas lands on nothing", boxAt(boxes, 900, 900) === null);

  const moving = [box({ x: 100, y: 100 })];
  translateBoxes(moving, 30, -10);
  check("dragging moves it", moving[0]!.x === 130 && moving[0]!.y === 90);
}

console.log("\nstarting one");
{
  const made = newBox(200, 300, { size: 16, color: "#1F2933" }, 240);
  check("it has an id", made.id.length > 0);
  check("it is empty", isEmpty(made));
  // The tap is where the TEXT starts, so the caret appears under the finger
  // rather than down and to the right of it.
  check("the caret sits where they tapped", made.y < 300 && made.y > 280, String(made.y));
  check("...and the left edge is exactly there", made.x === 200);

  check("text is never declared below 16px", MIN_SIZE === 16);
  check("a box with a space in it is still empty", isEmpty(box({ text: "   " })));
  check("...and one with a word in it is not", !isEmpty(box({ text: "x" })));
}

console.log(failures === 0 ? "\nobjects: all good\n" : `\nobjects: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
