// Écran d'alerte SOS — bouton maintenu 3s, SMS chiffré, sauvegarde offline
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sendDistressAlert } from '../services/SmsAlertService';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useColors } from '../theme/theme';
import { t } from '../i18n';
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
  { type: 'ROUTE_CHANGE', label: 'Changement route', icon: 'road-variant',    color: '#00897B' },
] as const;

type AlertTypeValue = typeof ALERT_TYPES[number]['type'];

// ─── Anneau de progression ────────────────────────────────────────────────────

function SOSRing({ progress, color }: { progress: number; color: string }) {
  const size = 200;
  const strokeW = 8;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeW,
          borderColor: 'rgba(255,255,255,0.12)',
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
            borderColor: color,
            borderTopColor: progress < 0.5 ? `${color}44` : color,
            borderRightColor: progress < 0.75 ? `${color}44` : color,
            borderBottomColor: progress < 1 ? `${color}44` : color,
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
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

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
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
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

  const selectedTypeInfo = ALERT_TYPES.find(a => a.type === selectedType)!;

  return (
    <View style={[styles.root, { backgroundColor: C.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />

      {/* ─── Titre SOS ─── */}
      <View style={styles.titleArea}>
        <Text style={[styles.title, { color: C.textPrimary }]}>{t('sos_title')}</Text>
        <Text style={[styles.subtitle, { color: C.textMuted }]}>{t('sos_hold')}</Text>
      </View>

      {/* ─── Sélection type (idle only) ─── */}
      {status === 'idle' && (
        <View style={styles.typesRow}>
          {ALERT_TYPES.map((at) => {
            const active = selectedType === at.type;
            return (
              <TouchableOpacity
                key={at.type}
                style={[
                  styles.typeBtn,
                  { borderColor: C.outline, backgroundColor: C.surface },
                  active && { borderColor: at.color, backgroundColor: `${at.color}18` },
                ]}
                onPress={() => setSelectedType(at.type)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name={at.icon as any} size={16} color={active ? at.color : C.textMuted} />
                <Text style={[styles.typeBtnLabel, { color: active ? at.color : C.textSecondary }]}>
                  {at.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─── Zone bouton SOS centré ─── */}
      <View style={styles.sosArea}>
        {(status === 'idle' || status === 'holding') && (
          <>
            <SOSRing progress={holdProgress} color={C.error} />

            <Animated.View
              style={[
                styles.sosButtonWrapper,
                { transform: [{ scale: status === 'idle' ? pulseAnim : 1 }, { translateX: shakeAnim }] },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.sosButton,
                  { backgroundColor: C.error, shadowColor: C.error },
                  status === 'holding' && { backgroundColor: C.errorContainer },
                ]}
                onPressIn={startHold}
                onPressOut={cancelHold}
                activeOpacity={1}
              >
                <MaterialCommunityIcons
                  name={selectedTypeInfo.icon as any}
                  size={44}
                  color="#FFFFFF"
                />
                <Text style={styles.sosLabel}>SOS</Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={[styles.holdInstruction, { color: C.textMuted }]}>
              {status === 'holding'
                ? `${countdown}...`
                : t('sos_hold')}
            </Text>
          </>
        )}

        {status === 'sending' && (
          <View style={styles.centerColumn}>
            <ActivityIndicator size="large" color={C.error} />
            <Text style={[styles.sendingText, { color: C.textPrimary }]}>{t('sos_sending')}</Text>
          </View>
        )}

        {status === 'sent' && (
          <View style={styles.centerColumn}>
            <View style={[styles.sentIconBg, { backgroundColor: C.successContainer }]}>
              <MaterialCommunityIcons name="check-circle" size={64} color={C.success} />
            </View>
            <Text style={[styles.sentTitle, { color: C.textPrimary }]}>{t('sos_sent')}</Text>
            <Text style={[styles.sentSub, { color: C.textSecondary }]}>
              {result?.smsSent
                ? 'Le centre de contrôle a été alerté par SMS chiffré.'
                : t('sos_saved')}
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.centerColumn}>
            <MaterialCommunityIcons name="alert-circle" size={64} color={C.error} />
            <Text style={[styles.sentTitle, { color: C.textPrimary }]}>Erreur d'envoi</Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.error }]}
              onPress={handleReset}
            >
              <Text style={styles.actionBtnText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── Bouton Fermer en bas ─── */}
      {(status === 'sent' || status === 'error') && (
        <View style={[styles.bottomArea, { paddingBottom: insets.bottom + 24 }]}>
          {status === 'sent' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.primary }]}
              onPress={handleReset}
            >
              <Text style={styles.actionBtnText}>Nouvelle alerte</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: C.textMuted }]}>{t('common_close')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  titleArea: { alignItems: 'center', paddingTop: 32, paddingBottom: 8, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 14, fontWeight: '500' },

  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center' },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1.5,
  },
  typeBtnLabel: { fontSize: 12, fontWeight: '600' },

  sosArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },

  sosButtonWrapper: { position: 'absolute' },
  sosButton: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    elevation: 12,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 20,
  },
  sosLabel: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },

  holdInstruction: {
    position: 'absolute', bottom: 40,
    fontSize: 16, fontWeight: '700',
  },

  centerColumn: { alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  sendingText: { fontSize: 18, fontWeight: '700' },

  sentIconBg: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  sentTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  sentSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  bottomArea: { paddingHorizontal: 24, gap: 8, alignItems: 'center' },
  actionBtn: {
    borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  closeBtn: { paddingVertical: 12 },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
});
