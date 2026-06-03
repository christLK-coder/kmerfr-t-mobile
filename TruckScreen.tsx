// Gestion de la flotte — Ma Flotte (chauffeur) — Design V3
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, StatusBar, TouchableOpacity, FlatList,
  Modal, Alert, TextInput, ScrollView,
} from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import {
  getMyTrucksApi, createTruckApi, TruckDto, TruckType, CreateTruckPayload,
} from '../../api/trucks.api';
import dayjs from 'dayjs';

const TRUCK_TYPES: { value: TruckType; label: string; icon: string; desc: string }[] = [
  { value: 'FLATBED',      label: 'Plateau',       icon: 'truck',           desc: 'Transport general, vivres, bois' },
  { value: 'TANKER',       label: 'Citerne',       icon: 'tanker-truck',    desc: 'Liquides, huile de palme, eau' },
  { value: 'REFRIGERATED', label: 'Frigorifique',  icon: 'snowflake',       desc: 'Produits frais, poisson, viande' },
  { value: 'CONTAINER_20', label: 'Conteneur 20"', icon: 'package-variant', desc: 'Exportation port Douala/Kribi' },
  { value: 'CONTAINER_40', label: 'Conteneur 40"', icon: 'package-variant-closed', desc: 'Grande capacite export' },
  { value: 'TIPPER',       label: 'Benne',         icon: 'dump-truck',      desc: 'Granulats, sable, dechets agricoles' },
];

// ─── Carte camion ─────────────────────────────────────────────────────────────

function TruckCard({ truck, C }: { truck: TruckDto; C: ReturnType<typeof useColors> }) {
  const type = TRUCK_TYPES.find(tt => tt.value === truck.truckType);
  const daysLeft = truck.insuranceExpiry
    ? dayjs(truck.insuranceExpiry).diff(dayjs(), 'day')
    : null;
  const insuranceOk = daysLeft === null || daysLeft > 30;

  return (
    <View style={[styles.truckCard, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
      <View style={styles.truckCardBody}>
        <View style={styles.truckCardTop}>
          <View style={styles.plateWrap}>
            <View style={[styles.iconCircle, { backgroundColor: C.secondaryContainer }]}>
              <MaterialCommunityIcons name={(type?.icon as any) ?? 'truck'} size={22} color={C.secondary} />
            </View>
            <View>
              <Text style={[styles.plate, { color: C.textPrimary }]}>{truck.plateNumber}</Text>
              <Text style={[styles.truckModel, { color: C.textMuted }]}>
                {[truck.brand, truck.model].filter(Boolean).join(' ') || t('truck_brand')}
              </Text>
            </View>
          </View>
          {truck.docsVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: C.primaryContainer }]}>
              <MaterialCommunityIcons name="check-decagram" size={14} color={C.primary} />
            </View>
          )}
        </View>

        <View style={[styles.truckStats, { borderTopColor: C.outline }]}>
          <View style={styles.truckStat}>
            <Text style={[styles.truckStatVal, { color: C.textPrimary }]}>{truck.capacityTons}t</Text>
            <Text style={[styles.truckStatLabel, { color: C.textMuted }]}>{t('truck_capacity')}</Text>
          </View>
          <View style={[styles.truckStatDivider, { backgroundColor: C.outline }]} />
          <View style={styles.truckStat}>
            <Text style={[styles.truckStatVal, { color: C.textPrimary }]}>{type?.label ?? truck.truckType}</Text>
            <Text style={[styles.truckStatLabel, { color: C.textMuted }]}>{t('truck_type')}</Text>
          </View>
          <View style={[styles.truckStatDivider, { backgroundColor: C.outline }]} />
          <View style={styles.truckStat}>
            <Text style={[styles.truckStatVal, !insuranceOk ? { color: C.error } : { color: C.textPrimary }]}>
              {daysLeft !== null ? `${daysLeft}j` : '—'}
            </Text>
            <Text style={[styles.truckStatLabel, { color: C.textMuted }]}>{t('truck_insurance')}</Text>
          </View>
        </View>

        {!insuranceOk && daysLeft !== null && (
          <View style={[styles.insuranceWarn, { backgroundColor: C.warningContainer }]}>
            <MaterialCommunityIcons name="alert" size={14} color={C.warning} />
            <Text style={[styles.insuranceWarnText, { color: C.warning }]}>
              {t('truck_insurance_alert')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Modal ajout camion ───────────────────────────────────────────────────────

function AddTruckModal({
  visible, onClose, onSaved, C,
}: {
  visible: boolean; onClose: () => void; onSaved: () => void; C: ReturnType<typeof useColors>;
}) {
  const [plate,    setPlate]    = useState('');
  const [brand,    setBrand]    = useState('');
  const [model,    setModel]    = useState('');
  const [capacity, setCapacity] = useState('');
  const [type,     setType]     = useState<TruckType>('FLATBED');
  const [saving,   setSaving]   = useState(false);

  async function save() {
    if (!plate.trim() || !capacity) {
      Alert.alert(t('truck_plate'), t('truck_plate') + ' & ' + t('truck_capacity'));
      return;
    }
    setSaving(true);
    try {
      await createTruckApi({
        plateNumber: plate.trim().toUpperCase(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        capacityTons: parseFloat(capacity),
        truckType: type,
      });
      onSaved();
      onClose();
      setPlate(''); setBrand(''); setModel(''); setCapacity('');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: C.surface }]}>
          <View style={[styles.modalHandle, { backgroundColor: C.outline }]} />
          <Text style={[styles.modalTitle, { color: C.textPrimary }]}>{t('truck_add')}</Text>

          <Text style={[styles.modalFieldLabel, { color: C.textMuted }]}>{t('truck_plate')} *</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: C.outline, color: C.textPrimary, backgroundColor: C.surfaceVariant }]}
            value={plate} onChangeText={setPlate}
            placeholder="LT 1234 A" placeholderTextColor={C.textMuted}
            autoCapitalize="characters"
          />

          <Text style={[styles.modalFieldLabel, { color: C.textMuted }]}>{t('truck_brand')}</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: C.outline, color: C.textPrimary, backgroundColor: C.surfaceVariant }]}
            value={brand} onChangeText={setBrand}
            placeholder="Mercedes, Scania, MAN..." placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.modalFieldLabel, { color: C.textMuted }]}>{t('truck_model')}</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: C.outline, color: C.textPrimary, backgroundColor: C.surfaceVariant }]}
            value={model} onChangeText={setModel}
            placeholder="Actros, R450..." placeholderTextColor={C.textMuted}
          />

          <Text style={[styles.modalFieldLabel, { color: C.textMuted }]}>{t('truck_capacity')} *</Text>
          <TextInput
            style={[styles.modalInput, { borderColor: C.outline, color: C.textPrimary, backgroundColor: C.surfaceVariant }]}
            value={capacity} onChangeText={setCapacity}
            placeholder="10" placeholderTextColor={C.textMuted}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.modalFieldLabel, { color: C.textMuted }]}>{t('truck_type')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
            {TRUCK_TYPES.map(tt => (
              <TouchableOpacity
                key={tt.value}
                style={[
                  styles.typeChip,
                  { borderColor: C.outline, backgroundColor: C.surfaceVariant },
                  type === tt.value && { backgroundColor: C.secondary, borderColor: C.secondary },
                ]}
                onPress={() => setType(tt.value)}
              >
                <MaterialCommunityIcons
                  name={tt.icon as any} size={18}
                  color={type === tt.value ? C.onSecondary : C.secondary}
                />
                <Text style={[
                  styles.typeChipText,
                  { color: C.secondary },
                  type === tt.value && { color: C.onSecondary },
                ]}>
                  {tt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {TRUCK_TYPES.find(tt => tt.value === type) && (
            <Text style={[styles.typeDesc, { color: C.textSecondary }]}>
              {TRUCK_TYPES.find(tt => tt.value === type)!.desc}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: C.secondary, opacity: saving ? 0.7 : 1 }]}
            onPress={save} disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={C.onSecondary} />
              : <Text style={[styles.saveBtnText, { color: C.onSecondary }]}>{t('common_save')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: C.textMuted }]}>{t('common_cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TruckScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [trucks,  setTrucks]  = useState<TruckDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setTrucks(await getMyTrucksApi()); }
    catch { /* offline */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const renderTruck = ({ item }: { item: TruckDto }) => <TruckCard truck={item} C={C} />;

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[C.gradientDriverStart, C.gradientDriverEnd]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={C.onPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: C.onPrimary }]}>{t('truck_title')}</Text>
            <Text style={[styles.headerSub, { color: 'rgba(255,255,255,0.75)' }]}>
              {trucks.length} camion{trucks.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.secondary} />
        </View>
      ) : trucks.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="truck-outline" size={72} color={C.textMuted} />
          <Text style={[styles.emptyTitle, { color: C.textSecondary }]}>{t('truck_title')}</Text>
          <Text style={[styles.emptySub, { color: C.textMuted }]}>{t('truck_add')}</Text>
        </View>
      ) : (
        <FlatList
          data={trucks}
          keyExtractor={(item) => item.id}
          renderItem={renderTruck}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 20, backgroundColor: C.secondary }]}
        onPress={() => setShowAdd(true)}
        color={C.onSecondary}
        customSize={56}
      />

      <AddTruckModal visible={showAdd} onClose={() => setShowAdd(false)} onSaved={load} C={C} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 14 },

  truckCard: {
    borderRadius: 14, overflow: 'hidden',
    elevation: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    marginBottom: 12,
  },
  truckCardBody: { padding: 16, gap: 12 },
  truckCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plateWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  plate: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  truckModel: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  verifiedBadge: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  truckStats: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 12 },
  truckStat: { flex: 1, alignItems: 'center' },
  truckStatVal: { fontSize: 14, fontWeight: '800' },
  truckStatLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  truckStatDivider: { width: 1, height: 28 },
  insuranceWarn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, padding: 8,
  },
  insuranceWarnText: { fontSize: 12, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute', right: 20,
    elevation: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalFieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  modalInput: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  typeScroll: { flexGrow: 0 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, marginRight: 8,
  },
  typeChipText: { fontSize: 12, fontWeight: '700' },
  typeDesc: { fontSize: 12, fontStyle: 'italic' },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, elevation: 3 },
  saveBtnText: { fontWeight: '800', fontSize: 15 },
  cancelBtn: { alignItems: 'center', paddingVertical: 10 },
  cancelBtnText: { fontSize: 14, fontWeight: '600' },
});
