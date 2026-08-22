import { z } from "zod";
import {
  searchNotes, getNote, listNotes, listSpaces, createNote, appendToNote,
  commentOnNote, listNoteComments, saveNote, defaultSpaceId, type Actor,
} from "@jotdojo/domain";

/**
 * The tool surface. Nine tools, and that is a budget, not a coincidence.
 *
 * kanninja exposes 42. An agent doing the flow we care about -- read a note,
 * build a plan -- holds BOTH servers, so every tool we add is spent from a
 * shared budget that is already mostly full. ADR-002, ADR-016.
 *
 * Every name ends in _note, _notes or _spaces. kanninja owns the generic names
 * (`search`, `list_comments`, `add_comment`), and a bare `search` on our side
 * would be a coin flip the agent sometimes loses.
 */

const asText = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

/** Provenance is stated, not implied. docs/05-mcp-server.md. */
/**
 * Render a note for a model, block by block.
 *
 * Handwriting is marked as handwriting and carries its confidence, always.
 * docs/08-ink.md is unambiguous about this and it is the honest thing to do:
 * a machine reading of somebody's scrawl is not the same kind of fact as a
 * sentence they typed, and an agent that cannot tell the difference will quote
 * a guess back to them as though they had written it.
 *
 * The states matter too. A block that is still pending, or that failed, must
 * not silently look like an empty page -- otherwise an agent confidently
 * reports that a note is blank when in fact it is covered in writing nobody
 * has read yet.
 */
function renderBlock(b: {
  kind: string; body: string | null; transcript: string | null;
  transcriptSource: string | null; transcriptState: string; confidence: number | null;
}): string {
  if (b.kind === "text") return b.body ?? "";

  // Words a person would use. An agent quoting this back says "from a voice
  // note" rather than "from an audio block", which is the difference between
  // sounding like a colleague and sounding like a database.
  const label = { ink: "handwritten", image: "from a photo", audio: "from a voice note" }[b.kind]
    ?? b.kind;

  if (b.transcriptState === "pending") {
    return `_[${label}, not yet read \u2014 ask again shortly]_`;
  }
  if (b.transcriptState === "failed") {
    return `_[${label}, could not be read. The original is intact; only the reading failed.]_`;
  }
  if (!b.transcript?.trim()) return `_[${label}, nothing legible on it]_`;

  // A person who corrected the transcript is not "82% sure". Saying so would
  // invite an agent to hedge about the one thing on the page that is certain.
  const provenance = b.transcriptSource === "user"
    ? `${label}, transcribed by the author`
    : `${label}, confidence ${(b.confidence ?? 0).toFixed(2)}`;

  return `> [${provenance}]\n${b.transcript}`;
}

function renderNote(note: {
  title: string | null; body: string; updatedAt: Date; revision: number; id: string;
  blocks?: Array<Parameters<typeof renderBlock>[0]>;
}): string {
  const content = note.blocks?.length
    ? note.blocks.map(renderBlock).filter((s) => s.trim()).join("\n\n")
    : note.body;

  return [
    `# ${note.title ?? "Untitled"}`,
    `_note ${note.id} · revision ${note.revision} · updated ${note.updatedAt.toISOString()}_`,
    "",
    content || "_(empty)_",
  ].join("\n");
}

export function registerTools(server: {
  registerTool: (name: string, config: unknown, handler: (args: never) => Promise<unknown>) => void;
}, actor: Actor) {
  const t = (name: string, config: unknown, handler: (args: never) => Promise<unknown>) =>
    server.registerTool(name, config, handler);

  // --- read ---------------------------------------------------------------

  t("search_notes", {
    title: "Search notes",
    description:
      "Search the user's jotdojo notes by meaning and by keyword. Use this first when " +
      "looking for something the user wrote. Returns ranked matches with note ids.",
    inputSchema: {
      query: z.string().describe("What to look for, in natural language or keywords"),
      space_id: z.string().optional().describe("Restrict to one space; omit for the default space"),
    },
  }, async ({ query, space_id }: { query: string; space_id?: string }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const results = await searchNotes(actor, spaceId, query);
    if (results.length === 0) {
      // Said plainly, because the alternative is an agent inferring the search
      // is broken and going looking for another way in.
      return asText(
        `No notes match "${query}". That is the whole answer -- the search covered ` +
          "keywords, meaning and misspellings across every note in the space.",
      );
    }
    // "matched by" is here for the model, not for decoration. A hit found only
    // semantically is a guess about what the user meant; one found by all three
    // is close to certain. An agent that can see the difference can hedge in
    // its answer instead of asserting.
    return asText(results.map((r) =>
      `- **${r.title ?? "Untitled"}** (note ${r.id}, updated ${r.updatedAt.toISOString()}`
      + `, matched by ${r.matchedBy.join(" + ")})\n  ${r.preview}`,
    ).join("\n"));
  });

  t("get_note", {
    title: "Get a note",
    description: "Read one jotdojo note in full, as markdown, with its provenance.",
    inputSchema: { note_id: z.string().describe("The note id, from search_notes or list_notes") },
  }, async ({ note_id }: { note_id: string }) => asText(renderNote(await getNote(actor, note_id))));

  t("list_notes", {
    title: "List recent notes",
    description: "The user's most recently updated jotdojo notes, newest first.",
    inputSchema: {
      space_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  }, async ({ space_id, limit }: { space_id?: string; limit?: number }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const rows = await listNotes(actor, spaceId, limit ?? 25);
    if (rows.length === 0) return asText("No notes yet.");
    return asText(rows.map((r) =>
      `- **${r.title ?? "Untitled"}** (note ${r.id}, updated ${r.updatedAt.toISOString()})\n  ${r.preview}`,
    ).join("\n"));
  });

  t("list_spaces", {
    title: "List spaces",
    description: "The jotdojo spaces this connection was granted. A space is a person, a family, or a team.",
    inputSchema: {},
  }, async () => {
    const spaces = await listSpaces(actor);
    return asText(spaces.map((s) => `- ${s.name} (${s.kind}, space ${s.id})`).join("\n") || "No spaces granted.");
  });

  t("list_note_comments", {
    title: "List comments on a note",
    description: "Comments on a jotdojo note, from people and from agents, oldest first.",
    inputSchema: { note_id: z.string() },
  }, async ({ note_id }: { note_id: string }) => {
    const rows = await listNoteComments(actor, note_id);
    if (rows.length === 0) return asText("No comments on that note.");
    return asText(rows.map((c) =>
      `- **${c.authorLabel}** (${c.authorType}, ${c.createdAt.toISOString()}): ${c.body}`,
    ).join("\n"));
  });

  // --- write --------------------------------------------------------------

  t("comment_on_note", {
    title: "Comment on a note",
    description:
      "Leave a comment on a jotdojo note. PREFER THIS over editing: it is how you " +
      "say something about a note without changing what the person wrote.",
    inputSchema: { note_id: z.string(), body: z.string() },
  }, async ({ note_id, body }: { note_id: string; body: string }) => {
    const c = await commentOnNote(actor, note_id, body);
    return asText(`Comment added to note ${note_id} at ${c.createdAt.toISOString()}.`);
  });

  t("create_note", {
    title: "Create a note",
    description: "Create a new jotdojo note from markdown.",
    inputSchema: { text: z.string(), space_id: z.string().optional() },
  }, async ({ text, space_id }: { text: string; space_id?: string }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const note = await createNote(actor, spaceId, text);
    return asText(`Created note ${note.id}.`);
  });

  t("append_to_note", {
    title: "Append to a note",
    description:
      "Add text to the end of a jotdojo note. Non-destructive: nothing already " +
      "in the note is changed. Prefer this over update_note.",
    inputSchema: { note_id: z.string(), text: z.string() },
  }, async ({ note_id, text }: { note_id: string; text: string }) => {
    const note = await appendToNote(actor, note_id, text);
    return asText(`Appended to note ${note.id}; it is now revision ${note.revision}.`);
  });

  t("update_note", {
    title: "Replace a note's content",
    description:
      "Replace the entire body of a jotdojo note. DESTRUCTIVE -- it overwrites what " +
      "the person wrote. Almost always the wrong tool: use comment_on_note to say " +
      "something, or append_to_note to add something. Requires an explicit grant.",
    inputSchema: {
      note_id: z.string(),
      text: z.string(),
      expected_revision: z.number().int().describe("From get_note. Guards against overwriting a concurrent change"),
    },
  }, async ({ note_id, text, expected_revision }: {
    note_id: string; text: string; expected_revision: number;
  }) => {
    const note = await saveNote(actor, note_id, text, expected_revision);
    return asText(`Note ${note.id} is now revision ${note.revision}. The previous version is kept and can be reverted.`);
  });
}
