import React, { useCallback, useState } from 'react';
import {
  View, FlatList, StyleSheet, Alert, Pressable, RefreshControl,
} from 'react-native';
import { Text, Button, Chip, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { api } from '../../api/axios.config';
import type { ApiResponse } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  accountStatus: string;
  isActive: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#2E7D32',
  SUSPENDED: '#C62828',
  PENDING_APPROVAL: '#F57F17',
};

export default function AdminAccountsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [tab, setTab] = useState('DRIVER');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get<ApiResponse<AdminUser[]>>(`/api/admin/users?role=${tab}`);
      setUsers(data.data ?? []);
    } catch {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [tab]));

  const toggleAccount = (user: AdminUser) => {
    const isSuspend = user.accountStatus === 'ACTIVE';
    const action = isSuspend ? 'suspend' : 'reactivate';
    const label = isSuspend ? 'Suspendre' : 'Reactiver';

    Alert.alert(label, `${label} le compte de ${user.fullName} ?`, [
      { text: t('common_cancel'), style: 'cancel' },
      {
        text: label, style: isSuspend ? 'destructive' : 'default',
        onPress: async () => {
          setActionLoading(user.id);
          try {
            await api.put(`/api/admin/users/${user.id}/${action}`);
            load();
          } catch (e) { Alert.alert('Erreur', (e as Error).message); }
          finally { setActionLoading(null); }
        },
      },
    ]);
  };

  const renderUser = ({ item }: { item: AdminUser }) => {
    const statusColor = STATUS_COLORS[item.accountStatus] ?? C.textSecondary;
    const isDriver = item.role === 'DRIVER';
    return (
      <View style={[card.root, { backgroundColor: C.surface }]}>
        <View style={card.row}>
          <View style={[card.avatar, { backgroundColor: isDriver ? '#0277BD18' : '#1B5E2018' }]}>
            <MaterialCommunityIcons
              name={isDriver ? 'truck-outline' : 'account-outline'}
              size={22}
              color={isDriver ? '#0277BD' : '#1B5E20'}
            />
          </View>
          <View style={card.info}>
            <Text style={[card.name, { color: C.textPrimary }]}>{item.fullName}</Text>
            <Text style={[card.email, { color: C.textSecondary }]}>{item.email}</Text>
            <Text style={[card.phone, { color: C.textMuted }]}>{item.phone}</Text>
          </View>
          <Chip compact style={{ backgroundColor: statusColor + '22' }}
            textStyle={{ color: statusColor, fontSize: 10, fontWeight: '700' }}>
            {item.accountStatus}
          </Chip>
        </View>

        <View style={card.footer}>
          <Text style={[card.date, { color: C.textMuted }]}>
            Inscrit le {new Date(item.createdAt).toLocaleDateString('fr-FR')}
          </Text>
          <Button
            mode={item.accountStatus === 'ACTIVE' ? 'outlined' : 'contained'}
            compact
            onPress={() => toggleAccount(item)}
            loading={actionLoading === item.id}
            style={item.accountStatus === 'ACTIVE'
              ? { borderColor: C.error }
              : { backgroundColor: C.success }}
            textColor={item.accountStatus === 'ACTIVE' ? C.error : '#fff'}
            labelStyle={{ fontSize: 11 }}
          >
            {item.accountStatus === 'ACTIVE' ? 'Suspendre' : 'Reactiver'}
          </Button>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: '#4A148C' }]}>
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.title}>Gestion des comptes</Text>
      </View>

      <View style={s.tabs}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'DRIVER', label: 'Chauffeurs', icon: 'truck' },
            { value: 'IMPORTER', label: 'Clients', icon: 'account-group' },
          ]}
          style={{ marginHorizontal: 16 }}
        />
      </View>

      <FlatList
        data={users}
        keyExtractor={i => i.id}
        renderItem={renderUser}
        contentContainerStyle={[s.list, users.length === 0 && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.center}>
            <MaterialCommunityIcons name="account-group-outline" size={56} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>
              Aucun {tab === 'DRIVER' ? 'chauffeur' : 'client'} trouve
            </Text>
          </View>
        }
      />
    </View>
  );
}

const card = StyleSheet.create({
  root: { borderRadius: 14, padding: 14, marginHorizontal: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  email: { fontSize: 12, marginTop: 1 },
  phone: { fontSize: 11, marginTop: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  date: { fontSize: 11 },
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
