import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json is the real config; this only adjusts it for a build signed by a free
 * Apple "Personal Team" (EXPO_PUBLIC_PERSONAL_TEAM=1, see `npm run ios:device`).
 * Personal teams can't use Sign in with Apple, so the capability and plugin come
 * off, and the bundle ID gets a suffix so the real one is never claimed by that team.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EXPO_PUBLIC_PERSONAL_TEAM !== "1") return config as ExpoConfig;
  return {
    ...config,
    name: "Cigua Test",
    ios: { ...config.ios, bundleIdentifier: `${config.ios?.bundleIdentifier}.personal`, usesAppleSignIn: false },
    plugins: config.plugins?.filter((p) => (Array.isArray(p) ? p[0] : p) !== "expo-apple-authentication"),
  } as ExpoConfig;
};
