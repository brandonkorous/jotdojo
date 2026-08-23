import { redirect } from "next/navigation";
import {
  createNote, defaultSpaceId, asUser, captureText, createMediaBlock, finalizeMedia,
  type Actor,
} from "@jotdojo/domain";
import { auth } from "@/auth";

/**
 * Android Web Share Target. docs/09-shortcuts.md, ADR-064.
 *
 * Android gives installed PWAs a real share-sheet entry through the manifest,
 * so on that platform this replaces the whole iOS Shortcut apparatus at the
 * cost of one route. iOS Safari has no equivalent -- hence capture tokens.
 *
 * THE ONE PLACE BYTES PASS THROUGH US, and it is not a choice. docs/04 is
 * emphatic that media goes browser->blob so our servers never hold the payload,
 * and every other path obeys that. The Web Share Target spec has no such path:
 * the file arrives inside the POST body or it does not arrive. The manifest has
 * been advertising `image/*` and `audio/*` since launch and this route ignored
 * them, so a shared screenshot silently became an empty note.
 */

/** Well above a screenshot, well below the 200MB the media pipeline allows.
 *  This route holds what it forwards, so its ceiling is memory, not policy. */
const MAX_SHARED_BYTES = 30 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const form = await request.formData();
  const actor = asUser(session.user.id);
  // The same rule the capture API uses, so a link shared from Android and the
  // same link sent by a Shortcut make the same note.
  const body = captureText({
    title: String(form.get("title") ?? ""),
    text: String(form.get("text") ?? ""),
    url: String(form.get("url") ?? ""),
  });

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const note = await createNote(actor, await defaultSpaceId(actor), body || titleFor(files));

  for (const file of files) await attach(actor, note.id, file);

  // Straight into the note, so the share lands somewhere visible rather than
  // silently.
  redirect(`/n/${note.id}`);
}

/**
 * A note that is nothing but a photo still needs a first line.
 *
 * Without one it lands in the list as an untitled blank row and looks lost --
 * the same complaint listNotes' preview join exists to answer. The filename is
 * usually meaningless (`IMG_4821.jpg`) but it is what the person will recognise
 * for the twenty minutes before recognition gives them something better.
 */
function titleFor(files: File[]): string {
  const first = files[0];
  if (!first) return "";
  const kind = first.type.startsWith("audio/") ? "Recording" : "Photo";
  return files.length > 1 ? `${kind} and ${files.length - 1} more` : `${kind}: ${first.name}`;
}

/**
 * Reserve, upload, finalize -- the same three steps the browser takes.
 *
 * A failure here must not lose the note. The text has already been saved, so a
 * photo that cannot be stored costs the photo and nothing else, and the person
 * still lands on a note with their link in it.
 */
async function attach(actor: Actor, noteId: string, file: File): Promise<void> {
  const kind = file.type.startsWith("audio/") ? "audio" : "image";
  if (file.size > MAX_SHARED_BYTES) return;

  try {
    const slot = await createMediaBlock(actor, noteId, kind, file.type);
    const put = await fetch(slot.url, {
      method: "PUT",
      headers: { ...slot.headers, "content-length": String(file.size) },
      body: file,
    });
    if (!put.ok) return;
    await finalizeMedia(actor, slot.blockId, { byteSize: file.size });
  } catch {
    // Deliberately swallowed. The alternative is a 500 on a share, which on
    // Android looks like the share sheet itself is broken.
  }
}
