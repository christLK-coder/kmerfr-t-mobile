// Écran chauffeur — liste des missions disponibles (OPEN) + acceptation
import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
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

function MissionCard({
  item,
  onAccept,
  accepting,
}: {
  item: MissionDto;
  onAccept: (mission: MissionDto) => void;
  accepting: boolean;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, delay: 80, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      {/* Badge disponible */}
      <View style={styles.cardHeader}>
        <StatusChip status={item.status} />
        {item.totalPrice != null && (
          <View style={styles.priceTag}>
            <MaterialCommunityIcons name="cash" size={13} color="#E65100" />
            <Text style={styles.priceText}>
              {item.totalPrice.toLocaleString()} FCFA
            </Text>
          </View>
        )}
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeDot} />
        <View style={styles.routeBody}>
          <Text style={styles.cityLabel} numberOfLines={1}>{item.originLabel}</Text>
          <View style={styles.dashLine} />
          <View style={styles.destRow}>
            <MaterialCommunityIcons name="flag-checkered" size={14} color="#E65100" />
            <Text style={[styles.cityLabel, styles.destLabel]} numberOfLines={1}>
              {item.destinationLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Cargo */}
      {item.cargoDescription && (
        <View style={styles.cargoRow}>
          <MaterialCommunityIcons name="package-variant" size={14} color="#9E9E9E" />
          <Text style={styles.cargoText} numberOfLines={2}>{item.cargoDescription}</Text>
        </View>
      )}

      {/* Bouton accepter */}
      <Button
        mode="contained"
        onPress={() => onAccept(item)}
        loading={accepting}
        disabled={accepting}
        icon="check-circle"
        style={styles.acceptBtn}
        contentStyle={styles.acceptContent}
        labelStyle={styles.acceptLabel}
        buttonColor="#1B5E20"
      >
        Accepter cette mission
      </Button>
    </Animated.View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name="clipboard-search-outline" size={72} color="#C8E6C9" />
      <Text style={styles.emptyTitle}>Aucune mission disponible</Text>
      <Text style={styles.emptySub}>
        Il n'y a pas encore de missions ouvertes.{'\n'}Revenez plus tard ou actualisez.
      </Text>
      <TouchableOpacity style={styles.emptyBtn} onPress={onRefresh}>
        <Text style={styles.emptyBtnText}>Actualiser</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DriverHomeScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { fullName } = useAuthStore();
  const { missions, isLoading, acceptMission, fetchAvailableMissions } = useMissionStore();
  const [acceptingId, setAcceptingId] = React.useState<string | null>(null);

  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAvailableMissions();
    Animated.timing(headerOpacity, {
      toValue: 1, duration: 500, useNativeDriver: true,
    }).start();
  }, []);

  const handleRefresh = useCallback(() => {
    fetchAvailableMissions();
  }, [fetchAvailableMissions]);

  async function handleAccept(mission: MissionDto) {
    Alert.alert(
      'Accepter la mission ?',
      `${mission.originLabel} → ${mission.destinationLabel}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          style: 'default',
          onPress: async () => {
            setAcceptingId(mission.id);
            try {
              await acceptMission(mission.id);
              navigation.navigate('ActiveMission', {
                missionId: mission.id,
                originLabel: mission.originLabel,
                destinationLabel: mission.destinationLabel,
              });
            } catch {
              Alert.alert('Erreur', "Impossible d'accepter cette mission.");
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  }

  const firstName = fullName?.split(' ')[0] ?? 'Chauffeur';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header */}
      <LinearGradient
        colors={['#E65100', '#F57C00', '#EF6C00']}
        locations={[0, 0.55, 1]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Animated.View style={{ opacity: headerOpacity }}>
          <Text style={styles.greeting}>Bonjour, {firstName} 🚛</Text>
          <Text style={styles.subtitle}>Missions disponibles pour vous</Text>
        </Animated.View>
        <Animated.View style={[styles.statsPill, { opacity: headerOpacity }]}>
          <MaterialCommunityIcons name="clipboard-list" size={16} color="#E65100" />
          <Text style={styles.statsText}>
            {missions.length} disponible{missions.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>
      </LinearGradient>

      {/* Liste */}
      {isLoading && missions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E65100" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : (
        <FlatList
          data={missions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MissionCard
              item={item}
              onAccept={handleAccept}
              accepting={acceptingId === item.id}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              colors={['#E65100']}
              tintColor="#E65100"
            />
          }
          ListEmptyComponent={<EmptyState onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  statsPill: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    marginTop: 14, gap: 6, elevation: 2,
  },
  statsText: { fontSize: 13, fontWeight: '700', color: '#E65100' },

  list: { padding: 16, gap: 14 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  priceTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFF3E0', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  priceText: { fontSize: 13, fontWeight: '700', color: '#E65100' },

  routeContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  routeDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#1B5E20', marginTop: 6,
  },
  routeBody: { flex: 1 },
  cityLabel: { fontSize: 15, fontWeight: '700', color: '#212121' },
  destLabel: { color: '#424242', marginLeft: 4 },
  dashLine: { width: 2, height: 14, backgroundColor: '#E0E0E0', marginLeft: 1, marginVertical: 4, borderRadius: 1 },
  destRow: { flexDirection: 'row', alignItems: 'center' },

  cargoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F5F5F5', borderRadius: 8,
    padding: 10, marginBottom: 12,
  },
  cargoText: { fontSize: 13, color: '#616161', flex: 1, lineHeight: 18 },

  acceptBtn: {
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
  },
  acceptContent: { height: 48 },
  acceptLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3, color: '#FFFFFF' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9E9E9E' },

  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60, gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#424242', marginTop: 8 },
  emptySub: { fontSize: 14, color: '#9E9E9E', textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    marginTop: 8, backgroundColor: '#E65100',
    borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
