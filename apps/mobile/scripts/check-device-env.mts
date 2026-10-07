/**
 * Checks the EXPO_PUBLIC_* values before `npm run ios:device`, which bakes them
 * into a Release build for a phone: a missing or example value would only show
 * up as a broken app on the device.
 *
 *   node apps/mobile/scripts/check-device-env.mts
 *
 * Reads the shell, then .env.local, then .env (the same precedence as Expo).
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// loadEnvFile never overrides a value that is already set, so the first file wins.
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const errors: string[] = [];
const warnings: string[] = [];

function read(name: string, placeholder: RegExp): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is not set.`);
  else if (placeholder.test(value)) errors.push(`${name} is still the example value from .env.example.`);
  else return value;
}

const apiUrl = read("EXPO_PUBLIC_API_URL", /^$/);
read("EXPO_PUBLIC_SUPABASE_URL", /your-project\.supabase\.co/);
read("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", /^sb_publishable_\.\.\.$/);

if (apiUrl) {
  let url: URL | undefined;
  try {
    url = new URL(apiUrl);
  } catch {
    errors.push(`EXPO_PUBLIC_API_URL is not a URL: ${apiUrl}`);
  }
  if (url && ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(url.hostname)) {
    errors.push("EXPO_PUBLIC_API_URL points at localhost, which the phone can't reach. Use the deployed Worker.");
  } else if (url?.protocol === "http:") {
    warnings.push("EXPO_PUBLIC_API_URL is plain http: it only works while this Mac serves the Worker on the same Wi-Fi.");
  }
}

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error("\nCopy apps/mobile/.env.example to apps/mobile/.env.local and fill it in.");
  process.exit(1);
}
console.log("Device build env looks good.");
