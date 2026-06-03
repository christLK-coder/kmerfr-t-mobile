// Écran de numérisation de documents portuaires (OCR via backend Tesseract)
import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { pickDocumentImage, uploadAndSaveDocument } from '../../services/OcrService';
import { useThemeStore } from '../../store/themeStore';
import { useColors } from '../../theme/theme';
import { t } from '../../i18n';
import type { DocType, DocumentDto } from '../../api/documents.api';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type NavProp = NativeStackNavigationProp<MainStackParamList>;
type RoutePropType = RouteProp<MainStackParamList, 'DocumentScan'>;

const DOC_TYPES: { value: DocType; label: string; icon: string }[] = [
  { value: 'LETTRE_VOITURE', label: 'Lettre de voiture',   icon: 'file-document'       },
  { value: 'BON_SORTIE',     label: 'Bon de sortie',        icon: 'file-check'           },
  { value: 'FACTURE',        label: 'Facture',              icon: 'receipt'              },
  { value: 'INSURANCE',      label: 'Assurance',            icon: 'shield-check'         },
  { value: 'ID_CARD',        label: 'Carte d\'identité',    icon: 'card-account-details' },
  { value: 'PERMIT',         label: 'Permis',               icon: 'card-bulleted'        },
  { value: 'OTHER',          label: 'Autre document',       icon: 'file'                 },
];

// ─── Sélecteur type de document ──────────────────────────────────────────────

function DocTypeSelector({
  selected,
  onSelect,
  colors,
}: {
  selected: DocType | null;
  onSelect: (t: DocType) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const C = colors;
  return (
    <View style={styles.typeGrid}>
      {DOC_TYPES.map((dt) => {
        const active = selected === dt.value;
        return (
          <TouchableOpacity
            key={dt.value}
            style={[
              styles.typeChip,
              { borderColor: C.outline, backgroundColor: C.surface },
              active && { backgroundColor: C.primary, borderColor: C.primary },
            ]}
            onPress={() => onSelect(dt.value)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={dt.icon as any}
              size={18}
              color={active ? '#FFFFFF' : C.primary}
            />
            <Text style={[styles.typeLabel, { color: active ? '#FFFFFF' : C.textPrimary }]}>
              {dt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Carte résultat OCR ───────────────────────────────────────────────────────

function OcrResultCard({ doc, colors }: { doc: DocumentDto; colors: ReturnType<typeof useColors> }) {
  const C = colors;
  const conf = doc.ocrConfidence != null ? Math.round(doc.ocrConfidence) : null;
  return (
    <View style={[styles.ocrCard, { backgroundColor: C.surfaceVariant }]}>
      <View style={styles.ocrCardHeader}>
        <MaterialCommunityIcons name="text-recognition" size={20} color={C.primary} />
        <Text style={[styles.ocrCardTitle, { color: C.textPrimary }]}>Texte extrait</Text>
        {conf != null && (
          <View style={[styles.confBadge, { backgroundColor: conf > 70 ? C.successContainer : C.warningContainer }]}>
            <Text style={[styles.confText, { color: conf > 70 ? C.success : C.warning }]}>
              {conf}%
            </Text>
          </View>
        )}
      </View>
      {doc.ocrRawText ? (
        <Text style={[styles.ocrText, { color: C.textSecondary }]}>{doc.ocrRawText}</Text>
      ) : (
        <Text style={[styles.ocrEmpty, { color: C.textMuted }]}>Aucun texte extrait automatiquement.</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentScanScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeStore();
  const C = useColors(isDark);

  const { missionId } = route.params;

  const [docType, setDocType] = useState<DocType | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<DocumentDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePickSource = useCallback((source: 'camera' | 'gallery') => {
    if (!docType) {
      Alert.alert('Type de document', 'Sélectionnez le type de document avant de scanner.');
      return;
    }
    setError(null);
    setResult(null);
    pickDocumentImage(source)
      .then((res) => {
        if (!res) return;
        setImageUri(res.uri);
        setImageBase64(res.base64);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Erreur lors de la capture');
      });
  }, [docType]);

  const handleUpload = useCallback(async () => {
    if (!docType || !imageBase64 || !imageUri) return;
    setUploading(true);
    setError(null);
    try {
      const doc = await uploadAndSaveDocument({
        missionId,
        docType,
        ocrResult: { uri: imageUri, base64: imageBase64 },
      });
      setResult(doc);
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de l\'envoi');
    } finally {
      setUploading(false);
    }
  }, [docType, imageBase64, imageUri, missionId]);

  const handleReset = useCallback(() => {
    setImageUri(null);
    setImageBase64(null);
    setResult(null);
    setError(null);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Header gradient ─── */}
      <LinearGradient
        colors={[C.gradientPrimaryStart, C.gradientPrimaryEnd]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="file-search" size={26} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Scanner un document</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Section type ─── */}
        <View style={[styles.section, { backgroundColor: C.surface }]}>
          <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>Type de document</Text>
          <DocTypeSelector selected={docType} onSelect={setDocType} colors={C} />
        </View>

        {/* ─── Section capture ─── */}
        {!result && (
          <View style={[styles.section, { backgroundColor: C.surface }]}>
            <Text style={[styles.sectionLabel, { color: C.textSecondary }]}>Capture</Text>

            {imageUri ? (
              <View style={[styles.previewContainer, { backgroundColor: C.surface }]}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                <TouchableOpacity style={styles.previewReset} onPress={handleReset}>
                  <MaterialCommunityIcons name="close-circle" size={26} color={C.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.captureRow}>
                <TouchableOpacity
                  style={[styles.captureBtn, { backgroundColor: C.primaryContainer }]}
                  onPress={() => handlePickSource('camera')}
                  activeOpacity={0.80}
                >
                  <MaterialCommunityIcons name="camera" size={32} color={C.primary} />
                  <Text style={[styles.captureBtnLabel, { color: C.primary }]}>Prendre une photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.captureBtn, { backgroundColor: C.surfaceVariant }]}
                  onPress={() => handlePickSource('gallery')}
                  activeOpacity={0.80}
                >
                  <MaterialCommunityIcons name="image-multiple" size={32} color={C.info} />
                  <Text style={[styles.captureBtnLabel, { color: C.info }]}>Choisir depuis la galerie</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bouton envoyer */}
            {imageUri && !uploading && (
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: C.primary }]}
                onPress={handleUpload}
                activeOpacity={0.85}
                disabled={!docType}
              >
                <MaterialCommunityIcons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>{t('common_confirm')}</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={[styles.uploadingText, { color: C.textSecondary }]}>Envoi et analyse OCR en cours...</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Erreur ─── */}
        {error && (
          <View style={[styles.errorCard, { backgroundColor: C.errorContainer }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={C.error} />
            <Text style={[styles.errorText, { color: C.error }]}>{error}</Text>
          </View>
        )}

        {/* ─── Résultat OCR ─── */}
        {result && (
          <View style={[styles.section, { backgroundColor: C.surface }]}>
            <View style={[styles.successBanner, { backgroundColor: C.successContainer }]}>
              <MaterialCommunityIcons name="check-circle" size={22} color={C.success} />
              <Text style={[styles.successText, { color: C.success }]}>Document sauvegardé avec succès</Text>
            </View>
            <OcrResultCard doc={result} colors={C} />

            <TouchableOpacity
              style={[styles.newDocBtn, { borderColor: C.primary }]}
              onPress={handleReset}
            >
              <MaterialCommunityIcons name="plus" size={18} color={C.primary} />
              <Text style={[styles.newDocBtnText, { color: C.primary }]}>Ajouter un autre document</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: C.primary }]}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmBtnText}>Terminé</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tip si aucune image */}
        {!imageUri && !result && (
          <View style={[styles.tipCard, { backgroundColor: C.surfaceVariant }]}>
            <MaterialCommunityIcons name="lightbulb-outline" size={18} color={C.info} />
            <Text style={[styles.tipText, { color: C.textSecondary }]}>
              Assurez-vous que le document est bien éclairé et lisible. Le texte sera extrait automatiquement par le serveur.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  section: {
    borderRadius: 14,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    gap: 12,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1.5,
  },
  typeLabel: { fontSize: 12, fontWeight: '600' },

  captureRow: { flexDirection: 'row', gap: 12 },
  captureBtn: {
    flex: 1, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 24,
  },
  captureBtnLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  previewContainer: {
    borderRadius: 12, overflow: 'hidden',
    position: 'relative',
  },
  preview: { width: '100%', height: 220, borderRadius: 12 },
  previewReset: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 13,
  },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  confirmBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  uploadingText: { fontSize: 14 },

  ocrCard: {
    borderRadius: 12, padding: 14, gap: 10,
  },
  ocrCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ocrCardTitle: { fontSize: 13, fontWeight: '700', flex: 1 },
  confBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  confText: { fontSize: 12, fontWeight: '700' },
  ocrText: { fontSize: 13, lineHeight: 20 },
  ocrEmpty: { fontSize: 13, fontStyle: 'italic' },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, padding: 12,
  },
  successText: { fontSize: 14, fontWeight: '600', flex: 1 },

  newDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, justifyContent: 'center',
    borderWidth: 1.5, borderRadius: 14,
  },
  newDocBtnText: { fontSize: 14, fontWeight: '600' },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14,
  },
  errorText: { fontSize: 13, flex: 1 },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 14, padding: 14,
  },
  tipText: { fontSize: 13, lineHeight: 18, flex: 1 },
});
