import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { changePasswordApi } from '../../api/auth.api';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';

export default function ChangePasswordScreen() {
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!currentPwd) e.current = 'Mot de passe actuel requis';
    if (newPwd.length < 8) e.newPwd = 'Minimum 8 caractères';
    else if (!/[A-Z]/.test(newPwd)) e.newPwd = 'Au moins une majuscule';
    else if (!/[0-9]/.test(newPwd)) e.newPwd = 'Au moins un chiffre';
    if (newPwd !== confirmPwd) e.confirm = 'Les mots de passe ne correspondent pas';
    if (currentPwd === newPwd && currentPwd) e.newPwd = 'Le nouveau mot de passe doit être différent';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await changePasswordApi(currentPwd, newPwd);
      Alert.alert('Mot de passe modifié', 'Votre mot de passe a été changé avec succès.', [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Erreur', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Button icon="arrow-left" mode="text" textColor="#fff" onPress={() => nav.goBack()} style={s.back}>
          Retour
        </Button>
        <MaterialCommunityIcons name="lock-reset" size={36} color="#fff" />
        <Text style={s.headerTitle}>Changer le mot de passe</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={[s.form, { backgroundColor: C.surface }]}
          contentContainerStyle={[s.formInner, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.infoCard, { backgroundColor: '#E3F2FD' }]}>
            <MaterialCommunityIcons name="shield-check" size={18} color="#0277BD" />
            <Text style={s.infoText}>
              Vous recevrez une notification de confirmation sur votre appareil après le changement.
            </Text>
          </View>

          <TextInput
            label="Mot de passe actuel"
            value={currentPwd}
            onChangeText={t => { setCurrentPwd(t); setErrors(e => ({ ...e, current: '' })); }}
            mode="outlined"
            secureTextEntry={!showCurrent}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={showCurrent ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowCurrent(v => !v)} />}
            error={!!errors.current}
            style={s.input}
            outlineStyle={s.outline}
          />
          {!!errors.current && <Text style={s.err}>{errors.current}</Text>}

          <TextInput
            label="Nouveau mot de passe"
            value={newPwd}
            onChangeText={t => { setNewPwd(t); setErrors(e => ({ ...e, newPwd: '' })); }}
            mode="outlined"
            secureTextEntry={!showNew}
            left={<TextInput.Icon icon="lock-plus-outline" />}
            right={<TextInput.Icon icon={showNew ? 'eye-off-outline' : 'eye-outline'} onPress={() => setShowNew(v => !v)} />}
            error={!!errors.newPwd}
            style={s.input}
            outlineStyle={s.outline}
          />
          {!!errors.newPwd && <Text style={s.err}>{errors.newPwd}</Text>}

          <TextInput
            label="Confirmer le nouveau mot de passe"
            value={confirmPwd}
            onChangeText={t => { setConfirmPwd(t); setErrors(e => ({ ...e, confirm: '' })); }}
            mode="outlined"
            secureTextEntry={!showNew}
            left={<TextInput.Icon icon="lock-check-outline" />}
            error={!!errors.confirm}
            style={s.input}
            outlineStyle={s.outline}
          />
          {!!errors.confirm && <Text style={s.err}>{errors.confirm}</Text>}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            style={s.btn}
            contentStyle={s.btnInner}
            labelStyle={s.btnLabel}
          >
            Modifier le mot de passe
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingBottom: 24, alignItems: 'center' },
  back: { alignSelf: 'flex-start', marginLeft: 4, marginBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 8 },
  form: { flex: 1, marginTop: -16, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  formInner: { padding: 20 },
  input: { marginBottom: 2 },
  outline: { borderRadius: 10 },
  err: { fontSize: 11, color: '#B71C1C', marginBottom: 8, marginLeft: 4 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  infoText: { fontSize: 12, color: '#0277BD', lineHeight: 17, flex: 1 },
  btn: { marginTop: 20, borderRadius: 10 },
  btnInner: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
});
