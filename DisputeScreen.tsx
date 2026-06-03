// Ecran de litige — signaler un probleme sur une mission
import React, { useState } from 'react';
import {
  View, StyleSheet, StatusBar, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../api/axios.config';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'Dispute'>;

const DISPUTE_TYPES = [
  { value: 'DAMAGED_GOODS',   label: 'Marchandise endommagee', icon: 'package-variant-closed-remove' },
  { value: 'PAYMENT_ISSUE',   label: 'Probleme de paiement',   icon: 'cash-remove' },
  { value: 'DELAY',           label: 'Retard de livraison',     icon: 'clock-alert' },
  { value: 'DRIVER_BEHAVIOR', label: 'Comportement chauffeur',  icon: 'account-alert' },
  { value: 'ROUTE_CHANGE',    label: 'Changement de route',     icon: 'road' },
  { value: 'OTHER',           label: 'Autre probleme',          icon: 'dots-horizontal-circle' },
] as const;

export default function DisputeScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { missionId } = route.params;

  const [type, setType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!type) { Alert.alert(t('dispute_reason'), t('val_required')); return; }
    if (!description.trim() || description.length < 20) {
      Alert.alert(t('dispute_desc'), 'Minimum 20 caracteres'); return;
    }
    setLoading(true);
    try {
      await api.post('/api/disputes', { missionId, disputeType: type, description: description.trim() });
      setDone(true);
    } catch (err: any) {
      Alert.alert(t('err_unknown'), err?.response?.data?.message ?? t('err_server'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[C.error, C.error + 'CC']}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={C.textInverted} />
        </TouchableOpacity>
        <MaterialCommunityIcons name="shield-alert" size={30} color={C.textInverted} />
        <Text style={[styles.headerTitle, { color: C.textInverted }]}>{t('dispute_title')}</Text>
        <Text style={[styles.headerSub, { color: C.textInverted + 'BB' }]}>
          {t('dispute_open')} — 24h
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {done ? (
          <View style={[styles.doneCard, { backgroundColor: C.surface }]}>
            <MaterialCommunityIcons name="check-circle" size={64} color={C.success} />
            <Text style={[styles.doneTitle, { color: C.success }]}>{t('dispute_open')}</Text>
            <Text style={[styles.doneSub, { color: C.textSecondary }]}>
              Le paiement est gele jusqu'a resolution. L'equipe KmerFret vous contactera sous 24h.
            </Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.doneBtnText, { color: C.onPrimary }]}>{t('common_back')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Type de litige */}
            <View style={[styles.card, { backgroundColor: C.surface }]}>
              <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{t('dispute_reason')}</Text>
              <View style={styles.typeGrid}>
                {DISPUTE_TYPES.map(dt => {
                  const active = type === dt.value;
                  return (
                    <TouchableOpacity
                      key={dt.value}
                      style={[
                        styles.typeChip,
                        {
                          borderColor: active ? C.error : C.outline,
                          backgroundColor: active ? C.errorContainer : C.surfaceVariant,
                        },
                      ]}
                      onPress={() => setType(dt.value)}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name={dt.icon as any}
                        size={22}
                        color={active ? C.error : C.textMuted}
                      />
                      <Text style={[styles.typeChipLabel, { color: active ? C.error : C.textSecondary }]}>
                        {dt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={[styles.card, { backgroundColor: C.surface }]}>
              <Text style={[styles.cardTitle, { color: C.textPrimary }]}>{t('dispute_desc')}</Text>
              <TextInput
                mode="outlined"
                style={styles.descInput}
                placeholder="Decrivez precisement le probleme rencontre..."
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={6}
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                outlineColor={C.outline}
                activeOutlineColor={C.error}
                textColor={C.textPrimary}
              />
              <Text style={[styles.charCount, { color: C.textMuted }]}>{description.length}/1000</Text>
            </View>

            {/* Warning */}
            <View style={[styles.warningCard, { backgroundColor: C.warningContainer, borderLeftColor: C.warning }]}>
              <MaterialCommunityIcons name="lock-clock" size={18} color={C.warning} />
              <Text style={[styles.warningText, { color: C.textSecondary }]}>
                En ouvrant un litige, le paiement sera gele jusqu'a resolution. Cette action est irreversible.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: C.error },
                (loading || !type) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={loading || !type}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={C.onError} />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-alert" size={20} color={C.onError} />
                  <Text style={[styles.submitBtnText, { color: C.onError }]}>{t('dispute_submit')}</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  headerSub: { fontSize: 12 },

  body: { padding: 16, gap: 16 },

  card: {
    borderRadius: 14, padding: 16, gap: 12,
    elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '800' },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 12, padding: 12,
  },
  typeChipLabel: { fontSize: 12, fontWeight: '600', flex: 1 },

  descInput: { minHeight: 120 },
  charCount: { fontSize: 11, textAlign: 'right' },

  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 14, padding: 16, borderLeftWidth: 3,
  },
  warningText: { fontSize: 12, lineHeight: 17, flex: 1 },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8,
  },
  submitBtnText: { fontWeight: '800', fontSize: 15 },

  doneCard: {
    borderRadius: 14, padding: 32, alignItems: 'center', gap: 12, marginTop: 24,
    elevation: 1,
  },
  doneTitle: { fontSize: 20, fontWeight: '800' },
  doneSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  doneBtn: { marginTop: 8, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 13 },
  doneBtnText: { fontWeight: '700', fontSize: 15 },
});
