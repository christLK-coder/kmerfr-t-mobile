import React, { useCallback, useState } from 'react';
import {
  View, FlatList, StyleSheet, Pressable, RefreshControl, Alert,
} from 'react-native';
import { Text, Button, Chip } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMissionStore } from '../../store/missionStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MissionResponse, MissionStatusValue } from '../../types';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

type TabKey = 'available' | 'mine' | 'history';

const STATUS_COLORS: Record<MissionStatusValue, string> = {
  OPEN: '#0277BD', ASSIGNED: '#F57F17', IN_TRANSIT: '#E65100',
  DELIVERED: '#2E7D32', CANCELLED: '#757575', DISPUTED: '#C62828',
};

function MissionCard({
  item, onPress, onAccept, accepting, C, showAccept,
}: {
  item: MissionResponse;
  onPress: () => void;
  onAccept?: () => void;
  accepting?: boolean;
  C: ReturnType<typeof useColors>;
  showAccept?: boolean;
}) {
  const statusColor = STATUS_COLORS[item.status as MissionStatusValue] ?? C.textSecondary;

  return (
    <Pressable onPress={onPress} style={[s.card, { backgroundColor: C.surface }]}>
      {/* Express badge */}
      {item.missionType === 'EXPRESS' && (
        <View style={[s.express, { backgroundColor: C.secondary }]}>
          <Text style={s.expressTxt}>EXPRESS ⚡</Text>
        </View>
      )}

      {/* Route */}
      <View style={s.routeRow}>
        <View style={s.routeIcons}>
          <MaterialCommunityIcons name="map-marker" size={14} color={C.primary} />
          <View style={[s.routeLine, { backgroundColor: C.outline }]} />
          <MaterialCommunityIcons name="map-marker-check" size={14} color={C.secondary} />
        </View>
        <View style={s.routeLabels}>
          <Text style={[s.fromTxt, { color: C.textPrimary }]} numberOfLines={1}>
            {item.originLabel}
          </Text>
          <Text style={[s.toTxt, { color: C.textSecondary }]} numberOfLines={1}>
            {item.destinationLabel}
          </Text>
        </View>
      </View>

      {/* Infos */}
      <View style={s.infoRow}>
        {item.cargoType && (
          <Chip compact style={{ backgroundColor: C.surfaceVariant }} textStyle={{ fontSize: 10, color: C.textSecondary }}>
            {t(`cargo_${item.cargoType}`) || item.cargoType}
          </Chip>
        )}
        {item.cargoWeightTons != null && (
          <View style={s.infoItem}>
            <MaterialCommunityIcons name="weight" size={12} color={C.textMuted} />
            <Text style={[s.infoTxt, { color: C.textSecondary }]}>{item.cargoWeightTons}t</Text>
          </View>
        )}
        <Chip compact style={{ backgroundColor: statusColor + '20' }} textStyle={{ fontSize: 10, color: statusColor, fontWeight: '700' }}>
          {t(`status_${item.status}`)}
        </Chip>
      </View>

      {/* Paiement */}
      {item.driverPayout != null && (
        <View style={[s.payRow, { borderTopColor: C.divider }]}>
          <Text style={[s.payLabel, { color: C.textMuted }]}>{t('mission_driver_payout')}</Text>
          <Text style={[s.payValue, { color: C.primary }]}>
            {item.driverPayout.toLocaleString('fr-FR')} {t('common_fcfa')}
          </Text>
        </View>
      )}

      {/* Bouton accepter */}
      {showAccept && onAccept && (
        <Button
          mode="contained"
          onPress={onAccept}
          loading={accepting}
          disabled={accepting}
          style={[s.acceptBtn, { backgroundColor: C.primary }]}
          labelStyle={{ fontSize: 13, fontWeight: '700' }}
          contentStyle={{ height: 40 }}
        >
          {t('mission_accept')}
        </Button>
      )}
    </Pressable>
  );
}

export default function DriverHomeScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { fullName } = useAuthStore();
  const {
    availableMissions, activeMissions, historyMissions,
    fetchAvailableMissions, fetchActiveMissions, fetchHistoryMissions,
    acceptMission, setCurrentMission,
    isLoading,
  } = useMissionStore();

  const [tab, setTab] = useState<TabKey>('available');
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    fetchAvailableMissions();
    fetchActiveMissions();
    fetchHistoryMissions();
  }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailableMissions(), fetchActiveMissions(), fetchHistoryMissions()]);
    setRefreshing(false);
  };

  const handleAccept = async (mission: MissionResponse) => {
    Alert.alert(
      t('mission_confirm_accept'),
      `${mission.originLabel} → ${mission.destinationLabel}`,
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('mission_accept'), onPress: async () => {
            setAcceptingId(mission.id);
            try {
              await acceptMission(mission.id);
              setCurrentMission({ ...mission, status: 'ASSIGNED' });
              nav.navigate('MissionDetail', { missionId: mission.id });
            } catch (e) {
              Alert.alert('Erreur', (e as Error).message);
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  };

  const goToMission = (mission: MissionResponse) => {
    setCurrentMission(mission);
    if (mission.status === 'IN_TRANSIT' || mission.status === 'ASSIGNED') {
      nav.navigate('ActiveMission', { missionId: mission.id });
    } else {
      nav.navigate('MissionDetail', { missionId: mission.id });
    }
  };

  // Missions actives du chauffeur (ASSIGNED ou IN_TRANSIT)
  const myActiveMissions = activeMissions.filter(m =>
    m.status === 'ASSIGNED' || m.status === 'IN_TRANSIT'
  );
  const myHistoryMissions = historyMissions;

  const listData: MissionResponse[] =
    tab === 'available' ? availableMissions :
    tab === 'mine'      ? myActiveMissions :
    myHistoryMissions;

  const first = fullName?.split(' ')[0] ?? '';
  const hasActive = myActiveMissions.length > 0;

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'available', label: t('mission_available'), count: availableMissions.length },
    { key: 'mine',      label: t('mission_active'),    count: myActiveMissions.length },
    { key: 'history',   label: t('mission_history') },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[C.gradientDriverStart, C.gradientDriverEnd]}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <Text style={s.greeting}>{t('nav_dashboard')} 🚛</Text>
        <Text style={s.userName}>{first}</Text>

        {/* Mission active en cours */}
        {hasActive && (
          <Pressable
            style={s.activeBanner}
            onPress={() => {
              const m = myActiveMissions[0];
              setCurrentMission(m);
              nav.navigate('ActiveMission', { missionId: m.id });
            }}
          >
            <MaterialCommunityIcons name="truck-fast" size={18} color="#fff" />
            <Text style={s.activeBannerTxt}>
              Mission en cours — {myActiveMissions[0].originLabel} → {myActiveMissions[0].destinationLabel}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />
          </Pressable>
        )}
      </LinearGradient>

      {/* Tabs */}
      <View style={[s.tabBar, { backgroundColor: C.surface, borderBottomColor: C.outline }]}>
        {TABS.map(tab2 => (
          <Pressable
            key={tab2.key}
            style={[s.tab, tab === tab2.key && { borderBottomColor: C.secondary, borderBottomWidth: 2.5 }]}
            onPress={() => setTab(tab2.key)}
          >
            <Text style={[s.tabTxt, { color: tab === tab2.key ? C.secondary : C.textSecondary }]}>
              {tab2.label}
              {tab2.count != null ? ` (${tab2.count})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Liste */}
      <FlatList
        data={listData}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <MissionCard
            item={item}
            C={C}
            onPress={() => goToMission(item)}
            onAccept={() => handleAccept(item)}
            accepting={acceptingId === item.id}
            showAccept={tab === 'available'}
          />
        )}
        contentContainerStyle={[s.list, listData.length === 0 && s.listEmpty]}
        refreshControl={
          <RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} colors={[C.secondary]} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons
              name={tab === 'available' ? 'clipboard-search-outline' : 'truck-outline'}
              size={56} color={C.textMuted}
            />
            <Text style={[s.emptyTitle, { color: C.textSecondary }]}>
              {tab === 'available' ? t('mission_no_available') : t('mission_none')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 12 },
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10,
  },
  activeBannerTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  tabTxt: { fontSize: 12, fontWeight: '600' },

  list: { padding: 16, gap: 12 },
  listEmpty: { flex: 1 },

  card: { borderRadius: 14, padding: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6 },
  express: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  expressTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  routeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  routeIcons: { alignItems: 'center', gap: 2, paddingTop: 2 },
  routeLine: { width: 2, height: 14, borderRadius: 1 },
  routeLabels: { flex: 1 },
  fromTxt: { fontSize: 14, fontWeight: '600' },
  toTxt: { fontSize: 13, marginTop: 4 },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  infoTxt: { fontSize: 12 },

  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 8 },
  payLabel: { fontSize: 12 },
  payValue: { fontSize: 15, fontWeight: '800' },

  acceptBtn: { marginTop: 10, borderRadius: 8 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 14, textAlign: 'center' },
});
