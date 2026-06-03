import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, StatusBar, ScrollView, Animated, Switch,
  KeyboardAvoidingView, Platform, TouchableOpacity, Alert, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppInput }      from '../../components/common/AppInput';
import { AppButton }     from '../../components/common/AppButton';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { PlaceAutocomplete } from '../../components/common/PlaceAutocomplete';
import { useMissionStore } from '../../store/missionStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import { getRoute } from '../../services/RouteService';
import {
  PRICE_PER_TON_FCFA, EXPRESS_SURCHARGE_PCT,
  NORMAL_COMMISSION_PCT, EXPRESS_COMMISSION_PCT, FIRST_DEPOSIT_PCT,
} from '../../utils/constants';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Props = NativeStackScreenProps<MainStackParamList, 'CreateMission'>;

const CARGO_TYPES = [
  { value: 'GENERAL',    label: 'Vivres & Légumes', icon: 'food-apple',       color: '#2E7D32', bg: '#E8F5E9' },
  { value: 'PERISHABLE', label: 'Céréales & Grains', icon: 'barley',           color: '#F57F17', bg: '#FFF8E1' },
  { value: 'LIQUID',     label: 'Café / Cacao',      icon: 'coffee',           color: '#5D4037', bg: '#EFEBE9' },
  { value: 'CONTAINER',  label: 'Bétail',            icon: 'cow',              color: '#E65100', bg: '#FBE9E7' },
  { value: 'OVERSIZED',  label: 'Bois & Bois d\'œuvre', icon: 'tree',         color: '#6D4C41', bg: '#EFEBE9' },
  { value: 'DANGEROUS',  label: 'Engrais & Intrants', icon: 'flask',          color: '#BF360C', bg: '#FBE9E7' },
] as const;

type CargoTypeValue = typeof CARGO_TYPES[number]['value'];

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Lieux', 'Cargaison', 'Récapitulatif'];
  return (
    <View style={si.row}>
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const active = step === n;
        const done   = step > n;
        return (
          <View key={n} style={si.item}>
            <View style={[si.dot, done && si.dotDone, active && si.dotActive]}>
              {done
                ? <MaterialCommunityIcons name="check" size={13} color="#FFF" />
                : <Text style={[si.dotText, active && si.dotTextActive]}>{n}</Text>}
            </View>
            <Text style={[si.label, active && si.labelActive]}>{label}</Text>
            {n < 3 && <View style={[si.line, done && si.lineDone]} />}
          </View>
        );
      })}
    </View>
  );
}
const si = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 0, paddingVertical: 8 },
  item:         { alignItems: 'center', flex: 1, position: 'relative' },
  dot:          { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  dotActive:    { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  dotDone:      { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(255,255,255,0.9)' },
  dotText:      { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  dotTextActive:{ color: '#1B5E20' },
  label:        { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: '600', textAlign: 'center' },
  labelActive:  { color: '#FFFFFF', fontWeight: '800' },
  line:         { position: 'absolute', top: 14, left: '60%', right: '-60%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.25)', zIndex: -1 },
  lineDone:     { backgroundColor: 'rgba(255,255,255,0.8)' },
});

// ─── Cargo Selector ──────────────────────────────────────────────────────────

function CargoSelector({ selected, onSelect }: { selected: CargoTypeValue | null; onSelect: (v: CargoTypeValue) => void }) {
  return (
    <View style={css.cargoGrid}>
      {CARGO_TYPES.map(ct => {
        const active = selected === ct.value;
        return (
          <TouchableOpacity
            key={ct.value}
            style={[css.cargoItem, { backgroundColor: active ? ct.color : ct.bg, borderColor: active ? ct.color : 'transparent' }]}
            onPress={() => onSelect(ct.value)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name={ct.icon as any} size={28} color={active ? '#FFFFFF' : ct.color} />
            <Text style={[css.cargoLabel, { color: active ? '#FFFFFF' : ct.color }]}>{ct.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Date Picker Modal ───────────────────────────────────────────────────────

function DatePickerModal({ visible, selectedDate, onSelect, onClose }: {
  visible: boolean; selectedDate: Date; onSelect: (d: Date) => void; onClose: () => void;
}) {
  const [year, setYear] = useState(selectedDate.getFullYear());
  const [month, setMonth] = useState(selectedDate.getMonth());
  const [day, setDay] = useState(selectedDate.getDate());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days: number[] = [];
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const firstDow = new Date(year, month, 1).getDay();
  const blanks: null[] = Array(firstDow === 0 ? 6 : firstDow - 1).fill(null);

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const isDisabled = (d: number) => {
    const date = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    return date < today;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={dp.overlay}>
        <View style={dp.container}>
          <View style={dp.header}>
            <TouchableOpacity onPress={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
              <MaterialCommunityIcons name="chevron-left" size={28} color="#1B5E20" />
            </TouchableOpacity>
            <Text style={dp.monthYear}>{monthNames[month]} {year}</Text>
            <TouchableOpacity onPress={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
              <MaterialCommunityIcons name="chevron-right" size={28} color="#1B5E20" />
            </TouchableOpacity>
          </View>
          <View style={dp.dowRow}>
            {['Lu','Ma','Me','Je','Ve','Sa','Di'].map(d => (
              <Text key={d} style={dp.dow}>{d}</Text>
            ))}
          </View>
          <View style={dp.grid}>
            {blanks.map((_, i) => <View key={`b${i}`} style={dp.cell} />)}
            {days.map(d => {
              const sel = d === day;
              const dis = isDisabled(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[dp.cell, sel && dp.cellSel, dis && dp.cellDis]}
                  onPress={() => { if (!dis) setDay(d); }}
                  disabled={dis}
                >
                  <Text style={[dp.cellText, sel && dp.cellTextSel, dis && dp.cellTextDis]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={dp.footer}>
            <TouchableOpacity onPress={onClose} style={dp.cancelBtn}>
              <Text style={dp.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSelect(new Date(year, month, day, 8, 0, 0))}
              style={dp.okBtn}
            >
              <Text style={dp.okText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const dp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  monthYear: { fontSize: 16, fontWeight: '800', color: '#1B5E20' },
  dowRow: { flexDirection: 'row', marginBottom: 8 },
  dow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#9E9E9E' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100/7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSel: { backgroundColor: '#1B5E20', borderRadius: 20 },
  cellDis: { opacity: 0.3 },
  cellText: { fontSize: 14, fontWeight: '500', color: '#212121' },
  cellTextSel: { color: '#fff', fontWeight: '700' },
  cellTextDis: { color: '#BDBDBD' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  cancelText: { fontSize: 14, color: '#757575', fontWeight: '600' },
  okBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#1B5E20' },
  okText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CreateMissionScreen({ navigation }: Props) {
  const insets   = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { createMission, isLoading, error, clearError } = useMissionStore();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  // Étape 1 — Lieux
  const [originLabel, setOriginLabel]   = useState('');
  const [originLat,   setOriginLat]     = useState(0);
  const [originLng,   setOriginLng]     = useState(0);
  const [destLabel,   setDestLabel]     = useState('');
  const [destLat,     setDestLat]       = useState(0);
  const [destLng,     setDestLng]       = useState(0);

  // Étape 2 — Cargaison
  const [cargoType,     setCargoType]     = useState<CargoTypeValue | null>(null);
  const [cargoDesc,     setCargoDesc]     = useState('');
  const [cargoWeight,   setCargoWeight]   = useState('');
  const [cargoVolume,   setCargoVolume]   = useState('');
  const [cargoValue,    setCargoValue]    = useState('');
  const [isFragile,     setIsFragile]     = useState(false);
  const [specialInst,   setSpecialInst]   = useState('');

  // Étape 3 — Récapitulatif
  const [missionType,   setMissionType] = useState<'NORMAL' | 'EXPRESS'>('NORMAL');
  const [pickupDate,    setPickupDate]  = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [distanceKm,    setDistanceKm]  = useState<number | null>(null);
  const [routeLoading,  setRouteLoading] = useState(false);

  async function useCurrentLocation(target: 'origin' | 'dest') {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission refusée', 'Activez la localisation'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = [place.street, place.city, place.region].filter(Boolean).join(', ');
      if (target === 'origin') {
        setOriginLat(latitude); setOriginLng(longitude);
        setOriginLabel(label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } else {
        setDestLat(latitude); setDestLng(longitude);
        setDestLabel(label || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch { Alert.alert('Erreur', 'Impossible de récupérer la position'); }
  }

  // ─── Calcul du prix ────────────────────────────────────────────────────────

  const weight = parseFloat(cargoWeight) || 0;
  const distFactor = distanceKm ? Math.max(1, distanceKm / 100) : 1;
  const basePrice = Math.round(weight * PRICE_PER_TON_FCFA * distFactor);
  const expressExtra = missionType === 'EXPRESS' ? Math.round(basePrice * EXPRESS_SURCHARGE_PCT) : 0;
  const totalPrice = basePrice + expressExtra;
  const commRate = missionType === 'EXPRESS' ? EXPRESS_COMMISSION_PCT : NORMAL_COMMISSION_PCT;
  const commission = Math.round(totalPrice * commRate);
  const driverPayout = totalPrice - commission;
  const firstDeposit = Math.round(totalPrice * FIRST_DEPOSIT_PCT);

  // ─── Calcul distance via OSRM quand on passe à l'étape 2 ──────────────────

  async function computeDistance() {
    if (!originLat || !destLat) return;
    setRouteLoading(true);
    try {
      const result = await getRoute(originLat, originLng, destLat, destLng);
      setDistanceKm(Math.round(result.distanceM / 1000));
    } catch {
      setDistanceKm(null);
    } finally {
      setRouteLoading(false);
    }
  }

  // ─── Validations ───────────────────────────────────────────────────────────

  function validateStep1() {
    const e: Record<string, string> = {};
    if (!originLabel.trim()) e.originLabel = 'Lieu d\'origine requis';
    if (!destLabel.trim())   e.destLabel   = 'Lieu de destination requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2() {
    const e: Record<string, string> = {};
    if (!cargoType)              e.cargoType   = 'Sélectionnez un type de marchandise';
    if (!cargoDesc.trim())       e.cargoDesc   = 'Description requise';
    if (!cargoWeight || isNaN(parseFloat(cargoWeight))) e.cargoWeight = 'Poids invalide';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 1) computeDistance();
    Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(() => {
      setStep(s => (s < 3 ? s + 1 : s) as any);
      slideAnim.setValue(0);
    });
  }

  function goBack() {
    setStep(s => (s > 1 ? s - 1 : s) as any);
  }

  async function handleSubmit() {
    if (totalPrice <= 0) {
      Alert.alert('Erreur', 'Le prix calculé est invalide. Vérifiez le poids et la distance.');
      return;
    }
    clearError();
    const extraNotes = [
      specialInst.trim(),
      isFragile ? 'FRAGILE' : '',
      cargoVolume ? `Volume: ${cargoVolume} m³` : '',
      cargoValue ? `Valeur déclarée: ${cargoValue} FCFA` : '',
    ].filter(Boolean).join(' | ');

    const payload: any = {
      originLabel:      originLabel.trim(),
      destinationLabel: destLabel.trim(),
      originLat:        originLat || 3.848,
      originLng:        originLng || 11.502,
      destinationLat:   destLat   || 3.848,
      destinationLng:   destLng   || 11.502,
      cargoDescription: cargoDesc.trim(),
      cargoWeightTons:  parseFloat(cargoWeight),
      cargoType:        cargoType ?? 'GENERAL',
      totalPrice,
      missionType,
    };
    if (extraNotes) payload.specialInstructions = extraNotes;
    if (pickupDate) payload.pickupScheduledAt = pickupDate.toISOString();

    try {
      await createMission(payload);
      navigation.goBack();
    } catch { /* error in store */ }
  }

  const cargoInfo = CARGO_TYPES.find(c => c.value === cargoType);

  return (
    <View style={[css.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LoadingOverlay visible={isLoading} message="Création de la mission…" />

      <LinearGradient
        colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[css.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={css.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={css.backBtn}>
            <MaterialCommunityIcons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={css.headerCenter}>
            <Text style={css.headerTitle}>Nouvelle mission</Text>
            <Text style={css.headerSub}>Transport agricole sécurisé</Text>
          </View>
          <View style={{ width: 38 }} />
        </View>
        <StepIndicator step={step} />
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[css.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >

          {/* ════ ÉTAPE 1 — Lieux ════ */}
          {step === 1 && (
            <Animated.View style={{ opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="map-marker-path" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Itinéraire de transport</Text>
                </View>

                {/* Origine */}
                <View style={css.locationBlock}>
                  <View style={[css.locationDot, { backgroundColor: '#1B5E20' }]} />
                  <View style={[css.locationInputs, { zIndex: 20 }]}>
                    <Text style={[css.locationLabel, { color: C.textMuted }]}>Point de chargement</Text>
                    <PlaceAutocomplete
                      label="Rechercher un lieu d'origine"
                      value={originLabel}
                      dotColor="#1B5E20"
                      error={errors.originLabel}
                      onChangeText={text => { setOriginLabel(text); setErrors(e => ({ ...e, originLabel: '' })); }}
                      onSelect={place => {
                        setOriginLabel(place.label);
                        setOriginLat(place.lat);
                        setOriginLng(place.lng);
                        setErrors(e => ({ ...e, originLabel: '' }));
                      }}
                    />
                    <TouchableOpacity style={css.gpsBtn} onPress={() => useCurrentLocation('origin')}>
                      <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#1B5E20" />
                      <Text style={css.gpsBtnText}>Ma position actuelle</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[css.routeLine, { backgroundColor: C.outline }]} />

                {/* Destination */}
                <View style={css.locationBlock}>
                  <View style={[css.locationDot, { backgroundColor: '#E65100' }]} />
                  <View style={[css.locationInputs, { zIndex: 10 }]}>
                    <Text style={[css.locationLabel, { color: C.textMuted }]}>Point de livraison</Text>
                    <PlaceAutocomplete
                      label="Rechercher un lieu de destination"
                      value={destLabel}
                      dotColor="#E65100"
                      error={errors.destLabel}
                      onChangeText={text => { setDestLabel(text); setErrors(e => ({ ...e, destLabel: '' })); }}
                      onSelect={place => {
                        setDestLabel(place.label);
                        setDestLat(place.lat);
                        setDestLng(place.lng);
                        setErrors(e => ({ ...e, destLabel: '' }));
                      }}
                    />
                    <TouchableOpacity style={css.gpsBtn} onPress={() => useCurrentLocation('dest')}>
                      <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#1B5E20" />
                      <Text style={css.gpsBtnText}>Ma position actuelle</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={[css.infoCard, { backgroundColor: C.successContainer, borderLeftColor: C.success }]}>
                <MaterialCommunityIcons name="shield-check" size={18} color={C.success} />
                <Text style={[css.infoText, { color: C.success }]}>
                  KmerFret surveille les nids-de-poule et vous alerte en temps réel pour protéger vos produits agricoles.
                </Text>
              </View>
            </Animated.View>
          )}

          {/* ════ ÉTAPE 2 — Cargaison ════ */}
          {step === 2 && (
            <View>
              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="package-variant" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Type de marchandise</Text>
                </View>
                <CargoSelector selected={cargoType} onSelect={ct => { setCargoType(ct); setErrors(e => ({ ...e, cargoType: '' })); }} />
                {!!errors.cargoType && <HelperText type="error">{errors.cargoType}</HelperText>}
              </View>

              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="clipboard-text" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Détails cargaison</Text>
                </View>
                <AppInput
                  label="Description (ex: 200 sacs de manioc frais)"
                  value={cargoDesc}
                  onChangeText={text => { setCargoDesc(text); setErrors(e => ({ ...e, cargoDesc: '' })); }}
                  error={errors.cargoDesc}
                  multiline
                />
                {!!errors.cargoDesc && <HelperText type="error">{errors.cargoDesc}</HelperText>}

                <View style={css.rowFields}>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Poids (tonnes)"
                      value={cargoWeight}
                      onChangeText={text => { setCargoWeight(text); setErrors(e => ({ ...e, cargoWeight: '' })); }}
                      keyboardType="numeric"
                      error={errors.cargoWeight}
                    />
                    {!!errors.cargoWeight && <HelperText type="error">{errors.cargoWeight}</HelperText>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppInput
                      label="Volume (m³)"
                      value={cargoVolume}
                      onChangeText={setCargoVolume}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <AppInput
                  label="Valeur déclarée (FCFA)"
                  value={cargoValue}
                  onChangeText={setCargoValue}
                  keyboardType="numeric"
                />

                {/* Toggle fragile */}
                <View style={[css.fragileRow, { backgroundColor: C.secondaryContainer }]}>
                  <MaterialCommunityIcons name="alert-decagram-outline" size={20} color={isFragile ? C.secondary : C.textMuted} />
                  <Text style={[css.fragileLabel, { color: C.textSecondary }, isFragile && { color: C.secondary, fontWeight: '700' }]}>
                    Marchandise fragile
                  </Text>
                  <Switch
                    value={isFragile}
                    onValueChange={setIsFragile}
                    trackColor={{ false: '#E0E0E0', true: '#FFCC80' }}
                    thumbColor={isFragile ? '#E65100' : '#BDBDBD'}
                  />
                </View>

                <AppInput
                  label="Remarques spéciales"
                  value={specialInst}
                  onChangeText={setSpecialInst}
                  multiline
                />

                {cargoInfo && (
                  <View style={[css.cargoTip, { borderLeftColor: cargoInfo.color, backgroundColor: cargoInfo.bg }]}>
                    <MaterialCommunityIcons name={cargoInfo.icon as any} size={16} color={cargoInfo.color} />
                    <Text style={[css.cargoTipText, { color: cargoInfo.color }]}>
                      {cargoType === 'PERISHABLE' && 'Produit périssable — précisez les conditions de conservation requises.'}
                      {cargoType === 'CONTAINER'  && 'Transport de bétail — eau et ventilation obligatoires en route.'}
                      {cargoType === 'DANGEROUS'  && 'Matières dangereuses — le chauffeur doit avoir le permis ADR.'}
                      {cargoType === 'GENERAL'    && 'Conditionnez bien pour éviter les dommages sur routes dégradées.'}
                      {cargoType === 'LIQUID'     && 'Café/cacao — indiquez le grade et la certification si applicable.'}
                      {cargoType === 'OVERSIZED'  && 'Bois — vérifiez les permis de transport forestier (MINFOF).'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ════ ÉTAPE 3 — Récapitulatif & Prix ════ */}
          {step === 3 && (
            <View>
              {/* Type de mission */}
              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="rocket-launch-outline" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Type de mission</Text>
                </View>
                <View style={css.missionTypeRow}>
                  <TouchableOpacity
                    style={[css.typeBtn, missionType === 'NORMAL' && css.typeBtnActive]}
                    onPress={() => setMissionType('NORMAL')}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="truck" size={24} color={missionType === 'NORMAL' ? '#fff' : '#1B5E20'} />
                    <Text style={[css.typeBtnLabel, missionType === 'NORMAL' && { color: '#fff' }]}>Standard</Text>
                    <Text style={[css.typeBtnSub, missionType === 'NORMAL' && { color: 'rgba(255,255,255,0.7)' }]}>
                      Commission {(NORMAL_COMMISSION_PCT * 100).toFixed(1)}%
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[css.typeBtn, css.typeBtnExpress, missionType === 'EXPRESS' && css.typeBtnExpressActive]}
                    onPress={() => setMissionType('EXPRESS')}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="lightning-bolt" size={24} color={missionType === 'EXPRESS' ? '#fff' : '#E65100'} />
                    <Text style={[css.typeBtnLabel, { color: '#E65100' }, missionType === 'EXPRESS' && { color: '#fff' }]}>Express</Text>
                    <Text style={[css.typeBtnSub, { color: '#BF360C' }, missionType === 'EXPRESS' && { color: 'rgba(255,255,255,0.7)' }]}>
                      +{(EXPRESS_SURCHARGE_PCT * 100)}% surcharge
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date de prise en charge */}
              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="calendar-clock" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Date de prise en charge</Text>
                </View>
                <TouchableOpacity
                  style={[css.datePickerBtn, { backgroundColor: C.surfaceVariant, borderColor: C.outline }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="calendar"
                    size={20}
                    color={pickupDate ? C.primary : C.textMuted}
                  />
                  <Text style={[css.datePickerText, { color: C.textMuted }, pickupDate && { color: C.textPrimary, fontWeight: '600' }]}>
                    {pickupDate
                      ? pickupDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Choisir une date'}
                  </Text>
                  {pickupDate && (
                    <TouchableOpacity onPress={() => setPickupDate(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <MaterialCommunityIcons name="close-circle" size={18} color="#9E9E9E" />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                <Text style={[css.dateHint, { color: C.textMuted }]}>
                  Laissez vide pour une prise en charge dès qu'un transporteur accepte.
                </Text>
                <DatePickerModal
                  visible={showDatePicker}
                  selectedDate={pickupDate ?? new Date()}
                  onSelect={(d) => { setPickupDate(d); setShowDatePicker(false); }}
                  onClose={() => setShowDatePicker(false)}
                />
              </View>

              {/* Récapitulatif de prix */}
              <View style={[css.summaryCard, { backgroundColor: C.surface, borderColor: C.successContainer }]}>
                <Text style={[css.summaryTitle, { color: C.primary }]}>Simulation de prix</Text>

                {distanceKm && (
                  <View style={css.summaryRow}>
                    <Text style={[css.summaryKey, { color: C.textSecondary }]}>Distance estimée</Text>
                    <Text style={css.summaryVal}>{distanceKm} km</Text>
                  </View>
                )}
                <View style={css.summaryRow}>
                  <Text style={css.summaryKey}>Poids</Text>
                  <Text style={css.summaryVal}>{weight || '—'} tonnes</Text>
                </View>

                {missionType === 'EXPRESS' && expressExtra > 0 && (
                  <>
                    <View style={css.summaryRow}>
                      <Text style={[css.summaryKey, { color: C.textSecondary }]}>Base</Text>
                      <Text style={css.summaryVal}>{basePrice.toLocaleString('fr-FR')} FCFA</Text>
                    </View>
                    <View style={css.summaryRow}>
                      <Text style={[css.summaryKey, { color: C.textSecondary }]}>Surcharge Express (+{EXPRESS_SURCHARGE_PCT * 100}%)</Text>
                      <Text style={[css.summaryVal, { color: '#E65100' }]}>+{expressExtra.toLocaleString('fr-FR')} FCFA</Text>
                    </View>
                  </>
                )}

                <View style={[css.summaryRow, css.summaryTotalRow, { borderTopColor: C.divider }]}>
                  <Text style={[css.summaryTotalKey, { color: C.primary }]}>Prix total</Text>
                  <Text style={[css.summaryTotalVal, { color: C.primary }]}>{totalPrice > 0 ? totalPrice.toLocaleString('fr-FR') : '—'} FCFA</Text>
                </View>

                <View style={css.summaryRow}>
                  <Text style={css.summaryKey}>1ère tranche (à l'acceptation)</Text>
                  <Text style={[css.summaryVal, { color: '#00897B', fontWeight: '800' }]}>
                    {firstDeposit > 0 ? firstDeposit.toLocaleString('fr-FR') : '—'} FCFA
                  </Text>
                </View>
                <View style={css.summaryRow}>
                  <Text style={css.summaryKey}>Commission KmerFret ({(commRate * 100).toFixed(1)}%)</Text>
                  <Text style={[css.summaryVal, { color: '#E65100' }]}>
                    -{commission > 0 ? commission.toLocaleString('fr-FR') : '0'} FCFA
                  </Text>
                </View>
                <View style={css.summaryRow}>
                  <Text style={css.summaryKey}>Payout transporteur</Text>
                  <Text style={css.summaryVal}>{driverPayout > 0 ? driverPayout.toLocaleString('fr-FR') : '—'} FCFA</Text>
                </View>

                <Text style={[css.escrowNote, { color: C.textMuted }]}>
                  Aucun paiement n'est prélevé maintenant. La 1ère tranche sera demandée quand un transporteur acceptera votre mission.
                </Text>
              </View>

              {/* Récap trajet */}
              <View style={[css.card, { backgroundColor: C.surface }]}>
                <View style={css.cardHeader}>
                  <MaterialCommunityIcons name="map-check-outline" size={22} color="#1B5E20" />
                  <Text style={[css.cardTitle, { color: C.textPrimary }]}>Résumé de la mission</Text>
                </View>
                <View style={css.recapRow}>
                  <MaterialCommunityIcons name="map-marker" size={16} color="#1B5E20" />
                  <Text style={[css.recapText, { color: C.textSecondary }]}>{originLabel || '—'}</Text>
                </View>
                <View style={css.recapRow}>
                  <MaterialCommunityIcons name="map-marker-check" size={16} color="#E65100" />
                  <Text style={[css.recapText, { color: C.textSecondary }]}>{destLabel || '—'}</Text>
                </View>
                <View style={css.recapRow}>
                  <MaterialCommunityIcons name="package-variant" size={16} color="#5D4037" />
                  <Text style={[css.recapText, { color: C.textSecondary }]}>{cargoDesc || '—'} ({weight} T)</Text>
                </View>
                {isFragile && (
                  <View style={css.recapRow}>
                    <MaterialCommunityIcons name="alert-decagram" size={16} color="#E65100" />
                    <Text style={[css.recapText, { color: '#E65100', fontWeight: '600' }]}>Marchandise fragile</Text>
                  </View>
                )}
              </View>

              {(error) && (
                <View style={[css.errorCard, { backgroundColor: C.errorContainer }]}>
                  <MaterialCommunityIcons name="alert-circle" size={18} color={C.error} />
                  <Text style={[css.errorText, { color: C.error }]}>{error}</Text>
                </View>
              )}
            </View>
          )}

          {/* ─── Navigation ─── */}
          <View style={css.navRow}>
            {step > 1 && (
              <TouchableOpacity style={[css.backNavBtn, { borderColor: C.primary }]} onPress={goBack}>
                <MaterialCommunityIcons name="arrow-left" size={18} color={C.primary} />
                <Text style={[css.backNavText, { color: C.primary }]}>Retour</Text>
              </TouchableOpacity>
            )}
            {step < 3 ? (
              <AppButton
                label="Étape suivante"
                onPress={goNext}
                style={step === 1 ? { ...css.nextBtn, flex: 1 } : css.nextBtn}
                fullWidth={false}
              />
            ) : (
              <AppButton
                label="Créer la mission"
                onPress={handleSubmit}
                loading={isLoading}
                style={css.nextBtn}
                icon="check"
                fullWidth={false}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const css = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  content: { padding: 16, gap: 14 },
  card: {
    borderRadius: 18, padding: 18, gap: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  locationBlock: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  locationDot: { width: 14, height: 14, borderRadius: 7, marginTop: 18, flexShrink: 0 },
  locationInputs: { flex: 1, gap: 8 },
  locationLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeLine: { width: 2, height: 16, marginLeft: 20, borderRadius: 1 },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  gpsBtnText: { fontSize: 12, color: '#1B5E20', fontWeight: '600' },
  cargoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cargoItem: { width: '47%', borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 2 },
  cargoLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  cargoTip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderLeftWidth: 3, borderRadius: 8, padding: 10, marginTop: 4,
  },
  cargoTipText: { fontSize: 12, lineHeight: 16, flex: 1, fontWeight: '500' },
  rowFields: { flexDirection: 'row', gap: 10 },
  fragileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 10, padding: 12,
  },
  fragileLabel: { flex: 1, fontSize: 13 },
  missionTypeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, borderRadius: 14, padding: 16, alignItems: 'center', gap: 6,
    borderWidth: 2, borderColor: '#1B5E20', backgroundColor: '#E8F5E9',
  },
  typeBtnActive: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  typeBtnExpress: { borderColor: '#E65100', backgroundColor: '#FBE9E7' },
  typeBtnExpressActive: { backgroundColor: '#E65100', borderColor: '#E65100' },
  typeBtnLabel: { fontSize: 14, fontWeight: '800', color: '#1B5E20' },
  typeBtnSub: { fontSize: 10, color: '#4CAF50' },
  datePickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  datePickerText: { flex: 1, fontSize: 14 },
  dateHint: { fontSize: 11, fontStyle: 'italic' },
  summaryCard: {
    borderRadius: 16, padding: 16, gap: 10,
    elevation: 2, borderWidth: 1,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryKey: { fontSize: 13, flex: 1 },
  summaryVal: { fontSize: 13, fontWeight: '700' },
  summaryTotalRow: { borderTopWidth: 1, paddingTop: 10 },
  summaryTotalKey: { fontSize: 14, fontWeight: '800' },
  summaryTotalVal: { fontSize: 18, fontWeight: '900' },
  escrowNote: { fontSize: 11, fontStyle: 'italic', lineHeight: 16 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recapText: { fontSize: 13, flex: 1 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, padding: 12, borderLeftWidth: 3,
  },
  infoText: { fontSize: 12, lineHeight: 17, flex: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  errorText: { fontSize: 13, flex: 1 },
  navRow: { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' },
  backNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5 },
  backNavText: { fontSize: 14, fontWeight: '600' },
  nextBtn: { flex: 1, borderRadius: 12 },
});
