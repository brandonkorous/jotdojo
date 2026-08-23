"use client";

import { useState, useTransition } from "react";
import { revokeConnectionAction } from "@/app/actions";
import type { Connection } from "@jotdojo/domain";

/**
 * Every agent that can reach your notes, and the button that stops it.
 *
 * docs/13-security-and-privacy.md promises this outright. It is not a settings
 * nicety: the whole product asks people to let a model read the things they
 * write down without thinking, and that trade is only fair if the list of who
 * can read them is one click away and the revoke actually works.
 *
 * So the copy names capabilities in plain language rather than showing OAuth
 * scope strings. "Add to the end of notes" is a fact about your notes.
 * "notes:append" is a fact about our database.
 *
 * There is no line for editing because nothing granted here can edit. ADR-070.
 */
const SCOPE_COPY: Record<string, string> = {
  "notes:read": "Read your notes",
  "notes:comment": "Leave comments",
  "notes:append": "Add to the end of notes",
};

const relative = (date: Date | null) => {
  if (!date) return "never used";
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

export function Connections({ connections }: { connections: Connection[] }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <section>
      <h2 className="font-head text-xl">Connected agents</h2>
      <p className="mb-4 mt-1 text-sm opacity-60">
        Every assistant you have let in, and what each one can reach. Revoking
        takes effect immediately — the agent&rsquo;s next request fails, it does not
        wait for a token to expire.
      </p>

      {connections.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm opacity-60">
          Nothing is connected. When you connect Claude, ChatGPT or another agent, it
          will appear here with exactly what it can reach.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {connections.map((c) => (
          <li key={c.clientId} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{c.clientName ?? c.clientId}</span>
              <span className="text-xs opacity-50">
                connected {c.createdAt.toLocaleDateString()} · last used {relative(c.lastUsedAt)}
              </span>
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.scopes.map((s) => (
                // Nothing granted here is worth a warning colour any more:
                // none of it can lose anything a person wrote. ADR-070.
                <li key={s} className="badge badge-sm badge-soft">
                  {SCOPE_COPY[s] ?? s}
                </li>
              ))}
            </ul>

            <p className="mt-3 text-sm opacity-70">
              In {c.spaceNames.length > 0 ? c.spaceNames.join(", ") : "no spaces"}
            </p>

            <div className="mt-3">
              {confirming === c.clientId ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm">Disconnect {c.clientName ?? "this agent"}?</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-error"
                    disabled={pending}
                    onClick={() => startTransition(async () => {
                      await revokeConnectionAction(c.clientId);
                      setConfirming(null);
                    })}
                  >
                    Disconnect
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setConfirming(null)}
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setConfirming(c.clientId)}
                >
                  Disconnect
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
