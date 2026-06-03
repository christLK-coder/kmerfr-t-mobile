import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TextInput as RNTextInput, Animated,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { OTP_RESEND_COOLDOWN_S } from '../../utils/constants';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'OtpVerify'>;

const OTP_LEN = 6;

export default function OtpVerifyScreen() {
  const nav = useNavigation<Nav>();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { verifyOtp, initiateLogin, pendingMaskedEmail, pendingOtpExpiresIn, email: storeEmail, isLoading, error, clearError, clearPendingLogin } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [countdown, setCountdown] = useState(OTP_RESEND_COOLDOWN_S);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(RNTextInput | null)[]>([]);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LEN - 1) inputRefs.current[index + 1]?.focus();
    if (next.every(d => d !== '')) submitCode(next.join(''));
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const submitCode = async (code: string) => {
    clearError();
    try {
      await verifyOtp(code);
      // Navigation happens via AppNavigator (isAuthenticated becomes true)
    } catch {
      setDigits(Array(OTP_LEN).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    // On n'a pas le mot de passe stocké — on doit juste renvoyer sans mot de passe
    // Pour simplicité, on retourne au login
    setResending(true);
    clearPendingLogin();
    setDigits(Array(OTP_LEN).fill(''));
    setCountdown(OTP_RESEND_COOLDOWN_S);
    setResending(false);
    nav.goBack();
  };

  const filled = digits.join('');

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Animated.View style={[s.content, { opacity: fade }]}>
        {/* En-tête */}
        <View style={s.iconWrap}>
          <MaterialCommunityIcons name="email-check-outline" size={48} color={C.primary} />
        </View>
        <Text variant="headlineSmall" style={[s.title, { color: C.textPrimary }]}>
          {t('otp_title')}
        </Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>
          {t('otp_subtitle')}
        </Text>
        <Text style={[s.email, { color: C.primary }]}>{pendingMaskedEmail}</Text>

        {/* 6 cases OTP */}
        <View style={s.otpRow}>
          {Array(OTP_LEN).fill(0).map((_, i) => (
            <RNTextInput
              key={i}
              ref={r => { inputRefs.current[i] = r; }}
              style={[
                s.otpBox,
                {
                  backgroundColor: C.surface,
                  borderColor: digits[i] ? C.primary : C.outline,
                  color: C.textPrimary,
                },
              ]}
              maxLength={1}
              keyboardType="number-pad"
              value={digits[i]}
              onChangeText={v => handleDigit(i, v)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(i, key)}
              selectTextOnFocus
            />
          ))}
        </View>

        {!!error && (
          <View style={[s.errBanner, { backgroundColor: C.errorContainer }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={[s.errText, { color: C.error }]}>{error}</Text>
          </View>
        )}

        <Button
          mode="contained"
          onPress={() => submitCode(filled)}
          loading={isLoading}
          disabled={isLoading || filled.length < OTP_LEN}
          style={s.btn}
          contentStyle={s.btnInner}
          labelStyle={s.btnLabel}
        >
          {t('otp_verify_btn')}
        </Button>

        <Button
          mode="text"
          onPress={handleResend}
          disabled={countdown > 0 || resending}
          labelStyle={[s.resendLabel, { color: countdown > 0 ? C.textMuted : C.primary }]}
        >
          {countdown > 0 ? t('otp_resend_in', { s: countdown }) : t('otp_resend')}
        </Button>

        <Button
          mode="text"
          onPress={() => { clearPendingLogin(); nav.goBack(); }}
          labelStyle={[s.backLabel, { color: C.textSecondary }]}
        >
          {t('common_back')}
        </Button>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  iconWrap: { marginBottom: 20 },
  title: { fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  email: { fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 32 },
  otpRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  otpBox: {
    width: 46, height: 56, borderRadius: 10, borderWidth: 2,
    textAlign: 'center', fontSize: 24, fontWeight: '700',
  },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 8, marginBottom: 14, width: '100%' },
  errText: { fontSize: 13, flex: 1 },
  btn: { marginTop: 4, borderRadius: 10, width: '100%' },
  btnInner: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  resendLabel: { fontSize: 14 },
  backLabel: { fontSize: 13 },
});
