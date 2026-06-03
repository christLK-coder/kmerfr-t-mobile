import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, KeyboardAvoidingView,
  Platform, Pressable, Image, Alert, Dimensions, Linking, Modal, StatusBar,
} from 'react-native';
import { Text, TextInput, Menu, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import { getChatHistoryApi } from '../../api/missions.api';
import { api } from '../../api/axios.config';
import WebSocketService from '../../services/WebSocketService';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type RouteType = RouteProp<MainStackParamList, 'Chat'>;

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  msgType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  mediaUrl?: string;
  fileName?: string;
  createdAt: string;
}

const { width: SCREEN_W } = Dimensions.get('window');
const MEDIA_MAX_W = SCREEN_W * 0.6;

export default function ChatScreen() {
  const route = useRoute<RouteType>();
  const nav = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);
  const { userId, fullName } = useAuthStore();
  const { missionId, otherPartyName } = route.params;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const subId = useRef<string | null>(null);

  useEffect(() => {
    loadHistory();
    initWS();
    return () => { if (subId.current) WebSocketService.unsubscribe(subId.current); };
  }, []);

  const loadHistory = async () => {
    try {
      const hist = await getChatHistoryApi(missionId);
      setMessages(hist.reverse());
    } catch {}
  };

  const initWS = async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
      if (!token) return;
      if (!WebSocketService.isConnected) await WebSocketService.connect(token);
      subId.current = WebSocketService.subscribe(
        `/topic/mission/${missionId}/chat`,
        (body: any) => {
          setMessages(prev => [...prev, body as Message]);
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
      );
      setConnected(true);
    } catch {}
  };

  // ─── Envoi texte ────────────────────────────────────────────────────────────

  const sendText = () => {
    if (!text.trim() || !userId) return;
    const content = text.trim();
    setText('');
    sendViaWS(content, 'TEXT');
  };

  const sendViaWS = (content: string, msgType: string, mediaUrl?: string) => {
    if (!userId) return;
    WebSocketService.send(
      `/app/mission/${missionId}/chat`,
      { content, msgType, mediaUrl: mediaUrl ?? null },
      { senderId: userId }
    );
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      senderId: userId,
      senderName: fullName ?? '',
      content,
      msgType: msgType as any,
      mediaUrl,
      createdAt: new Date().toISOString(),
    }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ─── Upload média vers le serveur ───────────────────────────────────────────

  const uploadMedia = async (uri: string, type: string, fileName?: string): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: type.startsWith('video') ? 'video/mp4'
            : type.startsWith('audio') ? 'audio/m4a'
            : 'image/jpeg',
        name: fileName ?? `media_${Date.now()}.${type.startsWith('video') ? 'mp4' : type.startsWith('audio') ? 'm4a' : 'jpg'}`,
      } as any);
      formData.append('missionId', missionId);

      const { data } = await api.post('/api/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data?.url ?? data.data?.fileUrl ?? null;
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le fichier');
      return null;
    } finally {
      setUploading(false);
    }
  };

  // ─── Pickers ────────────────────────────────────────────────────────────────

  const pickImage = async (useCamera: boolean) => {
    setMenuVisible(false);
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 60 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7, videoMaxDuration: 60 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const url = await uploadMedia(asset.uri, isVideo ? 'video' : 'image');
    if (url) {
      sendViaWS(isVideo ? '🎬 Vidéo' : '📷 Photo', isVideo ? 'VIDEO' : 'IMAGE', url);
    }
  };

  const pickDocument = async () => {
    setMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const url = await uploadMedia(asset.uri, 'file', asset.name);
      if (url) {
        sendViaWS(`📎 ${asset.name}`, 'FILE', url);
      }
    } catch {}
  };

  // ─── Audio recording (disabled — expo-av incompatible with SDK 56) ──────────

  const startRecording = async () => {
    setMenuVisible(false);
    Alert.alert('Bientôt disponible', 'Les messages vocaux seront disponibles dans une prochaine mise à jour.');
  };

  const stopRecording = async () => {
    setIsRecording(false);
  };

  // ─── Render message ─────────────────────────────────────────────────────────

  const isMe = (senderId: string) => senderId === userId;

  const renderMessage = ({ item }: { item: Message }) => {
    const me = isMe(item.senderId);

    if (item.msgType === 'SYSTEM') {
      return (
        <View style={s.systemRow}>
          <Text style={[s.systemTxt, { color: C.textMuted, backgroundColor: C.surfaceVariant }]}>
            {item.content}
          </Text>
        </View>
      );
    }

    return (
      <View style={[s.msgRow, me && s.msgRowMe]}>
        {!me && (
          <View style={[s.avatar, { backgroundColor: C.primaryContainer }]}>
            <Text style={[s.avatarTxt, { color: C.primary }]}>{item.senderName.charAt(0)}</Text>
          </View>
        )}
        <View style={[
          s.bubble,
          me ? [s.bubbleMe, { backgroundColor: C.primary }] : [s.bubbleOther, { backgroundColor: C.surfaceVariant }]
        ]}>
          {!me && <Text style={[s.senderName, { color: C.textSecondary }]}>{item.senderName}</Text>}

          {/* Contenu selon le type */}
          {item.msgType === 'IMAGE' && item.mediaUrl && (
            <Pressable onPress={() => setPreviewImage(item.mediaUrl!)}>
              <Image source={{ uri: item.mediaUrl }} style={s.mediaImg} resizeMode="cover" />
            </Pressable>
          )}
          {item.msgType === 'VIDEO' && item.mediaUrl && (
            <Pressable onPress={() => Linking.openURL(item.mediaUrl!)} style={s.videoThumb}>
              <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
              <Text style={s.videoLabel}>Vidéo</Text>
            </Pressable>
          )}
          {item.msgType === 'AUDIO' && item.mediaUrl && (
            <Pressable onPress={() => {}} style={s.audioRow}>
              <MaterialCommunityIcons name="play-circle" size={32} color={me ? '#fff' : C.primary} />
              <View style={[s.audioBar, { backgroundColor: me ? 'rgba(255,255,255,0.3)' : C.outline }]} />
              <Text style={[s.audioDur, { color: me ? 'rgba(255,255,255,0.7)' : C.textMuted }]}>0:00</Text>
            </Pressable>
          )}
          {item.msgType === 'FILE' && (
            <Pressable onPress={() => item.mediaUrl && Linking.openURL(item.mediaUrl)} style={s.fileRow}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color={me ? '#fff' : C.primary} />
              <Text style={[s.fileTxt, { color: me ? '#fff' : C.textPrimary }]} numberOfLines={2}>
                {item.content}
              </Text>
            </Pressable>
          )}
          {(item.msgType === 'TEXT' || (!item.mediaUrl && item.msgType !== 'FILE')) && (
            <Text style={[s.msgContent, { color: me ? '#fff' : C.textPrimary }]}>{item.content}</Text>
          )}

          <Text style={[s.time, { color: me ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>
            {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -200}
    >
      {/* Header WhatsApp-style */}
      <View style={[s.header, { backgroundColor: C.primary, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={[s.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={s.headerAvatarTxt}>{otherPartyName.charAt(0)}</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{otherPartyName}</Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: connected ? '#81C784' : '#EF9A9A' }]} />
            <Text style={s.statusTxt}>{connected ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={[s.list, { paddingBottom: 16 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="chat-outline" size={48} color={C.textMuted} />
            <Text style={[s.emptyTxt, { color: C.textMuted }]}>{t('chat_no_messages')}</Text>
          </View>
        }
      />

      {/* Uploading indicator */}
      {uploading && (
        <View style={[s.uploadBar, { backgroundColor: C.primaryContainer }]}>
          <ActivityIndicator size="small" color={C.primary} />
          <Text style={[s.uploadTxt, { color: C.primary }]}>Envoi en cours…</Text>
        </View>
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { backgroundColor: C.surface, borderTopColor: C.divider, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {/* Bouton pièce jointe */}
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={s.attachBtn}>
              <MaterialCommunityIcons name="plus-circle" size={28} color={C.primary} />
            </Pressable>
          }
          anchorPosition="top"
        >
          <Menu.Item leadingIcon="camera" title="Prendre une photo" onPress={() => pickImage(true)} />
          <Menu.Item leadingIcon="image-multiple" title="Galerie photos/vidéos" onPress={() => pickImage(false)} />
          <Menu.Item leadingIcon="file-document" title="Document / Fichier" onPress={pickDocument} />
          <Menu.Item leadingIcon="microphone" title="Message vocal" onPress={startRecording} />
        </Menu>

        {/* Input texte ou enregistrement audio */}
        {isRecording ? (
          <View style={s.recordingRow}>
            <View style={[s.recordDot, { backgroundColor: C.error }]} />
            <Text style={[s.recordTxt, { color: C.error }]}>Enregistrement…</Text>
            <Pressable onPress={stopRecording} style={[s.stopBtn, { backgroundColor: C.error }]}>
              <MaterialCommunityIcons name="stop" size={20} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat_placeholder')}
            mode="outlined"
            dense
            style={s.input}
            outlineStyle={s.inputOutline}
            multiline
            maxLength={2000}
            onSubmitEditing={sendText}
          />
        )}

        {/* Bouton envoyer */}
        {!isRecording && (
          <Pressable
            onPress={text.trim() ? sendText : startRecording}
            style={[s.sendBtn, { backgroundColor: text.trim() ? C.primary : C.surfaceVariant }]}
          >
            <MaterialCommunityIcons
              name={text.trim() ? 'send' : 'microphone'}
              size={20}
              color={text.trim() ? '#fff' : C.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/* Preview image plein écran */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={s.previewOverlay}>
          <Pressable style={s.previewClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={s.previewImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 14, gap: 10 },
  backBtn: { padding: 4 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerAvatarTxt: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 11, color: 'rgba(255,255,255,0.75)' },

  // Messages
  list: { padding: 12, gap: 6 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 8, gap: 2 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  senderName: { fontSize: 10, fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 },
  msgContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  time: { fontSize: 9, alignSelf: 'flex-end', marginTop: 2, paddingHorizontal: 4 },

  // System messages
  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemTxt: { fontSize: 11, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  // Media
  mediaImg: { width: MEDIA_MAX_W, height: MEDIA_MAX_W, borderRadius: 12 },
  videoThumb: {
    width: MEDIA_MAX_W, height: MEDIA_MAX_W * 0.56, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  videoLabel: { color: '#fff', fontSize: 11, marginTop: 4 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6, minWidth: 160 },
  audioBar: { flex: 1, height: 3, borderRadius: 1.5 },
  audioDur: { fontSize: 11 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  fileTxt: { fontSize: 13, flex: 1 },

  // Upload bar
  uploadBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  uploadTxt: { fontSize: 12, fontWeight: '600' },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, gap: 6, borderTopWidth: 1 },
  attachBtn: { paddingBottom: 10, paddingHorizontal: 2 },
  input: { flex: 1, maxHeight: 100 },
  inputOutline: { borderRadius: 22 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },

  // Recording
  recordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  recordDot: { width: 12, height: 12, borderRadius: 6 },
  recordTxt: { flex: 1, fontSize: 14, fontWeight: '600' },
  stopBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyTxt: { fontSize: 14, marginTop: 12 },

  // Preview plein écran
  previewOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
