import tokens from "@cigua/core/tokens.json";

const decl = (group: Record<string, string>) =>
  Object.entries(group).map(([k, v]) => `--${k}: ${v};`).join(" ");

/** The Papel tokens as CSS custom properties. The note fields ("fixed") never invert. */
export function tokensCss(): string {
  return (
    `:root { color-scheme: light dark; ${decl(tokens.fixed)} ${decl(tokens.light)} }\n` +
    `@media (prefers-color-scheme: dark) { :root { ${decl(tokens.dark)} } }`
  );
}
