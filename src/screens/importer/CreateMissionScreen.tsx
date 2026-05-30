// Wizard 2 étapes — création d'une nouvelle mission de transport
import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useMissionStore } from '../../store/missionStore';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateMission'>;

// ─── Indicateur de progression ────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <View style={si.row}>
      {([1, 2] as const).map((n) => (
        <View key={n} style={si.stepWrapper}>
          <View style={[si.dot, step >= n && si.dotActive]}>
            {step > n ? (
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            ) : (
              <Text style={[si.dotText, step === n && si.dotTextActive]}>{n}</Text>
            )}
          </View>
          <Text style={[si.label, step === n && si.labelActive]}>
            {n === 1 ? 'Origine & Cargaison' : 'Destination & Tarif'}
          </Text>
        </View>
      ))}
      <View style={si.connector} />
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 16,
    left: '25%',
    right: '25%',
    height: 2,
    backgroundColor: '#E0E0E0',
    zIndex: -1,
  },
  stepWrapper: { alignItems: 'center', gap: 6, flex: 1 },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: '#1B5E20' },
  dotText: { fontSize: 13, fontWeight: '700', color: '#9E9E9E' },
  dotTextActive: { color: '#FFFFFF' },
  label: { fontSize: 11, color: '#9E9E9E', fontWeight: '500', textAlign: 'center' },
  labelActive: { color: '#1B5E20', fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateMissionScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { createMission, isLoading, error, clearError } = useMissionStore();

  const [step, setStep] = useState<1 | 2>(1);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Step 1
  const [originLabel, setOriginLabel] = useState('');
  const [originLat, setOriginLat] = useState('');
  const [originLng, setOriginLng] = useState('');
  const [cargoDescription, setCargoDescription] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Step 2
  const [destLabel, setDestLabel] = useState('');
  const [destLat, setDestLat] = useState('');
  const [destLng, setDestLng] = useState('');
  const [price, setPrice] = useState('');

  const [errs, setErrs] = useState<Record<string, string>>({});

  function clearFieldError(field: string) {
    setErrs((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  async function fillGPS() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation pour remplir automatiquement.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setOriginLat(loc.coords.latitude.toFixed(6));
      setOriginLng(loc.coords.longitude.toFixed(6));
    } catch {
      Alert.alert('Erreur GPS', 'Impossible de récupérer la position.');
    } finally {
      setGpsLoading(false);
    }
  }

  function animateSlide() {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -1, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }

  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (!originLabel.trim()) e.originLabel = 'Le lieu de départ est requis.';
    if (!cargoDescription.trim()) e.cargoDescription = 'La description de la cargaison est requise.';
    if (originLat && isNaN(parseFloat(originLat))) e.originLat = 'Latitude invalide.';
    if (originLng && isNaN(parseFloat(originLng))) e.originLng = 'Longitude invalide.';
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    if (!destLabel.trim()) e.destLabel = 'Le lieu de destination est requis.';
    if (destLat && isNaN(parseFloat(destLat))) e.destLat = 'Latitude invalide.';
    if (destLng && isNaN(parseFloat(destLng))) e.destLng = 'Longitude invalide.';
    if (price && isNaN(parseFloat(price))) e.price = 'Tarif invalide.';
    setErrs(e);
    return Object.keys(e).length === 0;
  }

  function goToStep2() {
    if (!validateStep1()) return;
    setStep(2);
    animateSlide();
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    clearError();
    try {
      await createMission({
        originLabel: originLabel.trim(),
        destinationLabel: destLabel.trim(),
        originLat: originLat ? parseFloat(originLat) : 0,
        originLng: originLng ? parseFloat(originLng) : 0,
        destLat: destLat ? parseFloat(destLat) : 0,
        destLng: destLng ? parseFloat(destLng) : 0,
        cargoDescription: cargoDescription.trim(),
        totalPrice: price ? parseFloat(price) : 0,
      });
      navigation.goBack();
    } catch {
      // error already set in store
    }
  }

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-30, 0, 30],
  });
  const opacity = slideAnim.interpolate({
    inputRange: [-1, -0.3, 0, 0.3, 1],
    outputRange: [0, 0.6, 1, 0.6, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LoadingOverlay visible={isLoading} message="Création en cours…" />

      {/* Header */}
      <LinearGradient
        colors={['#1B5E20', '#388E3C']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => (step === 2 ? (setStep(1), animateSlide()) : navigation.goBack())}
            style={styles.backBtn}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouvelle mission</Text>
          <View style={{ width: 38 }} />
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <StepIndicator step={step} />

          <Animated.View style={{ transform: [{ translateX }], opacity }}>

            {step === 1 ? (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Lieu de départ & Cargaison</Text>

                <AppInput
                  label="Ville / Lieu de départ *"
                  value={originLabel}
                  onChangeText={(t) => { setOriginLabel(t); clearFieldError('originLabel'); }}
                  icon="map-marker"
                  autoCapitalize="words"
                  placeholder="Ex: Douala, Port de Kribi…"
                  error={errs.originLabel}
                />

                <Text style={styles.coordsLabel}>Coordonnées GPS (optionnel)</Text>
                <View style={styles.coordsRow}>
                  <View style={styles.coordInput}>
                    <AppInput
                      label="Latitude"
                      value={originLat}
                      onChangeText={(t) => { setOriginLat(t); clearFieldError('originLat'); }}
                      keyboardType="numeric"
                      placeholder="4.0511"
                      error={errs.originLat}
                    />
                  </View>
                  <View style={styles.coordInput}>
                    <AppInput
                      label="Longitude"
                      value={originLng}
                      onChangeText={(t) => { setOriginLng(t); clearFieldError('originLng'); }}
                      keyboardType="numeric"
                      placeholder="9.7679"
                      error={errs.originLng}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.gpsBtn}
                  onPress={fillGPS}
                  disabled={gpsLoading}
                >
                  <MaterialCommunityIcons
                    name={gpsLoading ? 'loading' : 'crosshairs-gps'}
                    size={16}
                    color="#1B5E20"
                  />
                  <Text style={styles.gpsBtnText}>
                    {gpsLoading ? 'Localisation…' : 'Utiliser ma position GPS'}
                  </Text>
                </TouchableOpacity>

                <AppInput
                  label="Description de la cargaison *"
                  value={cargoDescription}
                  onChangeText={(t) => { setCargoDescription(t); clearFieldError('cargoDescription'); }}
                  icon="package-variant"
                  multiline
                  numberOfLines={3}
                  placeholder="Ex: 500 sacs de ciment, 2 tonnes…"
                  autoCapitalize="sentences"
                  error={errs.cargoDescription}
                />

                <AppButton label="Suivant →" onPress={goToStep2} icon="arrow-right" style={styles.actionBtn} />
              </View>
            ) : (
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Destination & Tarif</Text>

                <AppInput
                  label="Ville / Lieu de destination *"
                  value={destLabel}
                  onChangeText={(t) => { setDestLabel(t); clearFieldError('destLabel'); }}
                  icon="map-marker-check"
                  autoCapitalize="words"
                  placeholder="Ex: Yaoundé, Bafoussam…"
                  error={errs.destLabel}
                />

                <Text style={styles.coordsLabel}>Coordonnées GPS destination (optionnel)</Text>
                <View style={styles.coordsRow}>
                  <View style={styles.coordInput}>
                    <AppInput
                      label="Latitude"
                      value={destLat}
                      onChangeText={(t) => { setDestLat(t); clearFieldError('destLat'); }}
                      keyboardType="numeric"
                      placeholder="3.8480"
                      error={errs.destLat}
                    />
                  </View>
                  <View style={styles.coordInput}>
                    <AppInput
                      label="Longitude"
                      value={destLng}
                      onChangeText={(t) => { setDestLng(t); clearFieldError('destLng'); }}
                      keyboardType="numeric"
                      placeholder="11.5021"
                      error={errs.destLng}
                    />
                  </View>
                </View>

                <AppInput
                  label="Tarif (FCFA) — optionnel"
                  value={price}
                  onChangeText={(t) => { setPrice(t); clearFieldError('price'); }}
                  icon="cash"
                  keyboardType="numeric"
                  placeholder="Ex: 150000"
                  error={errs.price}
                />

                {/* Récapitulatif */}
                <View style={styles.summary}>
                  <Text style={styles.summaryTitle}>📋 Récapitulatif</Text>
                  <View style={styles.summaryRow}>
                    <MaterialCommunityIcons name="map-marker" size={15} color="#1B5E20" />
                    <Text style={styles.summaryText}>{originLabel}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-down" size={15} color="#9E9E9E" style={{ marginLeft: 2 }} />
                  <View style={styles.summaryRow}>
                    <MaterialCommunityIcons name="map-marker-check" size={15} color="#E65100" />
                    <Text style={styles.summaryText}>
                      {destLabel.trim() || '(destination non renseignée)'}
                    </Text>
                  </View>
                  <Text style={styles.summaryCargo} numberOfLines={2}>📦 {cargoDescription}</Text>
                  {price ? <Text style={styles.summaryPrice}>💰 {parseFloat(price).toLocaleString()} FCFA</Text> : null}
                </View>

                {!!error && (
                  <HelperText type="error" visible style={styles.apiError}>{error}</HelperText>
                )}

                <AppButton
                  label="Créer la mission"
                  onPress={handleSubmit}
                  icon="check-circle"
                  loading={isLoading}
                  style={styles.actionBtn}
                />
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },

  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  form: { paddingHorizontal: 24, paddingTop: 28 },
  stepContent: { gap: 4 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1B5E20', marginBottom: 12, letterSpacing: 0.2 },

  coordsLabel: { fontSize: 12, color: '#9E9E9E', fontWeight: '500', marginTop: 8, marginBottom: 4, marginLeft: 4 },
  coordsRow: { flexDirection: 'row', gap: 10 },
  coordInput: { flex: 1 },

  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#A5D6A7', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 4, backgroundColor: '#F1F8E9',
  },
  gpsBtnText: { color: '#1B5E20', fontSize: 13, fontWeight: '600' },

  actionBtn: { marginTop: 20 },

  summary: {
    backgroundColor: '#F9FBE7',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCEDC8',
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#424242', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 14, fontWeight: '600', color: '#212121', flex: 1 },
  summaryCargo: { fontSize: 13, color: '#616161', paddingLeft: 4, marginTop: 4 },
  summaryPrice: { fontSize: 13, color: '#E65100', fontWeight: '700', paddingLeft: 4 },

  apiError: { fontSize: 13, textAlign: 'center', marginVertical: 4 },
});
