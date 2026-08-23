"use client";

import type { Presence as Who } from "@jotdojo/domain";

/**
 * Who else is in this note, and whether they are writing right now. ADR-058.
 *
 * This is the honest half of live updates without a CRDT. Two people typing
 * into one paragraph still ends in a conflict, and rather than pretend
 * otherwise, the product shows the collision coming and lets a person do the
 * obvious human thing about it.
 *
 * It says nothing at all when nobody else is here, which is nearly always.
 */
export function Presence({ who }: { who: Who[] }) {
  if (who.length === 0) return null;

  const writing = who.filter((p) => p.writing);
  return (
    <div className="jd-chrome jd-presence" role="status" aria-live="polite">
      <span className="jd-presence-faces" aria-hidden>
        {who.slice(0, 4).map((p) => (
          <span
            key={`${p.userId}:${p.deviceId}`}
            className="jd-presence-face"
            data-writing={p.writing}
            data-self={p.self}
            style={p.avatarUrl ? { backgroundImage: `url(${p.avatarUrl})` } : undefined}
          >
            {p.avatarUrl ? "" : initial(p)}
          </span>
        ))}
      </span>
      <span className="jd-presence-says">{says(who, writing)}</span>
    </div>
  );
}

/**
 * What is happening, in the fewest words that are true.
 *
 * Another window of your own account is information -- it explains why the page
 * moved. Somebody else writing is a warning. They read differently on purpose.
 */
function says(who: Who[], writing: Who[]): string {
  if (writing.length === 1) return `${name(writing[0]!)} is writing`;
  if (writing.length > 1) return `${writing.length} people are writing`;
  if (who.length === 1) return `${name(who[0]!)} is here`;
  return `${who.length} people are here`;
}

const name = (p: Who) => (p.self ? "Your other window" : p.displayName ?? "Somebody");

const initial = (p: Who) =>
  (p.self ? "\u2022" : (p.displayName ?? "?").trim().charAt(0).toUpperCase() || "?");
