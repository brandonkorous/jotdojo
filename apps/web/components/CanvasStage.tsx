"use client";

import type { ReactNode } from "react";
import type { CommentView } from "@jotacular/domain";
import { LiveFeedProvider } from "@/lib/live-feed";
import { RemarksProvider } from "@/lib/remarks";
import { LiveFeed } from "./LiveFeed";
import { RemarksFeed } from "./RemarksFeed";

/**
 * Everything the canvas says out loud, in one place. ADR-061.
 *
 * The page used to compose the canvas and the agent's cards as siblings, which
 * meant two surfaces reporting on the same note with no idea the other existed.
 * They share a line now, so they have to share a provider.
 *
 * The drawer, the pins and the popup are NOT here: all three have to ask the
 * engine where something is, so they hang off the canvas. `RemarkSurfaces`.
 */
export function CanvasStage(
  { noteId, comments, children }:
  { noteId: string; comments: CommentView[]; children: ReactNode },
) {
  return (
    <LiveFeedProvider>
      <RemarksProvider noteId={noteId} comments={comments}>
        {children}
        <RemarksFeed />
        <LiveFeed />
      </RemarksProvider>
    </LiveFeedProvider>
  );
}
