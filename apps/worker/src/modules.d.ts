/** Markdown bundled as a string (wrangler `Text` rule; a small plugin in vitest). */
declare module "*.md" {
  const text: string;
  export default text;
}

/** Font files bundled as bytes (wrangler `Data` rule; a small plugin in vitest). */
declare module "*.pfb" {
  const data: ArrayBuffer;
  export default data;
}
declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}
