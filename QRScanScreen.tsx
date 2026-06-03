// Écran scan QR — confirmation de livraison via expo-camera
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMissionStore } from '../../store/missionStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'QRScan'>;

export default function QRScanScreen({ route, navigation }: Props) {
  const { missionId } = route.params;
  const insets = useSafeAreaInsets();
  const { completeMission } = useMissionStore();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const frameScale = useRef(new Animated.Value(0.85)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(frameScale, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scanned || completing) return;
      setScanned(true);
      setCompleting(true);

      try {
        await completeMission(missionId ?? '', data);
        setConfirmed(true);
        Animated.spring(checkScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
        setTimeout(() => {
          navigation.popToTop();
        }, 2000);
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? 'QR code invalide ou mission non trouvée.';
        Alert.alert('Erreur', msg, [
          { text: 'Réessayer', onPress: () => { setScanned(false); setConfirmed(false); } },
          { text: t('common_cancel'), onPress: () => navigation.goBack() },
        ]);
      } finally {
        setCompleting(false);
      }
    },
    [scanned, completing, missionId, completeMission, navigation]
  );

  // ─── Permission loading ────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  // ─── Permission refusée ────────────────────────────────────────────────────

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: C.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <MaterialCommunityIcons name="camera-off" size={64} color={C.textMuted} />
        <Text style={[styles.permTitle, { color: C.textPrimary }]}>Accès caméra requis</Text>
        <Text style={[styles.permSub, { color: C.textSecondary }]}>
          KmerFret a besoin d'accéder à votre caméra pour scanner le QR code de livraison.
        </Text>
        <TouchableOpacity style={[styles.permBtn, { backgroundColor: C.primary }]} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelLinkText, { color: C.textMuted }]}>{t('common_cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Scanner ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Camera plein écran */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay sombre */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scanner QR</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setFlashOn(!flashOn)}>
            <MaterialCommunityIcons
              name={flashOn ? 'flash' : 'flash-off'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        {/* Zone centrale — fenêtre transparente */}
        <View style={styles.scanArea}>
          <View style={styles.maskTop} />
          <View style={styles.maskMiddle}>
            <View style={styles.maskSide} />

            {/* Cadre de scan animé */}
            <Animated.View style={[styles.scanFrame, { transform: [{ scale: frameScale }] }]}>
              {/* Coins verts (C.primary) */}
              <View style={[styles.corner, styles.cornerTL, { borderColor: C.primary }]} />
              <View style={[styles.corner, styles.cornerTR, { borderColor: C.primary }]} />
              <View style={[styles.corner, styles.cornerBL, { borderColor: C.primary }]} />
              <View style={[styles.corner, styles.cornerBR, { borderColor: C.primary }]} />

              {/* During scan : spinner */}
              {completing && !confirmed && (
                <View style={styles.completingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.completingText}>Validation...</Text>
                </View>
              )}

              {/* After confirm : check */}
              {confirmed && (
                <Animated.View style={[styles.confirmedOverlay, { transform: [{ scale: checkScale }] }]}>
                  <MaterialCommunityIcons name="check-circle" size={72} color={C.primary} />
                  <Text style={[styles.confirmedText, { color: '#FFFFFF' }]}>Livraison confirmée !</Text>
                </Animated.View>
              )}
            </Animated.View>

            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskBottom} />
        </View>

        {/* Instructions bas */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.footerText}>
            {confirmed
              ? 'Livraison confirmée !'
              : scanned
                ? 'QR code détecté — traitement...'
                : 'Scannez le QR Code de livraison'}
          </Text>
        </View>

      </Animated.View>
    </View>
  );
}

const FRAME = 250;
const CORNER = 32;
const THICKNESS = 4;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  permTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  permBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancelLink: { marginTop: 8 },
  cancelLinkText: { fontSize: 14 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  scanArea: { flex: 1 },
  maskTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  maskMiddle: { height: FRAME, flexDirection: 'row' },
  maskSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  maskBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },

  scanFrame: {
    width: FRAME,
    height: FRAME,
    position: 'relative',
  },

  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: THICKNESS, borderRightWidth: THICKNESS,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS,
    borderBottomRightRadius: 8,
  },

  completingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 4,
  },
  completingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

  confirmedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 4,
  },
  confirmedText: { fontSize: 16, fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.90)',
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
  },
});
