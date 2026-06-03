import React, { useCallback, useState } from 'react';
import {
  View, FlatList, StyleSheet, Alert, Pressable, RefreshControl,
} from 'react-native';
import { Text, Button, Chip, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../../api/axios.config';
import type { ApiResponse } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface AdminMission {
  id: string;
  status: string;
  missionType: string;
  paymentStatus: string;
  originLabel: string;
  destinationLabel: string;
  cargoDescription: string;
  totalPrice: number;
  importerName?: string;
  driverName?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#00897B', ASSIGNED: '#F57F17', IN_TRANSIT: '#E65100',
  DELIVERED: '#2E7D32', CANCELLED: '#757575', DISPUTED: '#C62828',
};

const PAY_COLORS: Record<string, string> = {
  PENDING: '#F57F17', ESCROWED: '#00897B', RELEASED: '#2E7D32',
  REFUNDED: '#757575', DISPUTED: '#C62828',
};

export default function AdminOperationsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [tab, setTab] = useState('active');
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [disputes, setDisputes] = useState<AdminMission[]>([]);
  const [toRelease, setToRelease] = useState<AdminMission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get<ApiResponse<AdminMission[]>>('/api/admin/missions?status=ALL');
      const all = data.data ?? [];
      setMissions(all.filter(m => ['OPEN', 'ASSIGNED', 'IN_TRANSIT'].includes(m.status)));
      setDisputes(all.filter(m => m.status === 'DISPUTED'));
      setToRelease(all.filter(m =>
        m.status === 'DELIVERED' && m.paymentStatus !== 'RELEASED' && m.paymentStatus !== 'REFUNDED'
      ));
    } catch {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleRelease = (missionId: string) => {
    Alert.alert('Libérer les fonds', 'Transférer les fonds au chauffeur (après commission) ?', [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Libérer', onPress: async () => {
          setActionLoading(missionId);
          try {
            await api.post(`/api/payments/admin/mission/${missionId}/release`);
            Alert.alert('Fait', 'Fonds libérés au transporteur.');
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message ?? (e as Error).message);
          } finally { setActionLoading(null); }
        },
      },
    ]);
  };

  const resolveDispute = (missionId: string, resolution: string, label: string) => {
    Alert.alert('Confirmer', `${label} ?`, [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Confirmer', style: resolution.includes('REFUND') ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(missionId);
          try {
            await api.put(`/api/disputes/${missionId}/resolve?resolution=${resolution}`);
            Alert.alert('Fait', 'Litige résolu avec succès.');
            load();
          } catch (e: any) {
            Alert.alert('Erreur', e?.response?.data?.message ?? (e as Error).message);
          } finally { setActionLoading(null); }
        },
      },
    ]);
  };

  const handleRefund = (missionId: string) => {
    Alert.prompt?.(
      'Remboursement partiel',
      'Montant à rembourser au client (FCFA) :',
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: 'Rembourser', onPress: async (amount?: string) => {
            if (!amount || isNaN(Number(amount))) return;
            setActionLoading(missionId);
            try {
              await api.post(`/api/payments/admin/mission/${missionId}/refund`, {
                amount, reason: 'Remboursement partiel litige',
              });
              Alert.alert('Fait', 'Remboursement effectué.');
              load();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message ?? (e as Error).message);
            } finally { setActionLoading(null); }
          },
        },
      ],
      'plain-text',
      '',
      'numeric'
    ) ?? resolveDispute(missionId, 'REFUND_CLIENT', 'Rembourser intégralement le client');
  };

  const data =
    tab === 'active'   ? missions :
    tab === 'disputes' ? disputes :
    toRelease;

  const renderMission = ({ item }: { item: AdminMission }) => {
    const statusColor = STATUS_COLORS[item.status] ?? C.textSecondary;
    const payColor    = PAY_COLORS[item.paymentStatus] ?? C.textMuted;
    const isDispute   = item.status === 'DISPUTED';
    const isReleasable = item.status === 'DELIVERED' && item.paymentStatus !== 'RELEASED';
    const loading = actionLoading === item.id;

    return (
      <View style={[card.root, { backgroundColor: C.surface }]}>
        <View style={card.header}>
          <Chip compact style={{ backgroundColor: statusColor + '22' }}
            textStyle={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>
            {item.status}
          </Chip>
          <Chip compact style={{ backgroundColor: payColor + '22' }}
            textStyle={{ color: payColor, fontSize: 10, fontWeight: '700' }}>
            {item.paymentStatus}
          </Chip>
          {item.missionType === 'EXPRESS' && (
            <Chip compact style={{ backgroundColor: C.secondaryContainer }}
              textStyle={{ color: C.secondary, fontSize: 10, fontWeight: '700' }}>
              EXPRESS
            </Chip>
          )}
        </View>

        <Pressable onPress={() => nav.navigate('MissionDetail', { missionId: item.id })}>
          <Text style={[card.route, { color: C.textPrimary }]} numberOfLines={1}>
            {item.originLabel} → {item.destinationLabel}
          </Text>
        </Pressable>

        <View style={card.metaRow}>
          {item.importerName && (
            <View style={card.meta}>
              <MaterialCommunityIcons name="account-outline" size={14} color={C.textMuted} />
              <Text style={[card.metaTxt, { color: C.textSecondary }]}>{item.importerName}</Text>
            </View>
          )}
          {item.driverName && (
            <View style={card.meta}>
              <MaterialCommunityIcons name="truck-outline" size={14} color={C.textMuted} />
              <Text style={[card.metaTxt, { color: C.textSecondary }]}>{item.driverName}</Text>
            </View>
          )}
        </View>

        <View style={card.footer}>
          <Text style={[card.price, { color: C.primary }]}>
            {item.totalPrice?.toLocaleString('fr-FR')} FCFA
          </Text>
          <Text style={[card.date, { color: C.textMuted }]}>
            {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Actions LITIGE */}
        {isDispute && (
          <View style={card.actions}>
            <Button mode="contained" compact
              onPress={() => resolveDispute(item.id, 'RELEASE_DRIVER', 'Libérer fonds au chauffeur')}
              loading={loading} disabled={loading}
              style={{ flex: 1, backgroundColor: C.success }} labelStyle={{ fontSize: 11 }}>
              Libérer → Chauffeur
            </Button>
            <Button mode="contained" compact
              onPress={() => handleRefund(item.id)}
              loading={loading} disabled={loading}
              style={{ flex: 1, backgroundColor: C.warning }} labelStyle={{ fontSize: 11 }}>
              Rembourser client
            </Button>
          </View>
        )}

        {/* Actions LIBÉRATION SÉQUESTRE */}
        {isReleasable && !isDispute && (
          <View style={card.actions}>
            <Button mode="contained" compact
              onPress={() => handleRelease(item.id)}
              loading={loading} disabled={loading}
              style={{ flex: 1, backgroundColor: C.primary }}
              icon="lock-open-variant-outline" labelStyle={{ fontSize: 12 }}>
              Libérer le séquestre
            </Button>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient
        colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.title}>{t('admin_operations')}</Text>
      </LinearGradient>

      <View style={s.tabs}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'active',   label: `Actives (${missions.length})`,  icon: 'truck-fast' },
            { value: 'release',  label: `Séquestre (${toRelease.length})`, icon: 'lock-open-variant-outline' },
            { value: 'disputes', label: `Litiges (${disputes.length})`,  icon: 'alert-circle' },
          ]}
          style={{ marginHorizontal: 12 }}
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={i => i.id}
        renderItem={renderMission}
        contentContainerStyle={[s.list, data.length === 0 && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.center}>
            <MaterialCommunityIcons
              name={tab === 'disputes' ? 'shield-check-outline' : tab === 'release' ? 'lock-check-outline' : 'truck-check-outline'}
              size={56} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>
              {tab === 'disputes' ? 'Aucun litige ouvert' :
               tab === 'release'  ? 'Aucun séquestre en attente' :
               'Aucune mission active'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const card = StyleSheet.create({
  root: {
    borderRadius: 14, padding: 14, marginHorizontal: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  header: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  route: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { padding: 4 },
  title: { fontSize: 19, fontWeight: '700', color: '#fff' },
  tabs: { paddingVertical: 12 },
  list: { paddingVertical: 8 },
  listEmpty: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTxt: { fontSize: 15, marginTop: 14 },
});
