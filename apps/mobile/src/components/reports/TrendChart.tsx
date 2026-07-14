import { StyleSheet, View } from 'react-native';
import { Txt, borders, radii, spacing, useTheme } from '@chrono/ui';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface TrendChartProps {
  points: TrendPoint[];
  /** Bar color for non-negative values. */
  color: string;
  /** Bar color for negative values (defaults to `color`). */
  negativeColor?: string;
  /** Format a value for the per-bar caption. */
  formatValue: (value: number) => string;
  height?: number;
}

/**
 * A dependency-free bar chart with a zero baseline (so negative values —
 * e.g. a negative margin month — render below the line). Pure Views, so it
 * behaves identically on web and native and needs no chart library.
 */
export function TrendChart({ points, color, negativeColor, formatValue, height = 120 }: TrendChartProps) {
  const { colors } = useTheme();

  const values = points.map((p) => p.value);
  const maxV = Math.max(0, ...values);
  const minV = Math.min(0, ...values);
  const allZero = maxV === 0 && minV === 0;
  const range = maxV - minV || 1;
  // When every value is 0 the baseline belongs at the bottom (a flat line), not
  // at the top where maxV/range would put it.
  const zeroFromTop = allZero ? height : (maxV / range) * height;

  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { height }]}>
        {points.map((p) => {
          const magnitude = allZero ? 0 : (Math.abs(p.value) / range) * height;
          const isNeg = p.value < 0;
          const barColor = isNeg ? negativeColor ?? color : color;
          return (
            <View key={p.label} style={styles.col}>
              <View style={[styles.plot, { height }]}>
                {/* zero baseline */}
                <View style={[styles.baseline, { top: zeroFromTop, backgroundColor: colors.border }]} />
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(2, magnitude),
                      top: isNeg ? zeroFromTop : zeroFromTop - Math.max(2, magnitude),
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        {points.map((p) => (
          <View key={p.label} style={styles.col}>
            <Txt variant="micro" tone="textFaint" style={styles.axisLabel} numberOfLines={1}>
              {p.label}
            </Txt>
            <Txt variant="micro" tone="textMuted" style={styles.axisLabel} numberOfLines={1}>
              {formatValue(p.value)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  plot: { width: '100%', justifyContent: 'flex-end' },
  baseline: { position: 'absolute', left: 0, right: 0, height: borders.hairline },
  bar: { position: 'absolute', left: '15%', right: '15%', borderRadius: radii.sm },
  axisLabel: { textAlign: 'center' },
});
