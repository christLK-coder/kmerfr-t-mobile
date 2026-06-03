import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { AuthNavigator }  from './AuthNavigator';
import { MainNavigator }  from './MainNavigator';
import { LoadingOverlay } from '../components/common/LoadingOverlay';
import { useAuthStore }   from '../store/authStore';
import { useSyncStore }   from '../store/syncStore';
import { initDatabase }   from '../database/schema';
import { loadSavedLocale } from '../i18n';
import { registerForPushNotifications, addNotificationListener } from '../services/NotificationService';
import { updatePushTokenApi } from '../api/auth.api';

export function AppNavigator() {
  const { isAuthenticated, isLoading, checkSession } = useAuthStore();
  const { startListener, stopListener }              = useSyncStore();
  const [appReady, setAppReady] = React.useState(false);
  const notifCleanup = useRef<(() => void) | null>(null);
  const navRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    Promise.all([
      initDatabase(),
      loadSavedLocale(),
    ])
      .then(() => checkSession())
      .catch(() => checkSession())
      .finally(() => setAppReady(true));

    startListener();
    return () => stopListener();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotifications().then(token => {
      if (token) updatePushTokenApi(token).catch(() => {});
    });
    notifCleanup.current = addNotificationListener(
      (notification) => {
        // Notification reçue en foreground — ne rien faire, elle s'affiche déjà
      },
      (response) => {
        // L'utilisateur a tapé sur la notification — naviguer
        const data = response.notification.request.content.data as Record<string, string> | undefined;
        if (!data) return;
        const type = data.type;
        const refId = data.referenceId ?? data.missionId;
        try {
          if (refId && (
            type === 'NEW_MISSION' || type === 'DRIVER_ASSIGNED' ||
            type === 'TRANSIT_STARTED' || type === 'DELIVERED' ||
            type === 'PAYMENT_CONFIRMED' || type === 'MISSION_CREATED' ||
            type === 'MISSION_CANCELLED' || type === 'ROUTE_CHANGED' ||
            type === 'DRIVER_ARRIVED'
          )) {
            navRef.current?.navigate('MissionDetail', { missionId: refId });
          }
        } catch {}
      },
    );
    return () => { notifCleanup.current?.(); };
  }, [isAuthenticated]);

  if (!appReady) return <LoadingOverlay visible message="Chargement…" />;

  return (
    <NavigationContainer ref={navRef}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
