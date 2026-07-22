const DEFAULT_BASE_URL = "http://localhost:3000";

/**
 * Resolves NEXT_PUBLIC_URL to an absolute base URL. Throws instead of
 * silently building a schemeless URL if the env var is set without an
 * http(s):// scheme -- a bare host like "odometry.app" passes some
 * consumers' checks (e.g. an email body) but fails others (Stripe).
 *
 * @param options.required - when true, also throws if the env var is unset
 * instead of falling back to localhost. Use for flows where a localhost
 * link would be actively wrong to send (e.g. transactional emails).
 */
export function getBaseUrl(options?: { required?: boolean }): string {
  const raw = process.env.NEXT_PUBLIC_URL?.trim();
  if (!raw) {
    if (options?.required) {
      throw new Error("NEXT_PUBLIC_URL is not configured.");
    }
    return DEFAULT_BASE_URL;
  }

  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      `NEXT_PUBLIC_URL is set to "${raw}", which is missing an http(s):// scheme.`,
    );
  }

  return raw.replace(/\/+$/, "");
}
