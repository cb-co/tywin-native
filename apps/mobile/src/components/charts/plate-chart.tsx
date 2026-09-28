import { memo, useMemo, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Line, Path, Pattern, Rect, Text as SvgText } from "react-native-svg";
import { HATCHES } from "@cigua/core/papel/plate";
import { Text } from "~/components/ui/text";
import { face } from "~/theme/fonts";
import { useColors } from "~/theme/theme";
import { radius } from "~/theme/tokens";

/**
 * The plates' charts, drawn in SVG: lines, areas and grouped bars on a ruled
 * grid, with Papel hatch fills so two series never differ by colour alone. A
 * touch reads out the values at that point, the way a hover does on the web.
 */

export type ChartSeries = {
  key: string;
  name: string;
  kind: "line" | "area" | "bar";
  color: string;
  /** Hatch slot (1-8) for areas and bars. */
  hatch?: number;
  dashed?: boolean;
  dots?: boolean;
  strokeWidth?: number;
  /** How the readout prints this series' value. */
  format?: (v: number) => string;
};

export type ChartPoint = { label: string; values: Record<string, number | null | undefined> };

const PAD = { top: 8, right: 8, bottom: 22 };
const AXIS_FONT = 12;

function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function ticksFor(min: number, max: number): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const step = niceStep(max - min, 4);
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5 && out.length < 8; v += step) out.push(Math.round(v / step) * step);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

export const PlateChart = memo(function PlateChart({
  data,
  series,
  height = 256,
  yFormat,
  domain = "zero",
  zeroLine,
  minTickGap = 8,
  legend,
  axisWidth = 48,
  xFormat,
  accessibilityLabel,
}: {
  data: ChartPoint[];
  series: ChartSeries[];
  height?: number;
  yFormat: (v: number) => string;
  /** "zero" pins the axis to include 0 (bars, spend); "auto" fits the data (net worth, balances). */
  domain?: "zero" | "auto";
  zeroLine?: boolean;
  minTickGap?: number;
  legend?: boolean;
  axisWidth?: number;
  xFormat?: (label: string) => string;
  accessibilityLabel: string;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const plotLeft = axisWidth;
  const plotW = Math.max(1, width - plotLeft - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const n = data.length;
  const bars = series.filter((s) => s.kind === "bar");

  const { ticks, lo, hi } = useMemo(() => {
    const values: number[] = [];
    for (const p of data) for (const s of series) {
      const v = p.values[s.key];
      if (typeof v === "number" && Number.isFinite(v)) values.push(v);
    }
    let min = values.length ? Math.min(...values) : 0;
    let max = values.length ? Math.max(...values) : 1;
    if (domain === "zero" || series.some((s) => s.kind === "bar")) {
      min = Math.min(0, min);
      max = Math.max(0, max);
    }
    const tk = ticksFor(min, max);
    return { ticks: tk, lo: tk[0], hi: tk[tk.length - 1] };
  }, [data, series, domain]);

  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const band = plotW / Math.max(1, n);
  // Lines and areas sit on point centres when bars share the plot; edge to edge otherwise.
  const x = (i: number) =>
    bars.length > 0 || n === 1 ? plotLeft + band * (i + 0.5) : plotLeft + (plotW * i) / Math.max(1, n - 1);

  const labelEvery = useMemo(() => {
    const longest = Math.max(1, ...data.map((d) => (xFormat ? xFormat(d.label) : d.label).length));
    const need = longest * 6.6 + minTickGap;
    const spacing = bars.length > 0 || n === 1 ? band : plotW / Math.max(1, n - 1);
    return Math.max(1, Math.ceil(need / Math.max(1, spacing)));
  }, [data, xFormat, minTickGap, band, plotW, n, bars.length]);

  const linePath = (key: string) => {
    let d = "";
    let started = false;
    data.forEach((p, i) => {
      const v = p.values[key];
      if (typeof v !== "number" || !Number.isFinite(v)) return; // connectNulls
      d += `${started ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      started = true;
    });
    return d;
  };

  const areaPath = (key: string) => {
    const pts = data
      .map((p, i) => ({ i, v: p.values[key] }))
      .filter((p): p is { i: number; v: number } => typeof p.v === "number" && Number.isFinite(p.v));
    if (pts.length === 0) return "";
    const base = y(Math.max(lo, Math.min(0, hi)));
    let d = `M${x(pts[0].i).toFixed(1)} ${base.toFixed(1)}`;
    for (const p of pts) d += `L${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`;
    d += `L${x(pts[pts.length - 1].i).toFixed(1)} ${base.toFixed(1)}Z`;
    return d;
  };

  const barWidth = Math.min(28, (band * 0.8) / Math.max(1, bars.length));

  function pick(locationX: number) {
    if (n === 0) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - locationX);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    setActive(best);
  }

  const readout = active !== null ? data[active] : null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          if (hideTimer.current) clearTimeout(hideTimer.current);
          pick(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => {
          hideTimer.current = setTimeout(() => setActive(null), 2500);
        }}
        onResponderTerminationRequest={() => true}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              {HATCHES.map((h, i) => {
                const slot = i + 1;
                const color = c.chart[i];
                return (
                  <Pattern
                    key={slot}
                    id={`plate-${slot}`}
                    width={h.gap}
                    height={h.gap}
                    patternUnits="userSpaceOnUse"
                    patternTransform={`rotate(${h.angle})`}
                  >
                    <Line x1={h.gap / 2} y1={0} x2={h.gap / 2} y2={h.gap} stroke={color} strokeWidth={1.25} />
                    {slot === 4 ? <Line x1={0} y1={h.gap / 2} x2={h.gap} y2={h.gap / 2} stroke={color} strokeWidth={1.25} /> : null}
                  </Pattern>
                );
              })}
            </Defs>

            {ticks.map((tk) => (
              <G key={tk}>
                <Line x1={plotLeft} x2={plotLeft + plotW} y1={y(tk)} y2={y(tk)} stroke={c.paperLine} strokeWidth={1} />
                <SvgText
                  x={plotLeft - 6}
                  y={y(tk) + 4}
                  fontSize={AXIS_FONT}
                  fontFamily={face(400)}
                  fill={c.mutedForeground}
                  textAnchor="end"
                >
                  {yFormat(tk)}
                </SvgText>
              </G>
            ))}

            {zeroLine && lo < 0 && hi > 0 ? <Line x1={plotLeft} x2={plotLeft + plotW} y1={y(0)} y2={y(0)} stroke={c.rule} strokeWidth={1} /> : null}

            {data.map((p, i) =>
              i % labelEvery === 0 ? (
                <SvgText
                  key={`x-${i}`}
                  x={x(i)}
                  y={height - 6}
                  fontSize={AXIS_FONT}
                  fontFamily={face(400)}
                  fill={c.mutedForeground}
                  textAnchor={bars.length === 0 && n > 1 && i === 0 ? "start" : bars.length === 0 && n > 1 && i === n - 1 ? "end" : "middle"}
                >
                  {xFormat ? xFormat(p.label) : p.label}
                </SvgText>
              ) : null,
            )}

            {bars.map((s, bi) =>
              data.map((p, i) => {
                const v = p.values[s.key];
                if (typeof v !== "number" || !Number.isFinite(v)) return null;
                const x0 = plotLeft + band * i + (band - barWidth * bars.length) / 2 + bi * barWidth;
                const top = y(Math.max(v, 0));
                const bottom = y(Math.min(v, 0));
                return (
                  <Rect
                    key={`${s.key}-${i}`}
                    x={x0 + 1}
                    y={top}
                    width={Math.max(1, barWidth - 2)}
                    height={Math.max(1, bottom - top)}
                    fill={s.hatch ? `url(#plate-${s.hatch})` : s.color}
                    stroke={s.color}
                    strokeWidth={1.25}
                  />
                );
              }),
            )}

            {series
              .filter((s) => s.kind === "area")
              .map((s) => (
                <G key={s.key}>
                  <Path d={areaPath(s.key)} fill={s.hatch ? `url(#plate-${s.hatch})` : s.color} fillOpacity={s.hatch ? 1 : 0.2} />
                  <Path d={linePath(s.key)} stroke={s.color} strokeWidth={s.strokeWidth ?? 2} fill="none" strokeLinejoin="round" />
                </G>
              ))}

            {series
              .filter((s) => s.kind === "line")
              .map((s) => (
                <Path
                  key={s.key}
                  d={linePath(s.key)}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth ?? 2}
                  strokeDasharray={s.dashed ? "4 4" : undefined}
                  fill="none"
                  strokeLinejoin="round"
                />
              ))}

            {series
              .filter((s) => s.dots && s.kind !== "bar")
              .map((s) =>
                data.map((p, i) => {
                  const v = p.values[s.key];
                  if (typeof v !== "number" || !Number.isFinite(v)) return null;
                  return <Circle key={`${s.key}-dot-${i}`} cx={x(i)} cy={y(v)} r={active === i ? 4 : 3} fill={s.color} />;
                }),
              )}

            {active !== null ? (
              <Line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke={c.inkSoft} strokeWidth={1} strokeDasharray="2 3" />
            ) : null}
          </Svg>
        ) : null}

        {readout ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: PAD.top,
              left: x(active!) > width / 2 ? plotLeft + 4 : undefined,
              right: x(active!) > width / 2 ? undefined : PAD.right + 4,
              backgroundColor: c.popover,
              borderColor: c.paperLine,
              borderWidth: 1,
              borderRadius: radius.sheet,
              paddingHorizontal: 8,
              paddingVertical: 6,
              gap: 2,
            }}
          >
            <Text size="xs" weight={600}>
              {xFormat ? xFormat(readout.label) : readout.label}
            </Text>
            {series.map((s) => {
              const v = readout.values[s.key];
              if (typeof v !== "number") return null;
              return (
                <Text key={s.key} size="xs" figure color={s.color}>
                  {s.name}: {s.format ? s.format(v) : yFormat(v)}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>

      {legend ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, marginTop: 8 }}>
          {series.map((s) => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              {s.kind === "line" ? (
                <View style={{ width: 14, height: 0, borderTopWidth: 2, borderColor: s.color, borderStyle: s.dashed ? "dashed" : "solid" }} />
              ) : (
                <View style={{ width: 10, height: 10, borderWidth: 1.25, borderColor: s.color }} />
              )}
              <Text size="xs" tone="muted">
                {s.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});
