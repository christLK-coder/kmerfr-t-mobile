import React, { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, Pressable, RefreshControl } from 'react-native';
import { Text, Button, Chip, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { api } from '../../api/axios.config';
import type { ApiResponse, DriverApplication, ApplicationStatus } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const STATUS_CFG: Record<ApplicationStatus, { color: string; icon: string; label: string }> = {
  PENDING:      { color: '#F57F17', icon: 'clock-outline',       label: 'En attente' },
  UNDER_REVIEW: { color: '#0277BD', icon: 'magnify',             label: 'En vérification' },
  APPROVED:     { color: '#2E7D32', icon: 'check-circle-outline', label: 'Approuvée' },
  REJECTED:     { color: '#C62828', icon: 'close-circle-outline', label: 'Refusée' },
};

export default function AdminApplicationsScreen() {
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [apps, setApps] = useState<DriverApplication[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DriverApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<ApiResponse<DriverApplication[]>>('/api/admin/applications');
      setApps(data.data ?? []);
    } catch {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleApprove = (app: DriverApplication) => {
    Alert.alert('Approuver', `Créer un compte chauffeur pour ${app.fullName} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver', onPress: async () => {
          setActionLoading(true);
          try {
            await api.put(`/api/admin/applications/${app.id}/approve`);
            Alert.alert('Compte créé', `${app.fullName} a reçu ses identifiants par email.`);
            load();
          } catch (e) { Alert.alert('Erreur', (e as Error).message); }
          finally { setActionLoading(false); }
        },
      },
    ]);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await api.put(`/api/admin/applications/${rejectTarget.id}/reject`, { reason: rejectReason });
      setRejectTarget(null);
      setRejectReason('');
      load();
    } catch (e) { Alert.alert('Erreur', (e as Error).message); }
    finally { setActionLoading(false); }
  };

  const openChat = (app: DriverApplication) => {
    nav.navigate('AdminApplicationChat', { applicationId: app.id, applicantName: app.fullName });
  };

  const pending = apps.filter(a => a.status === 'PENDING' || a.status === 'UNDER_REVIEW');
  const processed = apps.filter(a => a.status === 'APPROVED' || a.status === 'REJECTED');

  const renderApp = ({ item }: { item: DriverApplication }) => {
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.PENDING;
    const isPending = item.status === 'PENDING' || item.status === 'UNDER_REVIEW';
    return (
      <Pressable style={[cd.root, { backgroundColor: C.surface }]} onPress={() => openChat(item)}>
        <View style={cd.row}>
          <View style={[cd.avatar, { backgroundColor: cfg.color + '18' }]}>
            <Text style={[cd.initials, { color: cfg.color }]}>{item.fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={cd.info}>
            <Text style={[cd.name, { color: C.textPrimary }]}>{item.fullName}</Text>
            <Text style={[cd.email, { color: C.textSecondary }]}>{item.email}</Text>
            <View style={cd.metaRow}>
              {item.phone ? <Text style={[cd.meta, { color: C.textMuted }]}>{item.phone}</Text> : null}
              {item.city ? <Text style={[cd.meta, { color: C.textMuted }]}> — {item.city}</Text> : null}
            </View>
          </View>
          <Chip compact style={{ backgroundColor: cfg.color + '18' }}
            textStyle={{ color: cfg.color, fontSize: 9, fontWeight: '700' }}>
            {cfg.label}
          </Chip>
        </View>

        {/* Boutons d'action */}
        <View style={cd.actions}>
          <Pressable style={[cd.actionBtn, { backgroundColor: C.primaryContainer }]} onPress={() => openChat(item)}>
            <MaterialCommunityIcons name="chat-outline" size={16} color={C.primary} />
            <Text style={[cd.actionText, { color: C.primary }]}>Voir / Répondre</Text>
          </Pressable>
          {isPending && (
            <>
              <Pressable style={[cd.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => handleApprove(item)}>
                <MaterialCommunityIcons name="check" size={16} color="#2E7D32" />
                <Text style={[cd.actionText, { color: '#2E7D32' }]}>Approuver</Text>
              </Pressable>
              <Pressable style={[cd.actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => setRejectTarget(item)}>
                <MaterialCommunityIcons name="close" size={16} color="#C62828" />
                <Text style={[cd.actionText, { color: '#C62828' }]}>Rejeter</Text>
              </Pressable>
            </>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View>
          <Text style={s.title}>Candidatures</Text>
          <Text style={s.subtitle}>{pending.length} en attente — {processed.length} traitées</Text>
        </View>
      </LinearGradient>

      <FlatList
        data={apps}
        keyExtractor={i => i.id}
        renderItem={renderApp}
        contentContainerStyle={[s.list, apps.length === 0 && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.center}>
            <MaterialCommunityIcons name="account-clock-outline" size={56} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Aucune candidature</Text>
          </View>
        }
      />

      {/* Modal rejet */}
      {rejectTarget && (
        <View style={md.overlay}>
          <Pressable style={md.backdrop} onPress={() => setRejectTarget(null)} />
          <View style={[md.card, { backgroundColor: C.surface }]}>
            <Text style={[md.title, { color: C.textPrimary }]}>Rejeter {rejectTarget.fullName}</Text>
            <TextInput
              label="Motif du rejet"
              value={rejectReason}
              onChangeText={setRejectReason}
              mode="outlined" multiline numberOfLines={3}
              style={{ marginVertical: 12 }} outlineStyle={{ borderRadius: 10 }}
            />
            <View style={md.btns}>
              <Button mode="outlined" onPress={() => { setRejectTarget(null); setRejectReason(''); }} style={{ flex: 1 }}>
                Annuler
              </Button>
              <Button mode="contained" onPress={handleReject}
                loading={actionLoading} style={{ flex: 1, backgroundColor: '#C62828' }}>
                Confirmer
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const cd = StyleSheet.create({
  root: { borderRadius: 14, padding: 14, marginHorizontal: 16, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 18, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  email: { fontSize: 12 },
  metaRow: { flexDirection: 'row', marginTop: 1 },
  meta: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  actionText: { fontSize: 11, fontWeight: '600' },
});

const md = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  card: { width: '100%', borderRadius: 20, padding: 20, elevation: 20, zIndex: 10 },
  title: { fontSize: 17, fontWeight: '700' },
  btns: { flexDirection: 'row', gap: 10 },
});

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { padding: 4 },
  title: { fontSize: 19, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  list: { paddingVertical: 16 },
  listEmpty: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTxt: { fontSize: 15, marginTop: 14 },
});
