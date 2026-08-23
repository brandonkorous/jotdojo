"use client";

import type { ReactNode } from "react";
import type { CommentView } from "@jotdojo/domain";
import { LiveFeedProvider } from "@/lib/live-feed";
import { RemarksProvider } from "@/lib/remarks";
import { LiveFeed } from "./LiveFeed";
import { RemarksFeed } from "./RemarksFeed";
import { RemarksDrawer } from "./RemarksDrawer";

/**
 * Everything the canvas says out loud, in one place. ADR-061.
 *
 * The page used to compose the canvas and the agent's cards as siblings, which
 * meant two surfaces reporting on the same note with no idea the other existed.
 * They share a line now, so they have to share a provider.
 */
export function CanvasStage(
  { comments, children }: { comments: CommentView[]; children: ReactNode },
) {
  return (
    <LiveFeedProvider>
      <RemarksProvider comments={comments}>
        {children}
        <RemarksFeed />
        <LiveFeed />
        <RemarksDrawer />
      </RemarksProvider>
    </LiveFeedProvider>
  );
}
