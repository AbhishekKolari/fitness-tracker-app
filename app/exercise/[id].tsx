import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { eq } from 'drizzle-orm';
import YoutubePlayer from 'react-native-youtube-iframe';
import { db } from '../../db/client';
import { exercises } from '../../db/schema';
import BodyDiagram from '../../components/BodyDiagram';

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([^&\s]+)/);
  return match?.[1] ?? null;
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();

  const exercise = db
    .select()
    .from(exercises)
    .where(eq(exercises.id, Number(id)))
    .get();

  if (!exercise) {
    return (
      <>
        <Stack.Screen options={{ title: 'Exercise', headerShown: true }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Exercise not found.</Text>
        </View>
      </>
    );
  }

  const videoId = extractVideoId(exercise.youtubeUrl ?? '');
  const isCompound = exercise.category === 'compound';

  return (
    <>
      <Stack.Screen
        options={{ title: exercise.name, headerShown: true, headerBackTitle: 'Back' }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Category badge */}
        <View style={[styles.badge, isCompound ? styles.badgeCompound : styles.badgeAccessory]}>
          <Text style={[styles.badgeText, isCompound ? styles.badgeTextCompound : styles.badgeTextAccessory]}>
            {exercise.category}
          </Text>
        </View>

        {/* Muscle diagram */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Muscles Worked</Text>
          <BodyDiagram muscleGroups={exercise.muscleGroups} />
          <View style={styles.muscleChips}>
            {exercise.muscleGroups.map((m) => (
              <View key={m} style={styles.chip}>
                <Text style={styles.chipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Form cues */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Form Cues</Text>
          {exercise.formCues.map((cue, i) => (
            <View key={i} style={styles.cueRow}>
              <Text style={styles.cueNumber}>{i + 1}.</Text>
              <Text style={styles.cueText}>{cue}</Text>
            </View>
          ))}
        </View>

        {/* Video */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Video</Text>
          {videoId ? (
            <YoutubePlayer
              height={220}
              width={width - 32}
              videoId={videoId}
              play={false}
            />
          ) : (
            <View style={[styles.videoPlaceholder, { width: width - 32 }]}>
              <Text style={styles.videoPlaceholderText}>Video coming soon</Text>
            </View>
          )}
        </View>

      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: '#6B7280',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 20,
  },
  badgeCompound: {
    backgroundColor: '#FEF3C7',
  },
  badgeAccessory: {
    backgroundColor: '#F1F5F9',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  badgeTextCompound: {
    color: '#92400E',
  },
  badgeTextAccessory: {
    color: '#475569',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  muscleChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  cueRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  cueNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
    minWidth: 22,
  },
  cueText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
    lineHeight: 22,
  },
  videoPlaceholder: {
    height: 220,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
