import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, KeyboardAvoidingView,
  Platform, Pressable, Image, Alert, Dimensions, Linking, Modal,
  StatusBar,
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
  const [sending, setSending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const subId = useRef<string | null>(null);

  useEffect(() => {
    loadHistory();
    initWS();
    return () => {
      if (subId.current) WebSocketService.unsubscribe(subId.current);
    };
  }, [missionId]);

  const loadHistory = useCallback(async () => {
    try {
      const hist = await getChatHistoryApi(missionId);
      // L'API retourne du plus récent au plus ancien → on inverse pour affichage chronologique
      setMessages((hist as Message[]).reverse());
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
  }, [missionId]);

  const initWS = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('jwt_token');
      if (!token) return;
      if (!WebSocketService.isConnected) {
        await WebSocketService.connect(token).catch(() => {});
      }
      subId.current = WebSocketService.subscribe(
        `/topic/mission/${missionId}/chat`,
        (body: any) => {
          if (body && typeof body === 'object' && body.id) {
            setMessages(prev => {
              // Éviter les doublons (message déjà ajouté en optimiste)
              if (prev.some(m => m.id === body.id)) return prev;
              return [...prev, body as Message];
            });
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      );
      setConnected(true);
    } catch {}
  }, [missionId]);

  // ─── Envoi via HTTP POST (fiable — garanti sauvegardé en BD) ────────────────

  const sendText = useCallback(async () => {
    const content = text.trim();
    if (!content || !userId || sending) return;
    setText('');
    setSending(true);

    // Ajout optimiste avec ID temporaire
    const tempId = `temp_${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      senderId: userId,
      senderName: fullName ?? '',
      content,
      msgType: 'TEXT',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data } = await api.post(
        `/api/chat/mission/${missionId}`,
        { content, msgType: 'TEXT' }
      );
      const saved = data?.data as Message | undefined;
      if (saved?.id) {
        // Remplacer le message temporaire par le vrai (avec l'ID BD)
        setMessages(prev => prev.map(m => m.id === tempId ? { ...saved } : m));
      }
    } catch {
      // Retirer le message temporaire en cas d'erreur réseau
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Erreur', 'Message non envoyé. Vérifiez votre connexion.');
      setText(content); // Remettre le texte pour réessai
    } finally {
      setSending(false);
    }
  }, [text, userId, fullName, missionId, sending]);

  // ─── Upload média ────────────────────────────────────────────────────────────

  const uploadMedia = async (uri: string, type: string, fileName?: string): Promise<string | null> => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        type: type.startsWith('video') ? 'video/mp4' : 'image/jpeg',
        name: fileName ?? `media_${Date.now()}.${type.startsWith('video') ? 'mp4' : 'jpg'}`,
      } as any);
      formData.append('missionId', missionId);
      const { data } = await api.post('/api/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data?.url ?? data.data?.fileUrl ?? null;
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le fichier");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const sendMedia = async (content: string, msgType: string, mediaUrl: string) => {
    try {
      await api.post(`/api/chat/mission/${missionId}`, { content, msgType, mediaUrl });
    } catch {}
  };

  const pickImage = async (useCamera: boolean) => {
    setMenuVisible(false);
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    const url = await uploadMedia(asset.uri, isVideo ? 'video' : 'image');
    if (url) sendMedia(isVideo ? '🎬 Vidéo' : '📷 Photo', isVideo ? 'VIDEO' : 'IMAGE', url);
  };

  const pickDocument = async () => {
    setMenuVisible(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const url = await uploadMedia(asset.uri, 'file', asset.name);
      if (url) sendMedia(`📎 ${asset.name}`, 'FILE', url);
    } catch {}
  };

  // ─── Render message ─────────────────────────────────────────────────────────

  const isMe = (senderId: string) => senderId === userId;

  const renderMessage = ({ item }: { item: Message }) => {
    const me = isMe(item.senderId);
    const isTemp = item.id.startsWith('temp_');

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
          me
            ? [s.bubbleMe, { backgroundColor: C.primary, opacity: isTemp ? 0.7 : 1 }]
            : [s.bubbleOther, { backgroundColor: C.surfaceVariant }],
        ]}>
          {!me && <Text style={[s.senderName, { color: C.textSecondary }]}>{item.senderName}</Text>}

          {item.msgType === 'IMAGE' && item.mediaUrl && (
            <Pressable onPress={() => setPreviewImage(item.mediaUrl!)}>
              <Image source={{ uri: item.mediaUrl }} style={s.mediaImg} resizeMode="cover" />
            </Pressable>
          )}
          {item.msgType === 'VIDEO' && item.mediaUrl && (
            <Pressable onPress={() => Linking.openURL(item.mediaUrl!)} style={s.videoThumb}>
              <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
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

          <View style={s.timeRow}>
            <Text style={[s.time, { color: me ? 'rgba(255,255,255,0.6)' : C.textMuted }]}>
              {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {me && isTemp && (
              <MaterialCommunityIcons name="clock-outline" size={10} color="rgba(255,255,255,0.5)" />
            )}
            {me && !isTemp && (
              <MaterialCommunityIcons name="check" size={10} color="rgba(255,255,255,0.7)" />
            )}
          </View>
        </View>
      </View>
    );
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header FIXE — EN DEHORS du KeyboardAvoidingView pour ne pas bouger */}
      <View style={[s.header, { backgroundColor: C.primary, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => nav.goBack()} style={s.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={[s.headerAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={s.headerAvatarTxt}>{otherPartyName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{otherPartyName}</Text>
          <View style={s.statusRow}>
            <View style={[s.statusDot, { backgroundColor: connected ? '#81C784' : '#EF9A9A' }]} />
            <Text style={s.statusTxt}>{connected ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>
      </View>

      {/* Zone messages + input — seule partie gérée par KeyboardAvoidingView */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[s.list, { paddingBottom: 8 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialCommunityIcons name="chat-outline" size={52} color={C.textMuted} />
              <Text style={[s.emptyTxt, { color: C.textMuted }]}>{t('chat_no_messages')}</Text>
              <Text style={[s.emptyHint, { color: C.textMuted }]}>
                Envoyez le premier message ci-dessous
              </Text>
            </View>
          }
        />

        {uploading && (
          <View style={[s.uploadBar, { backgroundColor: C.primaryContainer }]}>
            <ActivityIndicator size="small" color={C.primary} />
            <Text style={[s.uploadTxt, { color: C.primary }]}>Envoi en cours…</Text>
          </View>
        )}

        {/* Barre de saisie — COLLÉE au bas, ne sera jamais cachée par le clavier */}
        <View style={[
          s.inputBar,
          {
            backgroundColor: C.surface,
            borderTopColor: C.divider,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}>
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
            <Menu.Item leadingIcon="camera"         title="Prendre une photo"       onPress={() => pickImage(true)} />
            <Menu.Item leadingIcon="image-multiple" title="Galerie photos/vidéos"   onPress={() => pickImage(false)} />
            <Menu.Item leadingIcon="file-document"  title="Document / Fichier"      onPress={pickDocument} />
          </Menu>

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
            right={
              sending
                ? <TextInput.Icon icon="loading" color={C.textMuted} />
                : undefined
            }
          />

          <Pressable
            onPress={sendText}
            disabled={!text.trim() || sending}
            style={[
              s.sendBtn,
              { backgroundColor: text.trim() && !sending ? C.primary : C.surfaceVariant },
            ]}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={text.trim() && !sending ? '#fff' : C.textMuted}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Preview image plein écran */}
      <Modal
        visible={!!previewImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={s.previewOverlay}>
          <Pressable style={s.previewClose} onPress={() => setPreviewImage(null)}>
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={s.previewImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const s = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 14, gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
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
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt: { fontSize: 12, fontWeight: '700' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 8, gap: 2 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  senderName: { fontSize: 10, fontWeight: '600', marginBottom: 2, paddingHorizontal: 4 },
  msgContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 4 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 2 },
  time: { fontSize: 9, paddingHorizontal: 4 },

  // System messages
  systemRow: { alignItems: 'center', marginVertical: 8 },
  systemTxt: { fontSize: 11, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },

  // Media
  mediaImg: { width: MEDIA_MAX_W, height: MEDIA_MAX_W, borderRadius: 12 },
  videoThumb: {
    width: MEDIA_MAX_W, height: MEDIA_MAX_W * 0.56, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6 },
  fileTxt: { fontSize: 13, flex: 1 },

  // Upload
  uploadBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  uploadTxt: { fontSize: 12, fontWeight: '600' },

  // Input bar — toujours visible au-dessus du clavier
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 6,
    borderTopWidth: 1,
  },
  attachBtn: { paddingBottom: 10, paddingHorizontal: 2 },
  input: { flex: 1, maxHeight: 120 },
  inputOutline: { borderRadius: 22 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 60, gap: 8 },
  emptyTxt: { fontSize: 15, fontWeight: '600' },
  emptyHint: { fontSize: 12, opacity: 0.7 },

  // Preview
  previewOverlay: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  previewClose: {
    position: 'absolute', top: 50, right: 20, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewImg: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.8 },
});
