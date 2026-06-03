import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, KeyboardAvoidingView, Platform,
  Pressable, Alert, Image, Keyboard, Modal, Dimensions, StatusBar, Linking,
} from 'react-native';
import { Text, TextInput, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { api } from '../../api/axios.config';
import { API_BASE_URL } from '../../utils/constants';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import type { ApiResponse } from '../../types';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type Route = RouteProp<MainStackParamList, 'AdminApplicationChat'>;

interface AppMessage {
  id?: string;
  senderRole: 'APPLICANT' | 'ADMIN';
  content: string;
  attachmentUrl?: string | null;
  createdAt?: string;
}

interface AppData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  adminNotes?: string;
  submittedAt?: string;
  messages: AppMessage[];
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function getFileType(url: string | null | undefined): 'image' | 'pdf' | 'other' {
  if (!url) return 'other';
  const lower = url.toLowerCase();
  if (IMAGE_EXTS.some(ext => lower.endsWith(ext))) return 'image';
  if (lower.endsWith('.pdf')) return 'pdf';
  return 'other';
}

function buildFullUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

export default function AdminApplicationChatScreen() {
  const nav = useNavigation();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { applicationId, applicantName } = route.params;
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [app, setApp] = useState<AppData | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const { data } = await api.get<ApiResponse<AppData>>(`/api/auth/apply/driver/${applicationId}`);
      if (data.data) setApp(data.data);
    } catch {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []));

  const sendAdminMsg = async () => {
    if (!message.trim()) return;
    const content = message.trim();
    setSending(true);
    setMessage('');
    Keyboard.dismiss();
    try {
      await api.post(`/api/admin/applications/${applicationId}/message`, { content });
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  if (loading || !app) {
    return (
      <View style={[s.root, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const messages = (app.messages ?? []).filter(m => m && typeof m.content === 'string');

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <LinearGradient colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={[s.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={s.headerInitial}>{applicantName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerName}>{applicantName}</Text>
          <Text style={s.headerMeta}>{app.email} — {app.phone}</Text>
        </View>
      </LinearGradient>

      {/* Info candidature */}
      <View style={[s.infoBar, { backgroundColor: C.surface, borderBottomColor: C.outline }]}>
        <Text style={[s.infoStatus, { color: C.primary }]}>Statut : {app.status}</Text>
        <Text style={[s.infoDate, { color: C.textMuted }]}>
          Soumise le {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('fr-FR') : '—'}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => item.id ?? String(i)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.chatContent}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={s.emptyChat}>
              <MaterialCommunityIcons name="chat-outline" size={40} color={C.textMuted} />
              <Text style={[s.emptyChatText, { color: C.textMuted }]}>
                Aucun message. Répondez au candidat ou demandez des documents.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isAdmin = item.senderRole === 'ADMIN';
            const fullUrl = buildFullUrl(item.attachmentUrl);
            const fileType = getFileType(item.attachmentUrl);

            return (
              <View style={[s.msgRow, isAdmin && s.msgRowMe]}>
                {!isAdmin && (
                  <View style={[s.msgAvatar, { backgroundColor: '#E65100' + '20' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#E65100' }}>
                      {applicantName.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={[
                  s.msgBubble,
                  fileType === 'image' && fullUrl && s.msgBubbleImg,
                  isAdmin
                    ? { backgroundColor: C.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.outline },
                ]}>
                  {!isAdmin && <Text style={[s.msgSender, { color: '#E65100' }]}>{applicantName}</Text>}

                  {fileType === 'image' && fullUrl ? (
                    <Pressable onPress={() => setPreviewImage(fullUrl)}>
                      <Image source={{ uri: fullUrl }} style={s.chatImage} resizeMode="cover" />
                      {item.content ? <Text style={[s.imgCaption, { color: isAdmin ? '#fff' : C.textPrimary }]}>{item.content}</Text> : null}
                    </Pressable>
                  ) : fileType === 'pdf' && fullUrl ? (
                    <Pressable onPress={() => Linking.openURL(fullUrl)} style={s.pdfCard}>
                      <View style={s.pdfIconBox}>
                        <MaterialCommunityIcons name="file-pdf-box" size={28} color="#C62828" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.pdfName, { color: isAdmin ? '#fff' : C.textPrimary }]} numberOfLines={2}>{item.content}</Text>
                        <Text style={[s.pdfMeta, { color: isAdmin ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>PDF — Appuyez pour ouvrir</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Text style={[s.msgText, { color: isAdmin ? '#fff' : C.textPrimary }]}>{item.content}</Text>
                  )}

                  <Text style={[s.msgTime, { color: isAdmin ? 'rgba(255,255,255,0.5)' : C.textMuted }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={[s.inputBar, { backgroundColor: C.surface, borderTopColor: C.outline, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Répondre au candidat..."
            mode="outlined"
            dense
            style={s.msgInput}
            outlineStyle={{ borderRadius: 22 }}
            multiline
            maxLength={1000}
            onSubmitEditing={sendAdminMsg}
          />
          <Pressable
            onPress={sendAdminMsg}
            disabled={!message.trim() || sending}
            style={[s.sendBtn, { backgroundColor: message.trim() ? C.primary : C.surfaceVariant }]}
          >
            {sending
              ? <ActivityIndicator size={16} color="#fff" />
              : <MaterialCommunityIcons name="send" size={18} color={message.trim() ? '#fff' : C.textMuted} />
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={s.previewOverlay}>
          <Pressable style={s.previewClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {previewImage && <Image source={{ uri: previewImage }} style={s.previewImage} resizeMode="contain" />}
        </View>
      </Modal>
    </View>
  );
}

const { width: SW, height: SH } = Dimensions.get('window');

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  infoBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  infoStatus: { fontSize: 12, fontWeight: '700' },
  infoDate: { fontSize: 11 },

  chatContent: { padding: 12, paddingBottom: 8 },
  emptyChat: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyChatText: { fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  msgBubbleImg: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
  msgSender: { fontSize: 10, fontWeight: '700', marginBottom: 2 },
  msgText: { fontSize: 14, lineHeight: 19 },
  msgTime: { fontSize: 9, alignSelf: 'flex-end', marginTop: 2, paddingHorizontal: 4 },

  chatImage: { width: SW * 0.5, height: SW * 0.5, borderRadius: 12 },
  imgCaption: { fontSize: 13, marginTop: 4, paddingHorizontal: 8 },
  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  pdfIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center' },
  pdfName: { fontSize: 13, fontWeight: '600' },
  pdfMeta: { fontSize: 11, marginTop: 1 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, gap: 6, borderTopWidth: 1 },
  msgInput: { flex: 1, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  previewOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: SW, height: SH * 0.8 },
});
