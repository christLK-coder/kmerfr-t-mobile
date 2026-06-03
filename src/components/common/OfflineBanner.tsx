import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSyncStore } from '../../store/syncStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing } = useSyncStore();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const slideAnim = useRef(new Animated.Value(-44)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline ? -44 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline]);

  const bgColor = isSyncing ? C.info : C.warning;
  const icon    = isSyncing ? 'sync' : 'wifi-off';
  const label   = isSyncing
    ? `${t('drive_syncing')} (${pendingCount})`
    : t('drive_offline');

  return (
    <Animated.View style={[s.banner, { backgroundColor: bgColor, transform: [{ translateY: slideAnim }] }]}>
      <MaterialCommunityIcons name={icon as any} size={16} color="#fff" />
      <Text style={s.txt}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8, paddingHorizontal: 16,
  },
  txt: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
