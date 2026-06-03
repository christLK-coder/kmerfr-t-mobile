import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, TextInput, Pressable,
} from 'react-native';
import { Text, Button, RadioButton, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  initiateStripePaymentApi,
  initiateMonetbillPaymentApi,
  initiateSecondStripeApi,
  initiateSecondMonetbillApi,
  getPaymentStatusApi,
} from '../../api/missions.api';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav   = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, 'Payment'>;

type PaymentMethod = 'STRIPE' | 'MTN_MOMO' | 'ORANGE_MONEY';

export default function PaymentScreen() {
  const nav    = useNavigation<Nav>();
  const route  = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const { missionId, amount, missionLabel, isSecondPayment } = route.params;

  const [method, setMethod] = useState<PaymentMethod>('MTN_MOMO');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  const handleStripePayment = useCallback(async () => {
    setLoading(true);
    try {
      const { clientSecret } = isSecondPayment
        ? await initiateSecondStripeApi(missionId)
        : await initiateStripePaymentApi(missionId);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'KmerFret',
        defaultBillingDetails: { address: { country: 'CM' } },
      });
      if (initError) {
        Alert.alert('Erreur', initError.message);
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Erreur paiement', presentError.message);
        }
        return;
      }

      Alert.alert(
        isSecondPayment ? 'Solde confirmé' : 'Paiement confirmé',
        isSecondPayment
          ? 'Votre paiement du solde a été enregistré. Les fonds seront versés au transporteur sous 24h.'
          : 'Votre paiement par carte a été enregistré.',
        [{ text: 'OK', onPress: () => nav.goBack() }],
      );
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [missionId, isSecondPayment, initPaymentSheet, presentPaymentSheet, nav]);

  const handleMobileMoneyPayment = useCallback(async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Numéro invalide', 'Saisissez un numéro de téléphone valide (ex: 691234567).');
      return;
    }
    const fullPhone = cleaned.startsWith('237') ? cleaned : `237${cleaned}`;

    setLoading(true);
    try {
      if (isSecondPayment) {
        await initiateSecondMonetbillApi(missionId, fullPhone);
      } else {
        await initiateMonetbillPaymentApi(missionId, fullPhone);
      }

      Alert.alert(
        'Confirmez sur votre téléphone',
        `Un message USSD a été envoyé au ${cleaned}.\nConfirmez le paiement depuis votre téléphone puis attendez.`,
      );

      setPolling(true);
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const status = await getPaymentStatusApi(missionId);
          const confirmed = isSecondPayment
            ? status === 'ESCROWED' || status === 'RELEASED'
            : status === 'ESCROWED' || status === 'CONFIRMED';

          if (confirmed) {
            clearInterval(pollInterval);
            setPolling(false);
            Alert.alert(
              isSecondPayment ? 'Solde reçu' : 'Paiement confirmé',
              isSecondPayment
                ? 'Votre paiement du solde a été reçu. Les fonds seront versés au transporteur sous 24h.'
                : 'Votre paiement Mobile Money a été reçu.',
              [{ text: 'OK', onPress: () => nav.goBack() }],
            );
          }
        } catch {}
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setPolling(false);
          Alert.alert('Délai dépassé', 'Le paiement n\'a pas été confirmé. Vérifiez dans le détail de la mission.');
        }
      }, 5000);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [missionId, isSecondPayment, phone, nav]);

  const handlePay = () => {
    if (method === 'STRIPE') handleStripePayment();
    else handleMobileMoneyPayment();
  };

  const formattedAmount = amount?.toLocaleString('fr-FR') ?? '0';
  const headerTitle = isSecondPayment ? 'Paiement du solde' : t('pay_title');

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header gradient */}
      <LinearGradient
        colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[s.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{headerTitle}</Text>
        <Text style={s.headerSub} numberOfLines={1}>{missionLabel}</Text>
        {isSecondPayment && (
          <View style={s.soldeTag}>
            <MaterialCommunityIcons name="lock-open-variant-outline" size={13} color="#fff" />
            <Text style={s.soldeTxt}>Solde — libération sous 24h</Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        {/* Carte montant */}
        <View style={[s.amountCard, { backgroundColor: C.surface }]}>
          <View style={[s.amountIconBg, { backgroundColor: C.primaryContainer }]}>
            <MaterialCommunityIcons
              name={isSecondPayment ? 'cash-check' : 'credit-card-clock-outline'}
              size={28}
              color={C.primary}
            />
          </View>
          <Text style={[s.amountLabel, { color: C.textSecondary }]}>
            {isSecondPayment ? 'Solde à verser' : 'Montant à payer'}
          </Text>
          <Text style={[s.amountValue, { color: C.primary }]}>{formattedAmount}</Text>
          <Text style={[s.amountUnit, { color: C.textMuted }]}>FCFA</Text>
        </View>

        {/* Méthode de paiement */}
        <View style={[s.card, { backgroundColor: C.surface }]}>
          <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Mode de paiement</Text>

          <RadioButton.Group onValueChange={(v) => setMethod(v as PaymentMethod)} value={method}>
            <Pressable style={s.radioRow} onPress={() => setMethod('MTN_MOMO')}>
              <RadioButton value="MTN_MOMO" color={C.primary} />
              <View style={[s.providerIcon, { backgroundColor: '#FFCC00' }]}>
                <MaterialCommunityIcons name="cellphone" size={18} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.radioLabel, { color: C.textPrimary }]}>MTN Mobile Money</Text>
                <Text style={[s.radioDesc, { color: C.textSecondary }]}>Paiement via USSD</Text>
              </View>
              {method === 'MTN_MOMO' && (
                <MaterialCommunityIcons name="check-circle" size={18} color={C.primary} />
              )}
            </Pressable>

            <Divider style={{ backgroundColor: C.divider }} />

            <Pressable style={s.radioRow} onPress={() => setMethod('ORANGE_MONEY')}>
              <RadioButton value="ORANGE_MONEY" color={C.primary} />
              <View style={[s.providerIcon, { backgroundColor: '#FF6600' }]}>
                <MaterialCommunityIcons name="cellphone" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.radioLabel, { color: C.textPrimary }]}>Orange Money</Text>
                <Text style={[s.radioDesc, { color: C.textSecondary }]}>Paiement via USSD</Text>
              </View>
              {method === 'ORANGE_MONEY' && (
                <MaterialCommunityIcons name="check-circle" size={18} color={C.primary} />
              )}
            </Pressable>

            <Divider style={{ backgroundColor: C.divider }} />

            <Pressable style={s.radioRow} onPress={() => setMethod('STRIPE')}>
              <RadioButton value="STRIPE" color={C.primary} />
              <View style={[s.providerIcon, { backgroundColor: C.primary }]}>
                <MaterialCommunityIcons name="credit-card-outline" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.radioLabel, { color: C.textPrimary }]}>Carte bancaire</Text>
                <Text style={[s.radioDesc, { color: C.textSecondary }]}>Visa / Mastercard (Stripe)</Text>
              </View>
              {method === 'STRIPE' && (
                <MaterialCommunityIcons name="check-circle" size={18} color={C.primary} />
              )}
            </Pressable>
          </RadioButton.Group>
        </View>

        {/* Champ téléphone Mobile Money */}
        {(method === 'MTN_MOMO' || method === 'ORANGE_MONEY') && (
          <View style={[s.card, { backgroundColor: C.surface }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>
              Numéro {method === 'MTN_MOMO' ? 'MTN' : 'Orange'}
            </Text>
            <View style={[s.phoneInput, { borderColor: C.primary, backgroundColor: C.primaryContainer + '30' }]}>
              <Text style={[s.phonePrefix, { color: C.primary }]}>+237</Text>
              <TextInput
                style={[s.phoneField, { color: C.textPrimary }]}
                placeholder="691 234 567"
                placeholderTextColor={C.textMuted}
                keyboardType="phone-pad"
                maxLength={12}
                value={phone}
                onChangeText={setPhone}
              />
              <MaterialCommunityIcons name="cellphone" size={18} color={C.primary} />
            </View>
          </View>
        )}

        {/* Indicateur de polling */}
        {polling && (
          <View style={[s.pollingCard, { backgroundColor: C.primaryContainer }]}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={[s.pollingText, { color: C.primary }]}>
              En attente de confirmation sur votre téléphone...
            </Text>
          </View>
        )}

        {/* Sécurité */}
        <View style={[s.secureRow, { borderColor: C.divider }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={C.success} />
          <Text style={[s.secureTxt, { color: C.textMuted }]}>
            Paiement sécurisé — {isSecondPayment ? 'fonds libérés sous 24h' : 'séquestré jusqu\'à livraison'}
          </Text>
        </View>

        {/* Bouton payer */}
        <Button
          mode="contained"
          onPress={handlePay}
          loading={loading}
          disabled={loading || polling}
          icon={method === 'STRIPE' ? 'credit-card-outline' : 'cellphone'}
          style={[s.payBtn, { backgroundColor: C.primary }]}
          contentStyle={s.payBtnInner}
          labelStyle={s.payBtnLabel}
        >
          Payer {formattedAmount} FCFA
        </Button>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 22 },
  backBtn: { padding: 4, marginBottom: 14, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  soldeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 10, alignSelf: 'flex-start',
  },
  soldeTxt: { fontSize: 11, fontWeight: '600', color: '#fff' },

  content: { padding: 16, gap: 14 },

  amountCard: {
    borderRadius: 16, padding: 24, alignItems: 'center', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    gap: 6,
  },
  amountIconBg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  amountLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 38, fontWeight: '800', lineHeight: 44 },
  amountUnit: { fontSize: 14, fontWeight: '600' },

  card: {
    borderRadius: 14, padding: 16, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },

  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  providerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioLabel: { fontSize: 15, fontWeight: '600' },
  radioDesc: { fontSize: 12, marginTop: 1 },

  phoneInput: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52, marginTop: 4, gap: 4,
  },
  phonePrefix: { fontSize: 15, fontWeight: '700', marginRight: 4 },
  phoneField: { flex: 1, fontSize: 16, fontWeight: '500' },

  pollingCard: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pollingText: { fontSize: 13, fontWeight: '600', flex: 1 },

  secureRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, padding: 12,
  },
  secureTxt: { fontSize: 12, flex: 1 },

  payBtn: { marginTop: 4, borderRadius: 14 },
  payBtnInner: { height: 56 },
  payBtnLabel: { fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
});
