import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, KeyboardAvoidingView, Platform,
  Pressable, Alert, Image, Keyboard, Modal, Dimensions, StatusBar,
  Linking,
} from 'react-native';
import { Text, TextInput, ActivityIndicator, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { getDriverApplicationApi, sendApplicationMessageApi, uploadApplicationFileApi } from '../../api/auth.api';
import { API_BASE_URL } from '../../utils/constants';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverOnboarding'>;

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

const STATUS_CONFIG: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  PENDING:      { icon: 'clock-outline',       color: '#F57F17', label: 'En attente',        bg: '#FFF8E1' },
  UNDER_REVIEW: { icon: 'magnify',             color: '#00897B', label: 'En vérification',   bg: '#E0F2F1' },
  APPROVED:     { icon: 'check-circle-outline', color: '#2E7D32', label: 'Approuvée',         bg: '#E8F5E9' },
  REJECTED:     { icon: 'close-circle-outline', color: '#C62828', label: 'Refusée',            bg: '#FFEBEE' },
};

const REQUIRED_DOCS = [
  { icon: 'card-account-details-outline',      label: 'CNI (recto/verso)' },
  { icon: 'card-account-details-star-outline', label: 'Permis de conduire C+' },
  { icon: 'account-box-outline',               label: 'Photo d\'identité' },
  { icon: 'file-document-outline',             label: 'Casier judiciaire' },
];

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const PDF_EXTS = ['.pdf'];

function getFileType(url: string | null | undefined): 'image' | 'pdf' | 'other' {
  if (!url) return 'other';
  const lower = url.toLowerCase();
  if (IMAGE_EXTS.some(ext => lower.endsWith(ext))) return 'image';
  if (PDF_EXTS.some(ext => lower.endsWith(ext))) return 'pdf';
  return 'other';
}

function getFileName(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1] || 'fichier';
}

function buildFullUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
}

export default function DriverOnboardingScreen({ route }: Props) {
  const nav = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { applicationId } = route.params;
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const [app, setApp] = useState<AppData | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const load = async () => {
    try {
      const data = await getDriverApplicationApi(applicationId);
      if (data && typeof data === 'object' && 'id' in data) {
        setApp(data as any);
      }
    } catch (e) {
      console.warn('[Onboarding] Erreur chargement:', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []));

  const sendTextMsg = async () => {
    if (!message.trim()) return;
    const content = message.trim();
    setSending(true);
    setMessage('');
    Keyboard.dismiss();
    try {
      await sendApplicationMessageApi(applicationId, content);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (uri: string, fileName: string, caption: string) => {
    setSending(true);
    try {
      const { url } = await uploadApplicationFileApi(applicationId, uri, fileName);
      await sendApplicationMessageApi(applicationId, caption, url);
      await load();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message || 'Envoi échoué.');
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async (fromCamera: boolean) => {
    setMenuVisible(false);
    try {
      let uri: string;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez la caméra.'); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (result.canceled || !result.assets[0]) return;
        uri = result.assets[0].uri;
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (result.canceled || !result.assets[0]) return;
        uri = result.assets[0].uri;
      }
      const name = `photo_${Date.now()}.jpg`;
      await uploadAndSend(uri, name, fromCamera ? 'Photo document' : 'Image jointe');
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer la photo.');
    }
  };

  const pickDocument = async () => {
    setMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'] });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await uploadAndSend(asset.uri, asset.name, asset.name);
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le fichier.');
    }
  };

  if (loading || !app) {
    return (
      <View style={[st.root, { backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.PENDING;
  const messages = (app.messages ?? []).filter(m => m && typeof m.content === 'string');

  return (
    <View style={[st.root, { backgroundColor: C.background }]}>
      <View style={[st.header, { backgroundColor: C.primary, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={st.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>Ma candidature</Text>
          <View style={st.headerStatusRow}>
            <View style={[st.headerDot, { backgroundColor: cfg.color }]} />
            <Text style={st.headerStatus}>{cfg.label}</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, i) => item.id ?? String(i)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.chatContent}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
          }}
          ListHeaderComponent={
            <View style={st.headerSection}>
              <View style={[st.statusCard, { backgroundColor: cfg.bg }]}>
                <MaterialCommunityIcons name={cfg.icon as any} size={28} color={cfg.color} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[st.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={[st.statusDate, { color: cfg.color + '99' }]}>
                    Soumise le {app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('fr-FR') : '—'}
                  </Text>
                </View>
              </View>

              <View style={[st.timeline, { backgroundColor: C.surface }]}>
                {(['PENDING', 'UNDER_REVIEW', 'APPROVED'] as const).map((step, i) => {
                  const steps = ['PENDING', 'UNDER_REVIEW', 'APPROVED'];
                  const idx = steps.indexOf(app.status);
                  const done = idx > i;
                  const active = idx === i;
                  return (
                    <View key={step} style={st.timelineStep}>
                      <View style={[st.dot, done ? st.dotDone : active ? st.dotActive : st.dotWait]}>
                        {done && <MaterialCommunityIcons name="check" size={10} color="#fff" />}
                        {active && <View style={st.dotPulse} />}
                      </View>
                      {i < 2 && <View style={[st.tLine, done && st.tLineDone]} />}
                      <Text style={[st.stepLabel, { color: done || active ? C.textPrimary : C.textMuted }]}>
                        {['Soumise', 'Vérification', 'Approuvée'][i]}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {app.adminNotes ? (
                <View style={st.noteBox}>
                  <MaterialCommunityIcons name="message-alert-outline" size={18} color="#E65100" />
                  <Text style={st.noteText}>{app.adminNotes}</Text>
                </View>
              ) : null}

              <View style={[st.docsCard, { backgroundColor: C.surface }]}>
                <Text style={[st.docsTitle, { color: C.textPrimary }]}>Documents requis</Text>
                {REQUIRED_DOCS.map((doc, i) => (
                  <View key={i} style={st.docRow}>
                    <MaterialCommunityIcons name={doc.icon as any} size={18} color={C.primary} />
                    <Text style={[st.docLabel, { color: C.textSecondary }]}>{doc.label}</Text>
                  </View>
                ))}
                <Text style={[st.docsHint, { color: C.textMuted }]}>
                  Utilisez le bouton + ci-dessous pour envoyer vos documents.
                </Text>
              </View>

              <View style={st.chatDivider}>
                <View style={[st.chatDivLine, { backgroundColor: C.outline }]} />
                <Text style={[st.chatDivText, { color: C.textMuted }]}>Conversation</Text>
                <View style={[st.chatDivLine, { backgroundColor: C.outline }]} />
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={st.emptyChat}>
              <MaterialCommunityIcons name="chat-processing-outline" size={40} color={C.textMuted} />
              <Text style={[st.emptyChatText, { color: C.textMuted }]}>
                Envoyez vos documents ou posez une question
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.senderRole === 'APPLICANT';
            const fullUrl = buildFullUrl(item.attachmentUrl);
            const fileType = getFileType(item.attachmentUrl);
            const fileName = item.attachmentUrl ? getFileName(item.attachmentUrl) : '';
            const displayName = item.content || fileName;

            return (
              <View style={[st.msgRow, isMe && st.msgRowMe]}>
                {!isMe && (
                  <View style={[st.msgAvatar, { backgroundColor: '#00897B20' }]}>
                    <MaterialCommunityIcons name="shield-account" size={16} color="#00897B" />
                  </View>
                )}
                <View style={[
                  st.msgBubble,
                  fileType === 'image' && fullUrl && st.msgBubbleImg,
                  isMe
                    ? { backgroundColor: C.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.outline },
                ]}>
                  {!isMe && <Text style={[st.msgSender, { color: '#00897B' }]}>Admin KmerFret</Text>}

                  {/* === IMAGE === */}
                  {fileType === 'image' && fullUrl ? (
                    <Pressable onPress={() => setPreviewImage(fullUrl)}>
                      <Image source={{ uri: fullUrl }} style={st.chatImage} resizeMode="cover" />
                      {displayName ? (
                        <Text style={[st.imgCaption, { color: isMe ? '#fff' : C.textPrimary }]}>{displayName}</Text>
                      ) : null}
                    </Pressable>

                  /* === PDF / FICHIER === */
                  ) : fileType === 'pdf' && fullUrl ? (
                    <Pressable onPress={() => Linking.openURL(fullUrl)} style={st.pdfCard}>
                      <View style={st.pdfIconBox}>
                        <MaterialCommunityIcons name="file-pdf-box" size={32} color="#C62828" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.pdfName, { color: isMe ? '#fff' : C.textPrimary }]} numberOfLines={2}>
                          {displayName}
                        </Text>
                        <Text style={[st.pdfMeta, { color: isMe ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>
                          PDF — Appuyez pour ouvrir
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="download" size={20} color={isMe ? 'rgba(255,255,255,0.7)' : C.primary} />
                    </Pressable>

                  /* === FICHIER AUTRE AVEC URL === */
                  ) : fullUrl && fileType === 'other' ? (
                    <Pressable onPress={() => Linking.openURL(fullUrl)} style={st.pdfCard}>
                      <View style={[st.pdfIconBox, { backgroundColor: '#E0F2F1' }]}>
                        <MaterialCommunityIcons name="file-document-outline" size={28} color="#00897B" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[st.pdfName, { color: isMe ? '#fff' : C.textPrimary }]} numberOfLines={2}>
                          {displayName}
                        </Text>
                        <Text style={[st.pdfMeta, { color: isMe ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>
                          Appuyez pour ouvrir
                        </Text>
                      </View>
                    </Pressable>

                  /* === TEXTE SIMPLE === */
                  ) : (
                    <Text style={[st.msgText, { color: isMe ? '#fff' : C.textPrimary }]}>{item.content}</Text>
                  )}

                  <Text style={[st.msgTime, { color: isMe ? 'rgba(255,255,255,0.5)' : C.textMuted }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[st.inputBar, { backgroundColor: C.surface, borderTopColor: C.outline, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchorPosition="top"
            anchor={
              <Pressable onPress={() => setMenuVisible(true)} style={st.attachBtn}>
                <MaterialCommunityIcons name="plus-circle" size={28} color={C.primary} />
              </Pressable>
            }
          >
            <Menu.Item leadingIcon="camera" title="Prendre une photo" onPress={() => pickPhoto(true)} />
            <Menu.Item leadingIcon="image-multiple" title="Choisir une image" onPress={() => pickPhoto(false)} />
            <Menu.Item leadingIcon="file-pdf-box" title="Envoyer un fichier" onPress={pickDocument} />
          </Menu>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Ecrivez un message..."
            mode="outlined"
            dense
            style={st.msgInput}
            outlineStyle={{ borderRadius: 22 }}
            multiline
            maxLength={1000}
            onSubmitEditing={sendTextMsg}
          />

          <Pressable
            onPress={sendTextMsg}
            disabled={!message.trim() || sending}
            style={[st.sendBtn, { backgroundColor: message.trim() ? C.primary : C.surfaceVariant }]}
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
        <View style={st.previewOverlay}>
          <Pressable style={st.previewClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={st.previewImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const { width: SW, height: SH } = Dimensions.get('window');

const st = StyleSheet.create({
  root: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  headerDot: { width: 8, height: 8, borderRadius: 4 },
  headerStatus: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  headerSection: { gap: 10, paddingBottom: 8 },

  statusCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginHorizontal: 12 },
  statusLabel: { fontSize: 15, fontWeight: '800' },
  statusDate: { fontSize: 11, marginTop: 2 },

  timeline: { flexDirection: 'row', justifyContent: 'center', marginHorizontal: 12, borderRadius: 12, padding: 14, elevation: 1 },
  timelineStep: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  dotDone: { backgroundColor: '#2E7D32' },
  dotActive: { backgroundColor: '#00897B' },
  dotWait: { backgroundColor: '#E0E0E0' },
  dotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  tLine: { position: 'absolute', top: 9, left: '60%', right: '-60%', height: 2, backgroundColor: '#E0E0E0' },
  tLineDone: { backgroundColor: '#2E7D32' },
  stepLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF3E0' },
  noteText: { fontSize: 13, color: '#E65100', flex: 1, lineHeight: 18 },

  docsCard: { marginHorizontal: 12, borderRadius: 14, padding: 14, elevation: 1 },
  docsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  docLabel: { fontSize: 12, flex: 1 },
  docsHint: { fontSize: 11, fontStyle: 'italic', marginTop: 8 },

  chatDivider: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginTop: 4 },
  chatDivLine: { flex: 1, height: 1 },
  chatDivText: { fontSize: 11, fontWeight: '600' },

  chatContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  emptyChat: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyChatText: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  msgBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  msgBubbleImg: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6 },
  msgSender: { fontSize: 10, fontWeight: '700', marginBottom: 2, paddingHorizontal: 8 },
  msgText: { fontSize: 14, lineHeight: 19 },
  msgTime: { fontSize: 9, alignSelf: 'flex-end', marginTop: 2, paddingHorizontal: 4 },

  // Image dans le chat
  chatImage: { width: SW * 0.55, height: SW * 0.55, borderRadius: 12 },
  imgCaption: { fontSize: 13, marginTop: 4, paddingHorizontal: 8, lineHeight: 17 },

  // PDF / fichier dans le chat
  pdfCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingRight: 4 },
  pdfIconBox: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#FFEBEE', alignItems: 'center', justifyContent: 'center' },
  pdfName: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  pdfMeta: { fontSize: 11, marginTop: 2 },

  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, gap: 6, borderTopWidth: 1 },
  attachBtn: { paddingBottom: 10, paddingHorizontal: 2 },
  msgInput: { flex: 1, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  previewOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: SW, height: SH * 0.8 },
});
