"use client";

import { useTransition } from "react";
import { setTriageAction } from "@/app/actions";
import type { TriageSetting } from "@jotdojo/domain";

/**
 * The switch for the one thing in jotdojo that speaks first. ADR-048.
 *
 * docs/07 asks for one property above all the others: it must be genuinely
 * easy to turn off, and off must mean off. So the button is here, next to the
 * list of agents that can read your notes, and it is off until you press it.
 */
export function TriageSwitch({ settings }: { settings: TriageSetting[] }) {
  const [pending, startTransition] = useTransition();
  if (settings.length === 0) return null;

  return (
    <section>
      <h2 className="font-head text-xl">An agent that reads new notes</h2>
      <p className="mb-4 mt-1 text-sm opacity-60">
        Once you have finished with a note it gets read, and you get a comment
        if there is a date coming up or somebody waiting on you. Most notes it
        says nothing about. It never changes a word you wrote, and switching it
        off stops it immediately, including anything it was about to look at.
      </p>

      <ul className="flex flex-col gap-2">
        {settings.map((space) => (
          <li
            key={space.spaceId}
            className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2"
          >
            <span className="truncate">{space.name}</span>
            <span className="ml-auto text-xs opacity-60">{reason(space)}</span>
            <button
              type="button"
              disabled={pending || !space.available || space.role !== "owner"}
              className={`btn btn-sm ${space.enabled ? "btn-primary" : "btn-ghost"}`}
              onClick={() => startTransition(async () => {
                await setTriageAction(space.spaceId, !space.enabled);
              })}
            >
              {space.enabled ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Why the button is greyed out, said plainly.
 *
 * A disabled control with no explanation is the most annoying thing a settings
 * page can contain, and "why can't I press this" is a support email.
 */
function reason(space: TriageSetting): string {
  if (!space.available) return "part of the Team plan";
  if (space.role !== "owner") return "only an owner can change this";
  if (space.enabled && space.lastRunAt) return `last looked ${relative(space.lastRunAt)}`;
  if (space.enabled) return "not looked yet";
  return "";
}

const relative = (date: Date) => {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};
