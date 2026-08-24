/**
 * Photographs as things on the page. ADR-103.
 *
 * Pure, like smoke-objects.ts beside it, and testing the same claim one kind
 * further along: ONE containment rule governs strokes, boxes and pictures. A
 * mixed selection is only explicable if all three are caught by the same
 * standard, and ADR-033 settled what that standard is.
 *
 * The validator is here too, because it is the only thing between a client and
 * a page full of NaN.
 */
import type { ImageOnPage, Point, Stroke, TextBox } from "@jotacular/domain";
import { validateImages } from "@jotacular/domain";
import {
  imageArea, imageAt, imageInPolygon, imagesBounds, translateImages,
} from "../lib/ink-objects";
import { InkSelection } from "../lib/ink-selection";
import { resizeSelection } from "../lib/ink-engine-size";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const pic = (over: Partial<ImageOnPage> = {}): ImageOnPage => ({
  id: "i1", blockId: "b1", x: 100, y: 100, w: 200, h: 150, ...over,
});

/** A rectangle as a lasso path. */
const loop = (x: number, y: number, w: number, h: number): Point[] =>
  [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) =>
    [px!, py!, 0, 0.5, 0, 0] as Point);

const threw = (fn: () => unknown): boolean => {
  try { fn(); return false; } catch { return true; }
};

console.log("\nall four corners, or it is not caught");
{
  const p = pic();
  check("a loop right round it catches it", imageInPolygon(loop(80, 80, 400, 400), p));
  check("a loop nowhere near it does not", !imageInPolygon(loop(600, 600, 100, 100), p));
  // The case the rule exists for: a picture overlapping the edge of a loop must
  // not come along with whatever was actually circled.
  check("a loop over HALF of it does not catch it",
    !imageInPolygon(loop(80, 80, 120, 400), p));
  check("two points cannot enclose anything",
    !imageInPolygon([[0, 0, 0, 0, 0, 0], [900, 900, 0, 0, 0, 0]] as Point[], p));
}

console.log("\nwhere a picture is");
{
  const p = pic();
  check("its area is its rectangle",
    JSON.stringify(imageArea(p)) === JSON.stringify({ x: 100, y: 100, w: 200, h: 150 }));
  check("a tap inside lands on it", imageAt([p], 150, 150)?.id === "i1");
  check("a tap on the very corner still lands on it", imageAt([p], 300, 250)?.id === "i1");
  check("a tap outside lands on nothing", imageAt([p], 99, 99) === null);

  // Reversed, so the topmost wins -- matching what is drawn.
  const under = pic({ id: "under" });
  const over = pic({ id: "over" });
  check("the topmost wins", imageAt([under, over], 150, 150)?.id === "over");

  const bounds = imagesBounds([pic(), pic({ id: "i2", x: 400, y: 300, w: 100, h: 100 })]);
  check("bounds cover them all",
    JSON.stringify(bounds) === JSON.stringify({ x: 100, y: 100, w: 400, h: 300 }));
  check("no pictures is no bounds", imagesBounds([]) === null);
}

console.log("\nmoving one moves the thing itself");
{
  // In place, deliberately: the plane, the selection and the page all hold the
  // same object, and copying would leave two of the three showing the old spot.
  const p = pic();
  translateImages([p], 10, -20);
  check("x and y moved", p.x === 110 && p.y === 80);
  check("the size did not", p.w === 200 && p.h === 150);
}

console.log("\none lasso, three kinds");
{
  const sel = new InkSelection();
  const stroke: Stroke = {
    id: "s1", tool: "pen", color: "#1F2933", width: 2,
    pts: [[120, 120, 0, 0.5, 0, 0], [140, 140, 1, 0.5, 0, 0]],
  };
  const text: TextBox = {
    id: "t1", x: 150, y: 150, w: 60, size: 16, color: "#1F2933", text: "hi",
  };
  const image = pic({ x: 200, y: 200, w: 80, h: 80 });

  sel.beginLasso([0, 0, 0, 0.5, 0, 0]);
  for (const [x, y] of [[900, 0], [900, 900], [0, 900]]) {
    sel.extendLasso([x!, y!, 0, 0.5, 0, 0]);
  }
  const caught = sel.settle([stroke], [text], [image]);

  check("everything inside is caught", caught === 3, `caught ${caught}`);
  check("the summary counts each kind", sel.summary.texts === 1 && sel.summary.images === 1);
  check("every id is named, so ONE delta deletes them",
    sel.summary.ids.join(",") === "s1,t1,i1");
  // Never offered for a mixed selection: "tidy these three things" is not
  // something anybody means. ADR-066.
  check("no shape is offered", sel.summary.shape === null);

  const marquee = sel.marquee!;
  check("the marquee covers the picture too",
    marquee.x + marquee.w >= 280 && marquee.y + marquee.h >= 280,
    JSON.stringify(marquee));

  sel.beginDrag(0, 0);
  sel.dragTo(10, 10);
  check("dragging moves the picture with the ink", image.x === 210 && image.y === 210);
  check("and the stroke came too", stroke.pts[0]![0] === 130);
}

console.log("\na picture is tapped like anything else");
{
  const sel = new InkSelection();
  const image = pic();
  // Boxes first, then pictures, then strokes -- matching what is drawn.
  const text: TextBox = {
    id: "t1", x: 100, y: 100, w: 60, size: 16, color: "#1F2933", text: "on top",
  };
  check("a picture under nothing is picked",
    sel.pick([], [], 150, 150, 6, [image]) === 1 && sel.summary.images === 1);
  check("a note laid on it wins, because that is what you can see",
    sel.pick([], [text], 110, 105, 6, [image]) === 1 && sel.summary.texts === 1);
}

console.log("\nbigger and smaller, about the centre");
{
  const sel = new InkSelection();
  const image = pic({ x: 0, y: 0, w: 100, h: 100 });
  sel.pick([], [], 50, 50, 6, [image]);
  resizeSelection(sel, true);
  check("it grew", image.w === 125 && image.h === 125);
  // Otherwise a row of photos walks off down the page as somebody presses
  // "bigger" three times.
  check("about its own centre", image.x === -12.5 && image.y === -12.5);
  resizeSelection(sel, false);
  check("and smaller puts it back", Math.abs(image.w - 100) < 1e-9 && Math.abs(image.x) < 1e-9);
}

console.log("\nwhat a client may send");
{
  check("a whole placement survives", validateImages([pic()]).length === 1);
  check("an id is minted when one is missing",
    validateImages([{ blockId: "b1", x: 0, y: 0, w: 1, h: 1 }])[0]!.id.length > 0);
  // A placement with no block behind it is a hole nothing can ever fill in.
  check("a missing blockId is refused",
    threw(() => validateImages([{ x: 0, y: 0, w: 1, h: 1 }])));
  check("NaN is refused",
    threw(() => validateImages([{ blockId: "b", x: NaN, y: 0, w: 1, h: 1 }])));
  check("a zero-sized picture is refused",
    threw(() => validateImages([{ blockId: "b", x: 0, y: 0, w: 0, h: 1 }])));
  check("something that is not a list is refused", threw(() => validateImages("nope")));
}

console.log(failures === 0 ? "\nimages: all good\n" : `\nimages: ${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
