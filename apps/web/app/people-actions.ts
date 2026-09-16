"use server";

/**
 * Putting people in a space, and taking them out again. Issue 001.
 *
 * Every function here already existed in the domain with no screen in front of
 * it: `inviteToSpace` wrote a row and nothing happened next, because nothing
 * called it. These are the callers.
 */

import { revalidatePath } from "next/cache";
import {
  createSpace, inviteToSpace, revokeInvite, removeMember, setMemberRole,
  acceptInvite,
} from "@jotacular/domain";
import { requireActor } from "@/lib/session";

export async function createSpaceAction(name: string, kind: "family" | "team") {
  const id = await createSpace(await requireActor(), name, kind);
  revalidatePath("/account");
  return id;
}

/**
 * Returns the LINK, because there is no mail in this repo and an invite that
 * only exists in a database is not an invite. The owner sends it themselves,
 * which suits a family: they are in the same house. ADR pending, issue 001.
 */
export async function inviteAction(spaceId: string, email: string, role: "owner" | "member") {
  const { inviteId, token, expiresAt } = await inviteToSpace(
    await requireActor(), spaceId, email, role,
  );
  revalidatePath("/account");
  // The id travels with the link so the screen can stop showing it once the
  // invite it belongs to is taken back or used. Issue 049.
  return { inviteId, token, expiresAt };
}

export async function revokeInviteAction(inviteId: string) {
  await revokeInvite(await requireActor(), inviteId);
  revalidatePath("/account");
}

export async function removeMemberAction(spaceId: string, userId: string) {
  await removeMember(await requireActor(), spaceId, userId);
  revalidatePath("/account");
}

export async function setMemberRoleAction(
  spaceId: string, userId: string, role: "owner" | "member",
) {
  await setMemberRole(await requireActor(), spaceId, userId, role);
  revalidatePath("/account");
}

export async function acceptInviteAction(token: string) {
  const spaceId = await acceptInvite(await requireActor(), token);
  revalidatePath("/account");
  revalidatePath("/dashboard");
  return spaceId;
}
