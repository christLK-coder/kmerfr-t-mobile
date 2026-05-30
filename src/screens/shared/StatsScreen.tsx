// Dashboard statistiques — chauffeur et importateur
import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, StyleSheet, StatusBar, TouchableOpacity,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMyStatsApi } from '../../api/stats.api';
import type { UserStats } from '../../api/stats.api';

function StatCard({
  icon, label, value, unit, color,
}: {
  icon: string; label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={styles.statValueRow}>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          {unit && <Text style={styles.statUnit}>{unit}</Text>}
        </View>
      </View>
    </View>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <MaterialCommunityIcons
          key={n}
          name={n <= Math.round(rating) ? 'star' : 'star-outline'}
          size={28}
          color={n <= Math.round(rating) ? '#F57F17' : '#E0E0E0'}
        />
      ))}
      <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyStatsApi()
      .then(setStats)
      .catch(() => setError('Impossible de charger les statistiques'))
      .finally(() => setLoading(false));
  }, []);

  const isDriver = stats?.role === 'DRIVER';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#0277BD', '#0288D1', '#039BE5']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerBody}>
          <MaterialCommunityIcons name="chart-bar" size={28} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Mes statistiques</Text>
          <Text style={styles.headerSub}>
            {isDriver ? 'Tableau de bord chauffeur' : 'Tableau de bord importateur'}
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0277BD" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : error || !stats ? (
        <View style={styles.centered}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#BDBDBD" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Note moyenne */}
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Note moyenne</Text>
            <StarDisplay rating={stats.averageRating} />
            <Text style={styles.ratingCount}>
              Basé sur {stats.totalReviews} avis
            </Text>
          </View>

          {/* Missions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Missions</Text>
            <View style={styles.grid}>
              <StatCard icon="clipboard-check" label="Livrées"     value={stats.delivered}    color="#2E7D32" />
              <StatCard icon="truck-fast"      label="En transit"  value={stats.inTransit}    color="#0277BD" />
              <StatCard icon="clipboard-list"  label="Ouvertes"    value={stats.open}         color="#F57F17" />
              <StatCard icon="sigma"           label="Total"       value={stats.totalMissions} color="#616161" />
            </View>
          </View>

          {/* Revenus */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isDriver ? 'Revenus perçus' : 'Volume traité'}
            </Text>
            <LinearGradient
              colors={['#1B5E20', '#2E7D32']}
              style={styles.earningsCard}
            >
              <MaterialCommunityIcons name="cash-multiple" size={36} color="rgba(255,255,255,0.8)" />
              <Text style={styles.earningsAmount}>
                {stats.totalAmount.toLocaleString()} FCFA
              </Text>
              <Text style={styles.earningsSub}>
                {isDriver ? 'Total payouts reçus' : 'Total missions payées'}
              </Text>
            </LinearGradient>
          </View>

          {/* Taux de succès */}
          {stats.totalMissions > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Taux de livraison</Text>
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Missions livrées / Total</Text>
                  <Text style={styles.progressPct}>
                    {Math.round((stats.delivered / stats.totalMissions) * 100)}%
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round((stats.delivered / stats.totalMissions) * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  headerBody: { gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9E9E9E' },
  errorText: { fontSize: 14, color: '#B71C1C', textAlign: 'center' },

  content: { padding: 16, gap: 16 },

  ratingCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 8,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  ratingTitle: { fontSize: 12, fontWeight: '700', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingNumber: { fontSize: 22, fontWeight: '800', color: '#F57F17', marginLeft: 8 },
  ratingCount: { fontSize: 12, color: '#9E9E9E' },

  section: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#424242', textTransform: 'uppercase', letterSpacing: 0.5 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderLeftWidth: 4,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statContent: { flex: 1 },
  statLabel: { fontSize: 11, color: '#9E9E9E', fontWeight: '600' },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statUnit: { fontSize: 11, color: '#9E9E9E' },

  earningsCard: {
    borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 8,
    elevation: 4, shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
  },
  earningsAmount: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  earningsSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  progressCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, gap: 10,
    elevation: 1,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 13, color: '#616161', fontWeight: '600' },
  progressPct: { fontSize: 18, fontWeight: '800', color: '#2E7D32' },
  progressBar: {
    height: 10, backgroundColor: '#E8F5E9', borderRadius: 5, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#2E7D32', borderRadius: 5,
  },
});
