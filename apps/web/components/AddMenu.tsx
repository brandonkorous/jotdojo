"use client";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@wizeworks/silicaui-react";
import { Icon } from "@/components/Icon";

/**
 * Everything that puts something NEW on the page. ADR-101.
 *
 * Voice, photo and "a note here" were three separate affordances in three
 * places -- two of them in the tool rail beside the pen, one buried in the text
 * tool's options. None of them is a mode: each produces content and then
 * finishes, so pressing one and walking away leaves the canvas doing what it
 * was doing.
 *
 * The same three the canvas menu offers on bare paper, deliberately. Two doors
 * to one room beats one door somebody has to already know about, and a menu
 * that lists what CAN be added is how a stranger finds out that voice exists.
 */
export function AddMenu({
  onPhoto, onVoice, onNote, unavailable = false, unavailableHint,
}: {
  onPhoto: () => void;
  onVoice: () => void;
  /** Arm placing a text box on the canvas. ADR-065. */
  onNote: () => void;
  /** Shown, but refused -- the marketing hero advertises the whole product and
   *  says plainly which parts need an account. */
  unavailable?: boolean;
  unavailableHint?: string;
}) {
  const label = unavailable && unavailableHint ? `Add — ${unavailableHint}` : "Add";

  if (unavailable) {
    return (
      <button type="button" disabled title={label} aria-label={label} className="jd-tool">
        <Icon name="addBox" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <button type="button" title="Add a photo, a voice note or a note" aria-label={label} className="jd-tool">
          <Icon name="addBox" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="center" sideOffset={10}>
        <DropdownMenuItem onClick={onPhoto}>
          <Icon name="photo" />
          Photo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onVoice}>
          <Icon name="voice" />
          Voice note
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNote}>
          <Icon name="text" />
          A note on the canvas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
