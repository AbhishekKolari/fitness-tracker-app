import { MD3DarkTheme } from 'react-native-paper';

// Apple Fitness inspired palette (deep black + vibrant rings)
export const colors = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: '#38383A',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  // Accent rings
  move: '#FA114F',     // red/pink — Move ring
  exercise: '#92E82A', // green — Exercise ring
  stand: '#1AEAEB',    // cyan — Stand ring
  // Extras
  warning: '#FFD60A',
  danger: '#FF453A',
};

export const paperTheme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.move,
    onPrimary: '#FFFFFF',
    primaryContainer: '#2A0B14',
    onPrimaryContainer: colors.move,
    secondary: colors.exercise,
    onSecondary: '#000000',
    tertiary: colors.stand,
    onTertiary: '#000000',
    background: colors.bg,
    onBackground: colors.textPrimary,
    surface: colors.surface,
    onSurface: colors.textPrimary,
    surfaceVariant: colors.surfaceElevated,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    error: colors.danger,
    elevation: {
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surfaceElevated,
      level3: '#3A3A3C',
      level4: '#48484A',
      level5: '#545456',
    },
  },
};
