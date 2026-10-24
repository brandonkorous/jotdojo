/**
 * A swallowed server error must still be seen, and a redirect must not be
 * swallowed at all. JD-6.
 */
import { redirect } from "next/navigation";
import { rethrowRedirect, reportError } from "../lib/report";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

let redirected: unknown;
try { redirect("/signin"); } catch (err) { redirected = err; }

let rethrown = false;
try { rethrowRedirect(redirected); } catch { rethrown = true; }
check("a redirect is rethrown", rethrown);

let plain = false;
try { rethrowRedirect(new Error("db down")); } catch { plain = true; }
check("an ordinary error is left to the caller", !plain);

const lines: string[] = [];
console.error = (...args: unknown[]) => { lines.push(args.map(String).join(" ")); };
await reportError(new Error("db down"), "heartbeatAction");
check("a reported error reaches the logs and does not throw", lines.some((l) => l.includes("heartbeatAction") || l.includes("db down")));

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
