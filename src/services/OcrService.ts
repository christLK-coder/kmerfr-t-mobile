import * as ImagePicker from 'expo-image-picker';
import { uploadDocumentApi } from '../api/documents.api';
import type { DocType, DocumentDto } from '../api/documents.api';

export interface OcrResult {
  uri: string;
  base64: string;
}

const IMAGE_QUALITY = 0.82;

export async function pickDocumentImage(source: 'camera' | 'gallery'): Promise<OcrResult | null> {
  let result: ImagePicker.ImagePickerResult;

  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission caméra refusée');
    result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as any,
      quality: IMAGE_QUALITY,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission galerie refusée');
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      quality: IMAGE_QUALITY,
      base64: true,
      allowsEditing: true,
      aspect: [3, 4],
    });
  }

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Base64 non disponible');

  return { uri: asset.uri, base64: asset.base64 };
}

export async function uploadAndSaveDocument(params: {
  missionId: string;
  docType: DocType;
  ocrResult: OcrResult;
}): Promise<DocumentDto> {
  const fileUrl = `data:image/jpeg;base64,${params.ocrResult.base64}`;
  return uploadDocumentApi({
    missionId: params.missionId,
    docType: params.docType,
    fileUrl,
  });
}
