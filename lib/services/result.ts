export type ServiceErrorCode =
  | "VALIDATION_ERROR"
  | "UNPROCESSABLE"
  | "SUBSCRIPTION_REQUIRED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR";

export interface ServiceFailure {
  error: string;
  code: ServiceErrorCode;
}

export function fail(code: ServiceErrorCode, error: string): ServiceFailure {
  return { error, code };
}

export function isFailure(result: unknown): result is ServiceFailure {
  return typeof result === "object" && result !== null && "error" in result && "code" in result;
}

/** Drops the machine-readable code so server actions keep their `{ error }` shape. */
export function toActionResult<T>(result: T | ServiceFailure): T | { error: string } {
  return isFailure(result) ? { error: result.error } : result;
}
