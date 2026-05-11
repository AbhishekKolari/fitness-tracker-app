import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { colors as C } from '../theme';

interface LogoProps {
  size?: number;
}

/**
 * Strongline logomark — a stylized "S" rendered as an upward bar/line motion.
 * Kept as inline SVG so we don't depend on a PNG asset pipeline.
 */
export default function Logo({ size = 40 }: LogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={C.move} stopOpacity={1} />
          <Stop offset="1" stopColor="#FF4F7E" stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="2" width="60" height="60" rx="14" fill={C.surfaceElevated} />
      {/* "S" stroke */}
      <Path
        d="M44 20 C44 14, 36 12, 30 14 C22 16, 20 22, 24 26 C28 30, 38 30, 42 34 C46 38, 44 46, 36 48 C28 50, 20 48, 18 42"
        stroke="url(#g)"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
