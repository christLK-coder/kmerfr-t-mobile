// Programme de fidelite chauffeur — Design V3
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import { api } from '../../api/axios.config';

interface LoyaltyData {
  tier: 'BRONZE' | 'ARGENT' | 'OR' | 'PLATINE';
  points: number;
  nextTierPoints: number;
  benefit: string;
  deliveries: number;
  averageRating: number;
}

const TIER_COLORS = {
  BRONZE:  '#CD7F32',
  ARGENT:  '#C0C0C0',
  OR:      '#FFD700',
  PLATINE: '#E5E4E2',
};

const TIER_CONFIG = {
  BRONZE:  { icon: 'medal-outline' as const, i18nKey: 'loyalty_BRONZE', min: 0 },
  ARGENT:  { icon: 'medal' as const,         i18nKey: 'loyalty_SILVER', min: 500 },
  OR:      { icon: 'star-circle' as const,    i18nKey: 'loyalty_GOLD',  min: 2000 },
  PLATINE: { icon: 'diamond-stone' as const,  i18nKey: 'loyalty_PLATINUM', min: 5000 },
};

const TIERS = ['BRONZE', 'ARGENT', 'OR', 'PLATINE'] as const;

const BENEFITS: Record<string, string[]> = {
  BRONZE:  ['Commission standard'],
  ARGENT:  ['Commission -2%', 'Support prioritaire'],
  OR:      ['Commission -5%', 'Missions express en priorite', 'Badge Or visible'],
  PLATINE: ['Commission -10%', 'Missions VIP exclusives', 'Support dedie 24/7', 'Badge Platine'],
};

export default function LoyaltyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [data,    setData]    = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/loyalty/me')
      .then(r => setData((r.data as any).data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tierColor = data ? TIER_COLORS[data.tier] : TIER_COLORS.BRONZE;
  const tierCfg = data ? TIER_CONFIG[data.tier] : TIER_CONFIG.BRONZE;
  const nextTierIdx = data ? TIERS.indexOf(data.tier) + 1 : 1;
  const nextTier = nextTierIdx < TIERS.length ? TIERS[nextTierIdx] : null;
  const progress = data && data.tier !== 'PLATINE'
    ? Math.min(100, ((data.points - TIER_CONFIG[data.tier].min) / (data.nextTierPoints)) * 100)
    : 100;

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header gradient vert */}
      <LinearGradient
        colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.onPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: C.onPrimary }]}>{t('loyalty_title')}</Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <Text style={{ color: C.textSecondary }}>Donnees non disponibles</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Grande card tier */}
          <View style={[styles.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <View style={styles.tierHeaderRow}>
              <View style={[styles.trophyCircle, { backgroundColor: tierColor + '20' }]}>
                <MaterialCommunityIcons name={tierCfg.icon as any} size={40} color={tierColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierLabel, { color: tierColor }]}>{t(tierCfg.i18nKey)}</Text>
                <Text style={[styles.tierSub, { color: C.textSecondary }]}>{t('loyalty_tier')}</Text>
              </View>
            </View>

            {/* Points */}
            <View style={styles.pointsRow}>
              <Text style={[styles.pointsValue, { color: C.textPrimary }]}>
                {data.points.toLocaleString()}
              </Text>
              <Text style={[styles.pointsLabel, { color: C.textMuted }]}>{t('loyalty_points')}</Text>
            </View>

            {/* Barre de progression */}
            {data.tier !== 'PLATINE' && nextTier && (
              <View style={styles.progressSection}>
                <Text style={[styles.progressLabel, { color: C.textSecondary }]}>
                  {t('loyalty_next_tier', { pts: data.nextTierPoints.toLocaleString(), tier: t(TIER_CONFIG[nextTier].i18nKey) })}
                </Text>
                <View style={[styles.progressBar, { backgroundColor: C.surfaceVariant }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.max(progress, 3)}%`, backgroundColor: tierColor },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Section Avantages */}
          <View style={[styles.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Avantages {t(tierCfg.i18nKey)}</Text>
            {(BENEFITS[data.tier] ?? []).map((benefit, i) => (
              <View key={i} style={styles.benefitRow}>
                <MaterialCommunityIcons name="check-circle" size={18} color={C.success} />
                <Text style={[styles.benefitText, { color: C.textSecondary }]}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Comment gagner des points */}
          <View style={[styles.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Comment gagner des points</Text>
            <View style={styles.earnRow}>
              <View style={[styles.earnIcon, { backgroundColor: C.primaryContainer }]}>
                <MaterialCommunityIcons name="truck-check" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.earnTitle, { color: C.textPrimary }]}>+100 pts</Text>
                <Text style={[styles.earnDesc, { color: C.textMuted }]}>Par livraison completee</Text>
              </View>
            </View>
            <View style={styles.earnRow}>
              <View style={[styles.earnIcon, { backgroundColor: C.warningContainer }]}>
                <MaterialCommunityIcons name="star" size={20} color={C.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.earnTitle, { color: C.textPrimary }]}>+50 pts bonus</Text>
                <Text style={[styles.earnDesc, { color: C.textMuted }]}>{'Si note >= 4.5 / 5'}</Text>
              </View>
            </View>
          </View>

          {/* Tous les paliers */}
          <View style={[styles.card, { backgroundColor: C.surface, shadowColor: C.shadow }]}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>Tous les paliers</Text>
            {TIERS.map(tierKey => {
              const cfg = TIER_CONFIG[tierKey];
              const color = TIER_COLORS[tierKey];
              const current = tierKey === data.tier;
              const reached = TIERS.indexOf(tierKey) <= TIERS.indexOf(data.tier);
              return (
                <View
                  key={tierKey}
                  style={[
                    styles.tierRow,
                    current && { backgroundColor: C.surfaceVariant, borderRadius: 10, paddingHorizontal: 8 },
                  ]}
                >
                  <View style={[styles.tierIconCircle, { backgroundColor: color + '20' }]}>
                    <MaterialCommunityIcons name={cfg.icon as any} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.tierName, reached ? { color } : { color: C.textMuted }]}>
                      {t(cfg.i18nKey)}
                    </Text>
                    <Text style={[styles.tierMin, { color: C.textMuted }]}>
                      {cfg.min === 0 ? 'Depart' : `${cfg.min.toLocaleString()} pts`}
                    </Text>
                  </View>
                  {current && (
                    <View style={[styles.currentBadge, { backgroundColor: color }]}>
                      <Text style={styles.currentBadgeText}>Actuel</Text>
                    </View>
                  )}
                  {!current && reached && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={color} />
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 10 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 14 },

  card: {
    borderRadius: 14, padding: 18, gap: 12,
    elevation: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },

  tierHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trophyCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  tierLabel: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  tierSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  pointsRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  pointsValue: { fontSize: 36, fontWeight: '900' },
  pointsLabel: { fontSize: 14, fontWeight: '600' },

  progressSection: { gap: 6 },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  progressBar: { height: 10, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },

  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { fontSize: 14, fontWeight: '500' },

  earnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  earnIcon: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  earnTitle: { fontSize: 14, fontWeight: '700' },
  earnDesc: { fontSize: 12 },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  tierIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  tierName: { fontSize: 14, fontWeight: '700' },
  tierMin: { fontSize: 11 },
  currentBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  currentBadgeText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
});
