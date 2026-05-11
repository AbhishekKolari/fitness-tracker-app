import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors as C } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const MARK_SIZE = 140;
// Path length is roughly traced; the dasharray/offset just needs to be large
// enough to fully hide the stroke before drawing. 260 covers the S-curve.
const STROKE_LEN = 260;

/**
 * Animated boot splash:
 *   1. Red gradient "S" mark draws itself in (~600ms)
 *   2. Mark gently pulses (scale 1.0 ↔ 1.05) on a loop
 *   3. "STRONGLINE" wordmark + tagline fade in beneath
 */
export default function Splash() {
  const draw = useRef(new Animated.Value(STROKE_LEN)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(draw, {
        toValue: 0,
        duration: 650,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // SVG strokeDashoffset is not a native-driver prop
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [draw, fade, pulse]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Svg width={MARK_SIZE} height={MARK_SIZE} viewBox="0 0 64 64">
          <Defs>
            <LinearGradient id="gSplash" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.move} stopOpacity={1} />
              <Stop offset="1" stopColor="#FF4F7E" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="2" y="2" width="60" height="60" rx="16" fill="#171717" />
          <AnimatedPath
            d="M44 20 C44 14, 36 12, 30 14 C22 16, 20 22, 24 26 C28 30, 38 30, 42 34 C46 38, 44 46, 36 48 C28 50, 20 48, 18 42"
            stroke="url(#gSplash)"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={STROKE_LEN}
            strokeDashoffset={draw}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
        <Text style={styles.wordmark}>STRONGLINE</Text>
        <Text style={styles.tagline}>MOVE STRONG</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 6,
    color: C.move,
  },
  tagline: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    color: C.textSecondary,
  },
});
