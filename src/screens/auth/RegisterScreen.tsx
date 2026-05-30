// Écran d'inscription — design premium MD3 KmerFret avec LinearGradient + animations
import React, { useEffect, useRef } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const PHONE_REGEX    = /^\+237[0-9]{9}$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const { height: SCREEN_H } = Dimensions.get('window');

export default function RegisterScreen({ navigation }: Props) {
  const { register, isLoading, error, clearError } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName]               = React.useState('');
  const [phone, setPhone]                     = React.useState('');
  const [email, setEmail]                     = React.useState('');
  const [password, setPassword]               = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [role, setRole]                       = React.useState<'IMPORTER' | 'DRIVER'>('DRIVER');
  const [errors, setErrors]                   = React.useState<Record<string, string>>({});

  // ─── Animations ──────────────────────────────────────────────────────────
  const logoOpacity    = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 600, delay: 80, useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0, tension: 55, friction: 9, delay: 130, useNativeDriver: true,
      }),
    ]).start();
    return () => clearError();
  }, []);

  // ─── Logique ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Le nom complet est requis.';
    if (!PHONE_REGEX.test(phone.trim())) e.phone = 'Format : +237691234567';
    if (!PASSWORD_REGEX.test(password)) e.password = 'Min. 8 car., 1 majuscule, 1 chiffre.';
    if (password !== confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    await register({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      password,
      role,
    });
  }

  function clearField(field: string) {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LoadingOverlay visible={isLoading} message="Création du compte…" />

      {/* ─── Dégradé vert ─── */}
      <LinearGradient
        colors={['#1B5E20', '#388E3C', '#2E7D32']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ─── Logo animé compact ─── */}
        <Animated.View
          style={[
            styles.logoArea,
            { paddingTop: insets.top + 20, opacity: logoOpacity },
          ]}
        >
          <Text style={styles.emoji}>🚛</Text>
          <Text style={styles.appName}>KmerFret</Text>
          <Text style={styles.tagline}>Créer un compte</Text>
        </Animated.View>

        {/* ─── Carte formulaire (slide up) ─── */}
        <Animated.View
          style={[styles.card, { transform: [{ translateY: cardTranslateY }] }]}
        >
          <ScrollView
            contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Rôle en premier — choix le plus important */}
            <Text style={styles.roleLabel}>Je suis :</Text>
            <SegmentedButtons
              value={role}
              onValueChange={(v) => setRole(v as 'IMPORTER' | 'DRIVER')}
              buttons={[
                { value: 'DRIVER',   label: 'Chauffeur',   icon: 'truck' },
                { value: 'IMPORTER', label: 'Importateur', icon: 'package-variant' },
              ]}
              style={styles.segment}
            />

            <View style={styles.inputs}>
              <AppInput
                label="Nom complet"
                value={fullName}
                onChangeText={(t) => { setFullName(t); clearField('fullName'); }}
                icon="account"
                autoCapitalize="words"
                error={errors.fullName}
              />

              <AppInput
                label="Numéro de téléphone"
                value={phone}
                onChangeText={(t) => { setPhone(t); clearField('phone'); }}
                icon="phone"
                keyboardType="phone-pad"
                placeholder="+237 6XX XXX XXX"
                error={errors.phone}
              />

              <AppInput
                label="Email (optionnel)"
                value={email}
                onChangeText={setEmail}
                icon="email"
                keyboardType="email-address"
              />

              <AppInput
                label="Mot de passe"
                value={password}
                onChangeText={(t) => { setPassword(t); clearField('password'); }}
                icon="lock"
                secureTextEntry
                error={errors.password}
              />

              <AppInput
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); clearField('confirmPassword'); }}
                icon="lock-check"
                secureTextEntry
                error={errors.confirmPassword}
              />
            </View>

            {!!error && (
              <HelperText type="error" visible style={styles.apiError}>
                {error}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={isLoading}
              disabled={isLoading}
              style={styles.btnPrimary}
              contentStyle={styles.btnContent}
              labelStyle={styles.btnPrimaryLabel}
            >
              Créer mon compte
            </Button>

            <Button
              mode="outlined"
              onPress={() => { clearError(); navigation.goBack(); }}
              disabled={isLoading}
              style={styles.btnOutline}
              contentStyle={styles.btnContent}
              labelStyle={styles.btnOutlineLabel}
            >
              J'ai déjà un compte
            </Button>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },

  logoArea: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: Math.max(SCREEN_H * 0.025, 16),
  },
  emoji: { fontSize: 48, marginBottom: 6 },
  appName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.8,
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: 0.3,
  },

  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
    minHeight: SCREEN_H * 0.65,
  },
  form: {
    paddingHorizontal: 28,
    paddingTop: 28,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
  },
  segment: { marginBottom: 16 },
  inputs: { gap: 4 },

  apiError: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 2,
  },

  btnPrimary: {
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#1B5E20',
    elevation: 5,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.40,
    shadowRadius: 10,
  },
  btnOutline: {
    marginTop: 12,
    borderRadius: 12,
    borderColor: '#1B5E20',
    borderWidth: 1.5,
  },
  btnContent: { height: 52 },
  btnPrimaryLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  btnOutlineLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#1B5E20',
  },
});
