import { api } from './axios.config';
import type { ApiResponse, MissionResponse, MissionType, CargoType, PaymentMethod } from '../types';

// ─── Payloads ─────────────────────────────────────────────────────────────────

export interface CreateMissionPayload {
  originLabel: string;
  destinationLabel: string;
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  cargoDescription: string;
  cargoWeightTons: number;
  cargoType: CargoType;
  specialInstructions?: string;
  totalPrice: number;
  paymentMethod?: PaymentMethod;
  pickupScheduledAt?: string;
  missionType?: MissionType;
}

// Alias rétro-compatible avec missionStore
export type MissionPayload = CreateMissionPayload;
export type MissionDto     = MissionResponse;

function unwrap<T>(r: ApiResponse<T>): T {
  if (!r.success || r.data === undefined) throw new Error(r.message ?? 'Réponse invalide');
  return r.data;
}

// ─── Listes ───────────────────────────────────────────────────────────────────

export async function getActiveMissionsApi(): Promise<MissionResponse[]> {
  const { data } = await api.get<ApiResponse<MissionResponse[]>>('/api/missions/active');
  return data.data ?? [];
}

export async function getHistoryMissionsApi(): Promise<MissionResponse[]> {
  const { data } = await api.get<ApiResponse<MissionResponse[]>>('/api/missions/history');
  return data.data ?? [];
}

export async function getAvailableMissionsApi(): Promise<MissionResponse[]> {
  const { data } = await api.get<ApiResponse<MissionResponse[]>>('/api/missions/available');
  return data.data ?? [];
}

// Alias pour missionStore
export const getMyMissionsApi = getActiveMissionsApi;

export async function getMissionDetailApi(id: string): Promise<MissionResponse> {
  const { data } = await api.get<ApiResponse<MissionResponse>>(`/api/missions/${id}`);
  return unwrap(data);
}

// ─── Création ──────────────────────────────────────────────────────────────────

export async function createMissionApi(payload: CreateMissionPayload): Promise<MissionResponse> {
  const { data } = await api.post<ApiResponse<MissionResponse>>('/api/missions', payload);
  return unwrap(data);
}

// ─── Actions chauffeur ────────────────────────────────────────────────────────

export async function acceptMissionApi(missionId: string): Promise<MissionResponse> {
  const { data } = await api.put<ApiResponse<MissionResponse>>(`/api/missions/${missionId}/assign`);
  return unwrap(data);
}

export async function markDriverArrivedApi(missionId: string): Promise<MissionResponse> {
  const { data } = await api.put<ApiResponse<MissionResponse>>(`/api/missions/${missionId}/driver-arrived`);
  return unwrap(data);
}

export async function startTransitApi(missionId: string): Promise<MissionResponse> {
  const { data } = await api.put<ApiResponse<MissionResponse>>(`/api/missions/${missionId}/transit-start`);
  return unwrap(data);
}

export async function deliverMissionApi(missionId: string, qrToken: string): Promise<MissionResponse> {
  const { data } = await api.put<ApiResponse<MissionResponse>>(
    `/api/missions/${missionId}/deliver?qrToken=${encodeURIComponent(qrToken)}`
  );
  return unwrap(data);
}

export const completeMissionApi = deliverMissionApi;

export async function cancelMissionApi(missionId: string): Promise<MissionResponse> {
  const { data } = await api.put<ApiResponse<MissionResponse>>(`/api/missions/${missionId}/cancel`);
  return unwrap(data);
}

export async function notifyRouteChangeApi(missionId: string): Promise<void> {
  await api.post(`/api/missions/${missionId}/route-changed`);
}

// ─── QR ───────────────────────────────────────────────────────────────────────

export async function getMissionQrTokenApi(missionId: string): Promise<string> {
  const { data } = await api.get<ApiResponse<string>>(`/api/missions/${missionId}/qr`);
  return unwrap(data);
}

// ─── Paiement ─────────────────────────────────────────────────────────────────

export async function initiateStripePaymentApi(missionId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { data } = await api.post<ApiResponse<{ clientSecret: string; paymentIntentId: string }>>(
    `/api/payments/mission/${missionId}/stripe/intent`
  );
  return unwrap(data);
}

export async function initiateMonetbillPaymentApi(missionId: string, phoneNumber: string): Promise<{ paymentRef: string; paymentUrl?: string }> {
  const { data } = await api.post<ApiResponse<{ paymentRef: string; paymentUrl?: string }>>(
    `/api/payments/mission/${missionId}/monetbill/initiate`, { phoneNumber }
  );
  return unwrap(data);
}

export async function getPaymentStatusApi(missionId: string): Promise<string> {
  const { data } = await api.get<ApiResponse<string>>(`/api/payments/mission/${missionId}/status`);
  return unwrap(data);
}

export async function getLatestDriverPositionApi(
  missionId: string
): Promise<{ lat: number; lng: number; speed: number; heading: number } | null> {
  try {
    const { data } = await api.get<ApiResponse<{ lat: number; lng: number; speed: number; heading: number } | null>>(
      `/api/telemetry/mission/${missionId}/latest`
    );
    return data.data ?? null;
  } catch {
    return null;
  }
}

export async function initiateSecondStripeApi(missionId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { data } = await api.post<ApiResponse<{ clientSecret: string; paymentIntentId: string }>>(
    `/api/payments/mission/${missionId}/second/stripe/intent`
  );
  return unwrap(data);
}

export async function initiateSecondMonetbillApi(missionId: string, phoneNumber: string): Promise<{ paymentRef: string; paymentUrl?: string }> {
  const { data } = await api.post<ApiResponse<{ paymentRef: string; paymentUrl?: string }>>(
    `/api/payments/mission/${missionId}/second/monetbill/initiate`, { phoneNumber }
  );
  return unwrap(data);
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function getChatHistoryApi(missionId: string, page = 0) {
  const { data } = await api.get<ApiResponse<any[]>>(`/api/chat/mission/${missionId}?page=${page}`);
  return data.data ?? [];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function getNotificationsApi(page = 0) {
  const { data } = await api.get<ApiResponse<any[]>>(`/api/notifications/mine?page=${page}`);
  return data.data ?? [];
}

export async function markNotificationsReadApi() {
  await api.put('/api/notifications/read-all');
}
