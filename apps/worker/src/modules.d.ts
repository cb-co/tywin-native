/** Markdown bundled as a string (wrangler `Text` rule; a small plugin in vitest). */
declare module "*.md" {
  const text: string;
  export default text;
}
