/**
 * A tab left open across a release must reload once, and never loop. JD-8.
 */
import { isStaleAction, reloadOnce } from "../lib/stale-action";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

const named = Object.assign(new Error("x"), { name: "UnrecognizedActionError" });
check("recognizes the error by name", isStaleAction(named));
check("...and by message", isStaleAction(new Error('Server Action "70e7c5a1" was not found on the server.')));
check("ignores other errors", !isStaleAction(new Error("db down")) && !isStaleAction(null));

const store = new Map<string, string>();
let reloads = 0;
const g = globalThis as unknown as Record<string, unknown>;
g.sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
g.window = { location: { reload: () => { reloads++; } } };

check("the first stale action reloads", reloadOnce(1_000_000) && reloads === 1);
check("a second within a minute does not", !reloadOnce(1_030_000) && reloads === 1);
check("one after the window may reload again", reloadOnce(1_070_000) && reloads === 2);

g.sessionStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
check("blocked storage never reloads, so it cannot loop", !reloadOnce(9_000_000) && reloads === 2);

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
