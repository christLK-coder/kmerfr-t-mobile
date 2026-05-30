// Écran profil partagé — affiche les infos utilisateur + déconnexion
import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Avatar, List, Divider, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';

const ROLE_LABEL: Record<string, string> = {
  IMPORTER: 'Importateur',
  DRIVER: 'Chauffeur',
  ADMIN: 'Administrateur',
};

export default function ProfileScreen() {
  const { fullName, phone, userRole, logout, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  const initials = (fullName ?? 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Header gradient */}
      <LinearGradient
        colors={['#1B5E20', '#388E3C']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Avatar.Text
          size={72}
          label={initials}
          style={styles.avatar}
          labelStyle={styles.avatarLabel}
        />
        <Text style={styles.name}>{fullName ?? 'Utilisateur'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>
            {ROLE_LABEL[userRole ?? ''] ?? userRole ?? '—'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <View style={styles.card}>
          <List.Item
            title="Numéro de téléphone"
            description={phone ?? '—'}
            left={(p) => (
              <List.Icon {...p} icon="phone" color="#1B5E20" />
            )}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
          <Divider />
          <List.Item
            title="Rôle"
            description={ROLE_LABEL[userRole ?? ''] ?? '—'}
            left={(p) => (
              <List.Icon {...p} icon="shield-account" color="#1B5E20" />
            )}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
        </View>

        {/* Version */}
        <View style={styles.card}>
          <List.Item
            title="Application"
            description="KmerFret v1.0.0 — Transport Cameroun"
            left={(p) => (
              <List.Icon {...p} icon="information-outline" color="#9E9E9E" />
            )}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
        </View>

        {/* Déconnexion */}
        <Button
          mode="outlined"
          onPress={logout}
          loading={isLoading}
          disabled={isLoading}
          icon="logout"
          style={styles.logoutBtn}
          contentStyle={styles.logoutContent}
          labelStyle={styles.logoutLabel}
        >
          Se déconnecter
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatar: { backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 12 },
  avatarLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 26 },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  roleBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  listTitle: { fontSize: 12, color: '#9E9E9E', fontWeight: '500' },
  listDesc: { fontSize: 15, color: '#212121', fontWeight: '600', marginTop: 2 },

  logoutBtn: {
    marginTop: 8,
    borderColor: '#B71C1C',
    borderWidth: 1.5,
    borderRadius: 12,
  },
  logoutContent: { height: 50 },
  logoutLabel: { color: '#B71C1C', fontSize: 15, fontWeight: '600' },
});
