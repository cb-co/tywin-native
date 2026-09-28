/**
 * Deterministic, regex-based PII redaction for statement text before it's sent to a
 * third-party LLM. No LLM involved in the scrubbing itself — a pattern-based pass can't
 * be talked out of redacting something the way a model theoretically could, and it's
 * free and instant. Validated against two real statements during design (see
 * docs/superpowers/specs/2026-07-23-llm-statement-extraction-design.md §3): this is a
 * heuristic, not a guarantee. Collateral stripping of non-sensitive boilerplate is
 * expected and fine — none of it is needed for extraction.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// An explicit Tel/Teléfono/Cel/Fax label followed by a digit run, OR a dash/dot/space/
// paren-grouped number shaped like 3+3+4 digits (809-227-3182, (809) 567-7268,
// 1-809-200-3182). The 3-digit middle group is deliberate: DR dates are DD-MM-YYYY
// (2+2+4 digits), so this never collides with a date — an earlier 2-4-digit version did,
// and silently ate "Fecha de Corte: 15-07-2026" during design testing.
const PHONE_RE =
  /\b(?:Tel(?:[eé]fono)?|Cel(?:ular)?|Fax|Phone)\.?:?\s*\+?[\d()][\d()\-.\s]{5,}\d\b|\+?\d{0,3}[-.\s]?\(?\d{3}\)?[-.\s]\d{3}[-.\s]?\d{4}\b/gi;

// A hidden barcode/reference layer some bank PDFs still expose as text, e.g.
// "- 6760 - 000000012473453 - 15-07-2026". Scoped to the whole-line shape so it never
// touches a transaction row's reference-number column (those always share a row with a
// description and an amount).
const ID_LINE_RE = /^\s*-\s*\S{1,8}\s*-\s*\d{8,}\s*-\s*\d{2}[-/]\d{2}[-/]\d{4}\s*-?\s*$/;

const NAME_LABEL_RE = /estado de cuenta de\s*:|titular\s*:|nombre del cliente|a nombre de\s*:|cliente\s*:/i;

// Card-network brand names recur on every page just like a cardholder's name would (a
// running header/footer), but they're not PII — the LLM needs cardNetwork to classify
// the statement correctly. Excluded from every name-candidate check below, not just the
// repetition net, since any of the three heuristics could otherwise catch one.
const BRAND_RE = /\b(visa|mastercard|american express|amex|discover)\b/i;

function isShortNoDigitLine(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  if (/\d/.test(t)) return false;
  if (/https?:|www\./i.test(t)) return false;
  if (BRAND_RE.test(t)) return false;
  return true;
}

export function scrubPii(text: string): string {
  const lines = text.split("\n");
  const out = lines.slice();

  const emailLineIdx: number[] = [];
  lines.forEach((l, i) => {
    if (EMAIL_RE.test(l)) emailLineIdx.push(i);
    EMAIL_RE.lastIndex = 0;
  });
  for (let i = 0; i < out.length; i++) out[i] = out[i].replace(EMAIL_RE, "[EMAIL]");

  for (let i = 0; i < out.length; i++) out[i] = out[i].replace(PHONE_RE, "[PHONE]");

  for (let i = 0; i < lines.length; i++) if (ID_LINE_RE.test(lines[i])) out[i] = "[ID]";

  // Name candidates near an email — cardholder identity blocks cluster within a handful
  // of lines of the email in every layout seen so far, in either direction.
  const WINDOW_BEFORE = 6;
  const WINDOW_AFTER = 2;
  for (const idx of emailLineIdx) {
    for (let d = 1; d <= WINDOW_BEFORE; d++) {
      const i = idx - d;
      // Guard `out[i] === lines[i]` ensures we don't overwrite a line already redacted as
      // [EMAIL] — when two emails land within the window distance, the second email's backward
      // scan would otherwise re-classify the first email's line as a name candidate and clobber
      // the [EMAIL] marker.
      if (i >= 0 && out[i] === lines[i] && isShortNoDigitLine(lines[i])) out[i] = "[NAME]";
    }
    for (let d = 1; d <= WINDOW_AFTER; d++) {
      const i = idx + d;
      if (i < lines.length && out[i] === lines[i] && isShortNoDigitLine(lines[i])) out[i] = "[NAME]";
    }
  }

  // Name-introducing labels: scan a few lines after for the first digit-free line.
  for (let i = 0; i < lines.length; i++) {
    if (NAME_LABEL_RE.test(lines[i])) {
      for (let d = 1; d <= 4; d++) {
        const j = i + d;
        if (j < lines.length && isShortNoDigitLine(lines[j])) {
          out[j] = "[NAME]";
          break;
        }
      }
    }
  }

  // Repetition safety net: a short, multi-word, digit-free line recurring 3+ times
  // verbatim is almost always a repeating identity/contact field or boilerplate label —
  // real transaction/merchant text never appears as a bare line with no date or amount,
  // let alone three times identically. Catches occurrences too far from any email match
  // for the window above.
  const freq = new Map<string, number>();
  for (const l of lines) {
    const t = l.trim();
    if (!isShortNoDigitLine(l)) continue;
    if (t.split(/\s+/).length < 2) continue; // single-word headers (MONEDA, CUOTAS) stay
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  const recurring = [...freq.entries()].filter(([, n]) => n >= 3).map(([t]) => t);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (out[i] === lines[i] && (freq.get(t) ?? 0) >= 3) out[i] = "[NAME]";
  }

  // Fuzzy net: a line that merely starts with one of the recurring strings above is
  // almost certainly that same field glued to unrelated header text by a column-merge
  // artifact on one occurrence — the clean occurrences already fed the exact-match set.
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (out[i] !== lines[i]) continue; // already redacted
    if (!t || /\d/.test(t)) continue;
    if (recurring.some((r) => r.length >= 8 && t.startsWith(r))) out[i] = "[NAME]";
  }

  return out.join("\n");
}
