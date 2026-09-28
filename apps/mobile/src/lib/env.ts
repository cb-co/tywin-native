/**
 * Build-time configuration (EXPO_PUBLIC_*, see apps/mobile/.env.example).
 * All three are public by design: the publishable key only ever acts as the
 * signed-in person, under row-level security.
 */
export const ENV = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, ""),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
};
