import {
  listSpaces, listMembers, listInvites, spaceSeats, type Actor,
} from "@jotacular/domain";
import type { SpacePeopleProps } from "@/components/SpacePeople";

/**
 * Everything the People section needs, per space. Issue 001.
 *
 * Invites are only fetched for a space you own, because a member has no
 * business seeing who else was asked and has not answered.
 */
export async function peopleBySpace(actor: Actor): Promise<SpacePeopleProps[]> {
  const spaces = await listSpaces(actor);
  return Promise.all(spaces.map(async (s) => {
    const owner = s.role === "owner";
    const [seats, members, invites] = await Promise.all([
      spaceSeats(actor, s.id),
      listMembers(actor, s.id),
      owner ? listInvites(actor, s.id) : Promise.resolve([]),
    ]);
    return { spaceId: s.id, name: s.name, ownedBy: s.ownedBy, owner, seats, members, invites };
  }));
}
