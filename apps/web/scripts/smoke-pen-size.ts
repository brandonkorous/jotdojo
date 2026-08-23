/**
 * The pen size curve. ADR-059.
 *
 * The failure this exists to catch is silent and maddening: the slider is
 * driven by the width it produced, so if two steps settle to one width, the
 * thumb sticks at that width and slides back under the finger.
 */
import {
  PEN_WIDTH_MAX, PEN_WIDTH_MIN, sliderFromWidth, widthFromSlider,
} from "../lib/ink-style";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const STEPS = 100;
const widths = Array.from({ length: STEPS + 1 }, (_, i) => widthFromSlider(i / STEPS));

console.log("\nthe range reaches both of its own ends");
check("the thinnest step is the thinnest pen", widths[0] === PEN_WIDTH_MIN, `${widths[0]}`);
check("the widest step is the widest pen",
  widths[STEPS] === PEN_WIDTH_MAX, `${widths[STEPS]}`);
check("nothing lands outside the range the domain will accept",
  widths.every((w) => w > 0 && w <= 200));

console.log("\nno step settles to the same width as its neighbour");
{
  const stuck = widths.filter((w, i) => i > 0 && w === widths[i - 1]);
  check("every one of the 101 steps is a width of its own",
    stuck.length === 0, `${stuck.length} repeats, first at ${stuck[0]}`);
  check("and the widths only ever go up",
    widths.every((w, i) => i === 0 || w > widths[i - 1]!));
}

console.log("\nthe thumb lands back where it was put");
{
  const drifted = widths.filter((w, i) => Math.round(sliderFromWidth(w) * STEPS) !== i);
  check("reading a width back gives the step that made it",
    drifted.length === 0, `${drifted.length} drifted, first at ${drifted[0]}`);
}

console.log("\nthe handwriting sizes get the room they need");
{
  const at = (t: number) => widthFromSlider(t);
  check("the old Fine and Medium are still a quarter and a third along",
    at(0.25) > 1.2 && at(0.25) < 1.7 && at(0.35) > 1.9 && at(0.35) < 2.6,
    `${at(0.25)} / ${at(0.35)}`);
  check("half the travel is still a pen and not a slab",
    at(0.5) > 3 && at(0.5) < 6, `${at(0.5)}`);
  check("out of range asks are pulled back in",
    widthFromSlider(-1) === PEN_WIDTH_MIN && widthFromSlider(9) === PEN_WIDTH_MAX);
  check("so are widths that came from somewhere older",
    sliderFromWidth(0.01) === 0 && sliderFromWidth(500) === 1);
}

console.log(failures === 0
  ? "\npen size smoke: all checks passed"
  : `\npen size smoke: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
