/**
 * Reconciling two copies of a page, with no database and no canvas. ADR-058.
 *
 * These are pure functions and they decide whether somebody's handwriting
 * survives two devices, which is exactly the kind of rule that fails quietly.
 * The important cases are the ones where the OBVIOUS implementation is wrong:
 * adopting the server's page loses the upload queue, and trusting a stroke
 * count loses an erase.
 */
import type { Stroke } from "@jotdojo/domain";
import { mergePages, needsFullRead, newcomers } from "../lib/ink-merge";

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const s = (id: string): Stroke => ({
  id, tool: "pen", color: "#1A1817", width: 2, pts: [[0, 0, 0, 0.5, 0, 0]],
});
const at = (...page: Stroke[]) => page.map((x) => x.id).join(",");

console.log("\nwhich strokes are new");

check("nothing is new when both sides match",
  newcomers([s("a"), s("b")], [s("a"), s("b")]).length === 0);
check("a stroke the page has never seen is new",
  at(...newcomers([s("a")], [s("a"), s("b")])) === "b");
check("an empty page finds everything new",
  newcomers([], [s("a"), s("b")]).length === 2);

console.log("\nmerging, and the queue that must not be lost");

check("the other side's strokes land after this side's",
  at(...mergePages([s("a")], [s("b")])) === "a,b");
check("A STROKE STILL IN THE UPLOAD QUEUE SURVIVES adopting the server's page",
  at(...mergePages([s("x"), s("y")], [s("mine")])) === "x,y,mine");
check("...and one the server ALREADY has is not added twice",
  at(...mergePages([s("x"), s("mine")], [s("mine")])) === "x,mine");
check("paint order is the first page's order, so a highlighter stays behind",
  at(...mergePages([s("c"), s("a"), s("b")], [])) === "c,a,b");

console.log("\nstrokes are copied, because the selection mutates them in place");

const original = s("shared");
const merged = mergePages([original], [])[0]!;
merged.color = "#E0432F";
check("recolouring the merged copy does not recolour the original",
  original.color === "#1A1817");
merged.pts.push([9, 9, 9, 1, 0, 0]);
check("...and dragging it does not drag the original", original.pts.length === 1);

console.log("\ntail or whole page");

const have = { count: 10, version: 4 };
check("a page that only grew is caught up with a tail",
  needsFullRead(have, { count: 13, version: 7 }) === false);
check("A COUNT THAT FELL means something in the middle went",
  needsFullRead(have, { count: 8, version: 5 }) === true);
check("a count that did not move while the version did is an erase and a draw",
  needsFullRead(have, { count: 10, version: 6 }) === true);
check("a version that moved further than the count is a delta, not an append",
  needsFullRead(have, { count: 11, version: 6 }) === true);
check("nothing changed at all needs nothing",
  needsFullRead(have, have) === false);

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
