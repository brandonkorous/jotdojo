import { z } from "zod";
import {
  searchNotes, getNote, listNotes, listSpaces, listNoteComments,
  renderNote, listChanges, defaultSpaceId, type Actor,
} from "@jotacular/domain";
import { viewNote } from "./view.js";
import { parseWhen, describeWhen, renderChange, WHEN_HINT } from "./when.js";
import { asText, reads, type Register } from "./tool-kit.js";

/**
 * Reading. Seven tools, none of which changes anything.
 *
 * Descriptions say what a tool does and what it is for, and stop there. Which
 * tool a model should reach for first is not ours to assert: a description that
 * ranks its neighbours is prompt injection wearing a helpful face. Safety is
 * carried by annotations now. ADR-069.
 */
export function registerReadTools(t: Register, actor: Actor) {
  t("search_notes", {
    title: "Search notes",
    annotations: reads("Search notes"),
    description:
      "Search the user's Jotacular notes by meaning and by keyword at once, across every " +
      "note in a space. Returns ranked matches with note ids, dates, a preview, and how " +
      "each one was matched.",
    inputSchema: {
      query: z.string().describe("What to look for, in natural language or keywords"),
      space_id: z.string().optional().describe("Restrict to one space; omit for the default space"),
      since: z.string().optional().describe(`Only notes touched on or after this. ${WHEN_HINT}`),
      until: z.string().optional().describe("Only notes touched strictly before this."),
    },
  }, async ({ query, space_id, since, until }: {
    query: string; space_id?: string; since?: string; until?: string;
  }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const when = parseWhen(since, until);
    const results = await searchNotes(actor, spaceId, query, when);
    if (results.length === 0) {
      // Said plainly, because the alternative is an agent inferring the search
      // is broken and going looking for another way in. The window is repeated
      // back so an empty answer says what it was empty ABOUT.
      return asText(
        `No notes match "${query}"${describeWhen(when)}. That is the whole answer -- the ` +
          "search covered keywords, meaning and misspellings across every note in the space.",
      );
    }
    // "matched by" is here for the model, not for decoration. A hit found only
    // semantically is a guess about what the user meant; one found by all three
    // is close to certain. An agent that can see the difference can hedge.
    return asText(results.map((r) =>
      `- **${r.title ?? "Untitled"}** (note ${r.id}, updated ${r.updatedAt.toISOString()}`
      + `, matched by ${r.matchedBy.join(" + ")})\n  ${r.preview}`,
    ).join("\n"));
  });

  t("get_note", {
    title: "Get a note",
    annotations: reads("Get a note"),
    description:
      "Read one Jotacular note in full, as markdown, with the provenance of every block: " +
      "whether it was typed, handwritten, spoken or photographed, and how confident the " +
      "reading of it is.",
    inputSchema: { note_id: z.string().describe("The note id, from search_notes or list_notes") },
  }, async ({ note_id }: { note_id: string }) => asText(renderNote(await getNote(actor, note_id))));

  t("list_notes", {
    title: "List recent notes",
    annotations: reads("List recent notes"),
    description:
      "The user's Jotacular notes in reverse-chronological order, newest first, with a " +
      "preview of each. Answers what somebody captured over a period.",
    inputSchema: {
      space_id: z.string().optional().describe("Restrict to one space; omit for the default space"),
      limit: z.number().int().min(1).max(100).optional().describe("How many notes; 25 by default"),
      since: z.string().optional().describe(`Only notes touched on or after this. ${WHEN_HINT}`),
      until: z.string().optional().describe("Only notes touched strictly before this."),
    },
  }, async ({ space_id, limit, since, until }: {
    space_id?: string; limit?: number; since?: string; until?: string;
  }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const when = parseWhen(since, until);
    const rows = await listNotes(actor, spaceId, { ...when, limit: limit ?? 25 });
    if (rows.length === 0) return asText(`No notes${describeWhen(when)}.`);
    return asText(rows.map((r) =>
      `- **${r.title ?? "Untitled"}** (note ${r.id}, updated ${r.updatedAt.toISOString()})\n  ${r.preview}`,
    ).join("\n"));
  });

  /**
   * The one thing a transcript cannot carry. ADR-068.
   *
   * Arrows, boxes, a crossed-out line, a freehand table, a sketch of a room all
   * come back as "handwritten, nothing legible on it", which is true and
   * useless. We keep the strokes, so we can hand over the page itself.
   */
  t("view_note", {
    title: "Look at a note's handwriting",
    annotations: reads("Look at a note's handwriting"),
    description:
      "Render a Jotacular note's handwriting as an image, so the page can be looked at " +
      "rather than only read. This carries what a transcript cannot: diagrams, sketches, " +
      "tables, arrows, crossings-out and layout. It suits any page whose transcript is " +
      "empty, unhelpful or low confidence. The drawing is the record and the transcript " +
      "is a reading of it, so where they disagree the image is what happened.",
    inputSchema: { note_id: z.string().describe("The note id, from search_notes or list_notes") },
  }, async ({ note_id }: { note_id: string }) => viewNote(actor, note_id));

  /**
   * "Anything new?" -- a question nothing could answer before ADR-063.
   *
   * A page whose handwriting was finally read, or that somebody left a comment
   * on, has changed in a way its position in a list cannot express.
   */
  t("changes_notes", {
    title: "What has changed",
    annotations: reads("What has changed"),
    description:
      "An event feed for a Jotacular space, newest first: notes created and edited, comments " +
      "left by people and by agents, handwriting that has finished being read. It reports " +
      "what happened and when, which is a different question from which notes are recent.",
    inputSchema: {
      space_id: z.string().optional().describe("Restrict to one space; omit for the default space"),
      since: z.string().optional().describe(`Only what happened on or after this. ${WHEN_HINT}`),
      until: z.string().optional().describe("Only what happened strictly before this."),
      limit: z.number().int().min(1).max(200).optional().describe("How many events; 50 by default"),
    },
  }, async ({ space_id, since, until, limit }: {
    space_id?: string; since?: string; until?: string; limit?: number;
  }) => {
    const spaceId = space_id ?? (await defaultSpaceId(actor));
    const when = parseWhen(since, until);
    const rows = await listChanges(actor, spaceId, { ...when, limit: limit ?? 50 });
    if (rows.length === 0) return asText(`Nothing has happened in that space${describeWhen(when)}.`);
    return asText(rows.map(renderChange).join("\n"));
  });

  t("list_spaces", {
    title: "List spaces",
    annotations: reads("List spaces"),
    description:
      "The Jotacular spaces this connection was granted, with the id every other tool takes. " +
      "A space is one person, a family, or a team.",
    inputSchema: {},
  }, async () => {
    const spaces = await listSpaces(actor);
    return asText(spaces.map((s) => `- ${s.name} (${s.kind}, space ${s.id})`).join("\n") || "No spaces granted.");
  });

  t("list_note_comments", {
    title: "List comments on a note",
    annotations: reads("List comments on a note"),
    description:
      "Comments on a Jotacular note, oldest first, each attributed to the person or the " +
      "agent that left it.",
    inputSchema: { note_id: z.string().describe("The note id, from search_notes or list_notes") },
  }, async ({ note_id }: { note_id: string }) => {
    const rows = await listNoteComments(actor, note_id);
    if (rows.length === 0) return asText("No comments on that note.");
    return asText(rows.map((c) =>
      `- **${c.authorLabel}** (${c.authorType}, ${c.createdAt.toISOString()}): ${c.body}`,
    ).join("\n"));
  });
}
