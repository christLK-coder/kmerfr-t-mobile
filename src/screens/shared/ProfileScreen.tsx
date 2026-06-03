import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, Switch, Alert, Pressable, Platform,
} from 'react-native';
import { Text, Avatar, Divider, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import dayjs from 'dayjs';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t, setLocale, i18n } from '../../i18n';
import { registerForPushNotifications } from '../../services/NotificationService';
import { updatePushTokenApi } from '../../api/auth.api';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const ROLE_COLORS: Record<string, string> = {
  IMPORTER: '#1B5E20',
  DRIVER:   '#00897B',
  ADMIN:    '#E65100',
};

const ROLE_LABELS: Record<string, string> = {
  IMPORTER: 'Exportateur / Producteur',
  DRIVER:   'Chauffeur',
  ADMIN:    'Administrateur',
};

function Row({
  icon, label, desc, color, onPress, right, isDark, C,
}: {
  icon: string; label: string; desc?: string; color: string;
  onPress?: () => void; right?: React.ReactNode;
  isDark: boolean; C: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      style={[s.row, { opacity: onPress ? 1 : 0.9 }]}
      onPress={onPress}
      android_ripple={{ color: C.outline }}
    >
      <View style={[s.rowIcon, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={20} color={color} />
      </View>
      <View style={s.rowContent}>
        <Text style={[s.rowLabel, { color: C.textPrimary }]}>{label}</Text>
        {desc ? <Text style={[s.rowDesc, { color: C.textSecondary }]}>{desc}</Text> : null}
      </View>
      {right !== undefined
        ? right
        : onPress ? <MaterialCommunityIcons name="chevron-right" size={18} color={C.textMuted} /> : null}
    </Pressable>
  );
}

function SectionCard({ title, children, C, isDark }: {
  title: string; children: React.ReactNode;
  C: ReturnType<typeof useColors>; isDark: boolean;
}) {
  return (
    <View style={[s.card, { backgroundColor: C.surface }]}>
      <Text style={[s.sectionTitle, { color: C.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const { setMode, mode } = useThemeStore();
  const C = useColors(isDark);

  const {
    fullName, email, phone, userRole, userId,
    logout, isLoading,
    enableBiometric, disableBiometric, checkBiometricValid, biometricExpiresAt,
  } = useAuthStore();

  const [locale, setLocaleState] = useState<'fr' | 'en'>(i18n.locale as 'fr' | 'en');
  const [bioHardwareAvail, setBioHardwareAvail] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    // Vérifier si le matériel biométrique est disponible sur cet appareil
    LocalAuthentication.hasHardwareAsync().then(async has => {
      if (has) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBioHardwareAvail(enrolled);
      }
    });
    // État biométrie depuis le store (token en SecureStore)
    setBioEnabled(checkBiometricValid());

    // Enregistrer push token
    registerForPushNotifications().then(token => {
      if (token && userId) updatePushTokenApi(token).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleToggleBiometric = useCallback(async (val: boolean) => {
    if (val) {
      // Vérifier biométrie locale d'abord
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: t('bio_prompt'),
        fallbackLabel: t('bio_fallback'),
        cancelLabel: t('bio_cancel'),
        disableDeviceFallback: false,
      });
      if (!r.success) return;
      try {
        await enableBiometric();
        setBioEnabled(true);
        Alert.alert(t('bio_success'));
      } catch (e) {
        Alert.alert('Erreur', (e as Error).message);
      }
    } else {
      try {
        await disableBiometric();
        setBioEnabled(false);
      } catch {}
    }
  }, [enableBiometric, disableBiometric]);

  const handleToggleLocale = async () => {
    const next = locale === 'fr' ? 'en' : 'fr';
    await setLocale(next);
    setLocaleState(next);
  };

  const handleLogout = () => {
    Alert.alert(t('auth_logout'), t('auth_logout_confirm'), [
      { text: t('common_cancel'), style: 'cancel' },
      { text: t('auth_logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const roleColor = ROLE_COLORS[userRole ?? ''] ?? C.primary;
  const initials = (fullName ?? 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const isDriver = userRole === 'DRIVER';
  const isAdmin  = userRole === 'ADMIN';

  const bioValidUntil = biometricExpiresAt
    ? dayjs(biometricExpiresAt).format('DD/MM/YYYY')
    : null;

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark
          ? [C.gradientPrimaryStart, C.gradientPrimaryEnd]
          : ['#1B5E20', '#2E7D32', '#388E3C']}
        style={[s.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={s.avatarWrap}>
          <Avatar.Text
            size={84}
            label={initials}
            style={[s.avatar, { backgroundColor: roleColor + '55' }]}
            labelStyle={s.avatarLabel}
          />
          <View style={[s.roleDot, { backgroundColor: roleColor }]} />
        </View>
        <Text style={s.name}>{fullName ?? 'Utilisateur'}</Text>
        <View style={[s.roleBadge, { backgroundColor: roleColor + '30', borderColor: roleColor + '60' }]}>
          <Text style={s.roleText}>{ROLE_LABELS[userRole ?? ''] ?? userRole}</Text>
        </View>
        {email ? <Text style={s.emailTxt}>{email}</Text> : null}
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Activité */}
        <SectionCard title={t('profile_activity')} C={C} isDark={isDark}>
          <Row icon="chart-bar" label={t('nav_stats')} color={C.info}
            onPress={() => nav.navigate('Stats')} C={C} isDark={isDark} />
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="map" label={t('nav_map')} color={C.primary}
            onPress={() => nav.navigate('Map')} C={C} isDark={isDark} />
          {isDriver && <>
            <Divider style={{ backgroundColor: C.divider }} />
            <Row icon="truck" label={t('nav_fleet')} color={C.secondary}
              onPress={() => nav.navigate('Trucks')} C={C} isDark={isDark} />
            <Divider style={{ backgroundColor: C.divider }} />
            <Row icon="trophy" label={t('nav_loyalty')} color="#F9A825"
              onPress={() => nav.navigate('Loyalty')} C={C} isDark={isDark} />
          </>}
        </SectionCard>

        {/* Sécurité */}
        <SectionCard title={t('profile_security')} C={C} isDark={isDark}>
          {/* Biométrie */}
          {bioHardwareAvail ? (
            <>
              <Row
                icon="fingerprint"
                label={t('profile_biometric')}
                desc={bioEnabled && bioValidUntil
                  ? t('bio_enabled_until', { date: bioValidUntil })
                  : bioEnabled ? 'Actif' : 'Désactivé'}
                color={C.info}
                C={C} isDark={isDark}
                right={
                  <Switch
                    value={bioEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: C.outline, true: C.info + '80' }}
                    thumbColor={bioEnabled ? C.info : C.surfaceVariant}
                  />
                }
              />
              <Divider style={{ backgroundColor: C.divider }} />
            </>
          ) : null}
          <Row icon="lock-reset" label={t('profile_change_pwd')} color={C.warning}
            onPress={() => nav.navigate('ChangePassword' as any)}
            C={C} isDark={isDark} />
        </SectionCard>

        {/* Préférences */}
        <SectionCard title={t('profile_preferences')} C={C} isDark={isDark}>
          {/* Mode sombre */}
          <Row
            icon={isDark ? 'weather-night' : 'weather-sunny'}
            label={t('profile_dark_mode')}
            desc={mode === 'system' ? 'Automatique' : isDark ? 'Activé' : 'Désactivé'}
            color={C.primary}
            C={C} isDark={isDark}
            right={
              <Switch
                value={isDark}
                onValueChange={v => setMode(v ? 'dark' : 'light')}
                trackColor={{ false: C.outline, true: C.primaryVariant }}
                thumbColor={isDark ? '#9C27B0' : C.surfaceVariant}
              />
            }
          />
          <Divider style={{ backgroundColor: C.divider }} />
          {/* Langue */}
          <Row
            icon="translate"
            label={t('profile_language')}
            desc={locale === 'fr' ? 'Français' : 'English'}
            color={C.secondary}
            C={C} isDark={isDark}
            right={
              <Pressable onPress={handleToggleLocale} style={s.langToggle}>
                <Text style={[s.langBtn, { color: locale === 'fr' ? C.primary : C.textMuted }]}>FR</Text>
                <Text style={[s.langSep, { color: C.outline }]}>/</Text>
                <Text style={[s.langBtn, { color: locale === 'en' ? C.primary : C.textMuted }]}>EN</Text>
              </Pressable>
            }
          />
        </SectionCard>

        {/* Compte */}
        <SectionCard title={t('profile_account')} C={C} isDark={isDark}>
          {email ? (
            <Row icon="email-outline" label="Email" desc={email} color={C.primary} C={C} isDark={isDark} />
          ) : null}
          {phone ? (
            <>
              <Divider style={{ backgroundColor: C.divider }} />
              <Row icon="phone-outline" label={t('auth_phone')} desc={phone} color={C.primary} C={C} isDark={isDark} />
            </>
          ) : null}
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="shield-account-outline" label="Rôle" desc={ROLE_LABELS[userRole ?? ''] ?? '—'} color={roleColor} C={C} isDark={isDark} />
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="information-outline" label="Version" desc="KmerFret v3.0" color={C.textMuted} C={C} isDark={isDark} />
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="file-document-outline" label={t('profile_terms')} color={C.textSecondary}
            onPress={() => {}} C={C} isDark={isDark} />
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="shield-lock-outline" label={t('profile_privacy')} color={C.textSecondary}
            onPress={() => {}} C={C} isDark={isDark} />
          <Divider style={{ backgroundColor: C.divider }} />
          <Row icon="headset" label={t('profile_support')} color={C.textSecondary}
            onPress={() => {}} C={C} isDark={isDark} />
        </SectionCard>

        {/* Déconnexion */}
        <Button
          mode="outlined"
          onPress={handleLogout}
          loading={isLoading}
          disabled={isLoading}
          icon="logout"
          style={[s.logoutBtn, { borderColor: C.error }]}
          contentStyle={s.logoutInner}
          textColor={C.error}
        >
          {t('auth_logout')}
        </Button>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24, gap: 8 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' },
  avatarLabel: { color: '#fff', fontWeight: '800', fontSize: 28 },
  roleDot: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, borderColor: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  roleBadge: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1 },
  roleText: { fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },
  emailTxt: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },

  content: { padding: 16, gap: 12 },

  card: { borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '500' },
  rowDesc: { fontSize: 12, marginTop: 1 },

  langToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  langBtn: { fontSize: 14, fontWeight: '700' },
  langSep: { fontSize: 14 },

  logoutBtn: { marginTop: 4, borderRadius: 12 },
  logoutInner: { height: 48 },
});
