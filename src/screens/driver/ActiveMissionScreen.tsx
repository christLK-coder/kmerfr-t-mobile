// Écran mission active — GPS temps réel, compteur de chocs, bouton SOS
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  Alert,
  TouchableOpacity,
  Animated,
  ScrollView,
  Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TelemetryService from '../../services/TelemetryService';
import { useMissionStore } from '../../store/missionStore';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import type { HazardSeverity } from '../../types';

type Props = NativeStackScreenProps<MainStackParamList, 'ActiveMission'>;

const SEVERITY_COLOR: Record<HazardSeverity, string> = {
  LOW: '#4CAF50',
  MEDIUM: '#FF9800',
  HIGH: '#F44336',
  CRITICAL: '#B71C1C',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  unit,
  label,
  color,
  pulse,
}: {
  icon: string;
  value: string;
  unit: string;
  label: string;
  color: string;
  pulse?: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[sc.card, { transform: [{ scale: pulseAnim }] }]}>
      <View style={[sc.iconCircle, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon as never} size={22} color={color} />
      </View>
      <View style={sc.textBlock}>
        <View style={sc.valueRow}>
          <Text style={[sc.value, { color }]}>{value}</Text>
          <Text style={[sc.unit, { color }]}>{unit}</Text>
        </View>
        <Text style={sc.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  unit: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  label: { fontSize: 11, color: '#9E9E9E', fontWeight: '500', marginTop: 1 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ActiveMissionScreen({ route, navigation }: Props) {
  const { missionId, originLabel, destinationLabel } = route.params;
  const insets = useSafeAreaInsets();
  const { completeMission } = useMissionStore();

  const [tracking, setTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [shockCount, setShockCount] = useState(0);
  const [lastSeverity, setLastSeverity] = useState<HazardSeverity | null>(null);
  const [distressSent, setDistressSent] = useState(false);
  const [ending, setEnding] = useState(false);

  const shockFlash = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  // ─── Démarrage télémétrie ─────────────────────────────────────────────────

  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    TelemetryService.startTracking(missionId, {
      onHazard: (severity, _magnitude) => {
        setShockCount((n) => n + 1);
        setLastSeverity(severity);
        Vibration.vibrate(severity === 'CRITICAL' ? [0, 200, 100, 200] : 80);
        Animated.sequence([
          Animated.timing(shockFlash, { toValue: 1.3, duration: 120, useNativeDriver: true }),
          Animated.spring(shockFlash, { toValue: 1, useNativeDriver: true }),
        ]).start();
      },
      onPosition: (speed) => {
        setSpeedKmh(speed);
      },
    })
      .then(() => setTracking(true))
      .catch((e: Error) => setTrackingError(e.message));

    return () => {
      TelemetryService.stopTracking();
    };
  }, [missionId]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  function handleDistress() {
    Alert.alert(
      '🆘 Alerte de détresse',
      'Voulez-vous envoyer une alerte d\'urgence ? Votre position sera partagée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer l\'alerte',
          style: 'destructive',
          onPress: () => setDistressSent(true),
        },
      ]
    );
  }

  const handleOpenQR = useCallback(() => {
    navigation.navigate('QRScan', { missionId });
  }, [navigation, missionId]);

  async function handleEndMission() {
    Alert.alert(
      'Terminer la mission ?',
      'Confirmez uniquement si la livraison est effectuée via scan QR.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, scanner QR',
          onPress: handleOpenQR,
        },
      ]
    );
  }

  const speedColor = speedKmh != null && speedKmh > 0 ? '#0277BD' : '#9E9E9E';
  const shockColor = lastSeverity ? SEVERITY_COLOR[lastSeverity] : '#9E9E9E';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header gradient */}
      <LinearGradient
        colors={['#0D47A1', '#1565C0', '#1976D2']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Animated.View style={{ opacity: headerOpacity }}>
          <View style={styles.headerTop}>
            <View style={[styles.statusDot, tracking && styles.statusDotActive]} />
            <Text style={styles.statusText}>
              {tracking ? 'MISSION EN COURS' : 'Démarrage…'}
            </Text>
          </View>
          <Text style={styles.routeText} numberOfLines={1}>
            {originLabel}
          </Text>
          <View style={styles.arrowRow}>
            <MaterialCommunityIcons name="arrow-down" size={14} color="rgba(255,255,255,0.7)" />
          </View>
          <Text style={styles.routeText} numberOfLines={1}>
            {destinationLabel}
          </Text>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Erreur permission GPS */}
        {trackingError && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#B71C1C" />
            <Text style={styles.errorText}>{trackingError}</Text>
          </View>
        )}

        {/* Loading télémétrie */}
        {!tracking && !trackingError && (
          <View style={styles.startingRow}>
            <ActivityIndicator size="small" color="#1976D2" />
            <Text style={styles.startingText}>Démarrage du suivi GPS…</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              icon="speedometer"
              value={speedKmh != null ? Math.round(speedKmh).toString() : '--'}
              unit="km/h"
              label="Vitesse actuelle"
              color={speedColor}
            />
          </View>
          <View style={styles.statsRow}>
            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: shockFlash }] }]}>
              <StatCard
                icon="alert-octagon"
                value={shockCount.toString()}
                unit="choc{s}"
                label="Anomalies détectées"
                color={shockCount > 0 ? shockColor : '#9E9E9E'}
                pulse={shockCount > 0 && lastSeverity === 'CRITICAL'}
              />
            </Animated.View>
          </View>
        </View>

        {/* Dernier choc */}
        {lastSeverity && (
          <View style={[styles.lastShockBadge, { backgroundColor: `${SEVERITY_COLOR[lastSeverity]}18` }]}>
            <MaterialCommunityIcons
              name="alert"
              size={16}
              color={SEVERITY_COLOR[lastSeverity]}
            />
            <Text style={[styles.lastShockText, { color: SEVERITY_COLOR[lastSeverity] }]}>
              Dernier choc : sévérité {lastSeverity}
            </Text>
          </View>
        )}

        {/* Alerte détresse envoyée */}
        {distressSent && (
          <View style={styles.distressConfirm}>
            <MaterialCommunityIcons name="check-circle" size={18} color="#2E7D32" />
            <Text style={styles.distressConfirmText}>Alerte de détresse envoyée</Text>
          </View>
        )}

        {/* Bouton SOS */}
        <TouchableOpacity
          style={[styles.sosBtn, distressSent && styles.sosBtnSent]}
          onPress={handleDistress}
          disabled={distressSent}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={distressSent ? ['#4CAF50', '#388E3C'] : ['#B71C1C', '#C62828', '#D32F2F']}
            style={styles.sosBtnGradient}
          >
            <MaterialCommunityIcons
              name={distressSent ? 'check' : 'alert-octagram'}
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.sosBtnText}>
              {distressSent ? 'ALERTE ENVOYÉE' : 'SOS — DÉTRESSE'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Bouton QR / Fin de mission */}
        <TouchableOpacity
          style={styles.endBtn}
          onPress={handleEndMission}
          disabled={ending || !tracking}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="#FFFFFF" />
          <Text style={styles.endBtnText}>
            {ending ? 'Finalisation…' : 'Scanner QR — Livraison'}
          </Text>
          {ending && <ActivityIndicator size="small" color="#FFFFFF" style={{ marginLeft: 4 }} />}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  flex: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  statusDotActive: { backgroundColor: '#69F0AE' },
  statusText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  routeText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  arrowRow: { paddingVertical: 2 },

  content: { padding: 16, gap: 12 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  errorText: { fontSize: 13, color: '#B71C1C', flex: 1, lineHeight: 18 },

  startingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 12,
  },
  startingText: { fontSize: 13, color: '#1565C0' },

  statsGrid: { gap: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },

  lastShockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, padding: 10,
  },
  lastShockText: { fontSize: 13, fontWeight: '600' },

  distressConfirm: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10,
  },
  distressConfirmText: { fontSize: 13, color: '#2E7D32', fontWeight: '600' },

  sosBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#B71C1C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    marginTop: 8,
  },
  sosBtnSent: {
    shadowColor: '#2E7D32',
    elevation: 4,
  },
  sosBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  sosBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },

  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1B5E20',
    borderRadius: 14,
    paddingVertical: 16,
    elevation: 5,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
  },
  endBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
