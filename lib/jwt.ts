import { jwtVerify, SignJWT } from "jose";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

type TokenKind = "access" | "refresh";

const EXPIRY_SECONDS: Record<TokenKind, number> = {
  access: 15 * 60,
  refresh: 7 * 24 * 60 * 60,
};

const SECRET_ENV: Record<TokenKind, string> = {
  access: "JWT_SECRET",
  refresh: "JWT_REFRESH_SECRET",
};

// Read lazily so `next build` can import routes without the secrets present,
// but a missing secret at request time fails closed instead of signing with a default.
function getSecret(kind: TokenKind): Uint8Array {
  const value = process.env[SECRET_ENV[kind]];
  if (!value || value.length < 32) {
    throw new Error(`${SECRET_ENV[kind]} must be set to at least 32 characters.`);
  }
  return new TextEncoder().encode(value);
}

function sign(userId: string, kind: TokenKind): Promise<string> {
  return new SignJWT({ typ: kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS[kind]}s`)
    .sign(getSecret(kind));
}

async function verify(token: string, kind: TokenKind): Promise<string | null> {
  const secret = getSecret(kind);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.typ !== kind || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function generateTokens(userId: string): Promise<Tokens> {
  const [accessToken, refreshToken] = await Promise.all([
    sign(userId, "access"),
    sign(userId, "refresh"),
  ]);
  return { accessToken, refreshToken };
}

/** Returns the user id, or null when the token is invalid or expired. */
export function verifyAccessToken(token: string): Promise<string | null> {
  return verify(token, "access");
}

/** Returns the user id, or null when the token is invalid or expired. */
export function verifyRefreshToken(token: string): Promise<string | null> {
  return verify(token, "refresh");
}
