import { describe, expect, it } from "vitest";
import { appleClientSecret } from "./apple";

function fromBase64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function freshKey() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array((await crypto.subtle.exportKey("pkcs8", pair.privateKey)) as ArrayBuffer);
  const b64 = btoa(String.fromCharCode(...pkcs8));
  const pem = `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----`;
  return { pem, publicKey: pair.publicKey };
}

describe("appleClientSecret", () => {
  it("is an ES256 JWT Apple can verify, valid for five minutes", async () => {
    const { pem, publicKey } = await freshKey();
    const now = Date.UTC(2026, 9, 6);
    const jwt = await appleClientSecret(
      { teamId: "TEAM123456", keyId: "KEY1234567", privateKey: pem, clientId: "app.tywin.cigua" },
      now,
    );

    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromBase64url(h)))).toEqual({ alg: "ES256", kid: "KEY1234567" });
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(p)));
    expect(payload).toEqual({
      iss: "TEAM123456",
      iat: now / 1000,
      exp: now / 1000 + 300,
      aud: "https://appleid.apple.com",
      sub: "app.tywin.cigua",
    });

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      fromBase64url(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok).toBe(true);
  });

  it("accepts a key pasted with literal \\n escapes", async () => {
    const { pem } = await freshKey();
    const jwt = await appleClientSecret({
      teamId: "T",
      keyId: "K",
      privateKey: pem.replace(/\n/g, "\\n"),
      clientId: "c",
    });
    expect(jwt.split(".")).toHaveLength(3);
  });
});
