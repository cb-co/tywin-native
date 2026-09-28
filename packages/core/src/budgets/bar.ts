/**
 * How much of the bar to fill, clamped to the track.
 *
 * An unbudgeted row has no fraction to draw, so it fills completely once there
 * is any spend at all and stays empty otherwise — spending against no budget
 * is not 0% of anything, and drawing it as an empty bar would read as "nothing
 * spent here".
 */
export function barPct(used: number, budget: number) {
  if (budget > 0) return Math.min(Math.max((used / budget) * 100, 0), 100);
  return used > 0 ? 100 : 0;
}

/**
 * The (used, total) pair to hand `RuleMeter` for a row. A real budget passes
 * through; its over state comes from the numbers. With no budget the meter
 * fills completely once anything is spent and stays empty otherwise, the same
 * rule `barPct` states: spending against no budget is not 0% of anything.
 * `used === total` fills the meter without `meterFill` calling it over, so an
 * unbudgeted row that the caller knows is over (`over`) gets `Infinity`, which
 * `meterFill` treats as full and over: red fill and the end cap.
 */
export function meterArgs(
  used: number,
  budget: number,
  over = false,
): { used: number; total: number } {
  if (budget > 0) return { used, total: budget };
  if (over && used > 0) return { used: Infinity, total: 1 };
  return { used: used > 0 ? 1 : 0, total: 1 };
}
