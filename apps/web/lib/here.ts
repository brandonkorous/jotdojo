/**
 * Where the browser was actually going.
 *
 * A server component cannot read its own URL, so middleware puts it on the
 * request and the auth guard reads it back. Without it every sign-in redirect
 * forgets the page that asked for one, and a link to a note drops the person on
 * the canvas instead. Issue 025.
 *
 * Middleware SETS this rather than appending, so a header a client sent under
 * the same name is replaced rather than trusted.
 */
export const PATH_HEADER = "x-jd-path";
