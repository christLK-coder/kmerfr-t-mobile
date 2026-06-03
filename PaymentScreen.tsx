import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, Alert, TextInput, Pressable,
} from 'react-native';
import { Text, Button, RadioButton, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { usePaymentSheet } from '@stripe/stripe-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { initiateStripePaymentApi, initiateMonetbillPaymentApi, getPaymentStatusApi } from '../../api/missions.api';
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

  const { missionId, amount, missionLabel } = route.params;

  const [method, setMethod] = useState<PaymentMethod>('MTN_MOMO');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();

  const handleStripePayment = useCallback(async () => {
    setLoading(true);
    try {
      const { clientSecret } = await initiateStripePaymentApi(missionId);

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

      Alert.alert('Paiement confirme', 'Votre paiement par carte a ete enregistre.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [missionId, initPaymentSheet, presentPaymentSheet, nav]);

  const handleMobileMoneyPayment = useCallback(async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Numero invalide', 'Saisissez un numero de telephone valide (ex: 691234567).');
      return;
    }
    const fullPhone = cleaned.startsWith('237') ? cleaned : `237${cleaned}`;

    setLoading(true);
    try {
      const { paymentRef } = await initiateMonetbillPaymentApi(missionId, fullPhone);

      Alert.alert(
        'Confirmez sur votre telephone',
        `Un message USSD a ete envoye au ${cleaned}.\nConfirmez le paiement depuis votre telephone puis attendez.`,
      );

      setPolling(true);
      let attempts = 0;
      const maxAttempts = 24;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const status = await getPaymentStatusApi(missionId);
          if (status === 'ESCROWED' || status === 'CONFIRMED') {
            clearInterval(pollInterval);
            setPolling(false);
            Alert.alert('Paiement confirme', 'Votre paiement Mobile Money a ete recu.', [
              { text: 'OK', onPress: () => nav.goBack() },
            ]);
          }
        } catch {}
        if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setPolling(false);
          Alert.alert('Delai depasse', 'Le paiement n\'a pas ete confirme. Verifiez dans le detail de la mission.');
        }
      }, 5000);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [missionId, phone, nav]);

  const handlePay = () => {
    if (method === 'STRIPE') handleStripePayment();
    else handleMobileMoneyPayment();
  };

  const formattedAmount = amount?.toLocaleString('fr-FR') ?? '0';

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.primary, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>{t('pay_title')}</Text>
        <Text style={s.headerSub}>{missionLabel}</Text>
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* Montant */}
        <View style={[s.amountCard, { backgroundColor: C.surface }]}>
          <Text style={[s.amountLabel, { color: C.textSecondary }]}>Montant a payer</Text>
          <Text style={[s.amountValue, { color: C.primary }]}>{formattedAmount} FCFA</Text>
        </View>

        {/* Methode */}
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
            </Pressable>

            <Divider style={{ backgroundColor: C.divider }} />

            <Pressable style={s.radioRow} onPress={() => setMethod('STRIPE')}>
              <RadioButton value="STRIPE" color={C.primary} />
              <View style={[s.providerIcon, { backgroundColor: '#635BFF' }]}>
                <MaterialCommunityIcons name="credit-card-outline" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.radioLabel, { color: C.textPrimary }]}>Carte bancaire</Text>
                <Text style={[s.radioDesc, { color: C.textSecondary }]}>Visa / Mastercard (Stripe)</Text>
              </View>
            </Pressable>
          </RadioButton.Group>
        </View>

        {/* Champ telephone pour Mobile Money */}
        {(method === 'MTN_MOMO' || method === 'ORANGE_MONEY') && (
          <View style={[s.card, { backgroundColor: C.surface }]}>
            <Text style={[s.sectionTitle, { color: C.textSecondary }]}>
              Numero {method === 'MTN_MOMO' ? 'MTN' : 'Orange'}
            </Text>
            <View style={[s.phoneInput, { borderColor: C.outline }]}>
              <Text style={[s.phonePrefix, { color: C.textSecondary }]}>+237</Text>
              <TextInput
                style={[s.phoneField, { color: C.textPrimary }]}
                placeholder="691 234 567"
                placeholderTextColor={C.textMuted}
                keyboardType="phone-pad"
                maxLength={12}
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>
        )}

        {/* Polling indicator */}
        {polling && (
          <View style={[s.pollingCard, { backgroundColor: C.primaryContainer }]}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={[s.pollingText, { color: C.primary }]}>
              En attente de confirmation sur votre telephone...
            </Text>
          </View>
        )}

        {/* Bouton payer */}
        <Button
          mode="contained"
          onPress={handlePay}
          loading={loading}
          disabled={loading || polling}
          icon={method === 'STRIPE' ? 'credit-card-outline' : 'cellphone'}
          style={[s.payBtn, { backgroundColor: C.secondary }]}
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
  header: { paddingHorizontal: 16, paddingBottom: 20 },
  backBtn: { padding: 4, marginBottom: 12, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  content: { padding: 16, gap: 14 },

  amountCard: { borderRadius: 14, padding: 24, alignItems: 'center', elevation: 1 },
  amountLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  amountValue: { fontSize: 32, fontWeight: '800', marginTop: 8 },

  card: { borderRadius: 14, padding: 16, elevation: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },

  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  providerIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  radioLabel: { fontSize: 15, fontWeight: '600' },
  radioDesc: { fontSize: 12, marginTop: 1 },

  phoneInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 50, marginTop: 4 },
  phonePrefix: { fontSize: 15, fontWeight: '600', marginRight: 8 },
  phoneField: { flex: 1, fontSize: 16, fontWeight: '500' },

  pollingCard: { borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pollingText: { fontSize: 13, fontWeight: '600', flex: 1 },

  payBtn: { marginTop: 8, borderRadius: 12 },
  payBtnInner: { height: 54 },
  payBtnLabel: { fontSize: 17, fontWeight: '700' },
});
