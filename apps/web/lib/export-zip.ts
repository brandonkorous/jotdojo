import { artifactBytes, type ExportNote } from "@jotacular/domain";
import { attachmentsOf, inkSvg, noteMarkdown, slugOf } from "./export-files";
import { zip, type ZipEntry } from "./zip";

/**
 * The archive the privacy policy promised: markdown plus the originals.
 *
 * Built in memory, which is the honest constraint on it -- an account with a
 * year of voice notes is gigabytes, and a route handler holding that is a route
 * handler that gets killed. So there is a ceiling, and when it is reached the
 * README says exactly which files were left out. A silent truncation would be
 * the same failure as the missing export itself, one layer down.
 */

const MAX_ARTIFACT_BYTES = 250 * 1024 * 1024;

const utf8 = (text: string) => new TextEncoder().encode(text);

export async function zipNotes(notes: ExportNote[], at = new Date()): Promise<Uint8Array> {
  const entries: ZipEntry[] = [];
  const skipped: string[] = [];
  let spent = 0;

  for (const [i, note] of notes.entries()) {
    const attachments = attachmentsOf(note);
    const index = String(i + 1).padStart(4, "0");
    entries.push({
      name: `notes/${index}-${slugOf(note)}.md`,
      bytes: utf8(noteMarkdown(note, attachments)),
    });

    for (const { block, path } of attachments) {
      if (block.kind === "ink") {
        const svg = inkSvg(block);
        if (svg) entries.push({ name: path, bytes: utf8(svg) });
        continue;
      }
      if (spent >= MAX_ARTIFACT_BYTES) {
        skipped.push(path);
        continue;
      }
      const bytes = await artifactBytes(block.blobUrl);
      if (!bytes) {
        skipped.push(path);
        continue;
      }
      spent += bytes.length;
      entries.push({ name: path, bytes });
    }
  }

  entries.unshift({ name: "README.txt", bytes: utf8(readme(notes.length, skipped, at)) });
  return zip(entries, at);
}

/**
 * Written for whoever opens the zip, not for us.
 *
 * They may be leaving, or backing up, or handing a folder to a solicitor. None
 * of those people want to read about our storage layer; all of them want to
 * know what these folders are and whether anything is missing.
 */
function readme(count: number, skipped: string[], at: Date): string {
  const lines = [
    "Your Jotacular notes",
    "==================",
    "",
    `${count} ${count === 1 ? "note" : "notes"}, exported ${at.toISOString().slice(0, 10)}.`,
    "",
    "notes/      one markdown file per note, newest first",
    "ink/        your handwriting, as SVG. Opens in any browser.",
    "artifacts/  the photos and recordings exactly as they arrived",
    "",
    "Handwriting is kept as the strokes you drew, so each SVG is the drawing",
    "itself rather than a picture of it. Where a page has been read back into",
    "text, that text is in the markdown and says so, along with how sure the",
    "reading was. Your ink is the record; the transcript is a guess about it.",
    "",
  ];

  if (skipped.length > 0) {
    lines.push(
      "Not included",
      "------------",
      "These files were too large to fit in one archive, or could not be read.",
      "They are still on your account and nothing has been deleted.",
      "",
      ...skipped.map((path) => `  ${path}`),
      "",
    );
  }

  return lines.join("\n");
}
