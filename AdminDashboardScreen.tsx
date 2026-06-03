import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Pressable } from 'react-native';
import { Text, Badge } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
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

interface AdminStats {
  activeMissions: number;
  revenueDay: number;
  revenueMonth: number;
  openDisputes: number;
  newClients: number;
  newDrivers: number;
  pendingApplications: number;
  totalEscrowed: number;
}

function KpiCard({ icon, label, value, unit, color, alert, C }: {
  icon: string; label: string; value: string | number; unit?: string;
  color: string; alert?: boolean; C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[k.card, { backgroundColor: C.surface }]}>
      <View style={[k.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
        {alert && <View style={[k.alertDot, { backgroundColor: C.error }]} />}
      </View>
      <Text style={[k.val, { color }]}>{value}{unit ? <Text style={[k.unit, { color: C.textMuted }]}> {unit}</Text> : null}</Text>
      <Text style={[k.lbl, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}
const k = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, flex: 1, minWidth: '45%', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
  alertDot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  val: { fontSize: 22, fontWeight: '800' },
  unit: { fontSize: 12 },
  lbl: { fontSize: 11, marginTop: 2 },
});

function QuickAction({ icon, label, color, onPress, C, badge }: {
  icon: string; label: string; color: string; onPress: () => void;
  C: ReturnType<typeof useColors>; badge?: number;
}) {
  return (
    <Pressable style={[qa.btn, { backgroundColor: C.surface }]} onPress={onPress}>
      <View style={{ position: 'relative' }}>
        <View style={[qa.icon, { backgroundColor: color + '18' }]}>
          <MaterialCommunityIcons name={icon as any} size={24} color={color} />
        </View>
        {badge != null && badge > 0 && (
          <Badge style={[qa.badge, { backgroundColor: C.error }]} size={18}>{badge}</Badge>
        )}
      </View>
      <Text style={[qa.label, { color: C.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}
const qa = StyleSheet.create({
  btn: { borderRadius: 14, padding: 16, flex: 1, alignItems: 'center', gap: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  icon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6 },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});

export default function AdminDashboardScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<ApiResponse<AdminStats>>('/api/stats/admin');
      if (data.data) setStats(data.data);
    } catch {
      // Données fictives si endpoint pas encore implémenté
      setStats({
        activeMissions: 0, revenueDay: 0, revenueMonth: 0,
        openDisputes: 0, newClients: 0, newDrivers: 0,
        pendingApplications: 0, totalEscrowed: 0,
      });
    } finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Text style={s.title}>{t('admin_dashboard')}</Text>
        <Text style={s.subtitle}>KmerFret Admin</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* KPIs */}
        <View style={s.grid}>
          <KpiCard icon="truck-fast" label={t('admin_active_missions')} value={stats?.activeMissions ?? 0} color={C.primary} C={C} />
          <KpiCard icon="alert-circle" label={t('admin_disputes_open')} value={stats?.openDisputes ?? 0} color={C.error} alert={(stats?.openDisputes ?? 0) > 0} C={C} />
          <KpiCard icon="account-multiple-plus" label={t('admin_new_clients')} value={stats?.newClients ?? 0} color={C.info} C={C} />
          <KpiCard icon="account-clock" label="Candidatures" value={stats?.pendingApplications ?? 0} color={C.warning} alert={(stats?.pendingApplications ?? 0) > 0} C={C} />
        </View>

        {/* Revenus */}
        <View style={[s.revenueCard, { backgroundColor: C.primary }]}>
          <Text style={s.revTitle}>Revenus du mois</Text>
          <Text style={s.revAmount}>
            {(stats?.revenueMonth ?? 0).toLocaleString('fr-FR')} FCFA
          </Text>
          <Text style={s.revSub}>Séquestré : {(stats?.totalEscrowed ?? 0).toLocaleString('fr-FR')} FCFA</Text>
        </View>

        {/* Actions rapides */}
        <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Actions rapides</Text>
        <View style={s.quickGrid}>
          <QuickAction icon="account-clock-outline" label="Candidatures" color={C.warning}
            badge={stats?.pendingApplications}
            onPress={() => nav.navigate('AdminApplications' as any)} C={C} />
          <QuickAction icon="alert-circle-outline" label="Litiges" color={C.error}
            badge={stats?.openDisputes}
            onPress={() => nav.navigate('AdminOperations' as any)} C={C} />
          <QuickAction icon="account-group-outline" label="Comptes" color={C.info}
            onPress={() => nav.navigate('AdminAccounts' as any)} C={C} />
          <QuickAction icon="cash-multiple" label="Finances" color={C.primary}
            onPress={() => nav.navigate('AdminFinance' as any)} C={C} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  content: { padding: 16, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  revenueCard: { borderRadius: 16, padding: 20 },
  revTitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4 },
  revAmount: { fontSize: 28, fontWeight: '800', color: '#fff' },
  revSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
