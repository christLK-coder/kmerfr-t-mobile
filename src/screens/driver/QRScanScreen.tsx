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
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'QRScan'>;

export default function QRScanScreen({ route, navigation }: Props) {
  const { missionId } = route.params;
  const insets = useSafeAreaInsets();
  const { completeMission } = useMissionStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [completing, setCompleting] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const frameScale = useRef(new Animated.Value(0.85)).current;

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
        await completeMission(missionId, data);
        Alert.alert(
          '✅ Livraison confirmée !',
          'La mission a été marquée comme livrée avec succès.',
          [{ text: 'OK', onPress: () => navigation.popToTop() }]
        );
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message ?? 'QR code invalide ou mission non trouvée.';
        Alert.alert('Erreur', msg, [
          { text: 'Réessayer', onPress: () => setScanned(false) },
          { text: 'Annuler', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setCompleting(false);
      }
    },
    [scanned, completing, missionId, completeMission, navigation]
  );

  // ─── Permission refusée ────────────────────────────────────────────────────

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar barStyle="dark-content" />
        <MaterialCommunityIcons name="camera-off" size={64} color="#9E9E9E" />
        <Text style={styles.permTitle}>Accès caméra requis</Text>
        <Text style={styles.permSub}>
          KmerFret a besoin d'accéder à votre caméra pour scanner le QR code de livraison.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Autoriser la caméra</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelLinkText}>Annuler</Text>
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
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />

      {/* Overlay sombre */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scanner la livraison</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Zone centrale — fenêtre transparente */}
        <View style={styles.scanArea}>
          {/* Masques sombres autour de la fenêtre */}
          <View style={styles.maskTop} />
          <View style={styles.maskMiddle}>
            <View style={styles.maskSide} />

            {/* Cadre de scan animé */}
            <Animated.View style={[styles.scanFrame, { transform: [{ scale: frameScale }] }]}>
              {/* Coins */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />

              {completing && (
                <View style={styles.completingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.completingText}>Validation…</Text>
                </View>
              )}
            </Animated.View>

            <View style={styles.maskSide} />
          </View>
          <View style={styles.maskBottom} />
        </View>

        {/* Instructions bas */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          <MaterialCommunityIcons name="qrcode-scan" size={20} color="rgba(255,255,255,0.80)" />
          <Text style={styles.footerText}>
            {scanned
              ? 'QR code détecté — traitement en cours…'
              : 'Placez le QR code de livraison dans le cadre'}
          </Text>
        </View>

      </Animated.View>
    </View>
  );
}

const FRAME = 240;
const CORNER = 28;
const THICKNESS = 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#212121', textAlign: 'center' },
  permSub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  permBtn: {
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  permBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  cancelLink: { marginTop: 4 },
  cancelLinkText: { color: '#9E9E9E', fontSize: 14 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  closeBtn: {
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
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: THICKNESS, borderLeftWidth: THICKNESS,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: THICKNESS, borderRightWidth: THICKNESS,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: THICKNESS, borderLeftWidth: THICKNESS,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: THICKNESS, borderRightWidth: THICKNESS,
    borderBottomRightRadius: 6,
  },

  completingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 2,
  },
  completingText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },

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
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    fontWeight: '500',
    flex: 1,
  },
});
