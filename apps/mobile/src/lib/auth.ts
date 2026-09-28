import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { auth } from "./supabase";

/** Where Supabase sends the browser back to: the app's own scheme. */
export const AUTH_REDIRECT = Linking.createURL("auth/callback");

/**
 * One exchange per code. On Android the redirect can reach the app twice, through
 * the auth session and as a deep link; a code can only be spent once, so the
 * second caller shares the first one's result instead of failing.
 */
const exchanges = new Map<string, Promise<{ error?: string }>>();

/** Finishes a PKCE sign-in from the URL the provider redirected to. */
export function completeFromUrl(url: string): Promise<{ error?: string }> {
  const { queryParams } = Linking.parse(url);
  const code = typeof queryParams?.code === "string" ? queryParams.code : null;
  const failure = queryParams?.error_description ?? queryParams?.error;
  if (!code) return Promise.resolve({ error: typeof failure === "string" ? failure : "auth" });
  let pending = exchanges.get(code);
  if (!pending) {
    pending = auth.exchangeCodeForSession(code).then(({ error }) => (error ? { error: error.message } : {}));
    exchanges.set(code, pending);
  }
  return pending;
}

/**
 * Google, in the system's auth browser session (shared cookies, a password
 * manager, no embedded web view), returning to the app with a PKCE code.
 */
export async function signInWithGoogle(): Promise<{ error?: string; cancelled?: boolean }> {
  const { data, error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) return { error: error?.message ?? "auth" };
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== "success") return { cancelled: true };
  return completeFromUrl(result.url);
}

/**
 * Sign in with Apple, natively. The hashed nonce goes to Apple and the raw one
 * to Supabase, which checks they match, so a stolen identity token cannot be replayed.
 */
export async function signInWithApple(): Promise<{ error?: string; cancelled?: boolean }> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { error: "auth" };
    const { error } = await auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
    return error ? { error: error.message } : {};
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return { cancelled: true };
    return { error: (e as Error).message };
  }
}
