/**
 * A worker with nothing to drain parks; it does not exit. ADR-055.
 *
 * This spawns a real worker rather than calling a function, because the thing
 * being tested is a process-level behaviour that no in-process assertion can
 * see. It earns its keep: the first version of the fix replaced
 * `process.exit(0)` with `await park()` and shipped, and a signal handler does
 * NOT hold Node's event loop open -- so Node warned about an unsettled
 * top-level await and exited 13. The pod restarted exactly as fast, for a new
 * reason, and every suite here was green.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ALIVE_MS = 5000;
const STOP_MS = 8000;

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../src/index.ts");

/** Deliberately stripped, so the child takes the no-provider path whatever the
 *  developer running this happens to have exported. */
const env = { ...process.env };
for (const key of [
  "EMBEDDING_PROVIDER", "VISION_PROVIDER", "SPEECH_PROVIDER", "TRIAGE_PROVIDER",
]) delete env[key];

console.log("\na worker with no providers");

const child = spawn(process.execPath, ["--import", "tsx", entry], { env, stdio: "pipe" });

let out = "";
child.stdout.on("data", (d) => { out += d; });
child.stderr.on("data", (d) => { out += d; });

let exited: number | null = null;
let signalled: string | null = null;
child.on("exit", (code, signal) => { exited = code; signalled = signal; });

await wait(ALIVE_MS);

check("says why it has nothing to do", out.includes("nothing to drain"),
  out.slice(0, 300) || "(no output)");
check(`is still running after ${ALIVE_MS / 1000}s`, exited === null,
  `exited with ${exited}`);

// The exact shape of the bug that shipped. Node prints this and exits 13 when
// a top-level await has nothing left that could ever settle it.
check("Node does not call the park a deadlock", !out.includes("unsettled top-level await"),
  out);

console.log("\nand it still stops when asked");

child.kill("SIGTERM");
const deadline = Date.now() + STOP_MS;
while (exited === null && signalled === null && Date.now() < deadline) await wait(100);

check("stops on SIGTERM rather than having to be killed",
  exited !== null || signalled !== null, `still running after ${STOP_MS / 1000}s`);

if (exited === null && signalled === null) child.kill("SIGKILL");

console.log(failures === 0 ? "\npark: all good\n" : `\npark: ${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
