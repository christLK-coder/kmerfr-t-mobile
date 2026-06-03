import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import { applyDriverApi } from '../../api/auth.api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'DriverApply'>;

export default function DriverApplyScreen() {
  const nav = useNavigation<Nav>();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [motivation, setMotivation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.length < 3) e.fullName = t('val_name_min');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('val_email_invalid');
    if (!phone.trim()) e.phone = t('val_required');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      const { applicationId } = await applyDriverApi({ fullName, email: email.toLowerCase(), phone, city, motivation });
      await SecureStore.setItemAsync('driver_application_id', applicationId);
      nav.navigate('DriverOnboarding', { applicationId });
    } catch (err: unknown) {
      setError((err as Error).message ?? t('err_unknown'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.primary }]}>
        <Button
          icon="arrow-left"
          mode="text"
          textColor="#fff"
          onPress={() => nav.goBack()}
          style={s.backBtn}
        >
          {t('common_back')}
        </Button>
        <MaterialCommunityIcons name="truck-outline" size={44} color="#fff" style={{ marginBottom: 8 }} />
        <Text style={s.headerTitle}>{t('apply_title')}</Text>
        <Text style={s.headerSub}>{t('apply_subtitle')}</Text>
      </View>

      <ScrollView
        style={[s.form, { backgroundColor: C.surface }]}
        contentContainerStyle={s.formInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View style={[s.errBanner, { backgroundColor: C.errorContainer }]}>
            <Text style={{ color: C.error }}>{error}</Text>
          </View>
        )}

        <TextInput
          label={t('apply_fullname')}
          value={fullName}
          onChangeText={setFullName}
          mode="outlined"
          left={<TextInput.Icon icon="account-outline" />}
          error={!!errors.fullName}
          style={s.input}
          outlineStyle={s.outline}
        />
        {!!errors.fullName && <Text style={[s.fieldErr, { color: C.error }]}>{errors.fullName}</Text>}

        <TextInput
          label={t('apply_email')}
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          left={<TextInput.Icon icon="email-outline" />}
          error={!!errors.email}
          style={s.input}
          outlineStyle={s.outline}
        />
        {!!errors.email && <Text style={[s.fieldErr, { color: C.error }]}>{errors.email}</Text>}

        <TextInput
          label={t('apply_phone')}
          value={phone}
          onChangeText={setPhone}
          mode="outlined"
          keyboardType="phone-pad"
          left={<TextInput.Icon icon="phone-outline" />}
          error={!!errors.phone}
          style={s.input}
          outlineStyle={s.outline}
        />
        {!!errors.phone && <Text style={[s.fieldErr, { color: C.error }]}>{errors.phone}</Text>}

        <TextInput
          label={t('apply_city')}
          value={city}
          onChangeText={setCity}
          mode="outlined"
          left={<TextInput.Icon icon="city-variant-outline" />}
          style={s.input}
          outlineStyle={s.outline}
        />

        <TextInput
          label={t('apply_motivation')}
          value={motivation}
          onChangeText={setMotivation}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={[s.input, { height: 100 }]}
          outlineStyle={s.outline}
        />

        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          style={[s.btn, { backgroundColor: C.primary }]}
          contentStyle={s.btnInner}
          labelStyle={s.btnLabel}
        >
          {t('apply_submit')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 48, paddingBottom: 28, paddingHorizontal: 20, alignItems: 'center' },
  backBtn: { position: 'absolute', top: 48, left: 8, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  formInner: { padding: 20, paddingBottom: 40 },
  input: { marginBottom: 4 },
  outline: { borderRadius: 10 },
  fieldErr: { fontSize: 11, marginBottom: 8, marginLeft: 4 },
  errBanner: { padding: 12, borderRadius: 8, marginBottom: 16 },
  btn: { marginTop: 16, borderRadius: 10 },
  btnInner: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
});
