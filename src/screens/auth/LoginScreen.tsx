import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Animated, Pressable, Dimensions, Alert } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import { API_BASE_URL } from '../../utils/constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { initiateLogin, loginWithBiometric, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [canBiometric, setCanBiometric] = useState(false);
  const [bioUserName, setBioUserName] = useState<string | null>(null);
  const [pendingAppId, setPendingAppId] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, useNativeDriver: true }),
    ]).start();
    checkBiometricAvailability();
    SecureStore.getItemAsync('driver_application_id').then(id => {
      if (id) setPendingAppId(id);
    }).catch(() => {});
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const token = await SecureStore.getItemAsync('biometric_token');
      const userId = await SecureStore.getItemAsync('user_id');
      const savedName = await SecureStore.getItemAsync('biometric_user_name');
      console.log('[Bio] token:', !!token, 'userId:', !!userId, 'name:', savedName);
      if (!token || !userId) return;

      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('[Bio] hardware:', hw, 'enrolled:', enrolled);
      if (!hw || !enrolled) return;

      setCanBiometric(true);
      setBioUserName(savedName);
    } catch (e) {
      console.log('[Bio] check error:', e);
    }
  };

  const validate = () => {
    let ok = true;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) { setEmailErr(t('val_required')); ok = false; }
    else if (!re.test(email)) { setEmailErr(t('val_email_invalid')); ok = false; }
    else setEmailErr('');
    if (!password) { setPwdErr(t('val_required')); ok = false; }
    else setPwdErr('');
    return ok;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    clearError();
    const trimmedEmail = email.trim().toLowerCase();
    try {
      const result = await initiateLogin({ email: trimmedEmail, password });
      if (result && result.sessionToken) {
        nav.navigate('OtpVerify');
      } else {
        Alert.alert('Erreur', 'Reponse serveur invalide. Reessayez.');
      }
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Erreur inconnue';
      Alert.alert('Echec connexion', msg);
    }
  };

  const onBiometric = async () => {
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Connexion KmerFret',
        fallbackLabel: 'Utiliser le mot de passe',
        cancelLabel: 'Annuler',
        disableDeviceFallback: false,
      });
      if (!r.success) return;

      const ok = await loginWithBiometric();
      if (!ok) {
        Alert.alert(
          'Session expirée',
          'Votre session biométrique a expiré. Connectez-vous avec email et mot de passe, puis réactivez la biométrie dans Profil → Sécurité.',
        );
      }
    } catch {
      Alert.alert('Erreur', 'La connexion biométrique a échoué.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={s.header}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }], alignItems: 'center' }}>
          <View style={s.iconWrap}>
            <MaterialCommunityIcons name="truck-fast" size={38} color="#fff" />
          </View>
          <Text style={s.brand}>KmerFret</Text>
          <Text style={s.tagline}>{t('auth_tagline')}</Text>
        </Animated.View>
      </LinearGradient>

      <Animated.ScrollView
        style={[s.card, { backgroundColor: C.surface }]}
        contentContainerStyle={s.cardInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Biométrie (affiché en premier si disponible) ─── */}
        {canBiometric && (
          <>
            <Pressable style={s.bioCard} onPress={onBiometric}>
              <View style={[s.bioIconBig, { backgroundColor: C.primaryContainer }]}>
                <MaterialCommunityIcons name="fingerprint" size={48} color={C.primary} />
              </View>
              <Text style={[s.bioTitle, { color: C.textPrimary }]}>
                {bioUserName ? `Bonjour, ${bioUserName.split(' ')[0]}` : 'Connexion rapide'}
              </Text>
              <Text style={[s.bioSubtitle, { color: C.textSecondary }]}>
                Touchez pour vous connecter avec votre empreinte
              </Text>
            </Pressable>

            <View style={s.dividerRow}>
              <View style={[s.dividerLine, { backgroundColor: C.outline }]} />
              <Text style={[s.dividerText, { color: C.textMuted }]}>ou connectez-vous avec</Text>
              <View style={[s.dividerLine, { backgroundColor: C.outline }]} />
            </View>
          </>
        )}

        {!canBiometric && (
          <Text variant="headlineSmall" style={[s.title, { color: C.textPrimary }]}>
            {t('auth_login_btn')}
          </Text>
        )}

        {!!error && (
          <View style={[s.errBanner, { backgroundColor: C.errorContainer }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color={C.error} />
            <Text style={[s.errText, { color: C.error }]}>{error}</Text>
          </View>
        )}

        <TextInput
          label={t('auth_email')}
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          left={<TextInput.Icon icon="email-outline" />}
          error={!!emailErr}
          style={s.input}
          outlineStyle={s.outline}
        />
        {!!emailErr && <Text style={[s.fieldErr, { color: C.error }]}>{emailErr}</Text>}

        <TextInput
          label={t('auth_password')}
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={!showPwd}
          left={<TextInput.Icon icon="lock-outline" />}
          right={<TextInput.Icon icon={showPwd ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowPwd(v => !v)} />}
          error={!!pwdErr}
          style={s.input}
          outlineStyle={s.outline}
          onSubmitEditing={onSubmit}
          returnKeyType="go"
        />
        {!!pwdErr && <Text style={[s.fieldErr, { color: C.error }]}>{pwdErr}</Text>}

        <Button
          mode="contained"
          onPress={onSubmit}
          loading={isLoading}
          disabled={isLoading}
          style={s.btn}
          contentStyle={s.btnInner}
          labelStyle={s.btnLabel}
        >
          {t('auth_login_btn')}
        </Button>

        <View style={[s.sep, { backgroundColor: C.outline }]} />

        <Button
          mode="text"
          onPress={() => nav.navigate('Register')}
          labelStyle={[s.link, { color: C.primary }]}
        >
          {t('auth_no_account')}
        </Button>

        <Button
          mode="text"
          onPress={() => nav.navigate('DriverApply')}
          labelStyle={[s.link, { color: C.secondary }]}
        >
          {t('auth_driver_apply')}
        </Button>

        {pendingAppId && (
          <Pressable
            style={[s.trackCard, { backgroundColor: C.primaryContainer, borderColor: C.primary + '40' }]}
            onPress={() => nav.navigate('DriverOnboarding', { applicationId: pendingAppId })}
          >
            <View style={[s.trackIcon, { backgroundColor: C.primary + '20' }]}>
              <MaterialCommunityIcons name="file-document-check-outline" size={24} color={C.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.trackTitle, { color: C.primary }]}>Candidature en cours</Text>
              <Text style={[s.trackSub, { color: C.primary }]}>Suivre l'avancement et envoyer des documents</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={C.primary} />
          </Pressable>
        )}
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { height: Math.max(Dimensions.get('window').height * 0.32, 240), alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 50 },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 },
  card: { flex: 1, marginTop: -24, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  cardInner: { padding: 24, paddingTop: 26, paddingBottom: 40 },
  title: { fontWeight: '700', marginBottom: 20 },
  input: { marginBottom: 2 },
  outline: { borderRadius: 10 },
  fieldErr: { fontSize: 11, marginBottom: 8, marginLeft: 4 },
  errBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 8, marginBottom: 14 },
  errText: { fontSize: 13, flex: 1 },
  btn: { marginTop: 14, borderRadius: 10 },
  btnInner: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  sep: { height: 1, marginVertical: 14 },
  link: { fontSize: 14 },

  // Biometric card
  bioCard: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 10,
    backgroundColor: '#E8F5E920', borderRadius: 16, borderWidth: 1.5,
    borderColor: '#1B5E2030', borderStyle: 'dashed', marginBottom: 8,
  },
  bioIconBig: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  bioTitle: { fontSize: 18, fontWeight: '700' },
  bioSubtitle: { fontSize: 13, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12 },

  // Track application
  trackCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 8,
  },
  trackIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  trackTitle: { fontSize: 14, fontWeight: '700' },
  trackSub: { fontSize: 11, marginTop: 2, opacity: 0.7 },
});
