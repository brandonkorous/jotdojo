/** What the autosave loop is currently doing. Shared by the canvas and the
 *  line that reports it, so neither can invent a state the other cannot show. */
export type SaveState = "idle" | "saving" | "saved" | "retrying" | "conflict";
