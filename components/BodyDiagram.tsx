import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Rect, G } from 'react-native-svg';

const HIGHLIGHT = '#F59E0B';
const NEUTRAL = '#D1D5DB';
const OUTLINE = '#9CA3AF';

type Props = { muscleGroups: string[] };

export default function BodyDiagram({ muscleGroups }: Props) {
  const fill = (id: string) =>
    muscleGroups.includes(id) ? HIGHLIGHT : NEUTRAL;

  return (
    <View style={styles.row}>
      <View style={styles.figure}>
        <Svg width={80} height={200} viewBox="0 0 80 200">
          {/* Head */}
          <Ellipse cx={40} cy={11} rx={10} ry={11} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Neck */}
          <Rect x={35} y={21} width={10} height={8} rx={2} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Front shoulders / deltoids */}
          <Ellipse cx={17} cy={38} rx={11} ry={9} fill={fill('shoulders')} stroke={OUTLINE} strokeWidth={0.5} />
          <Ellipse cx={63} cy={38} rx={11} ry={9} fill={fill('shoulders')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Chest / pectorals */}
          <Rect x={22} y={30} width={36} height={26} rx={5} fill={fill('chest')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Biceps */}
          <Rect x={6} y={47} width={12} height={26} rx={6} fill={fill('biceps')} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={62} y={47} width={12} height={26} rx={6} fill={fill('biceps')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Forearms (neutral) */}
          <Rect x={7} y={75} width={10} height={20} rx={5} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={63} y={75} width={10} height={20} rx={5} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Core / abs */}
          <Rect x={24} y={57} width={32} height={28} rx={4} fill={fill('core')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Hips (neutral connector) */}
          <Rect x={22} y={86} width={36} height={14} rx={4} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Quads */}
          <Rect x={22} y={102} width={15} height={44} rx={7} fill={fill('quads')} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={43} y={102} width={15} height={44} rx={7} fill={fill('quads')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Calves (neutral) */}
          <Rect x={23} y={149} width={13} height={36} rx={6} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={44} y={149} width={13} height={36} rx={6} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
        </Svg>
        <Text style={styles.label}>Front</Text>
      </View>

      <View style={styles.figure}>
        <Svg width={80} height={200} viewBox="0 0 80 200">
          {/* Head */}
          <Ellipse cx={40} cy={11} rx={10} ry={11} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Neck */}
          <Rect x={35} y={21} width={10} height={8} rx={2} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Rear shoulders / deltoids */}
          <Ellipse cx={17} cy={38} rx={11} ry={9} fill={fill('shoulders')} stroke={OUTLINE} strokeWidth={0.5} />
          <Ellipse cx={63} cy={38} rx={11} ry={9} fill={fill('shoulders')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Upper back / traps (neutral) */}
          <Rect x={26} y={30} width={28} height={20} rx={4} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Lats */}
          <Rect x={19} y={36} width={10} height={34} rx={4} fill={fill('lats')} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={51} y={36} width={10} height={34} rx={4} fill={fill('lats')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Triceps */}
          <Rect x={6} y={47} width={12} height={26} rx={6} fill={fill('triceps')} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={62} y={47} width={12} height={26} rx={6} fill={fill('triceps')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Forearms (neutral) */}
          <Rect x={7} y={75} width={10} height={20} rx={5} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={63} y={75} width={10} height={20} rx={5} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Lower back (neutral) */}
          <Rect x={26} y={72} width={28} height={18} rx={4} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Glutes */}
          <Rect x={22} y={90} width={36} height={22} rx={9} fill={fill('glutes')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Hamstrings */}
          <Rect x={22} y={114} width={15} height={38} rx={7} fill={fill('hamstrings')} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={43} y={114} width={15} height={38} rx={7} fill={fill('hamstrings')} stroke={OUTLINE} strokeWidth={0.5} />
          {/* Calves (neutral) */}
          <Rect x={23} y={155} width={13} height={32} rx={6} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
          <Rect x={44} y={155} width={13} height={32} rx={6} fill={NEUTRAL} stroke={OUTLINE} strokeWidth={0.5} />
        </Svg>
        <Text style={styles.label}>Back</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 8,
  },
  figure: {
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});
