import React, { useCallback, useState } from 'react';
import {
  View, FlatList, StyleSheet, Alert, Pressable, RefreshControl,
} from 'react-native';
import { Text, Button, Chip, SegmentedButtons, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  OPEN: '#0277BD', ASSIGNED: '#F57F17', IN_TRANSIT: '#E65100',
  DELIVERED: '#2E7D32', CANCELLED: '#757575', DISPUTED: '#C62828',
};

export default function AdminOperationsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [tab, setTab] = useState('active');
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [disputes, setDisputes] = useState<AdminMission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [resolveLoading, setResolveLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const [activeRes, disputeRes] = await Promise.all([
        api.get<ApiResponse<AdminMission[]>>('/api/admin/missions?status=ALL'),
        api.get<ApiResponse<AdminMission[]>>('/api/admin/missions/disputed'),
      ]);
      const all = activeRes.data.data ?? [];
      setMissions(all.filter(m => ['OPEN', 'ASSIGNED', 'IN_TRANSIT'].includes(m.status)));
      setDisputes(disputeRes.data.data ?? []);
    } catch {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const resolveDispute = (missionId: string, resolution: string, label: string) => {
    Alert.alert('Confirmer', `${label} pour cette mission ?`, [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: 'Confirmer', onPress: async () => {
          setResolveLoading(missionId);
          try {
            await api.put(`/api/disputes/${missionId}/resolve?resolution=${resolution}`);
            if (resolution === 'RELEASE_DRIVER') {
              await api.post(`/api/payments/admin/mission/${missionId}/release`);
            }
            load();
          } catch (e) { Alert.alert('Erreur', (e as Error).message); }
          finally { setResolveLoading(null); }
        },
      },
    ]);
  };

  const data = tab === 'active' ? missions : disputes;

  const renderMission = ({ item }: { item: AdminMission }) => {
    const color = STATUS_COLORS[item.status] ?? C.textSecondary;
    const isDispute = item.status === 'DISPUTED';
    return (
      <Pressable
        style={[card.root, { backgroundColor: C.surface }]}
        onPress={() => nav.navigate('MissionDetail', { missionId: item.id })}
      >
        <View style={card.header}>
          <Chip compact style={{ backgroundColor: color + '22' }}
            textStyle={{ color, fontSize: 10, fontWeight: '700' }}>
            {item.status}
          </Chip>
          {item.missionType === 'EXPRESS' && (
            <Chip compact style={{ backgroundColor: '#FF6D0022' }}
              textStyle={{ color: '#E65100', fontSize: 10, fontWeight: '700' }}>
              EXPRESS
            </Chip>
          )}
        </View>

        <Text style={[card.route, { color: C.textPrimary }]} numberOfLines={1}>
          {item.originLabel} → {item.destinationLabel}
        </Text>

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

        {isDispute && (
          <View style={card.disputeActions}>
            <Button mode="contained" compact
              onPress={() => resolveDispute(item.id, 'RELEASE_DRIVER', 'Liberer fonds au chauffeur')}
              loading={resolveLoading === item.id}
              style={{ flex: 1, backgroundColor: C.success }} labelStyle={{ fontSize: 11 }}>
              Liberer → Chauffeur
            </Button>
            <Button mode="contained" compact
              onPress={() => resolveDispute(item.id, 'REFUND_CLIENT', 'Rembourser le client')}
              loading={resolveLoading === item.id}
              style={{ flex: 1, backgroundColor: C.warning }} labelStyle={{ fontSize: 11 }}>
              Rembourser client
            </Button>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: '#4A148C' }]}>
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.title}>{t('admin_operations')}</Text>
      </View>

      <View style={s.tabs}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'active', label: `Actives (${missions.length})`, icon: 'truck-fast' },
            { value: 'disputes', label: `Litiges (${disputes.length})`, icon: 'alert-circle' },
          ]}
          style={{ marginHorizontal: 16 }}
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
            <MaterialCommunityIcons name={tab === 'active' ? 'truck-check-outline' : 'shield-check-outline'}
              size={56} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>
              {tab === 'active' ? 'Aucune mission active' : 'Aucun litige ouvert'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const card = StyleSheet.create({
  root: { borderRadius: 14, padding: 14, marginHorizontal: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  header: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  route: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11 },
  disputeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
