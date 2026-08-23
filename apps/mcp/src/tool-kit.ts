export type Register = (
  name: string,
  config: unknown,
  handler: (args: never) => Promise<unknown>,
) => void;

export type Registrar = { registerTool: Register };

/** Every tool answers in text. `view_note` is the one exception; see view.ts. */
export const asText = (value: unknown) => ({
  content: [{
    type: "text" as const,
    text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  }],
});

/**
 * Annotations are how a client decides what may run unasked. ADR-069.
 *
 * A read-only tool needs no per-call confirmation; a destructive one always
 * prompts. Both directories check these mechanically and reject what is
 * missing, so they are declared here once rather than spelled out eleven times.
 */
export const reads = (title: string) => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

/**
 * `destroys` is true only for a write that can lose something a person wrote.
 * Adding a comment, a note or a paragraph cannot, and saying otherwise would
 * spend a confirmation prompt the user has no reason to answer.
 */
export const writes = (title: string, destroys: boolean) => ({
  title,
  readOnlyHint: false,
  destructiveHint: destroys,
  idempotentHint: false,
  openWorldHint: false,
});
