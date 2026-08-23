/**
 * Text boxes as things a lasso can catch. ADR-065.
 *
 * Pure, like smoke-lasso.ts beside it. The rule under test is that ONE
 * containment rule governs both kinds -- a mixed selection is only explicable
 * if strokes and boxes are caught by the same standard, and ADR-033 already
 * settled what that standard is.
 */
import type { Point, TextBox } from "@jotacular/domain";
import { textBounds } from "@jotacular/ink-render";
import { boxAt, boxBounds, boxesBounds, boxInPolygon, drawnBox, isEmpty, newBox, translateBoxes }
  from "../lib/ink-objects";
import { MIN_SIZE } from "../lib/ink-plane";
import { TextDrag } from "../lib/ink-text-drag";
import { InkSelection } from "../lib/ink-selection";
import type { Stroke } from "@jotacular/domain";

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
  // A drawn height is a FLOOR, not a ceiling. Both halves matter: a card keeps
  // the size it was dragged to when it holds one word, and grows rather than
  // clipping when it holds a paragraph. ADR-078.
  check("a drawn height is kept when the text is short",
    boxBounds(box({ h: 400 })).h === 400, String(boxBounds(box({ h: 400 })).h));
  check("...and text that outgrows it wins instead of being clipped",
    boxBounds(box({ h: 20, text: "x".repeat(600) })).h > 20,
    String(boxBounds(box({ h: 20, text: "x".repeat(600) })).h));

  // The bug this replaced: the browser laid text out at 1.35 and the renderer
  // framed it at 1.25, so a lasso and an export disagreed about where a box
  // ended. One implementation now, imported rather than copied.
  check("the client measures a box exactly as the renderer does",
    boxBounds(box({ text: "several words that will wrap around a line or two" })).h
      === textBounds(box({ text: "several words that will wrap around a line or two" })).h);

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

console.log("\ndrawing a box out, without costing the tap");
{
  const at = (x: number, y: number): Point => [x, y, 0, 0.5, 0, 0];

  // THE ONE THAT MATTERS. docs/02 calls sub-second capture non-negotiable, so
  // a text tool that only worked by dragging would have put an interaction in
  // front of the thing the product exists to do. Down and up in one place is
  // still a tap. ADR-078.
  const tap = new TextDrag();
  tap.begin(at(100, 100));
  const tapped = tap.end(at(100, 100), 1);
  check("a tap is still a tap", tapped?.kind === "tap");

  // And a finger is never perfectly still. Below the threshold the drag simply
  // did not happen -- the same bargain hold-to-snap makes.
  const wobble = new TextDrag();
  wobble.begin(at(100, 100));
  check("...and so is a tap with a shaky hand",
    wobble.end(at(104, 103), 1)?.kind === "tap");

  const drag = new TextDrag();
  drag.begin(at(100, 100));
  const drawn = drag.end(at(300, 250), 1);
  check("a real drag draws a box", drawn?.kind === "drawn");
  if (drawn?.kind === "drawn") {
    check("...the size it was dragged to",
      drawn.rect.w === 200 && drawn.rect.h === 150, JSON.stringify(drawn.rect));
  }

  // Up and to the left is an ordinary way to draw a box, and a naive
  // subtraction gives it a negative width that validateTexts would refuse.
  const backwards = new TextDrag();
  backwards.begin(at(300, 250));
  const rev = backwards.end(at(100, 100), 1);
  check("dragging up and left is the same box",
    rev?.kind === "drawn" && rev.rect.x === 100 && rev.rect.y === 100
      && rev.rect.w === 200 && rev.rect.h === 150, JSON.stringify(rev));

  // The threshold is SCREEN pixels, so it means the same thing to a finger at
  // every zoom. Zoomed out, the same document distance is a smaller gesture.
  const zoomed = new TextDrag();
  zoomed.begin(at(0, 0));
  check("zoomed out, the same document drag is still a tap",
    zoomed.end(at(20, 20), 0.1)?.kind === "tap");

  const tapPoint = new TextDrag();
  tapPoint.begin(at(42, 84));
  const where = tapPoint.end(at(45, 85), 1);
  check("a tap lands where the finger went down, not where it came up",
    where?.kind === "tap" && where.x === 42 && where.y === 84, JSON.stringify(where));

  const abandoned = new TextDrag();
  abandoned.begin(at(0, 0));
  abandoned.cancel();
  check("a cancelled drag places nothing", abandoned.end(at(500, 500), 1) === null);

  // A drawn box carries its height; a tapped one has no opinion about how tall
  // it is, which is what lets its text decide.
  check("a drawn box stores the height",
    drawnBox({ x: 0, y: 0, w: 200, h: 150 }, { size: 16, color: "#111418" }).h === 150);
  check("...and a tapped one stores none",
    newBox(0, 0, { size: 16, color: "#111418" }, 200).h === undefined);
}

console.log("\npicking one thing up, without drawing a loop round it");
{
  const sel = new InkSelection();
  const boxes = [box({ id: "under", x: 0, y: 0 }), box({ id: "over", x: 0, y: 0 })];

  // THE REASON THIS EXISTS. Changing one card's colour used to mean drawing a
  // closed loop round it, which is most of a second on a phone. ADR-084.
  check("a tap picks the one box under it", sel.pick([], boxes, 10, 10, 10) === 1);
  check("...the topmost, matching what is drawn",
    sel.selectedTexts[0]?.id === "over");
  check("...and it gets a marquee, so the bar and the menu have something to point at",
    sel.marquee !== null);

  check("a tap on bare canvas picks nothing", sel.pick([], boxes, 900, 900, 10) === 0);
  check("...which is also how a selection is dropped", sel.marquee === null);

  // Boxes win over strokes at the same point, because the object plane is
  // painted above both canvases -- the card is the thing you can see.
  const stroke: Stroke = {
    id: "s", tool: "pen", color: "#111418", width: 3,
    pts: [[10, 10, 0, 0.5, 0, 0], [20, 20, 0, 0.5, 0, 0]],
  };
  sel.pick([stroke], boxes, 10, 10, 10);
  check("a card over a squiggle takes the tap",
    sel.selectedTexts.length === 1 && sel.selected.length === 0);
  check("...and the squiggle alone is picked when no card is there",
    sel.pick([stroke], [], 10, 10, 10) === 1 && sel.selected[0]?.id === "s");
}

console.log("\nthe menu only offers to tidy what it can name");
{
  const sel = new InkSelection();
  const circle: Stroke = {
    id: "c", tool: "pen", color: "#111418", width: 3,
    pts: Array.from({ length: 40 }, (_, i) => {
      const a = (i / 39) * Math.PI * 2;
      return [100 + Math.cos(a) * 60, 100 + Math.sin(a) * 60, 0, 0.5, 0, 0] as Point;
    }),
  };
  sel.pick([circle], [], 160, 100, 12);
  check("a round thing is offered as a circle", sel.summary.shape === "circle");

  // Tuned toward silence, and the same floor hold-to-snap uses: an offer to
  // tidy something that was not going to be a shape is worse than no offer.
  const squiggle: Stroke = {
    ...circle, id: "sq",
    pts: Array.from({ length: 40 }, (_, i) =>
      [i * 7, 100 + Math.sin(i) * 40 + (i % 3) * 18, 0, 0.5, 0, 0] as Point),
  };
  sel.pick([squiggle], [], 0, 100, 12);
  check("a deliberate squiggle is offered nothing", sel.summary.shape === null);

  sel.pick([], [box({ id: "t" })], 110, 110, 12);
  check("a note is never offered a shape", sel.summary.shape === null);
}

console.log(failures === 0 ? "\nobjects: all good\n" : `\nobjects: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
