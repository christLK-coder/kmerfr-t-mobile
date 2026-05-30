// Thème Material Design 3 — Palette KmerFret
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const KmerFretColors = {
  primary: '#1B5E20',           // Vert forêt camerounaise
  primaryContainer: '#A5D6A7',
  secondary: '#E65100',         // Orange routes Douala
  secondaryContainer: '#FFCC80',
  tertiary: '#0277BD',          // Bleu mer (Port de Kribi)
  error: '#B71C1C',
  success: '#2E7D32',
  warning: '#F57F17',
  surface: '#FAFAFA',
  background: '#F5F5F5',
  onPrimary: '#FFFFFF',
  onSecondary: '#FFFFFF',
};

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: KmerFretColors.primary,
    primaryContainer: KmerFretColors.primaryContainer,
    secondary: KmerFretColors.secondary,
    secondaryContainer: KmerFretColors.secondaryContainer,
    surface: KmerFretColors.surface,
    background: KmerFretColors.background,
    error: KmerFretColors.error,
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#81C784',
    secondary: '#FFAB40',
  },
};

export { KmerFretColors };
