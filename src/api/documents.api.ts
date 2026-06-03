import { api } from './axios.config';
import type { ApiResponse } from '../types';

export type DocType =
  | 'LETTRE_VOITURE'
  | 'BON_SORTIE'
  | 'FACTURE'
  | 'INSURANCE'
  | 'ID_CARD'
  | 'PERMIT'
  | 'OTHER';

export interface DocumentDto {
  id: string;
  missionId: string;
  docType: DocType;
  fileUrl: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  isVerified: boolean;
  createdAt: string;
}

export interface UploadDocumentPayload {
  missionId: string;
  docType: DocType;
  fileUrl: string;
  ocrRawText?: string;
  ocrConfidence?: number;
}

export async function uploadDocumentApi(payload: UploadDocumentPayload): Promise<DocumentDto> {
  const { data } = await api.post<ApiResponse<DocumentDto>>('/api/documents/upload', payload);
  if (!data.data) throw new Error(data.message ?? 'Erreur upload document');
  return data.data;
}

export async function getMissionDocumentsApi(missionId: string): Promise<DocumentDto[]> {
  const { data } = await api.get<ApiResponse<DocumentDto[]>>(
    `/api/documents/mission/${missionId}`
  );
  return data.data ?? [];
}
