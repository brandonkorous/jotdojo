/** Auth.js logs a scanner's GET /api/auth/<junk> as an error; it is a 400, not a fault. */
export function logAuthError(error: Error & { type?: string }): void {
  if ((error.type ?? error.name) === "UnknownAction") return;
  console.error(`[auth][error] ${error.type ?? error.name}: ${error.message}`, error.cause ?? "");
}
