/**
 * The words the OAuth files share: what a scope is, what a refusal is, and how
 * long a grant lives. Everything else lives in `oauth-*.ts` beside it. ADR-117.
 */

import { createHash } from "node:crypto";
import { DomainError } from "./errors";

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export const SCOPES = ["notes:read", "notes:comment", "notes:append"] as const;
export type Scope = (typeof SCOPES)[number];

/** Off by default. An agent gets edit rights only by a deliberate act. ADR-004. */
export const DEFAULT_SCOPES: Scope[] = ["notes:read", "notes:comment"];

export const CODE_TTL_MS = 60_000;          // 1 minute. A code is exchanged immediately.
export const ACCESS_TTL_MS = 60 * 60_000;   // 1 hour.
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;

export class OAuthError extends DomainError {
  constructor(readonly oauthCode: string, description: string, status = 400) {
    super(description, oauthCode, status);
  }
}
