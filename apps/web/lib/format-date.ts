/**
 * One spelling of a date across the marketing site, so posts and policies agree.
 *
 * `UTC` is not a detail: a bare `2026-08-22` parses as UTC midnight, and
 * rendering that in a western timezone printed the day before on every post and
 * on the date a policy last changed.
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}
