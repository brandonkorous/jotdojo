"use client";

import { useEffect, useState } from "react";
import { applyTheme, rememberTheme, themeChoice, type ThemeChoice as Choice } from "@/lib/theme";

/**
 * Light, dark, or whatever the room is doing. ADR-116.
 *
 * Client-side and not a server action, because the choice lives on the device
 * (`lib/theme.ts` says why) and because a round trip to change a colour is a
 * round trip somebody watches.
 */
const OPTIONS: ReadonlyArray<{ value: Choice; label: string; says: string }> = [
  { value: "auto", label: "Auto", says: "Follow this device" },
  { value: "paper", label: "Paper", says: "Always light" },
  { value: "paper-night", label: "Night", says: "Always dark" },
];

export function ThemeChoice() {
  // Starts at `auto` and is corrected in an effect: the server has no
  // localStorage, and guessing would mean a hydration mismatch.
  const [choice, setChoice] = useState<Choice>("auto");
  useEffect(() => { setChoice(themeChoice()); }, []);

  const pick = (next: Choice) => {
    setChoice(next);
    rememberTheme(next);
    applyTheme(next);
  };

  return (
    <section className="mb-10">
      <h2 className="font-head text-xl">Light or dark</h2>
      <p className="mb-3 mt-1 text-sm jd-quiet">
        Auto follows whatever this device is set to, which changes on its own at
        dusk on most phones. Pick one to hold it there instead.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={choice === option.value}
            title={option.says}
            onClick={() => pick(option.value)}
            className={`btn btn-sm ${choice === option.value ? "btn-primary" : "btn-ghost"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs jd-quiet">
        Kept on this device, not on your account — a desk at noon and a phone in
        bed are not the same room.
      </p>
    </section>
  );
}
