import { env } from "#/env";

/**
 * Revokes a person's Sign in with Apple grant when they delete their account,
 * as App Store guideline 5.1.1(v) requires of apps that offer it.
 *
 * Supabase keeps no Apple token to revoke, so the app asks Apple for a fresh
 * authorization code at the moment of deletion. Here that code is exchanged for
 * a refresh token, which is then revoked: two calls to Apple, each signed with
 * a short-lived client secret (an ES256 JWT made from the team's .p8 key).
 *
 * Best effort by design. A person who asked to be deleted is deleted even if
 * Apple is unreachable; the outcome is logged without anything that identifies
 * them.
 */

const APPLE = "https://appleid.apple.com";

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  let bin = "";
  for (const b of raw) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  // Secrets pasted into a dashboard often arrive with literal "\n"s.
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export type AppleConfig = { teamId: string; keyId: string; privateKey: string; clientId: string };

export function appleConfig(): AppleConfig | null {
  const teamId = env("APPLE_TEAM_ID");
  const keyId = env("APPLE_KEY_ID");
  const privateKey = env("APPLE_PRIVATE_KEY");
  const clientId = env("APPLE_CLIENT_ID");
  if (!teamId || !keyId || !privateKey || !clientId) return null;
  return { teamId, keyId, privateKey, clientId };
}

/** The client secret Apple's token endpoints take: an ES256 JWT valid for five minutes. */
export async function appleClientSecret(config: AppleConfig, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(config.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({ iss: config.teamId, iat, exp: iat + 300, aud: APPLE, sub: config.clientId }),
  );
  // WebCrypto's ECDSA output is r||s, which is exactly the JWS encoding.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  return `${header}.${payload}.${base64url(new Uint8Array(sig))}`;
}

/** Exchanges the code and revokes the grant. True if Apple confirmed the revocation. */
export async function revokeAppleAuthorization(code: string): Promise<boolean> {
  const config = appleConfig();
  if (!config) {
    console.error("[apple] revocation skipped: Apple keys are not configured");
    return false;
  }
  try {
    const clientSecret = await appleClientSecret(config);
    const tokenRes = await fetch(`${APPLE}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      console.error("[apple] code exchange failed:", tokenRes.status);
      return false;
    }
    const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) return false;

    const revokeRes = await fetch(`${APPLE}/auth/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token ? "refresh_token" : "access_token",
      }),
    });
    if (!revokeRes.ok) console.error("[apple] revoke failed:", revokeRes.status);
    return revokeRes.ok;
  } catch (e) {
    console.error("[apple] revocation error:", e instanceof Error ? e.name : "unknown");
    return false;
  }
}
