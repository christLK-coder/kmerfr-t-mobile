// Écran de connexion — design premium MD3 KmerFret avec LinearGradient + animations
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
import { Text, Button, HelperText } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppInput } from '../../components/common/AppInput';
import { LoadingOverlay } from '../../components/common/LoadingOverlay';
import { useAuthStore } from '../../store/authStore';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const { height: SCREEN_H } = Dimensions.get('window');

export default function LoginScreen({ navigation }: Props) {
  const { login, isLoading, error, clearError } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [phone, setPhone]             = React.useState('');
  const [password, setPassword]       = React.useState('');
  const [phoneError, setPhoneError]   = React.useState('');
  const [passError, setPassError]     = React.useState('');

  // ─── Animations ──────────────────────────────────────────────────────────
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 700, delay: 100, useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0, tension: 55, friction: 9, delay: 150, useNativeDriver: true,
      }),
    ]).start();
    return () => clearError();
  }, []);

  // ─── Logique ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    let ok = true;
    setPhoneError(''); setPassError('');
    if (!phone.trim()) { setPhoneError('Le numéro de téléphone est requis.'); ok = false; }
    if (!password.trim()) { setPassError('Le mot de passe est requis.'); ok = false; }
    return ok;
  }

  async function handleLogin() {
    if (!validate()) return;
    await login({ phone: phone.trim(), password });
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LoadingOverlay visible={isLoading} message="Connexion en cours…" />

      {/* ─── Dégradé vert plein écran (arrière-plan) ─── */}
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
        keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
      >
        {/* ─── Logo animé ─── */}
        <Animated.View
          style={[
            styles.logoArea,
            { paddingTop: insets.top + 36, opacity: logoOpacity },
          ]}
        >
          <Text style={styles.emoji}>🚛</Text>
          <Text style={styles.appName}>KmerFret</Text>
          <Text style={styles.tagline}>Transport de confiance au Cameroun</Text>
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
            <Text style={styles.cardTitle}>Connexion</Text>
            <Text style={styles.cardSub}>Entrez vos identifiants pour continuer</Text>

            <View style={styles.inputs}>
              <AppInput
                label="Numéro de téléphone"
                value={phone}
                onChangeText={(t) => { setPhone(t); setPhoneError(''); }}
                icon="phone"
                keyboardType="phone-pad"
                placeholder="+237 6XX XXX XXX"
                error={phoneError}
              />

              <AppInput
                label="Mot de passe"
                value={password}
                onChangeText={(t) => { setPassword(t); setPassError(''); }}
                icon="lock"
                secureTextEntry
                error={passError}
              />
            </View>

            {!!error && (
              <HelperText type="error" visible style={styles.apiError}>
                {error}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.btnPrimary}
              contentStyle={styles.btnContent}
              labelStyle={styles.btnPrimaryLabel}
            >
              Se connecter
            </Button>

            <Button
              mode="outlined"
              onPress={() => { clearError(); navigation.navigate('Register'); }}
              disabled={isLoading}
              style={styles.btnOutline}
              contentStyle={styles.btnContent}
              labelStyle={styles.btnOutlineLabel}
            >
              Créer un compte
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
    paddingBottom: Math.max(SCREEN_H * 0.04, 24),
  },
  emoji: { fontSize: 64, marginBottom: 8 },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  tagline: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
    textAlign: 'center',
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
    minHeight: SCREEN_H * 0.55,
  },
  form: {
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B5E20',
    letterSpacing: 0.4,
  },
  cardSub: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginBottom: 24,
  },
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
