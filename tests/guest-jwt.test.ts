import { generateKeyPairSync, sign } from "node:crypto";
import { expect, test } from "bun:test";
import { GuestTokenError, verifyGuestAccessToken } from "../app/api/_lib/guest-jwt";
import { PLAYROOM_SUPABASE_PROJECT_REF } from "../app/lib/playroom-supabase";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = publicKey.export({ format: "jwk" }) as JsonWebKey & { kid?: string };
jwk.kid = "test-key";
jwk.alg = "ES256";

function token(claims: Record<string, unknown>, kid = "test-key") {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT", kid })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

const guest = {
  iss: `https://${PLAYROOM_SUPABASE_PROJECT_REF}.supabase.co/auth/v1`,
  aud: "authenticated",
  role: "authenticated",
  sub: "11111111-1111-4111-8111-111111111111",
  exp: Math.floor(Date.now() / 1000) + 600,
};

test("a signed playroom guest token verifies locally", async () => {
  expect((await verifyGuestAccessToken(token(guest), { jwks: { keys: [jwk] } })).id).toBe(guest.sub);
});

test("a bad signature, expired token, or other project is rejected", async () => {
  const parts = token(guest).split(".");
  parts[2] = `${parts[2].slice(0, -4)}aaaa`;
  await expect(verifyGuestAccessToken(parts.join("."), { jwks: { keys: [jwk] } })).rejects.toThrow(GuestTokenError);
  await expect(verifyGuestAccessToken(token({ ...guest, exp: Math.floor(Date.now() / 1000) - 10 }), { jwks: { keys: [jwk] } })).rejects.toThrow(GuestTokenError);
  await expect(verifyGuestAccessToken(token({ ...guest, iss: "https://bkybxirilbbnmgkufxim.supabase.co/auth/v1" }), { jwks: { keys: [jwk] } })).rejects.toThrow(GuestTokenError);
  await expect(verifyGuestAccessToken(token(guest, "missing"), { jwks: { keys: [jwk] } })).rejects.toThrow(GuestTokenError);
});
