// Détail mission + QR Code + flux paiement séquestre (MTN MoMo / Orange Money)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getMissionDetailApi } from '../../api/missions.api';
import {
  initiateMtnMomoApi,
  initiateOrangeMoneyApi,
  getPaymentStatusApi,
} from '../../api/payment.api';
import type { MissionDto } from '../../api/missions.api';
import type { PaymentInitResult } from '../../api/payment.api';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { StatusChip } from '../../components/common/StatusChip';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

dayjs.locale('fr');

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'MissionDetail'>;

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING:   '#F57F17',
  ESCROWED:  '#0277BD',
  RELEASED:  '#2E7D32',
  REFUNDED:  '#6A1B9A',
  DISPUTED:  '#B71C1C',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING:  'En attente',
  ESCROWED: 'Séquestré',
  RELEASED: 'Libéré',
  REFUNDED: 'Remboursé',
  DISPUTED: 'Contesté',
};

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string; color?: string;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconWrap}>
        <MaterialCommunityIcons name={icon as any} size={18} color={color ?? '#1B5E20'} />
      </View>
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, color ? { color } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F1F8E9', alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1 },
  label: { fontSize: 11, color: '#9E9E9E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, fontWeight: '700', color: '#212121', marginTop: 1 },
});

// ─── Modal paiement ───────────────────────────────────────────────────────────

function PaymentModal({
  visible,
  missionId,
  amount,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  missionId: string;
  amount: number;
  onClose: () => void;
  onSuccess: (result: PaymentInitResult) => void;
}) {
  const [provider, setProvider] = useState<'MTN_MOMO' | 'ORANGE_MONEY'>('MTN_MOMO');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) {
      setError('Numéro de téléphone invalide');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = provider === 'MTN_MOMO'
        ? await initiateMtnMomoApi(missionId, cleaned)
        : await initiateOrangeMoneyApi(missionId, cleaned);
      onSuccess(result);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur paiement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>Paiement sécurisé</Text>
          <Text style={modalStyles.amount}>{amount.toLocaleString()} FCFA</Text>
          <Text style={modalStyles.escrowNote}>Fonds séquestrés — libérés à la livraison</Text>

          {/* Choix opérateur */}
          <View style={modalStyles.providerRow}>
            {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[modalStyles.providerBtn, provider === p && modalStyles.providerBtnActive]}
                onPress={() => setProvider(p)}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={p === 'MTN_MOMO' ? 'cellphone' : 'cellphone-wireless'}
                  size={20}
                  color={provider === p ? '#FFFFFF' : '#616161'}
                />
                <Text style={[modalStyles.providerLabel, provider === p && { color: '#FFFFFF' }]}>
                  {p === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Saisie numéro */}
          <View style={modalStyles.inputWrap}>
            <MaterialCommunityIcons name="phone" size={18} color="#9E9E9E" style={{ marginRight: 8 }} />
            <TextInput
              style={modalStyles.input}
              placeholder="Ex: +237 6XX XXX XXX"
              placeholderTextColor="#BDBDBD"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={16}
            />
          </View>

          {error && (
            <View style={modalStyles.errorRow}>
              <MaterialCommunityIcons name="alert-circle" size={15} color="#B71C1C" />
              <Text style={modalStyles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[modalStyles.payBtn, loading && { opacity: 0.7 }]}
            onPress={handlePay}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="lock" size={18} color="#FFFFFF" />
                <Text style={modalStyles.payBtnText}>Payer {amount.toLocaleString()} FCFA</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={modalStyles.cancelBtn}>
            <Text style={modalStyles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 14,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0',
    alignSelf: 'center', marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#212121', textAlign: 'center' },
  amount: { fontSize: 28, fontWeight: '900', color: '#1B5E20', textAlign: 'center' },
  escrowNote: { fontSize: 12, color: '#0277BD', textAlign: 'center', fontWeight: '600' },
  providerRow: { flexDirection: 'row', gap: 10 },
  providerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#E0E0E0',
    justifyContent: 'center',
  },
  providerBtnActive: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  providerLabel: { fontSize: 13, fontWeight: '700', color: '#616161' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 16, color: '#212121' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 12, color: '#B71C1C', flex: 1 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1B5E20', borderRadius: 14, paddingVertical: 16,
    elevation: 4, shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  payBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, color: '#9E9E9E', fontWeight: '600' },
});

// ─── Screen principal ─────────────────────────────────────────────────────────

export default function MissionDetailScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();

  const { missionId } = route.params;

  const [mission, setMission] = useState<MissionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentDone, setPaymentDone] = useState<PaymentInitResult | null>(null);
  const [showQR, setShowQR] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadMission = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await getMissionDetailApi(missionId);
      setMission(m);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (err: any) {
      setError(err?.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => { loadMission(); }, [loadMission]);

  const handlePaymentSuccess = useCallback((result: PaymentInitResult) => {
    setShowPayment(false);
    setPaymentDone(result);
    loadMission();
  }, [loadMission]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1B5E20" />
        <Text style={styles.loadingText}>Chargement de la mission…</Text>
      </View>
    );
  }

  if (error || !mission) {
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="alert-circle-outline" size={56} color="#BDBDBD" />
        <Text style={styles.errorTitle}>Impossible de charger la mission</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadMission}>
          <Text style={styles.retryBtnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isEscrowed  = mission.paymentStatus === 'ESCROWED';
  const isReleased  = mission.paymentStatus === 'RELEASED';
  const isPaid      = isEscrowed || isReleased;
  const hasQR       = !!mission.qrDeliveryToken;
  const payStatusColor = PAYMENT_STATUS_COLORS[mission.paymentStatus ?? 'PENDING'] ?? '#9E9E9E';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Header ─── */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        locations={[0, 0.55, 1]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerBody}>
          <View style={styles.routeHeaderRow}>
            <MaterialCommunityIcons name="map-marker" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.routeHeaderText} numberOfLines={1}>{mission.originLabel}</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.routeHeaderText} numberOfLines={1}>{mission.destinationLabel}</Text>
          </View>
          <View style={styles.headerMeta}>
            <StatusChip status={mission.status} />
            <View style={[styles.payBadge, { backgroundColor: `${payStatusColor}25`, borderColor: payStatusColor }]}>
              <Text style={[styles.payBadgeText, { color: payStatusColor }]}>
                {PAYMENT_STATUS_LABELS[mission.paymentStatus ?? 'PENDING']}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions header */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('DocumentScan', { missionId })}
          >
            <MaterialCommunityIcons name="file-search" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => navigation.navigate('Alert', { missionId })}
          >
            <MaterialCommunityIcons name="alert-octagon" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Animated.View style={[styles.scrollWrap, { opacity: fadeAnim }]}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Prix & finances ─── */}
          <View style={styles.financeCard}>
            <LinearGradient colors={['#E8F5E9', '#F1F8E9']} style={styles.financeGradient}>
              <Text style={styles.financeTitle}>Résumé financier</Text>
              <View style={styles.financeRow}>
                <View style={styles.financeStat}>
                  <Text style={styles.financeStatLabel}>Prix total</Text>
                  <Text style={styles.financeStatValue}>
                    {(mission.totalPrice ?? 0).toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={styles.financeDivider} />
                <View style={styles.financeStat}>
                  <Text style={styles.financeStatLabel}>Commission (7.5%)</Text>
                  <Text style={[styles.financeStatValue, { color: '#E65100' }]}>
                    {(mission.commissionAmount ?? 0).toLocaleString()} FCFA
                  </Text>
                </View>
                <View style={styles.financeDivider} />
                <View style={styles.financeStat}>
                  <Text style={styles.financeStatLabel}>Chauffeur</Text>
                  <Text style={[styles.financeStatValue, { color: '#1B5E20' }]}>
                    {(mission.driverPayout ?? 0).toLocaleString()} FCFA
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* ─── Informations mission ─── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Détails de la mission</Text>
            <InfoRow icon="map-marker-outline"  label="Origine"      value={mission.originLabel} />
            <View style={styles.divider} />
            <InfoRow icon="map-marker-check"    label="Destination"  value={mission.destinationLabel} />
            <View style={styles.divider} />
            <InfoRow icon="package-variant"     label="Marchandise"  value={mission.cargoDescription ?? '—'} />
            {mission.cargoWeightTons != null && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="weight-kilogram"   label="Poids"        value={`${mission.cargoWeightTons} tonnes`} />
              </>
            )}
            {mission.cargoType && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="tag-outline"        label="Type cargo"   value={mission.cargoType} />
              </>
            )}
            {mission.paymentMethod && (
              <>
                <View style={styles.divider} />
                <InfoRow icon="bank-outline" label="Mode de paiement" value={mission.paymentMethod.replace('_', ' ')} />
              </>
            )}
            <View style={styles.divider} />
            <InfoRow
              icon="calendar-outline"
              label="Créée le"
              value={dayjs(mission.createdAt).format('D MMM YYYY [à] HH:mm')}
            />
            {mission.startedAt && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="play-circle-outline"
                  label="Démarrée le"
                  value={dayjs(mission.startedAt).format('D MMM YYYY [à] HH:mm')}
                />
              </>
            )}
            {mission.deliveredAt && (
              <>
                <View style={styles.divider} />
                <InfoRow
                  icon="check-circle-outline"
                  label="Livrée le"
                  value={dayjs(mission.deliveredAt).format('D MMM YYYY [à] HH:mm')}
                  color="#2E7D32"
                />
              </>
            )}
          </View>

          {/* ─── Instructions spéciales ─── */}
          {mission.specialInstructions && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Instructions spéciales</Text>
              <Text style={styles.specialInstructions}>{mission.specialInstructions}</Text>
            </View>
          )}

          {/* ─── QR Code livraison ─── */}
          {hasQR && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>QR Code de livraison</Text>
              <Text style={styles.qrExplain}>
                Le destinataire scanne ce code à la réception pour confirmer la livraison et libérer le paiement.
              </Text>
              <TouchableOpacity
                style={styles.qrContainer}
                onPress={() => setShowQR(true)}
                activeOpacity={0.8}
              >
                <QRCode
                  value={mission.qrDeliveryToken!}
                  size={180}
                  color="#1B5E20"
                  backgroundColor="transparent"
                />
                <View style={styles.qrTapHint}>
                  <MaterialCommunityIcons name="fullscreen" size={14} color="#9E9E9E" />
                  <Text style={styles.qrTapText}>Appuyer pour agrandir</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Résultat paiement ─── */}
          {paymentDone && (
            <View style={[styles.card, styles.successCard]}>
              <MaterialCommunityIcons name="check-circle" size={28} color="#2E7D32" />
              <Text style={styles.successCardTitle}>Paiement initié !</Text>
              <Text style={styles.successCardSub}>
                Réf. {paymentDone.referenceId.slice(0, 16)}… · {paymentDone.provider.replace('_', ' ')}
              </Text>
            </View>
          )}

          {/* ─── Bouton paiement ─── */}
          {!isPaid && (
            <TouchableOpacity
              style={styles.payActionBtn}
              onPress={() => setShowPayment(true)}
              activeOpacity={0.85}
            >
              <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.payActionGradient}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#FFFFFF" />
                <Text style={styles.payActionText}>Payer & séquestrer les fonds</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {isPaid && !isReleased && (
            <View style={styles.escrowedBanner}>
              <MaterialCommunityIcons name="bank-outline" size={22} color="#0277BD" />
              <Text style={styles.escrowedText}>
                Fonds séquestrés — seront libérés au chauffeur après livraison QR
              </Text>
            </View>
          )}

          {isReleased && (
            <View style={styles.releasedBanner}>
              <MaterialCommunityIcons name="check-all" size={22} color="#2E7D32" />
              <Text style={styles.releasedText}>
                Livraison confirmée — paiement chauffeur libéré
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>

      {/* ─── Modal paiement ─── */}
      <PaymentModal
        visible={showPayment}
        missionId={missionId}
        amount={mission.totalPrice ?? 0}
        onClose={() => setShowPayment(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* ─── QR agrandi ─── */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity
          style={qrModalStyles.overlay}
          activeOpacity={1}
          onPress={() => setShowQR(false)}
        >
          <View style={qrModalStyles.box}>
            <Text style={qrModalStyles.title}>QR Code livraison</Text>
            <QRCode
              value={mission.qrDeliveryToken!}
              size={260}
              color="#1B5E20"
              backgroundColor="white"
            />
            <Text style={qrModalStyles.hint}>Appuyer n'importe où pour fermer</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const qrModalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },
  box: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32,
    alignItems: 'center', gap: 16,
    elevation: 20,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1B5E20' },
  hint: { fontSize: 12, color: '#9E9E9E' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  loadingText: { fontSize: 14, color: '#9E9E9E' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#424242', textAlign: 'center' },
  retryBtn: { backgroundColor: '#1B5E20', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },

  header: { paddingHorizontal: 20, paddingBottom: 18 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  headerBody: { gap: 8 },
  routeHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  routeHeaderText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1, maxWidth: 120 },
  headerMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  payBadge: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  payBadgeText: { fontSize: 11, fontWeight: '700' },
  headerActions: {
    position: 'absolute', right: 20, top: 0, flexDirection: 'row', gap: 8,
  },
  headerActionBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },

  scrollWrap: { flex: 1 },
  content: { padding: 16, gap: 14 },

  financeCard: { borderRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  financeGradient: { padding: 16, gap: 14 },
  financeTitle: { fontSize: 12, fontWeight: '700', color: '#616161', textTransform: 'uppercase', letterSpacing: 0.5 },
  financeRow: { flexDirection: 'row', alignItems: 'center' },
  financeStat: { flex: 1, alignItems: 'center', gap: 2 },
  financeStatLabel: { fontSize: 10, color: '#9E9E9E', fontWeight: '600', textAlign: 'center' },
  financeStatValue: { fontSize: 14, fontWeight: '800', color: '#212121', textAlign: 'center' },
  financeDivider: { width: 1, height: 36, backgroundColor: '#C8E6C9' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, gap: 4,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#9E9E9E', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  divider: { height: 1, backgroundColor: '#F5F5F5', marginVertical: 2 },

  specialInstructions: { fontSize: 14, color: '#424242', lineHeight: 20 },

  qrExplain: { fontSize: 13, color: '#9E9E9E', lineHeight: 18, marginBottom: 8 },
  qrContainer: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  qrTapHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qrTapText: { fontSize: 12, color: '#9E9E9E' },

  payActionBtn: { borderRadius: 16, overflow: 'hidden', elevation: 5, shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  payActionGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16,
  },
  payActionText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  escrowedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E3F2FD', borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#0277BD',
  },
  escrowedText: { fontSize: 13, color: '#0277BD', flex: 1, lineHeight: 18, fontWeight: '600' },

  releasedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#E8F5E9', borderRadius: 14, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#2E7D32',
  },
  releasedText: { fontSize: 13, color: '#2E7D32', flex: 1, lineHeight: 18, fontWeight: '600' },

  successCard: {
    alignItems: 'center', gap: 6, paddingVertical: 20,
    backgroundColor: '#E8F5E9',
  },
  successCardTitle: { fontSize: 16, fontWeight: '800', color: '#2E7D32' },
  successCardSub: { fontSize: 12, color: '#4CAF50' },
});
