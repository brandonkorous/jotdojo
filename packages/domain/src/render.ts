/**
 * A note as markdown, block by block, with its provenance intact.
 *
 * Lived in apps/mcp until export needed the same thing. Two copies of this
 * would be two answers to "what did they write", and the one an agent reads
 * would drift from the one a person downloads -- which is precisely the
 * distinction the file exists to preserve.
 *
 * Handwriting is marked as handwriting and carries its confidence, always.
 * docs/08-ink.md is unambiguous, and it is the honest thing to do: a machine
 * reading of somebody's scrawl is not the same kind of fact as a sentence they
 * typed, and a reader who cannot tell the difference will quote a guess back to
 * them as though they had written it.
 *
 * The states matter too. A block that is still pending, or that failed, must
 * not silently look like an empty page -- otherwise the export of a notebook
 * full of writing is a stack of blank markdown files.
 */

export type RenderableBlock = {
  kind: string;
  body: string | null;
  transcript: string | null;
  transcriptSource: string | null;
  transcriptState: string;
  confidence: number | null;
  transcriptCoverage?: number | null;
};

export function renderBlock(b: RenderableBlock): string {
  if (b.kind === "text") return b.body ?? "";

  // Words a person would use. A reader quoting this back says "from a voice
  // note" rather than "from an audio block", which is the difference between
  // sounding like a colleague and sounding like a database.
  const label = { ink: "handwritten", image: "from a photo", audio: "from a voice note" }[b.kind]
    ?? b.kind;

  if (b.transcriptState === "pending") {
    return `_[${label}, not yet read — ask again shortly]_`;
  }
  if (b.transcriptState === "failed") {
    return `_[${label}, could not be read. The original is intact; only the reading failed.]_`;
  }
  if (!b.transcript?.trim()) return `_[${label}, nothing legible on it]_`;

  // A person who corrected the transcript is not "82% sure". Saying so would
  // invite a hedge about the one thing on the page that is certain.
  const provenance = b.transcriptSource === "user"
    ? `${label}, transcribed by the author`
    : `${label}, confidence ${(b.confidence ?? 0).toFixed(2)}`;

  return `> [${provenance}${partOf(b.transcriptCoverage)}]\n${b.transcript}`;
}

/**
 * Say when a reading covers only part of its surface. ADR-056.
 *
 * Silence here is the worst failure this renderer can produce -- worse than a
 * bad transcript, because a bad transcript looks wrong and this does not. A
 * reader handed a third of a whiteboard with no marker takes it for the whole
 * board, and everything downstream inherits that.
 *
 * NULL means nobody measured, which is every block read before this shipped.
 * Claiming those are whole would be inventing a fact.
 */
function partOf(coverage: number | null | undefined): string {
  if (coverage === null || coverage === undefined || coverage >= 1) return "";
  return ` — PARTIAL, roughly ${Math.round(coverage * 100)}% of the surface.`
    + " The rest was not read. Do not describe this as the whole page";
}

export type RenderableNote = {
  id: string;
  title: string | null;
  body: string;
  updatedAt: Date;
  revision: number;
  blocks?: RenderableBlock[];
};

export function renderNote(note: RenderableNote): string {
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
