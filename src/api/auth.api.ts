import { api } from './axios.config';
import type {
  ApiResponse,
  AuthResponse,
  LoginInitiateResponse,
  BiometricEnableResponse,
  DriverApplication,
  ApplicationMessage,
} from '../types';

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginInitiatePayload {
  email: string;
  password: string;
}

export interface LoginVerifyPayload {
  sessionToken: string;
  otpCode: string;
}

export interface BiometricLoginPayload {
  userId: string;
  biometricToken: string;
}

export interface DriverApplyPayload {
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  motivation?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: ApiResponse }; code?: string; message?: string };
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ECONNABORTED') return 'Delai de connexion depasse. Verifiez que le backend est lance.';
  if (e?.code === 'ERR_NETWORK' || e?.message?.includes('Network Error'))
    return 'Impossible de joindre le serveur. Verifiez votre connexion Wi-Fi et que le backend tourne.';
  return e?.message ?? 'Erreur de connexion au serveur';
}

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.message ?? 'Réponse invalide');
  }
  return response.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function registerApi(payload: RegisterPayload): Promise<void> {
  try {
    await api.post<ApiResponse<void>>('/api/auth/register', payload);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function loginInitiateApi(payload: LoginInitiatePayload): Promise<LoginInitiateResponse> {
  try {
    const { data } = await api.post<ApiResponse<LoginInitiateResponse>>('/api/auth/login/initiate', payload);
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function loginVerifyApi(payload: LoginVerifyPayload): Promise<AuthResponse> {
  try {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/login/verify', payload);
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function biometricLoginApi(payload: BiometricLoginPayload): Promise<AuthResponse> {
  try {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/biometric/login', payload);
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function enableBiometricApi(): Promise<BiometricEnableResponse> {
  try {
    const { data } = await api.post<ApiResponse<BiometricEnableResponse>>('/api/auth/biometric/enable');
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function disableBiometricApi(): Promise<void> {
  try {
    await api.post('/api/auth/biometric/disable');
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function refreshTokenApi(refreshToken: string): Promise<AuthResponse> {
  try {
    const { data } = await api.post<ApiResponse<AuthResponse>>(
      '/api/auth/refresh', null,
      { headers: { 'Refresh-Token': refreshToken } }
    );
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function changePasswordApi(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post('/api/auth/change-password', { currentPassword, newPassword });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function updatePushTokenApi(pushToken: string): Promise<void> {
  try {
    await api.put('/api/auth/push-token', { pushToken });
  } catch {
    // Non-bloquant
  }
}

// ─── Candidature chauffeur ────────────────────────────────────────────────────

export async function applyDriverApi(payload: DriverApplyPayload): Promise<{ applicationId: string }> {
  try {
    const { data } = await api.post<ApiResponse<{ applicationId: string }>>('/api/auth/apply/driver', payload);
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function getDriverApplicationApi(id: string): Promise<DriverApplication> {
  try {
    const { data } = await api.get<ApiResponse<DriverApplication>>(`/api/auth/apply/driver/${id}`);
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function sendApplicationMessageApi(id: string, content: string, attachmentUrl?: string): Promise<void> {
  try {
    await api.post(`/api/auth/apply/driver/${id}/message`, { content, attachmentUrl });
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}

export async function uploadApplicationFileApi(id: string, fileUri: string, fileName: string): Promise<{ url: string; fileName: string }> {
  try {
    const formData = new FormData();
    const ext = fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/pdf';
    formData.append('file', { uri: fileUri, type: mimeType, name: fileName } as any);
    const { data } = await api.post<ApiResponse<{ url: string; fileName: string }>>(
      `/api/auth/apply/driver/${id}/upload`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 }
    );
    return unwrap(data);
  } catch (err) {
    throw new Error(extractMessage(err));
  }
}
