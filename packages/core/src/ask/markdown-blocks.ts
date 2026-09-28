/**
 * The markdown an answer can contain, parsed into blocks a native view can draw.
 *
 * Deliberately small: the model writes paragraphs, bold figures, bullet and
 * numbered lists, the occasional GFM table, and (against its instructions) a
 * heading or a code block. That is the whole grammar here; anything else reads
 * as a paragraph. Links keep their text and drop the target, images vanish:
 * nothing in someone's transactions is a URL, so a link is one the model made up.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "em"; children: Inline[] }
  | { kind: "code"; text: string };

export type Align = "left" | "center" | "right" | null;

export type Block =
  | { kind: "paragraph"; inline: Inline[] }
  | { kind: "heading"; inline: Inline[] }
  | { kind: "list"; ordered: boolean; start: number; items: { inline: Inline[]; depth: number }[] }
  | { kind: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { kind: "code"; text: string }
  | { kind: "quote"; inline: Inline[] }
  | { kind: "rule" };

const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE = /^\s{0,3}(```|~~~)/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

function alignOf(cell: string): Align {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  return left && right ? "center" : right ? "right" : left ? "left" : null;
}

/** Bold, italics, code spans; links keep their text; images drop. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ kind: "text", text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length && /[\\`*_[\]()#+\-.!|>~]/.test(src[i + 1])) {
      text += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "`") {
      const end = src.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ kind: "code", text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === "!" && src[i + 1] === "[") {
      const close = src.indexOf("]", i + 2);
      if (close > 0 && src[close + 1] === "(") {
        const paren = src.indexOf(")", close + 2);
        if (paren > 0) {
          i = paren + 1;
          continue;
        }
      }
    }
    if (ch === "[") {
      const close = src.indexOf("]", i + 1);
      if (close > 0 && src[close + 1] === "(") {
        const paren = src.indexOf(")", close + 2);
        if (paren > 0) {
          flush();
          out.push(...parseInline(src.slice(i + 1, close)));
          i = paren + 1;
          continue;
        }
      }
    }
    if ((ch === "*" || ch === "_") && src[i + 1] === ch) {
      const marker = ch + ch;
      const end = src.indexOf(marker, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "strong", children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    // A single asterisk opens emphasis only when a non-space follows it, as in
    // CommonMark: "TST* Kedai" is an issuer descriptor, not an italic run.
    if ((ch === "*" || ch === "_") && src[i + 1] && src[i + 1] !== " " && src[i + 1] !== ch) {
      const wordy = ch === "_" && i > 0 && /\w/.test(src[i - 1]);
      if (!wordy) {
        let end = i + 1;
        while ((end = src.indexOf(ch, end)) !== -1) {
          if (src[end - 1] !== " " && src[end + 1] !== ch && !(ch === "_" && /\w/.test(src[end + 1] ?? ""))) break;
          end++;
        }
        if (end !== -1 && end > i + 1) {
          flush();
          out.push({ kind: "em", children: parseInline(src.slice(i + 1, end)) });
          i = end + 1;
          continue;
        }
      }
    }
    text += ch;
    i++;
  }
  flush();
  return out;
}

/** Splits an answer into blocks. Never throws: unknown syntax is a paragraph. */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const isBlockStart = (line: string, next?: string) =>
    HEADING.test(line) ||
    RULE.test(line) ||
    FENCE.test(line) ||
    BULLET.test(line) ||
    ORDERED.test(line) ||
    QUOTE.test(line) ||
    (line.includes("|") && next !== undefined && TABLE_SEP.test(next) && next.includes("-"));

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++]);
      i++; // the closing fence, or past the end while it streams in
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ kind: "heading", inline: parseInline(heading[1]) });
      i++;
      continue;
    }

    if (RULE.test(line)) {
      blocks.push({ kind: "rule" });
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const headCells = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        const cells = splitRow(lines[i]);
        rows.push(headCells.map((_, c) => parseInline(cells[c] ?? "")));
        i++;
      }
      blocks.push({ kind: "table", align: headCells.map((_, c) => align[c] ?? null), head: headCells.map((h) => parseInline(h)), rows });
      continue;
    }

    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].match(QUOTE)![1]);
      blocks.push({ kind: "quote", inline: parseInline(body.join(" ").trim()) });
      continue;
    }

    const bullet = line.match(BULLET);
    const ordered = line.match(ORDERED);
    if (bullet || ordered) {
      const isOrdered = !!ordered && !bullet;
      const items: { inline: Inline[]; depth: number }[] = [];
      const baseIndent = (bullet ? bullet[1] : ordered![1]).length;
      while (i < lines.length) {
        const b = lines[i].match(BULLET);
        const o = lines[i].match(ORDERED);
        const m = b ?? o;
        if (m) {
          const indent = m[1].length;
          const body = b ? b[2] : o![3];
          items.push({ inline: parseInline(body), depth: Math.max(0, Math.min(3, Math.floor((indent - baseIndent) / 2))) });
          i++;
          continue;
        }
        // A wrapped continuation line belongs to the item above it.
        if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length > 0 && !isBlockStart(lines[i].trim(), lines[i + 1])) {
          const last = items[items.length - 1];
          last.inline = [...last.inline, { kind: "text", text: " " }, ...parseInline(lines[i].trim())];
          i++;
          continue;
        }
        break;
      }
      blocks.push({ kind: "list", ordered: isOrdered, start: isOrdered ? Number(ordered![2]) : 1, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !(para.length > 0 && isBlockStart(lines[i], lines[i + 1]))) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", inline: parseInline(para.join(" ")) });
  }
  return blocks;
}
