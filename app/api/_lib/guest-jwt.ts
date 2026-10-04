import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { PLAYROOM_SUPABASE_PROJECT_REF } from "../../lib/playroom-supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWKS_URL = `https://${PLAYROOM_SUPABASE_PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json`;

export class GuestTokenError extends Error {
  constructor(message = "The guest session is invalid or expired.") {
    super(message);
  }
}

type Jwk = JsonWebKey & { kid?: string };

let cachedKeys: Map<string, KeyObject> | null = null;

function decodePart(part: string): unknown {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    throw new GuestTokenError();
  }
}

function keyMap(keys: Jwk[]) {
  const map = new Map<string, KeyObject>();
  for (const jwk of keys) {
    if (jwk.kty !== "EC" || jwk.kid == null) continue;
    map.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" }));
  }
  return map;
}

async function signingKeys(jwks?: { keys: Jwk[] }) {
  if (jwks) return keyMap(jwks.keys);
  if (cachedKeys) return cachedKeys;
  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error("Supabase server environment is not configured.");
  const body = await response.json() as { keys?: Jwk[] };
  cachedKeys = keyMap(body.keys ?? []);
  return cachedKeys;
}

/** Verify a Supabase guest access token locally against the project JWKS. */
export async function verifyGuestAccessToken(token: string, options?: { jwks?: { keys: Jwk[] } }): Promise<{ id: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new GuestTokenError();
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = decodePart(headerPart) as { alg?: unknown; kid?: unknown };
  if (header.alg !== "ES256" || typeof header.kid !== "string") throw new GuestTokenError();
  const key = (await signingKeys(options?.jwks)).get(header.kid);
  if (!key) throw new GuestTokenError();
  const valid = verify(
    "sha256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    { key, dsaEncoding: "ieee-p1363" },
    Buffer.from(signaturePart, "base64url"),
  );
  if (!valid) throw new GuestTokenError();
  const claims = decodePart(payloadPart) as {
    exp?: unknown;
    aud?: unknown;
    role?: unknown;
    sub?: unknown;
    iss?: unknown;
  };
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) throw new GuestTokenError();
  if (claims.aud !== "authenticated" || claims.role !== "authenticated") throw new GuestTokenError();
  if (typeof claims.sub !== "string" || !UUID.test(claims.sub)) throw new GuestTokenError();
  if (claims.iss !== `https://${PLAYROOM_SUPABASE_PROJECT_REF}.supabase.co/auth/v1`) throw new GuestTokenError();
  return { id: claims.sub };
}
