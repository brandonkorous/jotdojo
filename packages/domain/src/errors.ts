export class DomainError extends Error {
  constructor(message: string, readonly code: string, readonly status: number) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFound extends DomainError {
  constructor(what = "Not found") {
    super(what, "not_found", 404);
  }
}

/**
 * The session is signed and readable, and the user it names is not there.
 *
 * A JWT session carries no database round trip, so it outlives the rows it was
 * minted against. Distinct from Forbidden: nothing was refused, the caller
 * simply is not anybody.
 */
export class StaleSession extends DomainError {
  constructor(userId: string) {
    super(`No user ${userId}`, "stale_session", 401);
  }
}

export class Forbidden extends DomainError {
  constructor(what = "You do not have access to that") {
    super(what, "forbidden", 403);
  }
}

/**
 * Optimistic concurrency failure. The caller holds a stale revision.
 *
 * Per docs/03-architecture.md we never silently merge and never discard: the
 * caller is handed the current revision so the losing copy can be preserved
 * as a duplicate and flagged.
 */
export class RevisionConflict extends DomainError {
  constructor(readonly currentRevision: number) {
    super("This note changed somewhere else", "revision_conflict", 409);
  }
}

export class QuotaDeferred extends DomainError {
  constructor(what = "Recognition is paused until your limits reset") {
    super(what, "quota_deferred", 202);
  }
}

/** The text Postgres RAISEd. Drizzle wraps driver errors, so the message a
 *  caller matches on -- or shows a person -- is the deepest one, not the top. */
export function raisedMessage(err: unknown): string {
  let text = "";
  for (let e: unknown = err, depth = 0; e && depth < 8; depth++) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") text = m;
    e = (e as { cause?: unknown }).cause;
  }
  return text;
}
