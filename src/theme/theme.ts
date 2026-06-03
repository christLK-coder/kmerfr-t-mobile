import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { Light, Dark } from './colors';

export { Light as LightColors, Dark as DarkColors } from './colors';
export type { ColorScheme } from './colors';

// ─── Paper MD3 themes ─────────────────────────────────────────────────────────

export const LightTheme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary:            Light.primary,
    primaryContainer:   Light.primaryContainer,
    onPrimary:          Light.onPrimary,
    onPrimaryContainer: Light.onPrimaryContainer,
    secondary:          Light.secondary,
    secondaryContainer: Light.secondaryContainer,
    onSecondary:        Light.onSecondary,
    surface:            Light.surface,
    surfaceVariant:     Light.surfaceVariant,
    background:         Light.background,
    onBackground:       Light.textPrimary,
    onSurface:          Light.onSurface,
    onSurfaceVariant:   Light.onSurfaceVariant,
    outline:            Light.outline,
    error:              Light.error,
    onError:            Light.onError,
    errorContainer:     Light.errorContainer,
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  roundness: 3,
  colors: {
    ...MD3DarkTheme.colors,
    primary:            Dark.primary,
    primaryContainer:   Dark.primaryContainer,
    onPrimary:          Dark.onPrimary,
    onPrimaryContainer: Dark.onPrimaryContainer,
    secondary:          Dark.secondary,
    secondaryContainer: Dark.secondaryContainer,
    onSecondary:        Dark.onSecondary,
    surface:            Dark.surface,
    surfaceVariant:     Dark.surfaceVariant,
    background:         Dark.background,
    onBackground:       Dark.textPrimary,
    onSurface:          Dark.onSurface,
    onSurfaceVariant:   Dark.onSurfaceVariant,
    outline:            Dark.outline,
    error:              Dark.error,
    onError:            Dark.onError,
    errorContainer:     Dark.errorContainer,
  },
};

// ─── Hook couleurs contextuelles ─────────────────────────────────────────────

export function useColors(isDark: boolean) {
  return isDark ? Dark : Light;
}
