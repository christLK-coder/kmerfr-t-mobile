import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const nav = useNavigation<Nav>();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { register, isLoading, error, clearError } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [pwd, setPwd]         = useState('');
  const [pwd2, setPwd2]       = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [errs, setErrs]       = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim() || fullName.length < 3) e.fullName = t('val_name_min');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = t('val_email_invalid');
    if (pwd.length < 8) e.pwd = t('val_pwd_min');
    else if (!/[A-Z]/.test(pwd)) e.pwd = t('val_pwd_upper');
    else if (!/[0-9]/.test(pwd)) e.pwd = t('val_pwd_digit');
    if (pwd !== pwd2) e.pwd2 = t('val_pwd_mismatch');
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    clearError();
    try {
      await register({ fullName, email: email.toLowerCase(), phone: phone || undefined, password: pwd });
      nav.navigate('Login');
    } catch {}
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={s.header}>
        <Button icon="arrow-left" mode="text" textColor="#fff" onPress={() => nav.goBack()} style={s.back}>
          {t('common_back')}
        </Button>
        <MaterialCommunityIcons name="account-plus-outline" size={40} color="#fff" />
        <Text style={s.headerTitle}>{t('auth_register_btn')}</Text>
      </LinearGradient>

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

        {/* Nom */}
        <TextInput label={t('auth_fullname')} value={fullName} onChangeText={setFullName}
          mode="outlined" left={<TextInput.Icon icon="account-outline" />}
          error={!!errs.fullName} style={s.input} outlineStyle={s.outline} />
        {!!errs.fullName && <Text style={[s.fe, { color: C.error }]}>{errs.fullName}</Text>}

        {/* Email */}
        <TextInput label={t('auth_email')} value={email} onChangeText={setEmail}
          mode="outlined" keyboardType="email-address" autoCapitalize="none"
          left={<TextInput.Icon icon="email-outline" />}
          error={!!errs.email} style={s.input} outlineStyle={s.outline} />
        {!!errs.email && <Text style={[s.fe, { color: C.error }]}>{errs.email}</Text>}

        {/* Téléphone (optionnel) */}
        <TextInput label={`${t('auth_phone')} (${t('common_all').toLowerCase()})`}
          value={phone} onChangeText={setPhone}
          mode="outlined" keyboardType="phone-pad"
          left={<TextInput.Icon icon="phone-outline" />}
          style={s.input} outlineStyle={s.outline} />

        {/* Mot de passe */}
        <TextInput label={t('auth_password')} value={pwd} onChangeText={setPwd}
          mode="outlined" secureTextEntry={!showPwd}
          left={<TextInput.Icon icon="lock-outline" />}
          right={<TextInput.Icon icon={showPwd ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPwd(v => !v)} />}
          error={!!errs.pwd} style={s.input} outlineStyle={s.outline} />
        {!!errs.pwd && <Text style={[s.fe, { color: C.error }]}>{errs.pwd}</Text>}

        {/* Confirmer */}
        <TextInput label={t('auth_password_confirm')} value={pwd2} onChangeText={setPwd2}
          mode="outlined" secureTextEntry={!showPwd}
          left={<TextInput.Icon icon="lock-check-outline" />}
          error={!!errs.pwd2} style={s.input} outlineStyle={s.outline} />
        {!!errs.pwd2 && <Text style={[s.fe, { color: C.error }]}>{errs.pwd2}</Text>}

        <Button
          mode="contained" onPress={onSubmit}
          loading={isLoading} disabled={isLoading}
          style={s.btn} contentStyle={s.btnInner} labelStyle={s.btnLabel}
        >
          {t('auth_register_btn')}
        </Button>

        <Button mode="text" onPress={() => nav.navigate('Login')}
          labelStyle={[s.link, { color: C.primary }]}>
          {t('auth_has_account')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: 4, marginBottom: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 8 },
  form: { flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  formInner: { padding: 20, paddingBottom: 40 },
  input: { marginBottom: 2 },
  outline: { borderRadius: 10 },
  fe: { fontSize: 11, marginBottom: 8, marginLeft: 4 },
  errBanner: { padding: 12, borderRadius: 8, marginBottom: 14 },
  btn: { marginTop: 16, borderRadius: 10 },
  btnInner: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  link: { fontSize: 14 },
});
