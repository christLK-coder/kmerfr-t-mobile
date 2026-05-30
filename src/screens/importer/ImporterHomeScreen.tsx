// Liste des missions de l'importateur + FAB pour créer une nouvelle mission
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, FAB, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMissionStore } from '../../store/missionStore';
import { useAuthStore } from '../../store/authStore';
import { StatusChip } from '../../components/common/StatusChip';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import type { MissionDto } from '../../api/missions.api';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionItem({ item, onPress }: { item: MissionDto; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  }
  function onPressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
    onPress();
  }

  return (
    <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.cardInner}
      >
        {/* Route */}
        <View style={styles.routeRow}>
          <View style={styles.routePin}>
            <MaterialCommunityIcons name="map-marker" size={16} color="#1B5E20" />
          </View>
          <View style={styles.routeLabels}>
            <Text style={styles.routeFrom} numberOfLines={1}>
              {item.originLabel}
            </Text>
            <View style={styles.routeLine} />
            <Text style={styles.routeTo} numberOfLines={1}>
              {item.destinationLabel}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#BDBDBD" />
        </View>

        {/* Meta */}
        <View style={styles.metaRow}>
          <StatusChip status={item.status} />
          {item.totalPrice != null && (
            <View style={styles.priceTag}>
              <MaterialCommunityIcons name="cash" size={13} color="#E65100" />
              <Text style={styles.priceText}>
                {item.totalPrice.toLocaleString()} FCFA
              </Text>
            </View>
          )}
          {item.cargoDescription && (
            <Text style={styles.cargoText} numberOfLines={1}>
              {item.cargoDescription}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="truck-outline" size={72} color="#C8E6C9" />
      <Text style={styles.emptyTitle}>Aucune mission</Text>
      <Text style={styles.emptySub}>
        Créez votre première mission de transport en appuyant sur +
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onAdd}>
        <Text style={styles.emptyBtnText}>Créer une mission</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ImporterHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { fullName } = useAuthStore();
  const { missions, isLoading, fetchMyMissions } = useMissionStore();

  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchMyMissions();
    Animated.timing(headerOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, []);

  const handleRefresh = useCallback(() => {
    fetchMyMissions();
  }, [fetchMyMissions]);

  const openCreate = useCallback(() => {
    navigation.navigate('CreateMission');
  }, [navigation]);

  const firstName = fullName?.split(' ')[0] ?? 'Importateur';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Header gradient ─── */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        locations={[0, 0.6, 1]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Animated.View style={{ opacity: headerOpacity }}>
          <Text style={styles.greeting}>Bonjour, {firstName} 👋</Text>
          <Text style={styles.subtitle}>Gérez vos missions de transport</Text>
        </Animated.View>

        {/* Stats pill */}
        <Animated.View style={[styles.statsPill, { opacity: headerOpacity }]}>
          <MaterialCommunityIcons name="truck-delivery" size={16} color="#1B5E20" />
          <Text style={styles.statsText}>
            {missions.length} mission{missions.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* ─── Liste ─── */}
      {isLoading && missions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.loadingText}>Chargement des missions…</Text>
        </View>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MissionItem item={item} onPress={() => navigation.navigate('MissionDetail', { missionId: item.id })} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 96 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              colors={['#1B5E20']}
              tintColor="#1B5E20"
            />
          }
          ListEmptyComponent={<EmptyState onAdd={openCreate} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ─── FAB ─── */}
      <FAB
        icon="plus"
        label="Nouvelle mission"
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={openCreate}
        color="#FFFFFF"
        customSize={52}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    marginTop: 2,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 14,
    gap: 6,
    elevation: 2,
  },
  statsText: { fontSize: 13, fontWeight: '700', color: '#1B5E20' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  cardInner: { padding: 16 },

  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  routePin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeLabels: { flex: 1 },
  routeFrom: { fontSize: 14, fontWeight: '700', color: '#212121' },
  routeLine: {
    width: 2,
    height: 10,
    backgroundColor: '#E0E0E0',
    marginLeft: 4,
    marginVertical: 3,
    borderRadius: 1,
  },
  routeTo: { fontSize: 14, fontWeight: '600', color: '#616161' },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priceText: { fontSize: 12, fontWeight: '700', color: '#E65100' },
  cargoText: { fontSize: 12, color: '#9E9E9E', flex: 1 },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14, color: '#9E9E9E' },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#424242', marginTop: 8 },
  emptySub: {
    fontSize: 14,
    color: '#9E9E9E',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: '#1B5E20',
    elevation: 8,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
  },
});
