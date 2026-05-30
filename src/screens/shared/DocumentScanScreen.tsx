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
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { pickDocumentImage, uploadAndSaveDocument } from '../../services/OcrService';
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
}: {
  selected: DocType | null;
  onSelect: (t: DocType) => void;
}) {
  return (
    <View style={styles.typeGrid}>
      {DOC_TYPES.map((dt) => {
        const active = selected === dt.value;
        return (
          <TouchableOpacity
            key={dt.value}
            style={[styles.typeChip, active && styles.typeChipActive]}
            onPress={() => onSelect(dt.value)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons
              name={dt.icon as any}
              size={20}
              color={active ? '#FFFFFF' : '#1B5E20'}
            />
            <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
              {dt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Carte résultat OCR ───────────────────────────────────────────────────────

function OcrResultCard({ doc }: { doc: DocumentDto }) {
  const conf = doc.ocrConfidence != null ? Math.round(doc.ocrConfidence) : null;
  return (
    <View style={styles.ocrCard}>
      <View style={styles.ocrCardHeader}>
        <MaterialCommunityIcons name="text-recognition" size={20} color="#1B5E20" />
        <Text style={styles.ocrCardTitle}>Texte extrait</Text>
        {conf != null && (
          <View style={[styles.confBadge, { backgroundColor: conf > 70 ? '#E8F5E9' : '#FFF3E0' }]}>
            <Text style={[styles.confText, { color: conf > 70 ? '#1B5E20' : '#E65100' }]}>
              {conf}%
            </Text>
          </View>
        )}
      </View>
      {doc.ocrRawText ? (
        <Text style={styles.ocrText}>{doc.ocrRawText}</Text>
      ) : (
        <Text style={styles.ocrEmpty}>Aucun texte extrait automatiquement.</Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DocumentScanScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();

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
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Header ─── */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        locations={[0, 0.55, 1]}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <MaterialCommunityIcons name="file-search" size={28} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Numérisation document</Text>
          <Text style={styles.headerSub}>Port de Douala / Kribi</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Section type ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            <MaterialCommunityIcons name="tag-outline" size={14} color="#616161" /> Type de document
          </Text>
          <DocTypeSelector selected={docType} onSelect={setDocType} />
        </View>

        {/* ─── Section capture ─── */}
        {!result && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <MaterialCommunityIcons name="camera-outline" size={14} color="#616161" /> Capture
            </Text>

            {imageUri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                <TouchableOpacity style={styles.previewReset} onPress={handleReset}>
                  <MaterialCommunityIcons name="close-circle" size={26} color="#B71C1C" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.captureRow}>
                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={() => handlePickSource('camera')}
                  activeOpacity={0.80}
                >
                  <LinearGradient
                    colors={['#1B5E20', '#388E3C']}
                    style={styles.captureBtnGradient}
                  >
                    <MaterialCommunityIcons name="camera" size={28} color="#FFFFFF" />
                    <Text style={styles.captureBtnLabel}>Caméra</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={() => handlePickSource('gallery')}
                  activeOpacity={0.80}
                >
                  <LinearGradient
                    colors={['#0277BD', '#0288D1']}
                    style={styles.captureBtnGradient}
                  >
                    <MaterialCommunityIcons name="image-multiple" size={28} color="#FFFFFF" />
                    <Text style={styles.captureBtnLabel}>Galerie</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* Bouton envoyer */}
            {imageUri && !uploading && (
              <TouchableOpacity
                style={[styles.uploadBtn, !docType && styles.uploadBtnDisabled]}
                onPress={handleUpload}
                activeOpacity={0.85}
                disabled={!docType}
              >
                <MaterialCommunityIcons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.uploadBtnText}>Envoyer & extraire texte</Text>
              </TouchableOpacity>
            )}

            {uploading && (
              <View style={styles.uploadingRow}>
                <ActivityIndicator size="small" color="#1B5E20" />
                <Text style={styles.uploadingText}>Envoi et analyse OCR en cours…</Text>
              </View>
            )}
          </View>
        )}

        {/* ─── Erreur ─── */}
        {error && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#B71C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ─── Résultat OCR ─── */}
        {result && (
          <View style={styles.section}>
            <View style={styles.successBanner}>
              <MaterialCommunityIcons name="check-circle" size={22} color="#2E7D32" />
              <Text style={styles.successText}>Document sauvegardé avec succès</Text>
            </View>
            <OcrResultCard doc={result} />

            <TouchableOpacity style={styles.newDocBtn} onPress={handleReset}>
              <MaterialCommunityIcons name="plus" size={18} color="#1B5E20" />
              <Text style={styles.newDocBtnText}>Ajouter un autre document</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>Terminé</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tip si aucune image */}
        {!imageUri && !result && (
          <View style={styles.tipCard}>
            <MaterialCommunityIcons name="lightbulb-outline" size={18} color="#0277BD" />
            <Text style={styles.tipText}>
              Assurez-vous que le document est bien éclairé et lisible. Le texte sera extrait automatiquement par le serveur.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },

  header: { paddingHorizontal: 20, paddingBottom: 20 },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  headerContent: { alignItems: 'flex-start', gap: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    gap: 12,
  },
  sectionLabel: { fontSize: 12, color: '#757575', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5, borderColor: '#C8E6C9',
    backgroundColor: '#F1F8E9',
  },
  typeChipActive: { backgroundColor: '#1B5E20', borderColor: '#1B5E20' },
  typeLabel: { fontSize: 12, fontWeight: '600', color: '#1B5E20' },
  typeLabelActive: { color: '#FFFFFF' },

  captureRow: { flexDirection: 'row', gap: 12 },
  captureBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 3 },
  captureBtnGradient: {
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20,
  },
  captureBtnLabel: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  previewContainer: {
    borderRadius: 12, overflow: 'hidden',
    position: 'relative',
  },
  preview: { width: '100%', height: 220, borderRadius: 12 },
  previewReset: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
  },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1B5E20', borderRadius: 12,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  uploadBtnDisabled: { backgroundColor: '#A5D6A7' },
  uploadBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center', paddingVertical: 8 },
  uploadingText: { fontSize: 14, color: '#616161' },

  ocrCard: {
    backgroundColor: '#F9FBE7', borderRadius: 12, padding: 14, gap: 10,
    borderLeftWidth: 3, borderLeftColor: '#1B5E20',
  },
  ocrCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ocrCardTitle: { fontSize: 13, fontWeight: '700', color: '#1B5E20', flex: 1 },
  confBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  confText: { fontSize: 12, fontWeight: '700' },
  ocrText: { fontSize: 13, color: '#424242', lineHeight: 20 },
  ocrEmpty: { fontSize: 13, color: '#9E9E9E', fontStyle: 'italic' },

  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12,
  },
  successText: { fontSize: 14, fontWeight: '600', color: '#2E7D32', flex: 1 },

  newDocBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 12, justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#1B5E20', borderRadius: 12,
  },
  newDocBtnText: { fontSize: 14, fontWeight: '600', color: '#1B5E20' },

  doneBtn: {
    backgroundColor: '#1B5E20', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  doneBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#B71C1C',
  },
  errorText: { fontSize: 13, color: '#B71C1C', flex: 1 },

  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#0277BD',
  },
  tipText: { fontSize: 13, color: '#0277BD', lineHeight: 18, flex: 1 },
});
