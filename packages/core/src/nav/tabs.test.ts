/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { TAB_LABEL_SIZE, TAB_MIN_GAP, TAB_MIN_SCREEN, TABS } from "./tabs";

/* The band's names are measured with the app's own font rather than guessed,
   so a new name or translation that would crowd the band fails here. */
const FONT = new URL("../../../../apps/mobile/assets/fonts/Archivo-SemiBold.ttf", import.meta.url);

/** Advance widths from a TrueType file: just enough of `head`, `hhea`, `hmtx`
 *  and a format-4 `cmap` to measure a line of Latin text. */
function advanceMeter(file: Uint8Array) {
  const v = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const tables = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) {
    const rec = 12 + i * 16;
    tables.set(String.fromCharCode(...file.subarray(rec, rec + 4)), v.getUint32(rec + 8));
  }
  const at = (tag: string) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`no ${tag} table`);
    return offset;
  };
  const unitsPerEm = v.getUint16(at("head") + 18);
  const metrics = v.getUint16(at("hhea") + 34);
  const hmtx = at("hmtx");
  const advance = (glyph: number) => v.getUint16(hmtx + 4 * Math.min(glyph, metrics - 1));

  const cmap = at("cmap");
  let sub = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const rec = cmap + 4 + i * 8;
    const offset = cmap + v.getUint32(rec + 4);
    if (v.getUint16(rec) === 3 && v.getUint16(rec + 2) === 1 && v.getUint16(offset) === 4) sub = offset;
  }
  if (sub < 0) throw new Error("no Unicode BMP cmap");
  const segs = v.getUint16(sub + 6) / 2;
  const ends = sub + 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
  const glyphOf = (code: number) => {
    for (let s = 0; s < segs; s++) {
      if (code > v.getUint16(ends + s * 2)) continue;
      const start = v.getUint16(starts + s * 2);
      if (code < start) return 0;
      const delta = v.getInt16(deltas + s * 2);
      const range = v.getUint16(ranges + s * 2);
      if (range === 0) return (code + delta) & 0xffff;
      const g = v.getUint16(ranges + s * 2 + range + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  return (text: string, size: number) =>
    ([...text].reduce((w, ch) => w + advance(glyphOf(ch.codePointAt(0)!)), 0) * size) / unitsPerEm;
}

const measure = advanceMeter(new Uint8Array(readFileSync(FONT)));
const cell = TAB_MIN_SCREEN / TABS.length;

describe.each([
  ["en", en.Tabs],
  ["es", es.Tabs],
] as const)("the %s band", (_, names) => {
  test("names every tab", () => {
    for (const tab of TABS) expect(names[tab.key], tab.key).toBeTruthy();
  });

  test(`keeps ${TAB_MIN_GAP}pt between neighbouring names on a ${TAB_MIN_SCREEN}pt phone`, () => {
    const widths = TABS.map((tab) => measure(names[tab.key], TAB_LABEL_SIZE));
    for (let i = 0; i < widths.length - 1; i++) {
      // Each name is centred in its cell, so the space between two is half of each one's spare room.
      const gap = (cell - widths[i]) / 2 + (cell - widths[i + 1]) / 2;
      expect(gap, `${names[TABS[i].key]} | ${names[TABS[i + 1].key]}`).toBeGreaterThanOrEqual(TAB_MIN_GAP);
    }
  });
});
