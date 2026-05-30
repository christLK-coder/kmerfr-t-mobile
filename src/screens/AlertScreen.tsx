// Écran d'alerte SOS — bouton maintenu 3s, SMS chiffré, sauvegarde offline
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sendDistressAlert } from '../services/SmsAlertService';
import { useAuthStore } from '../store/authStore';
import type { MainStackParamList } from '../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'Alert'>;

const HOLD_DURATION_MS = 3000;
const TICK_INTERVAL_MS = 50;

type AlertStatus = 'idle' | 'holding' | 'sending' | 'sent' | 'error';

const ALERT_TYPES = [
  { type: 'DISTRESS',   label: 'Détresse',        icon: 'alert-octagon',      color: '#B71C1C' },
  { type: 'BREAKDOWN',  label: 'Panne',            icon: 'car-wrench',         color: '#E65100' },
  { type: 'ACCIDENT',   label: 'Accident',         icon: 'car-emergency',      color: '#B71C1C' },
  { type: 'DELAY',      label: 'Retard',           icon: 'clock-alert',        color: '#F57F17' },
  { type: 'ROUTE_CHANGE', label: 'Changement route', icon: 'road-variant',    color: '#0277BD' },
] as const;

type AlertTypeValue = typeof ALERT_TYPES[number]['type'];

// ─── Anneau de progression ────────────────────────────────────────────────────

function SOSRing({ progress }: { progress: number }) {
  const size = 200;
  const strokeW = 8;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * progress;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* SVG-like via border */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderColor: 'rgba(255,255,255,0.2)',
        }}
      />
      {progress > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeW,
            borderColor: '#FF5252',
            borderTopColor: progress < 0.5 ? 'rgba(255,82,82,0.3)' : '#FF5252',
            borderRightColor: progress < 0.75 ? 'rgba(255,82,82,0.3)' : '#FF5252',
            borderBottomColor: progress < 1 ? 'rgba(255,82,82,0.3)' : '#FF5252',
            transform: [{ rotate: '-90deg' }],
          }}
        />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AlertScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { userId } = useAuthStore();

  const missionId = route.params?.missionId;

  const [selectedType, setSelectedType] = useState<AlertTypeValue>('DISTRESS');
  const [status, setStatus] = useState<AlertStatus>('idle');
  const [holdProgress, setHoldProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [result, setResult] = useState<{ smsSent: boolean } | null>(null);

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsed = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Pulsation continue du bouton SOS quand idle
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const startHold = useCallback(() => {
    if (status !== 'idle') return;
    setStatus('holding');
    elapsed.current = 0;
    Vibration.vibrate(30);

    holdTimer.current = setInterval(() => {
      elapsed.current += TICK_INTERVAL_MS;
      const p = Math.min(elapsed.current / HOLD_DURATION_MS, 1);
      setHoldProgress(p);
      setCountdown(Math.ceil((HOLD_DURATION_MS - elapsed.current) / 1000));

      if (elapsed.current >= HOLD_DURATION_MS) {
        clearInterval(holdTimer.current!);
        holdTimer.current = null;
        triggerAlert();
      }
    }, TICK_INTERVAL_MS);
  }, [status]);

  const cancelHold = useCallback(() => {
    if (status !== 'holding') return;
    if (holdTimer.current) { clearInterval(holdTimer.current); holdTimer.current = null; }
    setStatus('idle');
    setHoldProgress(0);
    setCountdown(3);
    // Petit shake pour indiquer l'annulation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }, [status]);

  async function triggerAlert() {
    setStatus('sending');
    setHoldProgress(1);
    Vibration.vibrate([0, 100, 50, 100, 50, 300]);
    try {
      const res = await sendDistressAlert({
        userId: userId ?? 'unknown',
        missionId,
        alertType: selectedType,
        message: `Alerte ${selectedType} depuis mission KmerFret`,
      });
      setResult({ smsSent: res.smsSent });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  }

  const handleReset = useCallback(() => {
    setStatus('idle');
    setHoldProgress(0);
    setCountdown(3);
    setResult(null);
  }, []);

  const selectedTypeInfo = ALERT_TYPES.find(t => t.type === selectedType)!;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Header ─── */}
      <LinearGradient
        colors={['#7B0000', '#B71C1C', '#D32F2F']}
        locations={[0, 0.5, 1]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="alert-octagon" size={28} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Alerte d'urgence</Text>
          <Text style={styles.headerSub}>Envoi SMS chiffré + sauvegarde hors-ligne</Text>
        </View>
      </LinearGradient>

      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {/* ─── Sélection type ─── */}
        {status === 'idle' && (
          <View style={styles.typesRow}>
            {ALERT_TYPES.map((at) => {
              const active = selectedType === at.type;
              return (
                <TouchableOpacity
                  key={at.type}
                  style={[styles.typeBtn, active && { borderColor: at.color, backgroundColor: `${at.color}18` }]}
                  onPress={() => setSelectedType(at.type)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name={at.icon as any} size={18} color={active ? at.color : '#9E9E9E'} />
                  <Text style={[styles.typeBtnLabel, active && { color: at.color }]}>{at.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ─── Zone bouton SOS ─── */}
        <View style={styles.sosArea}>
          {(status === 'idle' || status === 'holding') && (
            <>
              <SOSRing progress={holdProgress} />

              <Animated.View
                style={[
                  styles.sosButtonWrapper,
                  { transform: [{ scale: status === 'idle' ? pulseAnim : 1 }, { translateX: shakeAnim }] },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.sosButton,
                    status === 'holding' && styles.sosButtonActive,
                  ]}
                  onPressIn={startHold}
                  onPressOut={cancelHold}
                  activeOpacity={1}
                >
                  <MaterialCommunityIcons
                    name={selectedTypeInfo.icon as any}
                    size={48}
                    color="#FFFFFF"
                  />
                  <Text style={styles.sosLabel}>SOS</Text>
                  <Text style={styles.sosSubLabel}>{selectedTypeInfo.label}</Text>
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.holdInstruction}>
                {status === 'holding'
                  ? `Maintenir… ${countdown}s`
                  : 'Maintenez 3 secondes pour envoyer'}
              </Text>
            </>
          )}

          {status === 'sending' && (
            <View style={styles.sendingContainer}>
              <ActivityIndicator size="large" color="#B71C1C" />
              <Text style={styles.sendingText}>Envoi de l'alerte…</Text>
              <Text style={styles.sendingSub}>GPS + SMS chiffré en cours</Text>
            </View>
          )}

          {status === 'sent' && (
            <View style={styles.sentContainer}>
              <View style={[styles.sentIcon, { backgroundColor: result?.smsSent ? '#E8F5E9' : '#FFF8E1' }]}>
                <MaterialCommunityIcons
                  name={result?.smsSent ? 'check-circle' : 'cloud-check'}
                  size={56}
                  color={result?.smsSent ? '#2E7D32' : '#F57F17'}
                />
              </View>
              <Text style={styles.sentTitle}>
                {result?.smsSent ? 'SMS envoyé !' : 'Alerte sauvegardée'}
              </Text>
              <Text style={styles.sentSub}>
                {result?.smsSent
                  ? 'Le centre de contrôle KmerFret a été alerté par SMS chiffré.'
                  : 'Aucun réseau — l\'alerte sera synchronisée dès le retour de la connectivité.'}
              </Text>

              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Nouvelle alerte</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.closeBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.sentContainer}>
              <MaterialCommunityIcons name="alert-circle" size={56} color="#B71C1C" />
              <Text style={styles.sentTitle}>Erreur d'envoi</Text>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Text style={styles.resetBtnText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── Infos bas ─── */}
        {(status === 'idle' || status === 'holding') && (
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#0277BD" />
            <Text style={styles.infoText}>
              L'alerte contient votre position GPS et est chiffrée. Elle est aussi sauvegardée localement si vous êtes hors réseau.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0D' },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  headerContent: { gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.70)' },

  body: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 16 },

  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#333',
  },
  typeBtnLabel: { fontSize: 12, fontWeight: '600', color: '#9E9E9E' },

  sosArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20,
  },

  sosButtonWrapper: { position: 'absolute' },
  sosButton: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#B71C1C',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    elevation: 12,
    shadowColor: '#B71C1C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 20,
  },
  sosButtonActive: {
    backgroundColor: '#7B0000',
    shadowOpacity: 0.8,
  },
  sosLabel: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  sosSubLabel: { fontSize: 12, color: 'rgba(255,255,255,0.80)', fontWeight: '600' },

  holdInstruction: {
    position: 'absolute', bottom: -28,
    fontSize: 14, color: '#9E9E9E', fontWeight: '600',
  },

  sendingContainer: { alignItems: 'center', gap: 16 },
  sendingText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  sendingSub: { fontSize: 13, color: '#9E9E9E' },

  sentContainer: { alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  sentIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  sentSub: { fontSize: 14, color: '#BDBDBD', textAlign: 'center', lineHeight: 20 },
  resetBtn: {
    marginTop: 8, backgroundColor: '#B71C1C', borderRadius: 12,
    paddingHorizontal: 32, paddingVertical: 13,
  },
  resetBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  closeBtn: { paddingVertical: 10 },
  closeBtnText: { color: '#9E9E9E', fontSize: 14, fontWeight: '600' },

  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(2,119,189,0.12)', borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#0277BD',
  },
  infoText: { fontSize: 13, color: '#90CAF9', lineHeight: 18, flex: 1 },
});
