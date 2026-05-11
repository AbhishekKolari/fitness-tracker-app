import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import Svg, { Circle } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { workoutSessions, workoutTemplates, programs, setLogs } from '../../db/schema';
import { colors as C } from '../../theme';
import { localDateStr } from '../../utils/date';
import Logo from '../../components/Logo';
import BodyStatsTrend from '../../components/BodyStatsTrend';

interface RecentSession {
  id: number;
  date: string;
  templateLabel: string;
  programName: string;
  setsCompleted: number;
}

const RING_SIZE = 200;
const RING_STROKE = 18;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function HomeScreen() {
  const [todayProgress, setTodayProgress] = useState({ done: 0, total: 0, label: '' });
  const [todaySessionId, setTodaySessionId] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [weekVolume, setWeekVolume] = useState(0);
  const [recent, setRecent] = useState<RecentSession[]>([]);

  const load = useCallback(() => {
    try {
      const today = localDateStr();

      // Today's session progress
      const session = db
        .select({
          id: workoutSessions.id,
          templateId: workoutSessions.templateId,
          isCustom: workoutSessions.isCustom,
        })
        .from(workoutSessions)
        .where(eq(workoutSessions.date, today))
        .get();

      if (session) {
        setTodaySessionId(session.id);
        const tmpl = db
          .select({ label: workoutTemplates.label })
          .from(workoutTemplates)
          .where(eq(workoutTemplates.id, session.templateId))
          .get();

        const completed = db
          .select({ c: sql<number>`count(*)` })
          .from(setLogs)
          .where(eq(setLogs.sessionId, session.id))
          .get();

        // Total target sets — for template workouts read from templateExercises
        let totalTarget = 0;
        if (!session.isCustom && session.templateId > 0) {
          const target = db
            .select({ c: sql<number>`coalesce(sum(sets), 0)` })
            .from(sql`template_exercises`)
            .where(sql`template_id = ${session.templateId}`)
            .get() as { c: number } | undefined;
          totalTarget = target?.c ?? 0;
        }
        setTodayProgress({
          done: completed?.c ?? 0,
          total: totalTarget || (completed?.c ?? 0),
          label: tmpl?.label ?? "Today's Workout",
        });
      } else {
        setTodaySessionId(null);
        setTodayProgress({ done: 0, total: 0, label: 'No workout yet' });
      }

      // Streak — count consecutive days back from today with at least one session
      const allDates = db
        .selectDistinct({ d: workoutSessions.date })
        .from(workoutSessions)
        .orderBy(desc(workoutSessions.date))
        .all()
        .map((r) => r.d);
      const dateSet = new Set(allDates);
      let streakCount = 0;
      const cursor = new Date();
      while (true) {
        const ds = localDateStr(cursor);
        if (dateSet.has(ds)) {
          streakCount += 1;
          cursor.setDate(cursor.getDate() - 1);
        } else if (streakCount === 0 && ds === today) {
          // Allow today not to break the streak if no session yet
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
      setStreak(streakCount);

      // Weekly volume = sum(weight * reps) for last 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekStart = localDateStr(weekAgo);
      const vol = db
        .select({
          v: sql<number>`coalesce(sum(${setLogs.weightKg} * ${setLogs.reps}), 0)`,
        })
        .from(setLogs)
        .innerJoin(workoutSessions, eq(setLogs.sessionId, workoutSessions.id))
        .where(sql`${workoutSessions.date} >= ${weekStart}`)
        .get();
      setWeekVolume(Math.round(vol?.v ?? 0));

      // Recent sessions
      const recentRows = db
        .select({
          id: workoutSessions.id,
          date: workoutSessions.date,
          templateLabel: workoutTemplates.label,
          programName: programs.name,
        })
        .from(workoutSessions)
        .leftJoin(workoutTemplates, eq(workoutSessions.templateId, workoutTemplates.id))
        .leftJoin(programs, eq(workoutSessions.programId, programs.id))
        .orderBy(desc(workoutSessions.date), desc(workoutSessions.id))
        .limit(3)
        .all();

      const withSets: RecentSession[] = recentRows.map((r) => {
        const c = db
          .select({ c: sql<number>`count(*)` })
          .from(setLogs)
          .where(eq(setLogs.sessionId, r.id))
          .get();
        return {
          id: r.id,
          date: r.date,
          templateLabel: r.templateLabel ?? 'Custom Workout',
          programName: r.programName ?? '',
          setsCompleted: c?.c ?? 0,
        };
      });
      setRecent(withSets);
    } catch (e) {
      console.error('Error loading home:', e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const ringPct = todayProgress.total > 0 ? Math.min(1, todayProgress.done / todayProgress.total) : 0;
  const dashOffset = RING_CIRC * (1 - ringPct);

  const fmtRecentDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.heading}>Strongline</Text>
          </View>
          <Logo size={48} />
        </View>

        {/* Activity ring */}
        <View style={styles.ringCard}>
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={C.surfaceElevated}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_RADIUS}
                stroke={C.move}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${RING_CIRC} ${RING_CIRC}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={styles.ringPct}>{Math.round(ringPct * 100)}%</Text>
              <Text style={styles.ringLabel}>{todayProgress.done}/{todayProgress.total || '—'} sets</Text>
            </View>
          </View>
          <Text style={styles.ringTitle}>{todayProgress.label}</Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.navigate('/today' as any)}>
            <Text style={styles.ctaText}>
              {todaySessionId ? (ringPct >= 1 ? 'Review Workout' : 'Continue Workout') : 'Start Today\'s Workout'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats grid */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{weekVolume.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Weekly Volume (kg)</Text>
          </View>
        </View>

        {/* Recent sessions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          <TouchableOpacity onPress={() => router.navigate('/history' as any)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No workouts logged yet.</Text>
          </View>
        ) : (
          recent.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.sessionCard}
              onPress={() => router.navigate('/history' as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionDate}>{fmtRecentDate(r.date)}</Text>
                <Text style={styles.sessionMeta}>{r.programName} · {r.templateLabel}</Text>
              </View>
              <View style={styles.setsPill}>
                <Text style={styles.setsText}>{r.setsCompleted} sets</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Body stats trend */}
        <View style={styles.trendCard}>
          <BodyStatsTrend />
        </View>

        {/* Quick links */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore</Text>
        </View>
        <TouchableOpacity style={styles.linkCard} onPress={() => router.navigate('/progress' as any)}>
          <Text style={styles.linkTitle}>Strength Progress</Text>
          <Text style={styles.linkSubtitle}>Track PRs over time</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkCard} onPress={() => router.navigate('/programs' as any)}>
          <Text style={styles.linkTitle}>Programs</Text>
          <Text style={styles.linkSubtitle}>Browse training plans</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 14, color: C.textSecondary, fontWeight: '500' },
  heading: { fontSize: 34, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5, marginTop: 2 },

  ringCard: { backgroundColor: C.surface, borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16 },
  ringContainer: { position: 'relative', width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 44, fontWeight: '800', color: C.textPrimary, letterSpacing: -1 },
  ringLabel: { fontSize: 13, color: C.textSecondary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  ringTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginTop: 12, marginBottom: 16 },
  cta: { backgroundColor: C.move, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, alignSelf: 'stretch' },
  ctaText: { color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 15 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '800', color: C.move, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: C.textSecondary, marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.3 },
  seeAll: { fontSize: 14, color: C.move, fontWeight: '600' },

  sessionCard: { backgroundColor: C.surface, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  sessionDate: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  sessionMeta: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
  setsPill: { backgroundColor: 'rgba(250, 17, 79, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  setsText: { fontSize: 12, fontWeight: '700', color: C.move },

  emptyBox: { backgroundColor: C.surface, borderRadius: 14, padding: 20, alignItems: 'center' },
  emptyText: { color: C.textSecondary, fontSize: 14 },

  trendCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginTop: 4 },
  linkCard: { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 10 },
  linkTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  linkSubtitle: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
});
