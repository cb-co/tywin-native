/** The welcome flow's steps, in order. */
export const STEPS = ["about", "account", "cards", "income", "loans", "bills", "done"] as const;
export type Step = (typeof STEPS)[number];

export type ResumeSnapshot = {
  hasName: boolean;
  /** A non-archived account that is neither a card nor a loan. */
  hasMainAccount: boolean;
};

/**
 * Where a returning visitor to /welcome picks up. Every step saves as it is
 * passed, so the data already says how far they got — no stored step, no
 * migration. Only the two required steps can be "unfinished"; past them the
 * flow resumes at the first optional step, which lists whatever already exists
 * so nothing is created twice.
 */
export function resumeStep(s: ResumeSnapshot): number {
  if (!s.hasName) return STEPS.indexOf("about");
  if (!s.hasMainAccount) return STEPS.indexOf("account");
  return STEPS.indexOf("cards");
}
