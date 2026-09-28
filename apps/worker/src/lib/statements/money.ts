/** Statement money is held as integer cents: statements carry their own
 *  checksum and float drift would produce false validation failures.
 *
 *  Nothing parses money out of text any more — the LLM schema types every
 *  amount as a number, so the only conversion left is cents -> the decimal
 *  string the DB columns store. */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
