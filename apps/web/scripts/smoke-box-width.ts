/**
 * How wide a new text box starts. Issue 015.
 *
 * Split out of smoke-objects.ts, which is about what a lasso CATCHES. How wide
 * a box begins is a different question and the file was at the limit.
 */
import { newBoxWidth, MIN_NEW_WIDTH, NEW_WIDTH_FRACTION } from "../lib/new-box-width";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

// At 360px the old rule was `max(120, 360 * 0.33)` = `max(120, 118.8)`, so a
// phone got the FLOOR. A sentence became a six-line ribbon with two thirds of
// the page empty beside it, which is the defect this fixes.
check("the OLD rule never reached the phone case",
  360 * NEW_WIDTH_FRACTION < MIN_NEW_WIDTH);
check("on a phone a new box uses the phone",
  newBoxWidth(360, true) === 331.2, `got ${newBoxWidth(360, true)}`);
check("...which is more than twice what a phone used to get",
  newBoxWidth(360, true) > 2 * MIN_NEW_WIDTH);

check("a laptop is untouched -- still a third",
  newBoxWidth(1400, false) === 462, `got ${newBoxWidth(1400, false)}`);
check("the floor still catches a tiny viewport",
  newBoxWidth(100, true) === MIN_NEW_WIDTH && newBoxWidth(100, false) === MIN_NEW_WIDTH);

// The fraction is chosen from the SCREEN and applied to the WORLD, so zoom must
// not turn a phone into a laptop or the other way about.
check("a zoomed-OUT laptop is still a laptop",
  newBoxWidth(4000, false) === 1320, `got ${newBoxWidth(4000, false)}`);
check("a zoomed-IN phone is still a phone",
  newBoxWidth(180, true) === 165.6, `got ${newBoxWidth(180, true)}`);

console.log(failures === 0 ? "\nbox width: all good\n" : `\nbox width: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
