import { fitFigureClass } from "@cigua/core/papel/fit";
import { scale, type Size } from "~/theme/fonts";

/**
 * The note's denomination size for a printed figure, by its length, so eight
 * digits plus `RD$` scale down on a 360pt phone instead of wrapping. The same
 * steps as the shared width model; a phone always takes the base step.
 */
export function fitFigureSize(text: string): number {
  const step = fitFigureClass(text).split(" ")[0].replace("text-", "") as Size;
  return scale[step]?.[0] ?? 20;
}
