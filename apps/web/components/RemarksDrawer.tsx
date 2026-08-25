"use client";

import type { RefObject } from "react";
import {
  Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle,
} from "@wizeworks/silicaui-react";
import { Icon } from "@/components/Icon";
import type { InkEngine } from "@/lib/ink-engine";
import { bringIntoView } from "@/lib/remark-anchor";
import type { Thread } from "@/lib/remark-threads";
import { useRemarks } from "@/lib/remarks";
import { RemarkThread, threadTitle } from "./RemarkThread";

/**
 * Everything anybody has said about this page, in one list. ADR-061, ADR-107.
 *
 * The drawer is the INDEX, not the conversation. A thread about one note is
 * read beside that note (`RemarkPopup`), because a page can hold five
 * unrelated ones and a panel at the edge of the screen cannot say which is
 * which. What the drawer answers is the other question -- what is outstanding
 * anywhere, including on the things currently off screen.
 *
 * The page's own thread is the exception and is here in full: it is about all
 * of this, so there is nothing on the canvas to sit beside.
 */
export function RemarksDrawer(
  { engine }: { engine: RefObject<InkEngine | null> },
) {
  const remarks = useRemarks();
  if (!remarks) return null;

  const { open, threads, drawer, setDrawer, openThread } = remarks;
  const page = threads.find((t) => t.anchorId === null);
  const things = threads.filter((t) => t.anchorId !== null);

  /** Go to it, then talk about it. The camera moves first so the popup opens
   *  on something the reader can actually see. */
  const goTo = (thread: Thread) => {
    const held = engine.current;
    if (held && thread.anchorId) bringIntoView(held, thread.anchorId);
    openThread(thread.anchorId);
  };

  return (
    <Drawer open={drawer} onOpenChange={setDrawer}>
      <DrawerContent side="right" className="jd-remarks-drawer">
        <DrawerHeader sticky>
          <div className="jd-remarks-head">
            <DrawerTitle className="jd-remarks-title">Comments</DrawerTitle>
            <p className="jd-remarks-count">{waiting(open.length)}</p>
          </div>
          <DrawerClose>
            <button type="button" className="jd-tool" aria-label="Close">
              <Icon name="close" />
            </button>
          </DrawerClose>
        </DrawerHeader>

        <section className="jd-remarks-section">
          <h3 className="jd-remarks-heading">This page</h3>
          {page && <RemarkThread thread={page} />}
        </section>

        {things.length > 0 && (
          <section className="jd-remarks-section">
            <h3 className="jd-remarks-heading">
              {things.length === 1 ? "One thing on the page" : "Things on the page"}
            </h3>
            <ul className="jd-remarks-things">
              {things.map((thread) => (
                <li key={thread.anchorId}>
                  <ThreadRow thread={thread} onOpen={() => goTo(thread)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </DrawerContent>
    </Drawer>
  );
}

/** One anchored thread, as a way back to the thing it is about. */
function ThreadRow({ thread, onOpen }: { thread: Thread; onOpen: () => void }) {
  const newest = thread.comments[thread.comments.length - 1];
  return (
    <button type="button" className="jd-remarks-thing" onClick={onOpen}>
      <span className="jd-remarks-thing-count" data-open={thread.open > 0}>
        {thread.comments.length}
      </span>
      <span className="jd-remarks-thing-what">
        <span className="jd-remarks-thing-title">{threadTitle(thread)}</span>
        {newest && (
          <span className="jd-remarks-thing-said">
            {newest.authorLabel}: {newest.body}
          </span>
        )}
      </span>
    </button>
  );
}

const waiting = (n: number) => (n === 0
  ? "Nothing outstanding"
  : n === 1 ? "1 waiting" : `${n} waiting`);
