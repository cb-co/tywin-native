import { memo, useMemo } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { closeOpenMarkdown } from "@cigua/core/ask/markdown";
import { parseMarkdown, type Align, type Block, type Inline } from "@cigua/core/ask/markdown-blocks";
import { Text, type TextProps } from "~/components/ui/text";
import { makeStyles, useColors } from "~/theme/theme";

/** The system monospace: the one place a second face is right, and it ships with the OS. */
const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

/** Inline runs as nested Text, so bold figures take tabular numerals and wrap with their sentence. */
function Runs({ inline, base }: { inline: Inline[]; base?: TextProps }) {
  const c = useColors();
  return (
    <>
      {inline.map((node, i) => {
        switch (node.kind) {
          case "text":
            return node.text;
          case "strong":
            return (
              <Text key={i} {...base} weight={600} figure>
                <Runs inline={node.children} base={{ ...base, weight: 600 }} />
              </Text>
            );
          case "em":
            return (
              <Text key={i} {...base} style={{ fontStyle: "italic" }}>
                <Runs inline={node.children} base={base} />
              </Text>
            );
          case "code":
            return (
              <Text key={i} size="xs" style={{ fontFamily: MONO, backgroundColor: c.muted }}>
                {` ${node.text} `}
              </Text>
            );
        }
      })}
    </>
  );
}

const ALIGN: Record<NonNullable<Align>, "left" | "center" | "right"> = { left: "left", center: "center", right: "right" };

/** A table scrolls sideways inside its own box instead of pushing the conversation. */
function Table({ block }: { block: Extract<Block, { kind: "table" }> }) {
  const s = useStyles();
  const cell = (inline: Inline[], col: number, head: boolean, key: string) => (
    <View key={key} style={s.cell}>
      {head ? (
        <Text legend tone="muted" align={ALIGN[block.align[col] ?? "left"]} style={{ fontSize: 11 }}>
          <Runs inline={inline} />
        </Text>
      ) : (
        <Text size="sm" figure align={ALIGN[block.align[col] ?? "left"]}>
          <Runs inline={inline} base={{ size: "sm" }} />
        </Text>
      )}
    </View>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={[s.row, s.headRow]}>{block.head.map((h, c) => cell(h, c, true, `h${c}`))}</View>
        {block.rows.map((row, r) => (
          <View key={r} style={[s.row, r < block.rows.length - 1 ? s.bodyRule : null]}>
            {row.map((x, c) => cell(x, c, false, `${r}-${c}`))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BlockView({ block }: { block: Block }) {
  const s = useStyles();
  switch (block.kind) {
    case "paragraph":
      return (
        <Text size="sm" style={s.relaxed}>
          <Runs inline={block.inline} base={{ size: "sm" }} />
        </Text>
      );
    case "heading":
      // An answer is not a document: a heading prints at the weight of a strong line.
      return (
        <Text size="sm" weight={600}>
          <Runs inline={block.inline} base={{ size: "sm", weight: 600 }} />
        </Text>
      );
    case "list":
      return (
        <View style={{ gap: 4 }}>
          {block.items.map((item, i) => (
            <View key={i} style={{ flexDirection: "row", paddingLeft: 4 + item.depth * 16 }}>
              <Text size="sm" figure style={[s.relaxed, { width: block.ordered ? 24 : 16 }]}>
                {block.ordered ? `${block.start + i}.` : "•"}
              </Text>
              <Text size="sm" style={[s.relaxed, { flex: 1 }]}>
                <Runs inline={item.inline} base={{ size: "sm" }} />
              </Text>
            </View>
          ))}
        </View>
      );
    case "table":
      return <Table block={block} />;
    case "code":
      return (
        <ScrollView horizontal style={s.pre} showsHorizontalScrollIndicator={false}>
          <Text size="xs" style={{ fontFamily: MONO }}>
            {block.text}
          </Text>
        </ScrollView>
      );
    case "quote":
      return (
        <View style={s.quote}>
          <Text size="sm" tone="muted">
            <Runs inline={block.inline} base={{ size: "sm", tone: "muted" }} />
          </Text>
        </View>
      );
    case "rule":
      return <View style={s.hr} />;
  }
}

/** One answer's markdown, closed first so a streaming answer never flashes its own syntax. */
export const AskAnswer = memo(function AskAnswer({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(closeOpenMarkdown(text)), [text]);
  return (
    <View style={{ gap: 12 }}>
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </View>
  );
});

const useStyles = makeStyles((c) => ({
  relaxed: { lineHeight: 22 },
  row: { flexDirection: "row" },
  headRow: { borderBottomWidth: 2, borderBottomColor: c.rule },
  bodyRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.paperLine },
  cell: { minWidth: 72, maxWidth: 220, paddingHorizontal: 8, paddingVertical: 6 },
  pre: { borderRadius: 6, backgroundColor: c.muted, padding: 12 },
  quote: { borderLeftWidth: 2, borderLeftColor: c.rule, paddingLeft: 12 },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: c.paperLine },
}));
