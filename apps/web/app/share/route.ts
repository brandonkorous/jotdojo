import { redirect } from "next/navigation";
import { createNote, defaultSpaceId, asUser } from "@jotdojo/domain";
import { auth } from "@/auth";

/**
 * Android Web Share Target. docs/09-shortcuts.md.
 *
 * Android gives installed PWAs a real share-sheet entry through the manifest,
 * so on that platform this replaces the whole iOS Shortcut apparatus at the
 * cost of one route. iOS Safari has no equivalent -- hence capture tokens.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const form = await request.formData();
  const parts = [
    String(form.get("title") ?? "").trim(),
    String(form.get("text") ?? "").trim(),
    String(form.get("url") ?? "").trim(),
  ].filter(Boolean);

  const actor = asUser(session.user.id);
  const note = await createNote(actor, await defaultSpaceId(actor), parts.join("\n\n"));

  // Straight into the note, so the share lands somewhere visible rather than
  // silently. Files (images, audio) arrive with the recognition work in M4.
  redirect(`/n/${note.id}`);
}
