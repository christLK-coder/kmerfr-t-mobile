import React, { useCallback, useState } from 'react';
import {
  View, ScrollView, FlatList, StyleSheet, Alert, Pressable, RefreshControl,
} from 'react-native';
import { Text, Button, Chip, TextInput, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { api } from '../../api/axios.config';
import type { ApiResponse } from '../../types';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';

interface WalletSummary {
  totalEscrowed: number;
  totalCommissions: number;
}

interface WalletTx {
  id: string;
  missionId: string;
  amount: number;
  transactionType: string;
  paymentMethod?: string;
  status: string;
  createdAt: string;
}

interface Policy {
  normalRate: number;
  expressRate: number;
  expressSurcharge: number;
  firstDepositPct: number;
}

const TX_COLORS: Record<string, string> = {
  DEPOSIT: '#0277BD', RELEASE: '#2E7D32', REFUND: '#F57F17', COMMISSION: '#7B1FA2',
};
const TX_ICONS: Record<string, string> = {
  DEPOSIT: 'arrow-down-circle', RELEASE: 'arrow-up-circle',
  REFUND: 'undo', COMMISSION: 'percent-circle',
};

export default function AdminFinanceScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [policyLoading, setPolicyLoading] = useState(false);

  const [editNormal, setEditNormal] = useState('');
  const [editExpress, setEditExpress] = useState('');
  const [editSurcharge, setEditSurcharge] = useState('');
  const [editDeposit, setEditDeposit] = useState('');

  const load = async () => {
    try {
      const [summaryRes, txRes, policyRes] = await Promise.all([
        api.get<ApiResponse<WalletSummary>>('/api/admin/wallet/summary'),
        api.get<ApiResponse<WalletTx[]>>('/api/admin/wallet/transactions'),
        api.get<ApiResponse<Policy>>('/api/admin/policy'),
      ]);
      setSummary(summaryRes.data.data ?? null);
      setTransactions(txRes.data.data ?? []);
      const p = policyRes.data.data;
      if (p) {
        setPolicy(p);
        setEditNormal(String(p.normalRate));
        setEditExpress(String(p.expressRate));
        setEditSurcharge(String(p.expressSurcharge));
        setEditDeposit(String(p.firstDepositPct));
      }
    } catch {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const savePolicy = async () => {
    setPolicyLoading(true);
    try {
      await api.put('/api/admin/policy', {
        normalRate: parseFloat(editNormal),
        expressRate: parseFloat(editExpress),
        expressSurcharge: parseFloat(editSurcharge),
        firstDepositPct: parseFloat(editDeposit),
      });
      Alert.alert('Succes', 'Politique tarifaire mise a jour.');
      setShowPolicy(false);
      load();
    } catch (e) { Alert.alert('Erreur', (e as Error).message); }
    finally { setPolicyLoading(false); }
  };

  const formatFcfa = (n: number) => (n ?? 0).toLocaleString('fr-FR');

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: '#4A148C' }]}>
        <Pressable onPress={() => nav.goBack()} style={s.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <Text style={s.title}>Finances</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }} colors={[C.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Solde */}
        <View style={[s.balanceCard, { backgroundColor: C.primary }]}>
          <View style={s.balanceRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.balanceLabel}>Fonds en sequestre</Text>
              <Text style={s.balanceAmount}>{formatFcfa(summary?.totalEscrowed ?? 0)} FCFA</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={s.balanceLabel}>Commissions totales</Text>
              <Text style={s.balanceAmount}>{formatFcfa(summary?.totalCommissions ?? 0)} FCFA</Text>
            </View>
          </View>
        </View>

        {/* Politique tarifaire */}
        <Pressable
          style={[s.policyCard, { backgroundColor: C.surface }]}
          onPress={() => setShowPolicy(!showPolicy)}
        >
          <View style={s.policyHeader}>
            <MaterialCommunityIcons name="cog-outline" size={20} color="#7B1FA2" />
            <Text style={[s.policyTitle, { color: C.textPrimary }]}>Politique tarifaire</Text>
            <MaterialCommunityIcons
              name={showPolicy ? 'chevron-up' : 'chevron-down'}
              size={20} color={C.textMuted}
            />
          </View>
          {!showPolicy && policy && (
            <View style={s.policyPreview}>
              <Text style={[s.policyVal, { color: C.textSecondary }]}>
                Normal {(policy.normalRate * 100).toFixed(1)}% | Express {(policy.expressRate * 100).toFixed(1)}% | Surcharge +{(policy.expressSurcharge * 100).toFixed(0)}% | Versement {(policy.firstDepositPct * 100).toFixed(0)}%
              </Text>
            </View>
          )}
        </Pressable>

        {showPolicy && (
          <View style={[s.policyForm, { backgroundColor: C.surface }]}>
            <TextInput label="Taux commission normal" value={editNormal} onChangeText={setEditNormal}
              mode="outlined" keyboardType="decimal-pad" right={<TextInput.Affix text="%" />}
              style={s.input} outlineStyle={{ borderRadius: 10 }} />
            <TextInput label="Taux commission express" value={editExpress} onChangeText={setEditExpress}
              mode="outlined" keyboardType="decimal-pad" right={<TextInput.Affix text="%" />}
              style={s.input} outlineStyle={{ borderRadius: 10 }} />
            <TextInput label="Surcharge express" value={editSurcharge} onChangeText={setEditSurcharge}
              mode="outlined" keyboardType="decimal-pad" right={<TextInput.Affix text="%" />}
              style={s.input} outlineStyle={{ borderRadius: 10 }} />
            <TextInput label="Premier versement" value={editDeposit} onChangeText={setEditDeposit}
              mode="outlined" keyboardType="decimal-pad" right={<TextInput.Affix text="%" />}
              style={s.input} outlineStyle={{ borderRadius: 10 }} />
            <Button mode="contained" onPress={savePolicy} loading={policyLoading}
              style={{ backgroundColor: '#7B1FA2', borderRadius: 10, marginTop: 8 }}>
              Enregistrer
            </Button>
          </View>
        )}

        {/* Transactions recentes */}
        <Text style={[s.sectionTitle, { color: C.textSecondary }]}>Transactions recentes</Text>

        {transactions.length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: C.surface }]}>
            <MaterialCommunityIcons name="cash-register" size={40} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textSecondary }]}>Aucune transaction</Text>
          </View>
        ) : (
          transactions.map((tx) => {
            const color = TX_COLORS[tx.transactionType] ?? C.textSecondary;
            const icon = TX_ICONS[tx.transactionType] ?? 'cash';
            const sign = tx.transactionType === 'DEPOSIT' ? '+' : tx.transactionType === 'REFUND' ? '-' : '';
            return (
              <View key={tx.id} style={[s.txCard, { backgroundColor: C.surface }]}>
                <View style={[s.txIcon, { backgroundColor: color + '18' }]}>
                  <MaterialCommunityIcons name={icon as any} size={20} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.txType, { color: C.textPrimary }]}>{tx.transactionType}</Text>
                  <Text style={[s.txMeta, { color: C.textMuted }]}>
                    {tx.paymentMethod ?? '—'} · {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.txAmount, { color }]}>
                    {sign}{formatFcfa(tx.amount)} FCFA
                  </Text>
                  <Chip compact style={{ backgroundColor: (tx.status === 'CONFIRMED' ? '#2E7D32' : '#F57F17') + '22' }}
                    textStyle={{ color: tx.status === 'CONFIRMED' ? '#2E7D32' : '#F57F17', fontSize: 9, fontWeight: '700' }}>
                    {tx.status}
                  </Chip>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  back: { padding: 4 },
  title: { fontSize: 19, fontWeight: '700', color: '#fff' },
  content: { padding: 16, gap: 12 },

  balanceCard: { borderRadius: 16, padding: 20 },
  balanceRow: { flexDirection: 'row' },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 20, fontWeight: '800', color: '#fff' },

  policyCard: { borderRadius: 14, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  policyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  policyTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  policyPreview: { marginTop: 8 },
  policyVal: { fontSize: 12 },

  policyForm: { borderRadius: 14, padding: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  input: { marginBottom: 8 },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 },

  txCard: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  txIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txType: { fontSize: 13, fontWeight: '600' },
  txMeta: { fontSize: 11, marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700', marginBottom: 4 },

  emptyCard: { borderRadius: 14, padding: 32, alignItems: 'center', gap: 8, elevation: 1 },
  emptyTxt: { fontSize: 13 },
});
