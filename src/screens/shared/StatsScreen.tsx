import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { getMyStatsApi } from '../../api/stats.api';
import type { UserStats } from '../../api/stats.api';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';

function KpiCard({ icon, label, value, unit, color, C }: {
  icon: string; label: string; value: string | number; unit?: string; color: string;
  C: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[kpi.card, { backgroundColor: C.surface }]}>
      <View style={[kpi.iconWrap, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[kpi.label, { color: C.textSecondary }]}>{label}</Text>
      <View style={kpi.valueRow}>
        <Text style={[kpi.value, { color }]}>{value}</Text>
        {unit && <Text style={[kpi.unit, { color: C.textMuted }]}> {unit}</Text>}
      </View>
    </View>
  );
}
const kpi = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, flex: 1, minWidth: '45%', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  label: { fontSize: 11, marginBottom: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 22, fontWeight: '800' },
  unit: { fontSize: 12 },
});

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <MaterialCommunityIcons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'}
          size={22} color={n <= Math.round(rating) ? '#F57F17' : '#BDBDBD'} />
      ))}
      <Text style={{ fontSize: 18, fontWeight: '800', color: '#F57F17', marginLeft: 6 }}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

export default function StatsScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { userRole } = useAuthStore();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setStats(await getMyStatsApi()); }
    catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const isDriver = userRole === 'DRIVER' || stats?.role === 'DRIVER';
  const gradientColors: [string, string] = isDriver
    ? [C.gradientDriverStart, C.gradientDriverEnd]
    : [C.gradientPrimaryStart, C.gradientPrimaryEnd];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient colors={gradientColors} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <MaterialCommunityIcons
          name={isDriver ? 'chart-line' : 'chart-bar'}
          size={40} color="#fff" style={{ marginBottom: 6 }}
        />
        <Text style={s.headerTitle}>{t('stats_title')}</Text>
      </LinearGradient>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {/* === IMPORTER STATS === */}
          {!isDriver && stats && (
            <>
              <View style={s.sectionHd}>
                <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Vue d'ensemble</Text>
              </View>
              <View style={s.kpiGrid}>
                <KpiCard icon="package-variant" label={t('stats_missions_total')} value={stats.totalMissions} color={C.primary} C={C} />
                <KpiCard icon="truck-fast" label={t('stats_missions_active')} value={stats.inTransit ?? 0} color={C.secondary} C={C} />
                <KpiCard icon="check-circle-outline" label={t('stats_missions_done')} value={stats.delivered ?? 0} color={C.success} C={C} />
                <KpiCard icon="clock-outline" label={t('status_OPEN')} value={stats.open ?? 0} color={C.info} C={C} />
              </View>

              <View style={[s.card, { backgroundColor: C.surface }]}>
                <Text style={[s.label, { color: C.textSecondary }]}>{t('stats_spending')}</Text>
                <Text style={[s.bigNum, { color: C.primary }]}>
                  {(stats.totalAmount ?? 0).toLocaleString('fr-FR')}
                  <Text style={[s.bigUnit, { color: C.textMuted }]}> {t('common_fcfa')}</Text>
                </Text>
              </View>
            </>
          )}

          {/* === DRIVER STATS === */}
          {isDriver && stats && (
            <>
              <View style={s.kpiGrid}>
                <KpiCard icon="truck-check" label={t('stats_missions_done')} value={stats.delivered ?? 0} color={C.success} C={C} />
                <KpiCard icon="clock-fast" label={t('stats_missions_active')} value={stats.inTransit ?? 0} color={C.secondary} C={C} />
                <KpiCard icon="currency-usd" label={t('stats_revenue')} value={(stats.totalAmount ?? 0).toLocaleString('fr-FR')} unit="FCFA" color={C.primary} C={C} />
                <KpiCard icon="star" label={t('stats_avg_rating')} value={stats.averageRating?.toFixed(1) ?? '—'} color="#F57F17" C={C} />
              </View>

              {(stats.averageRating ?? 0) > 0 && (
                <View style={[s.card, { backgroundColor: C.surface }]}>
                  <Text style={[s.label, { color: C.textSecondary }]}>{t('stats_avg_rating')}</Text>
                  <Stars rating={stats.averageRating} />
                  <Text style={[s.subTxt, { color: C.textMuted }]}>
                    {stats.totalReviews} avis
                  </Text>
                </View>
              )}
            </>
          )}

          {!stats && !loading && (
            <View style={s.center}>
              <MaterialCommunityIcons name="chart-bar-stacked" size={56} color={C.textMuted} />
              <Text style={[s.emptyTxt, { color: C.textSecondary }]}>
                Statistiques disponibles après votre première mission
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 24, alignItems: 'center' },
  back: { alignSelf: 'flex-start', padding: 4, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  content: { padding: 16, gap: 12 },
  sectionHd: { marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  label: { fontSize: 12, marginBottom: 8 },
  bigNum: { fontSize: 28, fontWeight: '800' },
  bigUnit: { fontSize: 14, fontWeight: '400' },
  subTxt: { fontSize: 12, marginTop: 6 },
  emptyTxt: { fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 22 },
});
