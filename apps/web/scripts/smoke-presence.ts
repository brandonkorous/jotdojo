/**
 * A heartbeat that changes nothing must not re-render the canvas. JD-4.
 *
 * Pure: the comparison the hook uses to decide whether to keep the old array.
 */
import type { Presence } from "@jotacular/domain";
import { samePresence } from "../lib/presence-same";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

const p = (over: Partial<Presence> = {}): Presence =>
  ({ userId: "u1", displayName: "Ada", avatarUrl: null, deviceId: "d1", writing: false, self: false, ...over });

check("two empty lists are the same", samePresence([], []));
check("equal contents in new arrays are the same", samePresence([p()], [p()]));
check("someone arriving is a change", !samePresence([p()], [p(), p({ deviceId: "d2" })]));
check("someone leaving is a change", !samePresence([p(), p({ deviceId: "d2" })], [p()]));
check("starting to write is a change", !samePresence([p()], [p({ writing: true })]));
check("a different device is a change", !samePresence([p()], [p({ deviceId: "d9" })]));
check("a renamed person is a change", !samePresence([p()], [p({ displayName: "Bo" })]));

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
