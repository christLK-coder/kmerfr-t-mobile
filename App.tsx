import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LightTheme } from './src/theme/theme';
import { AppNavigator } from './src/navigation/AppNavigator';

// Injecter @expo/vector-icons dans react-native-paper pour Expo Go
// (react-native-vector-icons seul ne charge pas les polices dans le workflow managé)
function paperIcon({
  name,
  color,
  size,
}: {
  name: string;
  color?: string;
  size: number;
  direction?: 'ltr' | 'rtl';
  allowFontScaling?: boolean;
}) {
  return (
    <MaterialCommunityIcons
      name={name as keyof typeof MaterialCommunityIcons.glyphMap}
      color={color ?? '#000'}
      size={size}
    />
  );
}

export default function App() {
  return (
    <PaperProvider theme={LightTheme} settings={{ icon: paperIcon }}>
      <AppNavigator />
    </PaperProvider>
  );
}
