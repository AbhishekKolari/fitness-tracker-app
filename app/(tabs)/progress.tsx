import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { colors as C } from '../../theme';
import { useFocusEffect } from 'expo-router';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { eq, asc, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { exercises, setLogs, workoutSessions } from '../../db/schema';
import { getProgressForExercise } from '../../db/queries';
import { useSettings } from '../../contexts/SettingsContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 180;
const PAD = { top: 16, bottom: 32, left: 40, right: 16 };

interface ExerciseOption {
  id: number;
  name: string;
}

interface DataPoint {
  date: string;
  value: number;
}

export default function ProgressScreen() {
  const { settings } = useSettings();
  const [exerciseOptions, setExerciseOptions] = useState<ExerciseOption[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    try {
      // Find exercises that have at least one completed set log
      const withData = db
        .selectDistinct({ id: exercises.id, name: exercises.name })
        .from(exercises)
        .innerJoin(setLogs, and(eq(setLogs.exerciseId, exercises.id), eq(setLogs.completed, true)))
        .orderBy(exercises.name)
        .all();

      setExerciseOptions(withData);
      if (withData.length > 0 && selectedId === null) {
        setSelectedId(withData[0].id);
      }
    } catch (e) {
      console.error('Error loading exercise list:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Reload chart data when selection changes
  const loadChart = useCallback(() => {
    if (selectedId === null) return;
    try {
      const rows = getProgressForExercise(selectedId);
      const toKg = (w: number) => settings.weightUnit === 'kg' ? w : w * 2.20462;
      setChartData(
        rows
          .filter((r) => r.maxWeightKg !== null)
          .map((r) => ({ date: r.date, value: toKg(r.maxWeightKg!) })),
      );
    } catch (e) {
      console.error('Error loading chart data:', e);
    }
  }, [selectedId, settings.weightUnit]);

  useFocusEffect(useCallback(() => { loadChart(); }, [loadChart]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  if (exerciseOptions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No data yet</Text>
        <Text style={styles.emptySubText}>Log some sets to see your strength progress here.</Text>
      </View>
    );
  }

  const selectedName = exerciseOptions.find((e) => e.id === selectedId)?.name ?? '';
  const hasChart = chartData.length >= 2;

  // Chart geometry
  const minV = hasChart ? Math.min(...chartData.map((d) => d.value)) : 0;
  const maxV = hasChart ? Math.max(...chartData.map((d) => d.value)) : 100;
  const range = maxV - minV || 1;

  const plotW = CHART_WIDTH - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;

  const px = (i: number) => PAD.left + (i / (chartData.length - 1)) * plotW;
  const py = (v: number) => PAD.top + plotH - ((v - minV) / range) * plotH;

  const points = chartData.map((d, i) => `${px(i)},${py(d.value)}`).join(' ');

  const firstDate = chartData[0]?.date ?? '';
  const lastDate = chartData[chartData.length - 1]?.date ?? '';
  const fmtDate = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Progress</Text>
      <Text style={styles.subheading}>Strength over time</Text>

      {/* Exercise selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {exerciseOptions.map((ex) => (
          <TouchableOpacity
            key={ex.id}
            style={[styles.chip, selectedId === ex.id && styles.chipActive]}
            onPress={() => setSelectedId(ex.id)}
          >
            <Text style={[styles.chipText, selectedId === ex.id && styles.chipTextActive]}>
              {ex.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.exerciseName}>{selectedName}</Text>
      <Text style={styles.axisLabel}>Max weight ({settings.weightUnit}) per session</Text>

      {hasChart ? (
        <View style={styles.chartWrapper}>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            {/* Horizontal grid lines */}
            {[0, 0.5, 1].map((frac) => {
              const y = PAD.top + frac * plotH;
              const val = maxV - frac * range;
              return (
                <React.Fragment key={frac}>
                  <Line x1={PAD.left} y1={y} x2={CHART_WIDTH - PAD.right} y2={y} stroke={C.border} strokeWidth={1} />
                  <SvgText x={PAD.left - 4} y={y + 4} fontSize={10} fill={C.textSecondary} textAnchor="end">
                    {val.toFixed(1)}
                  </SvgText>
                </React.Fragment>
              );
            })}

            {/* Line */}
            <Polyline points={points} fill="none" stroke={C.move} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {/* Data points */}
            {chartData.map((d, i) => (
              <Circle key={i} cx={px(i)} cy={py(d.value)} r={4} fill={C.move} />
            ))}

            {/* X axis labels */}
            <SvgText x={PAD.left} y={CHART_HEIGHT - 4} fontSize={10} fill={C.textSecondary}>
              {fmtDate(firstDate)}
            </SvgText>
            <SvgText x={CHART_WIDTH - PAD.right} y={CHART_HEIGHT - 4} fontSize={10} fill={C.textSecondary} textAnchor="end">
              {fmtDate(lastDate)}
            </SvgText>
          </Svg>
        </View>
      ) : (
        <View style={styles.noChartBox}>
          <Text style={styles.noChartText}>
            {chartData.length === 1
              ? 'One session logged — keep going to see the trend.'
              : 'No sessions logged for this exercise yet.'}
          </Text>
        </View>
      )}

      {/* Latest stats */}
      {chartData.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{chartData[chartData.length - 1].value.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Latest ({settings.weightUnit})</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.max(...chartData.map((d) => d.value)).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Best ({settings.weightUnit})</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{chartData.length}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  heading: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textSecondary, marginBottom: 20, marginTop: 2 },
  chipScroll: { marginBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginRight: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: 'rgba(250, 17, 79, 0.15)', borderColor: C.move },
  chipText: { fontSize: 13, fontWeight: '500', color: C.textSecondary },
  chipTextActive: { color: C.move, fontWeight: '700' },
  exerciseName: { fontSize: 20, fontWeight: '700', color: C.textPrimary, marginBottom: 2, letterSpacing: -0.3 },
  axisLabel: { fontSize: 12, color: C.textSecondary, marginBottom: 12 },
  chartWrapper: { backgroundColor: C.surface, borderRadius: 16, padding: 12, marginBottom: 16 },
  noChartBox: {
    backgroundColor: C.surface, borderRadius: 16, padding: 24, alignItems: 'center',
    marginBottom: 16,
  },
  noChartText: { fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', color: C.move, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: C.textSecondary, marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: C.textPrimary },
  emptySubText: { fontSize: 14, color: C.textSecondary, marginTop: 8, textAlign: 'center' },
});
