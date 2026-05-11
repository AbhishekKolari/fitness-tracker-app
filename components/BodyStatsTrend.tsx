import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, SegmentedButtons } from 'react-native-paper';
import Svg, { Circle, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { asc } from 'drizzle-orm';
import { db } from '../db/client';
import { bodyStats } from '../db/schema';
import { useSettings } from '../contexts/SettingsContext';
import { colors as C } from '../theme';

interface Entry {
  id: number;
  date: string;
  weightKg: number;
  heightCm: number | null;
}

interface Props {
  refreshKey?: number;
}

type Metric = 'weight' | 'bmi';

/**
 * Trend chart for body stats. Always renders (even with 0/1 entries).
 * Toggle between Weight and BMI plots. Shows all entries.
 */
export default function BodyStatsTrend({ refreshKey }: Props) {
  const { settings } = useSettings();
  const { width } = useWindowDimensions();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [metric, setMetric] = useState<Metric>('weight');

  useEffect(() => {
    try {
      const rows = db.select().from(bodyStats).orderBy(asc(bodyStats.date)).all();
      setEntries(rows);
    } catch (e) {
      console.error('Error loading body stats:', e);
    }
  }, [refreshKey]);

  // Compute Y values based on metric
  const dataPoints = useMemo(() => {
    return entries
      .map((e) => {
        if (metric === 'weight') {
          const v = settings.weightUnit === 'kg' ? e.weightKg : e.weightKg * 2.20462;
          return { date: e.date, value: v };
        }
        if (!e.heightCm || e.heightCm <= 0) return null;
        const m = e.heightCm / 100;
        return { date: e.date, value: e.weightKg / (m * m) };
      })
      .filter((p): p is { date: string; value: number } => p !== null);
  }, [entries, metric, settings.weightUnit]);

  const unitLabel = metric === 'weight' ? settings.weightUnit : 'BMI';

  const chartWidth = width - 64;
  const chartHeight = 160;
  const padH = 16;
  const padV = 20;

  const minVal = dataPoints.length ? Math.min(...dataPoints.map((p) => p.value)) : 0;
  const maxVal = dataPoints.length ? Math.max(...dataPoints.map((p) => p.value)) : 1;
  const range0 = maxVal - minVal;
  const pad = range0 * 0.1 || 1;
  const yMin = minVal - pad;
  const yMax = maxVal + pad;
  const yRange = yMax - yMin || 1;

  const xFor = (i: number) => {
    if (dataPoints.length <= 1) return chartWidth / 2;
    return padH + (i / (dataPoints.length - 1)) * (chartWidth - padH * 2);
  };
  const yFor = (v: number) => {
    return chartHeight - padV - ((v - yMin) / yRange) * (chartHeight - padV * 2);
  };

  const polyPoints = dataPoints.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(' ');

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trend</Text>

      <View style={styles.controls}>
        <SegmentedButtons
          value={metric}
          onValueChange={(v) => setMetric(v as Metric)}
          buttons={[
            { value: 'weight', label: 'Weight' },
            { value: 'bmi', label: 'BMI' },
          ]}
          density="small"
          style={styles.segment}
        />
      </View>

      <View style={styles.chartCard}>
        {dataPoints.length === 0 ? (
          <View style={styles.emptyChart}>
            <Text style={styles.emptyText}>
              {metric === 'bmi'
                ? 'Add an entry with height to see BMI trend'
                : 'Add your first entry to start tracking'}
            </Text>
          </View>
        ) : (
          <>
            <Svg width={chartWidth} height={chartHeight}>
              {/* Horizontal guideline at middle */}
              <Line
                x1={padH}
                y1={chartHeight / 2}
                x2={chartWidth - padH}
                y2={chartHeight / 2}
                stroke={C.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
              {dataPoints.length >= 2 && (
                <Polyline
                  points={polyPoints}
                  fill="none"
                  stroke={C.move}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
              {dataPoints.map((p, i) => (
                <Circle
                  key={i}
                  cx={xFor(i)}
                  cy={yFor(p.value)}
                  r={4}
                  fill={C.move}
                  stroke={C.bg}
                  strokeWidth={2}
                />
              ))}
              {/* Min/max labels */}
              <SvgText
                x={padH}
                y={12}
                fill={C.textSecondary}
                fontSize="10"
                fontWeight="600"
              >
                {maxVal.toFixed(1)} {unitLabel}
              </SvgText>
              <SvgText
                x={padH}
                y={chartHeight - 4}
                fill={C.textSecondary}
                fontSize="10"
                fontWeight="600"
              >
                {minVal.toFixed(1)} {unitLabel}
              </SvgText>
            </Svg>
            <View style={styles.xLabels}>
              <Text style={styles.xLabel}>{formatDate(dataPoints[0].date)}</Text>
              {dataPoints.length >= 3 && (
                <Text style={styles.xLabel}>
                  {formatDate(dataPoints[Math.floor(dataPoints.length / 2)].date)}
                </Text>
              )}
              {dataPoints.length >= 2 && (
                <Text style={styles.xLabel}>
                  {formatDate(dataPoints[dataPoints.length - 1].date)}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  controls: { gap: 8, marginBottom: 12 },
  segment: {},
  chartCard: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  emptyChart: { height: 160, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textSecondary, fontSize: 13, textAlign: 'center' },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  xLabel: { fontSize: 10, color: C.textSecondary, fontWeight: '500' },
  recentHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  recentDate: { fontSize: 14, color: C.textSecondary },
  recentValue: { fontSize: 14, color: C.textPrimary, fontWeight: '600' },
});
