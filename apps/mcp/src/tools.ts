import type { Actor } from "@jotdojo/domain";
import { registerReadTools } from "./tools-read.js";
import { registerWriteTools } from "./tools-write.js";
import type { Registrar } from "./tool-kit.js";

/**
 * The tool surface. Eleven tools, and that is a budget, not a coincidence.
 *
 * kanninja exposes 42. An agent doing the flow we care about -- read a note,
 * build a plan -- holds BOTH servers, so every tool we add is spent from a
 * shared budget that is already mostly full. ADR-002, ADR-016.
 *
 * Every name ends in _note, _notes or _spaces. kanninja owns the generic names
 * (`search`, `list_comments`, `add_comment`), and a bare `search` on our side
 * would be a coin flip the agent sometimes loses.
 *
 * Split read from write on 2026-08-22, when annotating every tool for the app
 * directories pushed this past 250 lines (ADR-069). The split is the one the
 * directories themselves insist on: a tool may not be both.
 */
export function registerTools(server: Registrar, actor: Actor) {
  const t = server.registerTool.bind(server);
  registerReadTools(t, actor);
  registerWriteTools(t, actor);
}
