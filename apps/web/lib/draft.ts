import { cookies } from "next/headers";
import {
  startAnonSession, resumeAnonSession, type AnonSession,
} from "@jotacular/domain";

/**
 * The anonymous draft a visitor is holding, as a cookie. ADR-009, ADR-041.
 *
 * Host-only and httpOnly: the draft belongs to the apex, and the handoff to the
 * app carries the token in a URL rather than sharing a cookie across
 * subdomains -- which is what docs/16-web-presence.md describes.
 */

const COOKIE = "jd_draft";

/** Matches the 30-day unclaimed sweep. A cookie that outlived the draft would
 *  resolve to nothing and read as "start again", which is correct but slower. */
const MAX_AGE = 30 * 24 * 60 * 60;

const options = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
} as const;

/**
 * Read-only, so this is safe from a server component.
 *
 * Returns null when the token is unknown, swept or already claimed. That is not
 * an error -- it is a visitor whose draft has been through the front door
 * already, and the next keystroke starts a new one.
 */
export async function currentDraft(): Promise<AnonSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return resumeAnonSession(token);
}

/**
 * The draft, minting one on first use. Server actions and route handlers only,
 * because it writes a cookie.
 */
export async function ensureDraft(): Promise<AnonSession> {
  const existing = await currentDraft();
  if (existing) return existing;

  const session = await startAnonSession();
  (await cookies()).set(COOKIE, session.token, options);
  return session;
}

/** Forget a draft that has been claimed. The space is not going anywhere; it
 *  belongs to an account now and is reached by signing in. */
export async function forgetDraft(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
