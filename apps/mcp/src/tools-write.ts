import { z } from "zod";
import {
  createNote, appendToNote, commentOnNote, defaultSpaceId, type Actor,
} from "@jotacular/domain";
import { asText, writes, type Register } from "./tool-kit.js";

/**
 * Writing. Three tools, and not one of them can lose anything.
 *
 * There is no edit tool, on purpose. An agent adds notes, adds to notes, and
 * comments on notes; replacing what a person wrote is not on the surface at
 * all, so "an agent cannot overwrite your words" is a property of the server
 * rather than a promise about it. ADR-070.
 *
 * The old descriptions also ranked each other -- "PREFER THIS", "almost always
 * the wrong tool" -- which was honest and is now disallowed: a description that
 * steers a model away from its neighbours is indistinguishable from one that
 * steers it anywhere else. Annotations carry that now. ADR-069.
 */
export function registerWriteTools(t: Register, actor: Actor) {
  t("comment_on_note", {
    title: "Comment on a note",
    annotations: writes("Comment on a note", false),
    description:
      "Leave a comment on a Jotacular note. The note's own content is untouched -- a comment " +
      "is how something gets said about a page without changing what the person wrote. It " +
      "is attributed to this connection and sits alongside comments left by people.",
    inputSchema: {
      note_id: z.string().describe("The note id, from search_notes or list_notes"),
      body: z.string().describe("The comment, as markdown"),
    },
  }, async ({ note_id, body }: { note_id: string; body: string }) => {
    const c = await commentOnNote(actor, note_id, body);
    return asText(`Comment added to note ${note_id} at ${c.createdAt.toISOString()}.`);
  });

  t("create_note", {
    title: "Create a note",
    annotations: writes("Create a note", false),
    description:
      "Create a new Jotacular note from markdown. Nothing existing is affected. The new note " +
      "is attributed to this connection.",
    inputSchema: {
      text: z.string().describe("The note body, as markdown"),
      space_id: z.string().optional().describe("Which space; omit for the default space"),
    },
  }, async ({ text, space_id }: { text: string; space_id?: string }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const note = await createNote(actor, spaceId, text);
    return asText(`Created note ${note.id}.`);
  });

  t("append_to_note", {
    title: "Append to a note",
    annotations: writes("Append to a note", false),
    description:
      "Add text to the end of a Jotacular note. Nothing already in the note is read, moved " +
      "or overwritten; the note gains a revision and the addition is attributed to this " +
      "connection.",
    inputSchema: {
      note_id: z.string().describe("The note id, from search_notes or list_notes"),
      text: z.string().describe("What to add, as markdown"),
    },
  }, async ({ note_id, text }: { note_id: string; text: string }) => {
    const note = await appendToNote(actor, note_id, text);
    return asText(`Appended to note ${note.id}; it is now revision ${note.revision}.`);
  });
}
