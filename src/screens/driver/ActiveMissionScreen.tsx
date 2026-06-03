import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Alert, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import TelemetryService from '../../services/TelemetryService';
import WebSocketService from '../../services/WebSocketService';
import { getRoute, distanceBetween, formatDistance, formatDuration } from '../../services/RouteService';
import { notifyRouteChangeApi } from '../../api/missions.api';
import DriverNavigationMap, { type DriverMapHandle } from '../../components/map/DriverNavigationMap';
import { useMissionStore } from '../../store/missionStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { useLayout } from '../../hooks/useLayout';
import { t } from '../../i18n';
import { REROUTE_THRESHOLD_M, REROUTE_CHECK_MS } from '../../utils/constants';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import type { HazardSeverity } from '../../types';

type Props = NativeStackScreenProps<MainStackParamList, 'ActiveMission'>;

function StatItem({ icon, value, unit, label, color }: {
  icon: string; value: string; unit: string; label: string; color: string;
}) {
  return (
    <View style={s.statItem}>
      <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      <Text style={[s.statValue, { color }]}>
        {value}
        <Text style={s.statUnit}> {unit}</Text>
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function ActiveMissionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { userId } = useAuthStore();
  const { currentMission } = useMissionStore();
  const layout = useLayout();

  const mapRef = useRef<DriverMapHandle>(null);
  const rerouteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);

  const [speed, setSpeed] = useState(0);
  const [shocks, setShocks] = useState(0);
  const [lastSeverity, setLastSeverity] = useState<HazardSeverity | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [instruction, setInstruction] = useState('Navigation en cours…');
  const [isOnline, setIsOnline] = useState(true);

  const shockAnim = useRef(new Animated.Value(0)).current;
  const mission = currentMission;

  const destLat = mission?.destinationLat ?? 3.848;
  const destLng = (mission as any)?.destinationLng ?? 11.502;

  const SHOCK_COLORS: Record<HazardSeverity, string> = {
    LOW: '#4CAF50', MEDIUM: '#FF9800', HIGH: '#F44336', CRITICAL: '#B71C1C',
  };

  useEffect(() => {
    if (!mission) return;
    startTracking();
    initWebSocket();
    loadRoute(mission.originLat ?? null, mission.originLng ?? null);
    return () => {
      TelemetryService.stopTracking();
      if (rerouteTimer.current) clearTimeout(rerouteTimer.current);
    };
  }, []);

  const startTracking = () => {
    if (!mission) return;
    TelemetryService.startTracking(mission.id, {
      onHazard: (severity, _magnitude) => {
        setShocks(n => n + 1);
        setLastSeverity(severity);
        // Flash visible + vibration proportionnelle à la sévérité
        shockAnim.setValue(1);
        const flashDuration = severity === 'CRITICAL' ? 1400 : severity === 'HIGH' ? 1100 : 800;
        Animated.timing(shockAnim, { toValue: 0, duration: flashDuration, useNativeDriver: true }).start();
      },
      onPosition: (spd) => setSpeed(Math.round(spd ?? 0)),
    }).catch((e) => {
      console.warn('[Tracking] Erreur démarrage:', e?.message);
    });
  };

  const initWebSocket = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
      if (!token) return;
      if (!WebSocketService.isConnected) await WebSocketService.connect(token);
      setIsOnline(true);
    } catch { setIsOnline(false); }
  };

  const loadRoute = async (fromLat: number | null, fromLng: number | null) => {
    if (!mission) return;
    const oLat = fromLat ?? 3.848;
    const oLng = fromLng ?? 11.502;
    try {
      const route = await getRoute(oLat, oLng, destLat, destLng);
      routeCoordsRef.current = route.coordinates;
      setDistanceM(route.distanceM);
      setDurationS(route.durationS);
      mapRef.current?.updateRoute(route.coordinates);
      if (route.steps[0]) {
        setInstruction(route.steps[0].instruction);
        mapRef.current?.showInstruction(route.steps[0].instruction);
      }
    } catch {}
  };

  const checkReroute = useCallback((lat: number, lng: number) => {
    if (routeCoordsRef.current.length < 2) return;
    if (rerouteTimer.current) clearTimeout(rerouteTimer.current);
    rerouteTimer.current = setTimeout(() => {
      const minDist = routeCoordsRef.current.reduce((min, [lng2, lat2]) =>
        Math.min(min, distanceBetween(lat, lng, lat2, lng2)), Infinity);
      if (minDist > REROUTE_THRESHOLD_M) {
        setInstruction('Recalcul de l\'itinéraire…');
        loadRoute(lat, lng);
        if (mission?.id) notifyRouteChangeApi(mission.id).catch(() => {});
      }
    }, REROUTE_CHECK_MS);
  }, []);

  const handleSOS = () => {
    Alert.alert(t('sos_title'), t('sos_hold'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: 'Envoyer', style: 'destructive', onPress: () => navigation.navigate('Alert' as any) },
    ]);
  };

  const bgColor = isDark ? 'rgba(18,18,18,0.95)' : 'rgba(255,255,255,0.97)';
  const shockColor = lastSeverity ? SHOCK_COLORS[lastSeverity] : C.error;

  const renderPanel = () => (
    <>
      {/* Stats */}
      <View style={[s.statsBar, { backgroundColor: bgColor }, layout.isLandscape && { paddingVertical: 8 }]}>
        <StatItem icon="speedometer" value={String(speed)} unit="km/h" label={t('drive_speed')} color={C.primary} />
        <View style={[s.sep, { backgroundColor: C.outline }]} />
        <StatItem icon="map-marker-distance"
          value={distanceM ? formatDistance(distanceM) : '--'} unit="" label={t('drive_remaining')} color={C.info} />
        <View style={[s.sep, { backgroundColor: C.outline }]} />
        <StatItem icon="alert-circle" value={String(shocks)} unit=""
          label={t('drive_shocks')} color={shocks > 0 ? C.error : C.textSecondary} />
      </View>

      {/* Actions */}
      <View style={[s.actions, { paddingBottom: layout.isLandscape ? 8 : Math.max(insets.bottom, 14), backgroundColor: bgColor }]}>
        <Pressable style={[s.btn, s.sosBtn]} onPress={handleSOS}>
          <MaterialCommunityIcons name="phone-alert" size={20} color="#fff" />
          <Text style={s.sosTxt}>SOS</Text>
        </Pressable>
        <Pressable
          style={[s.btn, { backgroundColor: C.primaryContainer }]}
          onPress={() => navigation.navigate('Chat', {
            missionId: mission?.id ?? '',
            otherPartyName: mission?.importerName ?? 'Client',
          })}
        >
          <MaterialCommunityIcons name="message-outline" size={20} color={C.primary} />
          <Text style={[s.btnTxt, { color: C.primary }]}>Chat</Text>
        </Pressable>
        <Pressable style={[s.btn, { backgroundColor: C.primary }]}
          onPress={() => navigation.navigate('QRScan', { missionId: mission?.id ?? '' })}>
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="#fff" />
          <Text style={[s.btnTxt, { color: '#fff' }]}>QR</Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <View style={[s.root, layout.isLandscape && { flexDirection: 'row' }]}>
      {/* Carte — plein écran en portrait, moitié gauche en paysage */}
      <View style={layout.isLandscape ? { flex: 1 } : { flex: 1 }}>
        {/* Instruction */}
        <View style={[s.instrBar, { backgroundColor: isDark ? '#1E1E1E' : '#fff', top: insets.top + 8 }]}>
          <MaterialCommunityIcons name="navigation" size={20} color={C.primary} />
          <Text style={[s.instrTxt, { color: C.textPrimary }]} numberOfLines={2}>{instruction}</Text>
          {!isOnline && (
            <View style={[s.offBadge, { backgroundColor: C.warningContainer }]}>
              <Text style={[s.offTxt, { color: C.warning }]}>HORS LIGNE</Text>
            </View>
          )}
        </View>

        <DriverNavigationMap
          ref={mapRef}
          destLat={destLat}
          destLng={destLng}
          destLabel={mission?.destinationLabel ?? ''}
          originLat={mission?.originLat}
          originLng={mission?.originLng}
          routeCoords={routeCoordsRef.current}
        />

        <Animated.View style={[s.shockFlash, { backgroundColor: shockColor, opacity: shockAnim }]} pointerEvents="none" />

        {/* Stats + actions en bas en portrait uniquement */}
        {!layout.isLandscape && renderPanel()}
      </View>

      {/* Panel latéral en paysage */}
      {layout.isLandscape && (
        <View style={{ width: 220, justifyContent: 'flex-end' }}>
          {renderPanel()}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  instrBar: {
    position: 'absolute', left: 12, right: 12, zIndex: 100,
    borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  instrTxt: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  offBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  offTxt: { fontSize: 10, fontWeight: '700' },
  shockFlash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 },
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statUnit: { fontSize: 12, fontWeight: '400' },
  statLabel: { fontSize: 10, color: '#757575' },
  sep: { width: 1, height: 40, marginHorizontal: 8 },
  actions: { flexDirection: 'row', padding: 12, gap: 10, paddingTop: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 14 },
  sosBtn: { backgroundColor: '#C62828' },
  sosTxt: { fontSize: 14, fontWeight: '800', color: '#fff' },
  btnTxt: { fontSize: 13, fontWeight: '700' },
});
