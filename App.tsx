import React, { useEffect } from 'react';
import { View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as Notifications from 'expo-notifications';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LightTheme, DarkTheme } from './src/theme/theme';
import { AppNavigator }   from './src/navigation/AppNavigator';
import { OfflineBanner }  from './src/components/common/OfflineBanner';
import { useThemeStore }  from './src/store/themeStore';
import { useSyncStore }   from './src/store/syncStore';
import { STRIPE_PUBLISHABLE_KEY } from './src/utils/constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function paperIcon({ name, color, size }: { name: string; color?: string; size: number; direction?: 'ltr' | 'rtl'; allowFontScaling?: boolean }) {
  return (
    <MaterialCommunityIcons
      name={name as keyof typeof MaterialCommunityIcons.glyphMap}
      color={color ?? '#000'}
      size={size}
    />
  );
}

export default function App() {
  const { isDark, loadTheme } = useThemeStore();
  const { startListener, stopListener } = useSyncStore();

  useEffect(() => {
    loadTheme();
    // Débloquer la rotation d'écran (portrait + paysage)
    ScreenOrientation.unlockAsync().catch(() => {});
    // Démarrer la synchronisation offline→backend (positions GPS + chocs)
    startListener();
    Notifications.setNotificationChannelAsync('kmerfret', {
      name: 'KmerFret',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1B5E20',
      sound: 'default',
    }).catch(() => {});
    return () => stopListener();
  }, []);

  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.cm.kmerfret">
      <PaperProvider theme={isDark ? DarkTheme : LightTheme} settings={{ icon: paperIcon }}>
        <View style={{ flex: 1 }}>
          <AppNavigator />
          <OfflineBanner />
        </View>
      </PaperProvider>
    </StripeProvider>
  );
}
