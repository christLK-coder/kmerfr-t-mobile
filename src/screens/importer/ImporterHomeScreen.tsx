import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Pressable, Animated } from 'react-native';
import { Text, FAB, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMissionStore } from '../../store/missionStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { useLayout } from '../../hooks/useLayout';
import { t } from '../../i18n';
import type { MissionResponse, MissionStatusValue } from '../../types';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const STATUS_COLORS: Record<MissionStatusValue, string> = {
  OPEN:        '#00897B',
  ASSIGNED:    '#F57F17',
  IN_TRANSIT:  '#E65100',
  DELIVERED:   '#2E7D32',
  CANCELLED:   '#757575',
  DISPUTED:    '#C62828',
};

function MissionCard({ item, onPress, colors }: { item: MissionResponse; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  const statusColor = STATUS_COLORS[item.status as MissionStatusValue] ?? colors.textSecondary;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={[s.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
        {/* Badge type */}
        {item.missionType === 'EXPRESS' && (
          <View style={[s.expressBadge, { backgroundColor: colors.secondary }]}>
            <Text style={s.expressTxt}>EXPRESS</Text>
          </View>
        )}

        {/* Route */}
        <View style={s.routeRow}>
          <View style={s.routeIcons}>
            <MaterialCommunityIcons name="map-marker" size={16} color={colors.primary} />
            <View style={[s.routeDot, { backgroundColor: colors.outline }]} />
            <MaterialCommunityIcons name="map-marker-check" size={16} color={colors.secondary} />
          </View>
          <View style={s.routeLabels}>
            <Text style={[s.routeFrom, { color: colors.textPrimary }]} numberOfLines={1}>{item.originLabel}</Text>
            <Text style={[s.routeTo, { color: colors.textSecondary }]} numberOfLines={1}>{item.destinationLabel}</Text>
          </View>
        </View>

        {/* Bas de carte */}
        <View style={s.cardFooter}>
          <Chip
            style={[s.statusChip, { backgroundColor: statusColor + '22' }]}
            textStyle={[s.statusTxt, { color: statusColor }]}
            compact
          >
            {t(`status_${item.status}`)}
          </Chip>
          <View style={s.priceRow}>
            <Text style={[s.price, { color: colors.primary }]}>
              {item.totalPrice?.toLocaleString('fr-FR')} {t('common_fcfa')}
            </Text>
          </View>
        </View>

        {/* Driver si assigné */}
        {item.driverName ? (
          <View style={[s.driverRow, { borderTopColor: colors.divider }]}>
            <MaterialCommunityIcons name="truck-outline" size={13} color={colors.textSecondary} />
            <Text style={[s.driverTxt, { color: colors.textSecondary }]}>{item.driverName}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function ImporterHomeScreen() {
  const nav = useNavigation<Nav>();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const insets = useSafeAreaInsets();
  const { fullName } = useAuthStore();
  const layout = useLayout();
  const { activeMissions, historyMissions, fetchActiveMissions, fetchHistoryMissions, isLoading } = useMissionStore();

  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchActiveMissions();
    fetchHistoryMissions();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchActiveMissions(), fetchHistoryMissions()]);
    setRefreshing(false);
  };

  const data = tab === 'active' ? activeMissions : historyMissions;
  const first = fullName?.split(' ')[0] ?? '';

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header — compact en paysage */}
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[s.header, { paddingTop: insets.top + 8 }, layout.headerCompact && { paddingBottom: 10 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.greeting}>{t('auth_welcome')} 👋</Text>
            <Text style={s.userName}>{first}</Text>
          </View>
          <Pressable onPress={() => nav.navigate('Notifications' as any)} style={s.notifBtn}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#fff" />
          </Pressable>
        </View>

        {/* Stats + dépenses côte à côte en paysage */}
        <View style={layout.isLandscape ? { flexDirection: 'row', gap: 10 } : undefined}>
          <View style={[s.statsRow, layout.isLandscape && { flex: 2 }]}>
            {[
              { icon: 'truck-fast',   num: activeMissions.filter(m => m.status === 'IN_TRANSIT').length, label: 'En transit',  color: '#FFAB40' },
              { icon: 'clock-outline',num: activeMissions.filter(m => m.status === 'ASSIGNED').length,   label: 'Assignées',   color: '#80CBC4' },
              { icon: 'check-circle', num: historyMissions.filter(m => m.status === 'DELIVERED').length, label: 'Livrées',     color: '#A5D6A7' },
            ].map((stat, i) => (
              <View key={i} style={s.statCard}>
                <View style={[s.statIconBg, { backgroundColor: stat.color + '44' }]}>
                  <MaterialCommunityIcons name={stat.icon as any} size={layout.headerCompact ? 14 : 18} color={stat.color} />
                </View>
                <Text style={[s.statNum, layout.headerCompact && { fontSize: 18 }]}>{stat.num}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {!layout.headerCompact && (
            <View style={[s.spendingCard, layout.isLandscape && { flex: 1 }]}>
              <View style={s.spendingLeft}>
                <Text style={s.spendingLabel}>Total dépenses</Text>
                <Text style={s.spendingAmount}>
                  {historyMissions.reduce((sum, m) => sum + (m.totalPrice ?? 0), 0).toLocaleString('fr-FR')} FCFA
                </Text>
              </View>
              <View style={s.spendingIconBg}>
                <MaterialCommunityIcons name="chart-line" size={22} color="#fff" />
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: C.surface, borderBottomColor: C.outline }]}>
        {(['active', 'history'] as const).map(t2 => (
          <Pressable key={t2} style={[s.tab, tab === t2 && { borderBottomColor: C.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t2)}>
            <Text style={[s.tabTxt, { color: tab === t2 ? C.primary : C.textSecondary }]}>
              {t2 === 'active' ? `${t('mission_active')} (${activeMissions.length})` : t('mission_history')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Liste */}
      <FlatList
        data={data}
        keyExtractor={item => item.id}
        numColumns={layout.isLandscape ? 2 : 1}
        key={layout.isLandscape ? 'land' : 'port'}
        renderItem={({ item }) => (
          <View style={layout.isLandscape ? { flex: 1, maxWidth: '50%', paddingHorizontal: 6 } : undefined}>
            <MissionCard item={item} colors={C} onPress={() => {
              nav.navigate('MissionDetail', { missionId: item.id });
            }} />
          </View>
        )}
        contentContainerStyle={[s.list, data.length === 0 && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} colors={[C.primary]} />}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="package-variant-closed" size={56} color={C.textMuted} />
            <Text style={[s.emptyTitle, { color: C.textSecondary }]}>{t('mission_none')}</Text>
            <Text style={[s.emptySub, { color: C.textMuted }]}>{t('mission_none_sub')}</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={[s.fab, { backgroundColor: C.primary }]}
        color="#fff"
        onPress={() => nav.navigate('CreateMission')}
        label={t('mission_new')}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  notifBtn: { padding: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statIconBg: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statNum: { fontSize: 24, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.7)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.3 },
  spendingCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 14, marginTop: 8, alignItems: 'center' },
  spendingLeft: { flex: 1 },
  spendingLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  spendingAmount: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  spendingIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabTxt: { fontSize: 13, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  listEmpty: { flex: 1 },
  card: { borderRadius: 14, padding: 14, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  expressBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  expressTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  routeIcons: { alignItems: 'center', gap: 3 },
  routeDot: { width: 2, height: 20, borderRadius: 1 },
  routeLabels: { flex: 1, gap: 4 },
  routeFrom: { fontSize: 14, fontWeight: '600' },
  routeTo: { fontSize: 13 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusChip: { borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: '600' },
  priceRow: { alignItems: 'flex-end' },
  price: { fontSize: 14, fontWeight: '700' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  driverTxt: { fontSize: 12 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  fab: { position: 'absolute', right: 20, bottom: 24, borderRadius: 28 },
});
