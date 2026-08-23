/**
 * Every tool, held to what the app directories mechanically check. ADR-069.
 *
 * Anthropic's submission portal syncs the tool list off the live server and
 * refuses to accept one whose tools are missing a title or an annotation.
 * OpenAI names bad annotations as its first rejection reason. Both are checks a
 * machine runs, which means we can run the same ones before submitting rather
 * than finding out in a queue.
 *
 * No network and no database: the tools are registered into a recorder and the
 * declarations are read straight off it.
 *
 *   pnpm mcp:tools
 */
import { registerTools } from "../src/tools.js";
import type { Actor } from "@jotacular/domain";

type Declared = {
  name: string;
  title?: string;
  description?: string;
  annotations?: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
};

const declared: Declared[] = [];
const recorder = {
  registerTool(name: string, config: unknown) {
    declared.push({ name, ...(config as object) } as Declared);
  },
};

// Never called -- handlers are not invoked, only their declarations read.
registerTools(recorder as never, { type: "agent" } as Actor);

let failures = 0;
const check = (label: string, ok: boolean, detail?: string) => {
  console.log(`${ok ? "  ok  " : "  FAIL"}  ${label}${detail && !ok ? `\n          ${detail}` : ""}`);
  if (!ok) failures++;
};

console.log(`\n${declared.length} tools declared\n`);

/**
 * Steering, which reads to a reviewer exactly like injection.
 *
 * A description that ranks its neighbours -- "prefer this", "the wrong tool" --
 * is telling a model how to behave rather than what the tool does, and that is
 * a stated rejection cause on both directories.
 */
const STEERING = [
  /\bprefer\b/i, /\binstead\b/i, /\bwrong tool\b/i, /\brather than using\b/i,
  /\bALWAYS\b/, /\bNEVER\b/, /\bMUST\b/, /\bdo not use\b/i,
];

const names = new Set(declared.map((d) => d.name));

for (const tool of declared) {
  const at = `${tool.name}:`;

  check(`${at} name is 64 characters or fewer`, tool.name.length <= 64, `${tool.name.length} characters`);

  // ADR-002: kanninja owns the generic names -- `search`, `list_comments`,
  // `add_comment` -- and an agent holding both servers must never have to guess
  // which one it meant. Carrying our noun is what makes a collision impossible.
  check(`${at} name is namespaced against kanninja`,
    /(note|space)/.test(tool.name), `${tool.name} names neither a note nor a space`);

  check(`${at} declares a title`, typeof tool.title === "string" && tool.title.length > 0);

  const ann = tool.annotations;
  check(`${at} declares annotations`, Boolean(ann), "both directories reject a tool without them");
  if (!ann) continue;

  check(`${at} annotations carry a title`,
    typeof ann.title === "string" && (ann.title as string).length > 0);

  const readOnly = ann.readOnlyHint;
  check(`${at} declares readOnlyHint`, typeof readOnly === "boolean");

  check(`${at} declares destructiveHint`, typeof ann.destructiveHint === "boolean");

  // A read-only tool that also claims to destroy something is a contradiction,
  // and the pair decides whether a client may run it without asking.
  if (readOnly === true) {
    check(`${at} read-only, so not destructive`, ann.destructiveHint === false);
  }

  check(`${at} declares openWorldHint`, typeof ann.openWorldHint === "boolean");

  const description = tool.description ?? "";
  check(`${at} has a description of substance`, description.length >= 40,
    `${description.length} characters`);

  const steer = STEERING.find((re) => re.test(description));
  check(`${at} description does not steer`, !steer, `matched ${steer}`);

  const other = [...names].filter((n) => n !== tool.name && description.includes(n));
  check(`${at} description does not name another tool`, other.length === 0, other.join(", "));
}

// The budget is a decision, not an accident, and it is worth failing over.
check(`the surface is under a dozen tools`, declared.length < 12, `${declared.length} declared`);

/**
 * The invariant the whole surface is built to keep. ADR-070.
 *
 * No tool here can lose anything a person wrote, so no tool is destructive. If
 * this ever fails, an edit path came back and the promise on the listing --
 * and in the consent screen -- stopped being true.
 */
const destructive = declared.filter((d) => d.annotations?.destructiveHint === true);
check("no tool can overwrite what a person wrote",
  destructive.length === 0, destructive.map((d) => d.name).join(", "));

const writeTools = declared.filter((d) => d.annotations?.readOnlyHint === false);
check("the surface still writes at all", writeTools.length > 0);

console.log(failures === 0
  ? "\ndirectory readiness: all checks passed"
  : `\ndirectory readiness: ${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
