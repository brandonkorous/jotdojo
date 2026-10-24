/**
 * A scanner's GET /api/auth/<junk> is a 400, not an error worth logging. JD-7.
 */
import { logAuthError } from "../lib/auth-log";

let failures = 0;
const check = (label: string, ok: boolean) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}`);
  if (!ok) failures++;
};

const lines: string[] = [];
console.error = (...args: unknown[]) => { lines.push(args.join(" ")); };

logAuthError(Object.assign(new Error("Cannot handle action: x"), { type: "UnknownAction" }));
check("UnknownAction is dropped", lines.length === 0);

const named = new Error("nope");
named.name = "UnknownAction";
logAuthError(named);
check("...also when only the name says so", lines.length === 0);

logAuthError(Object.assign(new Error("db down"), { type: "AdapterError" }));
check("any other auth error is still logged", lines.length === 1 && lines[0]!.includes("AdapterError: db down"));

console.log(`\n${failures === 0 ? "all good" : `${failures} FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
