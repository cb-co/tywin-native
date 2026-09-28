/// <reference path="../../modules.d.ts" />
/**
 * pdfjs's standard font programs (Foxit and Liberation, from pdfjs-dist 6.1.200,
 * the version unpdf bundles), shipped inside the Worker.
 *
 * A statement that names one of the fourteen standard fonts without embedding it
 * needs these to read that font's glyphs. workerd exposes `process`, so pdfjs
 * takes its Node path and would read them from disk, which a Worker does not
 * have: it warns on every such statement and falls back to built-in metrics, the
 * fallback the web app found mismapping some characters. Licences sit next to
 * the files.
 */
import FoxitDingbats from "./standard-fonts/FoxitDingbats.pfb";
import FoxitFixed from "./standard-fonts/FoxitFixed.pfb";
import FoxitFixedBold from "./standard-fonts/FoxitFixedBold.pfb";
import FoxitFixedBoldItalic from "./standard-fonts/FoxitFixedBoldItalic.pfb";
import FoxitFixedItalic from "./standard-fonts/FoxitFixedItalic.pfb";
import FoxitSerif from "./standard-fonts/FoxitSerif.pfb";
import FoxitSerifBold from "./standard-fonts/FoxitSerifBold.pfb";
import FoxitSerifBoldItalic from "./standard-fonts/FoxitSerifBoldItalic.pfb";
import FoxitSerifItalic from "./standard-fonts/FoxitSerifItalic.pfb";
import FoxitSymbol from "./standard-fonts/FoxitSymbol.pfb";
import LiberationSansBold from "./standard-fonts/LiberationSans-Bold.ttf";
import LiberationSansBoldItalic from "./standard-fonts/LiberationSans-BoldItalic.ttf";
import LiberationSansItalic from "./standard-fonts/LiberationSans-Italic.ttf";
import LiberationSansRegular from "./standard-fonts/LiberationSans-Regular.ttf";

export const STANDARD_FONTS: Record<string, ArrayBuffer> = {
  "FoxitDingbats.pfb": FoxitDingbats,
  "FoxitFixed.pfb": FoxitFixed,
  "FoxitFixedBold.pfb": FoxitFixedBold,
  "FoxitFixedBoldItalic.pfb": FoxitFixedBoldItalic,
  "FoxitFixedItalic.pfb": FoxitFixedItalic,
  "FoxitSerif.pfb": FoxitSerif,
  "FoxitSerifBold.pfb": FoxitSerifBold,
  "FoxitSerifBoldItalic.pfb": FoxitSerifBoldItalic,
  "FoxitSerifItalic.pfb": FoxitSerifItalic,
  "FoxitSymbol.pfb": FoxitSymbol,
  "LiberationSans-Bold.ttf": LiberationSansBold,
  "LiberationSans-BoldItalic.ttf": LiberationSansBoldItalic,
  "LiberationSans-Italic.ttf": LiberationSansItalic,
  "LiberationSans-Regular.ttf": LiberationSansRegular,
};
