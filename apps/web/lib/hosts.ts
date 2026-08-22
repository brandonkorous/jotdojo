/**
 * Which surface a request is for: the marketing site or the app. ADR-040.
 *
 * One deployment serves both, chosen by Host. `SITE_URL` is the apex and
 * `APP_URL` is where the app lives -- and `APP_URL` is already load-bearing as
 * the OAuth issuer and the origin in Shortcut note links, so it is not a new
 * seam, only a second reader of an existing one.
 */

const hostOf = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
};

/** The apex. Falls back to the product's real domain so a missing environment
 *  variable degrades to "correct in production" rather than to "app at the
 *  apex", which ADR-010 says can never happen. */
export const siteOrigin = (): string => process.env.SITE_URL ?? "https://jotdojo.com";

export const appOrigin = (): string => process.env.APP_URL ?? "https://app.jotdojo.com";

/**
 * `www.` is the apex wearing a hat.
 *
 * It is matched here rather than redirected in Caddy because the canonical tag
 * on every marketing page already points at the bare apex, so a crawler that
 * arrives on `www.` is told where the real one is by the page itself.
 */
export function isMarketingHost(host: string | null | undefined): boolean {
  const site = hostOf(siteOrigin());
  if (!host || !site) return false;
  const seen = host.toLowerCase();
  return seen === site || seen === `www.${site}`;
}

/**
 * The host a request arrived at, as the outside world addressed it.
 *
 * `x-forwarded-host` first because the shared Caddy sets it. Spoofing it only
 * chooses which page tree renders and never grants access -- the app tree still
 * requires a session and RLS still decides what that session reaches.
 */
export function requestHost(headers: Headers): string | null {
  return headers.get("x-forwarded-host") ?? headers.get("host");
}
