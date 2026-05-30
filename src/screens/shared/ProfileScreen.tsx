// Écran profil partagé — infos utilisateur + stats + notation + déconnexion
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, Avatar, List, Divider, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { registerForPushNotifications } from '../../services/NotificationService';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

const ROLE_LABEL: Record<string, string> = {
  IMPORTER: 'Importateur',
  DRIVER:   'Chauffeur',
  ADMIN:    'Administrateur',
};

function QuickAction({
  icon, label, color, onPress,
}: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.quickIcon, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={18} color="#BDBDBD" />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { fullName, phone, userRole, logout, isLoading } = useAuthStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Enregistrer le token push au chargement du profil
    registerForPushNotifications().catch(() => {});
  }, []);

  const initials = (fullName ?? 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['#1B5E20', '#388E3C']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <Avatar.Text
          size={80}
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
        {/* Actions rapides */}
        <View style={styles.card}>
          <QuickAction
            icon="chart-bar"
            label="Mes statistiques"
            color="#0277BD"
            onPress={() => navigation.navigate('Stats')}
          />
          <Divider />
          <QuickAction
            icon="map"
            label="Carte des routes"
            color="#1B5E20"
            onPress={() => navigation.navigate('Map')}
          />
          <Divider />
          <QuickAction
            icon="alert-octagon"
            label="Envoyer une alerte SOS"
            color="#B71C1C"
            onPress={() => navigation.navigate('Alert', {})}
          />
        </View>

        {/* Infos compte */}
        <View style={styles.card}>
          <List.Item
            title="Numéro de téléphone"
            description={phone ?? '—'}
            left={p => <List.Icon {...p} icon="phone" color="#1B5E20" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
          <Divider />
          <List.Item
            title="Rôle"
            description={ROLE_LABEL[userRole ?? ''] ?? '—'}
            left={p => <List.Icon {...p} icon="shield-account" color="#1B5E20" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
        </View>

        {/* Version */}
        <View style={styles.card}>
          <List.Item
            title="Application"
            description="KmerFret v2.0.0 — Transport Cameroun"
            left={p => <List.Icon {...p} icon="information-outline" color="#9E9E9E" />}
            titleStyle={styles.listTitle}
            descriptionStyle={styles.listDesc}
          />
        </View>

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

  header: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24 },
  avatar: { backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 12 },
  avatarLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 28 },
  name: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },
  roleBadge: {
    marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4,
  },
  roleText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },

  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4,
  },
  listTitle: { fontSize: 12, color: '#9E9E9E', fontWeight: '500' },
  listDesc:  { fontSize: 15, color: '#212121', fontWeight: '600', marginTop: 2 },

  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#212121' },

  logoutBtn: { marginTop: 8, borderColor: '#B71C1C', borderWidth: 1.5, borderRadius: 12 },
  logoutContent: { height: 50 },
  logoutLabel: { color: '#B71C1C', fontSize: 15, fontWeight: '600' },
});
