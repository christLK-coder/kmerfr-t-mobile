import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, Pressable, RefreshControl,
} from 'react-native';
import { Text, Button, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { LinearGradient } from 'expo-linear-gradient';

import * as SecureStore from 'expo-secure-store';
import { getMissionDetailApi, getLatestDriverPositionApi } from '../../api/missions.api';
import { useMissionStore } from '../../store/missionStore';
import { useAuthStore } from '../../store/authStore';
import { useLayout } from '../../hooks/useLayout';
import { ImporterTrackingMap } from '../../components/map/ImporterTrackingMap';
import WebSocketService from '../../services/WebSocketService';
import { getRoute } from '../../services/RouteService';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MissionResponse, MissionStatusValue } from '../../types';
import type { MainStackParamList } from '../../navigation/MainNavigator';

dayjs.locale('fr');

type Nav  = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'MissionDetail'>;

const STATUS_COLORS: Record<MissionStatusValue, string> = {
  OPEN:       '#00897B', ASSIGNED:   '#F57F17',
  IN_TRANSIT: '#E65100', DELIVERED:  '#2E7D32',
  CANCELLED:  '#757575', DISPUTED:   '#C62828',
};

const STATUS_ICONS: Record<MissionStatusValue, string> = {
  OPEN:       'clock-outline',    ASSIGNED:  'account-check-outline',
  IN_TRANSIT: 'truck-fast',       DELIVERED: 'check-circle-outline',
  CANCELLED:  'close-circle-outline', DISPUTED: 'alert-circle-outline',
};

function InfoRow({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  return (
    <View style={ir.row}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color ?? C.textSecondary} style={{ width: 24 }} />
      <View style={ir.content}>
        <Text style={[ir.label, { color: C.textMuted }]}>{label}</Text>
        <Text style={[ir.value, { color: C.textPrimary }]}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  content: { flex: 1 },
  label:   { fontSize: 11 },
  value:   { fontSize: 14, fontWeight: '500', marginTop: 1 },
});

export default function MissionDetailScreen() {
  const nav   = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { missionId } = route.params;
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { userRole } = useAuthStore();
  const isDriver = userRole === 'DRIVER';
  const layout = useLayout();

  const [mission, setMission]   = useState<MissionResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number; speed?: number; heading?: number } | null>(null);
  const [wsSubId, setWsSubId]   = useState<string | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [distanceM, setDistanceM] = useState<number | undefined>(undefined);
  const [durationS, setDurationS] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const m = await getMissionDetailApi(missionId);
      setMission(m);
      if (m.status === 'IN_TRANSIT') {
        // Lancer les 3 initialisations en parallèle sans bloquer le rendu
        initTracking(m);
      }
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [missionId]);

  // Initialise le tracking : route OSRM + dernière position + WebSocket
  const initTracking = useCallback(async (m: MissionResponse) => {
    // 1. Route OSRM pour afficher le tracé
    if (m.originLat && m.originLng && m.destinationLat && m.destinationLng) {
      getRoute(m.originLat, m.originLng, m.destinationLat, m.destinationLng)
        .then(r => {
          setRouteCoords(r.coordinates);
          setDistanceM(r.distanceM);
          setDurationS(r.durationS);
        })
        .catch(() => {});
    }

    // 2. Dernière position connue depuis la BD (positionnement initial)
    getLatestDriverPositionApi(missionId)
      .then(pos => { if (pos) setDriverPos(pos); })
      .catch(() => {});

    // 3. Abonnement WebSocket pour les mises à jour temps réel
    try {
      if (!WebSocketService.isConnected) {
        const token = await SecureStore.getItemAsync('jwt_token');
        if (token) await WebSocketService.connect(token).catch(() => {});
      }
      const id = WebSocketService.subscribe(
        `/topic/mission/${missionId}/position`,
        (body: any) => {
          if (body && typeof body === 'object') {
            setDriverPos({ lat: body.lat, lng: body.lng, speed: body.speed, heading: body.heading });
          }
        }
      );
      setWsSubId(id);
    } catch {}
  }, [missionId]);

  useEffect(() => {
    load();
    return () => {
      if (wsSubId) WebSocketService.unsubscribe(wsSubId);
    };
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const handlePayment = () => {
    if (!mission) return;
    nav.navigate('Payment', {
      missionId,
      amount: mission.firstPaymentAmount ?? mission.totalPrice ?? 0,
      missionLabel: `${mission.originLabel} → ${mission.destinationLabel}`,
    });
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!mission) {
    return (
      <View style={[s.center, { backgroundColor: C.background }]}>
        <Text style={{ color: C.textSecondary }}>{t('err_not_found')}</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[mission.status as MissionStatusValue] ?? C.textSecondary;
  const statusIcon  = STATUS_ICONS[mission.status as MissionStatusValue] ?? 'help-circle-outline';
  const isInTransit = mission.status === 'IN_TRANSIT';
  const isAssigned  = mission.status === 'ASSIGNED';
  const isDelivered = mission.status === 'DELIVERED';
  const needsPayment = isAssigned && mission.paymentStatus === 'PENDING';

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={[statusColor, statusColor + 'CC']}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>

        <View style={s.statusRow}>
          <MaterialCommunityIcons name={statusIcon as any} size={28} color="#fff" />
          <Text style={s.statusTxt}>{t(`status_${mission.status}`)}</Text>
        </View>
        <Text style={s.routeTxt} numberOfLines={1}>
          {mission.originLabel} → {mission.destinationLabel}
        </Text>
        {mission.missionType === 'EXPRESS' && (
          <View style={s.expressBadge}><Text style={s.expressTxt}>EXPRESS ⚡</Text></View>
        )}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* === CARTE TRACKING (IN_TRANSIT) === */}
        {isInTransit && mission.originLat && mission.destinationLat && (
          <View style={s.mapCard}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>{t('map_tracking')}</Text>
            <View style={[s.mapContainer, { height: layout.mapHeight }]}>
              <ImporterTrackingMap
                originLat={mission.originLat}
                originLng={mission.originLng!}
                originLabel={mission.originLabel}
                destLat={mission.destinationLat}
                destLng={mission.destinationLng!}
                destLabel={mission.destinationLabel}
                driverPosition={driverPos}
                routeCoords={routeCoords.length > 0 ? routeCoords : undefined}
                distanceM={distanceM}
                durationS={durationS}
              />
            </View>
            {driverPos?.speed != null && (
              <View style={s.speedRow}>
                <MaterialCommunityIcons name="speedometer" size={16} color={C.primary} />
                <Text style={[s.speedTxt, { color: C.primary }]}>
                  {Math.round(driverPos.speed)} {t('common_kmh')}
                </Text>
                <Text style={[s.speedLbl, { color: C.textSecondary }]}>— Vitesse en temps réel</Text>
              </View>
            )}
          </View>
        )}

        {/* === PAIEMENT REQUIS (ASSIGNED + PENDING) === */}
        {needsPayment && (
          <View style={[s.alertCard, { backgroundColor: C.warningContainer, borderColor: C.warning }]}>
            <MaterialCommunityIcons name="alert-circle" size={22} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[s.alertTitle, { color: C.warning }]}>Paiement requis</Text>
              <Text style={[s.alertDesc, { color: C.textSecondary }]}>
                Versez {mission.firstPaymentAmount?.toLocaleString('fr-FR')} FCFA pour confirmer la mission
              </Text>
            </View>
          </View>
        )}

        {/* === INFORMATIONS MISSION === */}
        <View style={[s.card, { backgroundColor: C.surface }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Itinéraire</Text>
          <InfoRow icon="map-marker-outline" label={t('mission_origin')} value={mission.originLabel} color={C.primary} />
          <Divider style={{ backgroundColor: C.divider }} />
          <InfoRow icon="map-marker-check-outline" label={t('mission_destination')} value={mission.destinationLabel} color={C.secondary} />
          {mission.distanceKm && (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <InfoRow icon="road-variant" label="Distance" value={`${mission.distanceKm} km`} />
            </>
          )}
          {mission.pickupScheduledAt && (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <InfoRow icon="calendar-clock" label={t('mission_departure')}
                value={dayjs(mission.pickupScheduledAt).format('ddd D MMM YYYY [à] HH:mm')} />
            </>
          )}
        </View>

        {/* === CARGAISON === */}
        <View style={[s.card, { backgroundColor: C.surface }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>{t('mission_cargo')}</Text>
          <InfoRow icon="package-variant" label="Description" value={mission.cargoDescription} />
          {mission.cargoWeightTons && (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <InfoRow icon="weight" label={t('mission_weight')} value={`${mission.cargoWeightTons} ${t('common_tons')}`} />
            </>
          )}
          {mission.cargoType && (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <InfoRow icon="tag-outline" label="Type" value={t(`cargo_${mission.cargoType}`) || mission.cargoType} />
            </>
          )}
          {mission.specialInstructions && (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <InfoRow icon="note-text-outline" label={t('mission_instructions')} value={mission.specialInstructions} />
            </>
          )}
        </View>

        {/* === INTERLOCUTEUR (chauffeur pour l'importateur / importateur pour le chauffeur) === */}
        {(isDriver ? mission.importerName : mission.driverName) && (
          <View style={[s.card, { backgroundColor: C.surface }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>
              {isDriver ? 'Client / Producteur' : 'Transporteur'}
            </Text>
            <View style={s.driverRow}>
              <View style={[s.driverAvatar, { backgroundColor: C.primaryContainer }]}>
                <Text style={[s.driverInitials, { color: C.primary }]}>
                  {(isDriver ? mission.importerName : mission.driverName)!.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.driverName, { color: C.textPrimary }]}>
                  {isDriver ? mission.importerName : mission.driverName}
                </Text>
                {!isDriver && mission.driverPhone && (
                  <Text style={[s.driverPhone, { color: C.textSecondary }]}>{mission.driverPhone}</Text>
                )}
                {isDriver && mission.importerEmail && (
                  <Text style={[s.driverPhone, { color: C.textSecondary }]}>{mission.importerEmail}</Text>
                )}
              </View>
              {/* Bouton chat — disponible si mission partagée */}
              {(mission.driverId || isDriver) && mission.status !== 'CANCELLED' && (
                <Pressable
                  style={[s.chatBtn, { backgroundColor: C.primaryContainer }]}
                  onPress={() => nav.navigate('Chat', {
                    missionId,
                    otherPartyName: isDriver
                      ? (mission.importerName ?? 'Client')
                      : (mission.driverName ?? 'Chauffeur'),
                  })}
                >
                  <MaterialCommunityIcons name="message-outline" size={20} color={C.primary} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* === FINANCES === */}
        <View style={[s.card, { backgroundColor: C.surface }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>{t('pay_title')}</Text>
          <View style={s.financeRow}>
            <Text style={[s.finLabel, { color: C.textSecondary }]}>{t('mission_price')}</Text>
            <Text style={[s.finValue, { color: C.textPrimary }]}>
              {mission.totalPrice?.toLocaleString('fr-FR')} {t('common_fcfa')}
            </Text>
          </View>
          <Divider style={{ backgroundColor: C.divider }} />
          <View style={s.financeRow}>
            <Text style={[s.finLabel, { color: C.textSecondary }]}>Premier versement (50%)</Text>
            <Text style={[s.finValue, { color: needsPayment ? C.warning : C.textPrimary }]}>
              {mission.firstPaymentAmount?.toLocaleString('fr-FR')} {t('common_fcfa')}
            </Text>
          </View>
          <Divider style={{ backgroundColor: C.divider }} />
          <View style={s.financeRow}>
            <Text style={[s.finLabel, { color: C.textSecondary }]}>Statut paiement</Text>
            <Chip
              compact
              style={{ backgroundColor: statusColor + '22' }}
              textStyle={{ color: statusColor, fontSize: 11, fontWeight: '700' }}
            >
              {mission.paymentStatus ? t(`pay_${mission.paymentStatus.toLowerCase()}`) : '—'}
            </Chip>
          </View>
        </View>

        {/* === QR CODE LIVRAISON (visible seulement IN_TRANSIT) === */}
        {isInTransit && mission.qrDeliveryToken && (
          <View style={[s.card, { backgroundColor: C.surface, alignItems: 'center' }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>QR Code de livraison</Text>
            <View style={[s.qrWrap, { backgroundColor: '#fff', borderColor: C.outline }]}>
              <QRCode
                value={mission.qrDeliveryToken}
                size={160}
                color={C.primary}
                backgroundColor="#FFFFFF"
              />
            </View>
            <Text style={[s.qrHint, { color: C.textMuted }]}>
              Montrez ce code au chauffeur à la réception de la marchandise
            </Text>
          </View>
        )}

        {/* === ACTIONS SELON LE STATUT === */}

        {/* OPEN ou ASSIGNED sans paiement → Annuler la mission */}
        {(mission.status === 'OPEN' || (isAssigned && mission.paymentStatus === 'PENDING')) && (
          <Button
            mode="outlined"
            onPress={() => {
              Alert.alert('Annuler la mission', 'Voulez-vous vraiment annuler cette mission ?', [
                { text: 'Non', style: 'cancel' },
                { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
                  try {
                    const { cancelMission } = useMissionStore.getState();
                    await cancelMission(missionId);
                    nav.goBack();
                  } catch (e) { Alert.alert('Erreur', (e as Error).message); }
                }},
              ]);
            }}
            icon="close-circle-outline"
            style={s.actionBtn}
            contentStyle={s.actionBtnInner}
            textColor={C.error}
          >
            Annuler la mission
          </Button>
        )}

        {/* ASSIGNED + PENDING → Payer la 1ère tranche */}
        {needsPayment && (
          <Button
            mode="contained"
            onPress={handlePayment}
            icon="credit-card-outline"
            style={[s.actionBtn, { backgroundColor: C.secondary }]}
            contentStyle={s.actionBtnInner}
            labelStyle={s.actionBtnLabel}
          >
            Payer {mission.firstPaymentAmount?.toLocaleString('fr-FR')} FCFA
          </Button>
        )}

        {/* DELIVERED + paiement pas encore RELEASED et solde pas encore payé → Payer le solde */}
        {isDelivered && mission.paymentStatus !== 'RELEASED' && !mission.secondPaymentAt && (
          <Button
            mode="contained"
            onPress={() => {
              const solde = (mission.totalPrice ?? 0) - (mission.firstPaymentAmount ?? 0);
              nav.navigate('Payment', {
                missionId,
                amount: solde > 0 ? solde : mission.totalPrice ?? 0,
                missionLabel: `Solde — ${mission.originLabel} → ${mission.destinationLabel}`,
                isSecondPayment: true,
              });
            }}
            icon="cash-check"
            style={[s.actionBtn, { backgroundColor: C.primary }]}
            contentStyle={s.actionBtnInner}
            labelStyle={s.actionBtnLabel}
          >
            Finaliser le paiement du solde
          </Button>
        )}

        {/* DELIVERED + solde déjà payé → message d'attente */}
        {isDelivered && mission.secondPaymentAt && mission.paymentStatus !== 'RELEASED' && (
          <View style={[s.alertCard, { backgroundColor: C.successContainer, borderColor: C.success }]}>
            <MaterialCommunityIcons name="clock-check-outline" size={22} color={C.success} />
            <View style={{ flex: 1 }}>
              <Text style={[s.alertTitle, { color: C.success }]}>Solde reçu — en attente libération</Text>
              <Text style={[s.alertDesc, { color: C.textSecondary }]}>
                L'admin libérera les fonds au transporteur sous 24h.
              </Text>
            </View>
          </View>
        )}

        {/* DELIVERED → Noter le chauffeur */}
        {isDelivered && mission.driverName && (
          <Button
            mode="contained"
            onPress={() => nav.navigate('Rating', {
              missionId,
              reviewedName: mission.driverName ?? 'Chauffeur',
            })}
            icon="star-outline"
            style={[s.actionBtn, { backgroundColor: '#F9A825' }]}
            contentStyle={s.actionBtnInner}
            labelStyle={s.actionBtnLabel}
          >
            Noter le transporteur
          </Button>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  backBtn: { padding: 4, marginBottom: 12, alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusTxt: { fontSize: 20, fontWeight: '800', color: '#fff' },
  routeTxt: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 8 },
  expressBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  expressTxt: { fontSize: 12, fontWeight: '800', color: '#fff' },

  content: { padding: 16, gap: 12 },

  card: { borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },

  mapCard: { borderRadius: 14, overflow: 'hidden', elevation: 2, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  mapContainer: { height: 280, borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  speedTxt: { fontSize: 16, fontWeight: '700' },
  speedLbl: { fontSize: 12 },

  alertCard: { borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700' },
  alertDesc: { fontSize: 13, marginTop: 2, lineHeight: 18 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  driverInitials: { fontSize: 18, fontWeight: '800' },
  driverName: { fontSize: 15, fontWeight: '700' },
  driverPhone: { fontSize: 12, marginTop: 2 },
  chatBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  financeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  finLabel: { fontSize: 13 },
  finValue: { fontSize: 14, fontWeight: '700' },

  qrWrap: { padding: 16, borderRadius: 12, borderWidth: 1, marginVertical: 12 },
  qrHint: { fontSize: 12, textAlign: 'center' },

  actionBtn: { marginTop: 4, borderRadius: 12 },
  actionBtnInner: { height: 52 },
  actionBtnLabel: { fontSize: 16, fontWeight: '700' },
});
