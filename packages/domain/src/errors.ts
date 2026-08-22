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
