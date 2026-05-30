import { api } from './axios.config';
import type { ApiResponse, MissionStatusValue } from '../types';

export interface MissionPayload {
  originLabel: string;
  destinationLabel: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  cargoDescription: string;
  cargoWeightTons?: number;
  cargoType?: string;
  specialInstructions?: string;
  totalPrice: number;
  paymentMethod?: 'MTN_MOMO' | 'ORANGE_MONEY' | 'STRIPE' | 'PAYPAL';
}

export interface MissionDto {
  id: string;
  status: MissionStatusValue;
  originLabel: string;
  destinationLabel: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  cargoDescription?: string;
  cargoWeightTons?: number;
  cargoType?: string;
  specialInstructions?: string;
  totalPrice?: number;
  commissionAmount?: number;
  driverPayout?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  driverId?: string;
  driverName?: string;
  importerId?: string;
  importerName?: string;
  qrDeliveryToken?: string;
  pickupScheduledAt?: string;
  startedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// Créer une mission (importateur)
export async function createMissionApi(payload: MissionPayload): Promise<MissionDto> {
  const { data } = await api.post<ApiResponse<MissionDto>>('/api/missions', {
    originLabel:        payload.originLabel,
    destinationLabel:   payload.destinationLabel,
    originLat:          payload.originLat,
    originLng:          payload.originLng,
    destinationLat:     payload.destLat,
    destinationLng:     payload.destLng,
    cargoDescription:   payload.cargoDescription,
    cargoWeightTons:    payload.cargoWeightTons ?? 1,
    cargoType:          payload.cargoType ?? 'GENERAL',
    specialInstructions: payload.specialInstructions,
    totalPrice:         payload.totalPrice,
    paymentMethod:      payload.paymentMethod,
  });
  if (!data.data) throw new Error(data.message ?? 'Erreur création mission');
  return data.data;
}

// Missions de l'utilisateur connecté (rôle-dépendant côté serveur)
export async function getMyMissionsApi(): Promise<MissionDto[]> {
  const { data } = await api.get<ApiResponse<MissionDto[]>>('/api/missions');
  return data.data ?? [];
}

// Missions disponibles (OPEN) pour un chauffeur
export async function getAvailableMissionsApi(): Promise<MissionDto[]> {
  const { data } = await api.get<ApiResponse<MissionDto[]>>('/api/missions?status=OPEN');
  return data.data ?? [];
}

// Chauffeur accepte une mission
export async function acceptMissionApi(missionId: string): Promise<MissionDto> {
  const { data } = await api.put<ApiResponse<MissionDto>>(`/api/missions/${missionId}/assign`);
  if (!data.data) throw new Error(data.message ?? 'Erreur acceptation mission');
  return data.data;
}

// Chauffeur démarre la mission
export async function startMissionApi(missionId: string): Promise<MissionDto> {
  const { data } = await api.put<ApiResponse<MissionDto>>(`/api/missions/${missionId}/start`);
  if (!data.data) throw new Error(data.message ?? 'Erreur démarrage mission');
  return data.data;
}

// Livraison confirmée par scan QR
export async function deliverMissionApi(missionId: string, qrToken: string): Promise<MissionDto> {
  const { data } = await api.put<ApiResponse<MissionDto>>(
    `/api/missions/${missionId}/deliver?qrToken=${encodeURIComponent(qrToken)}`
  );
  if (!data.data) throw new Error(data.message ?? 'Livraison non confirmée');
  return data.data;
}

// Récupère le token QR d'une mission (importateur ou chauffeur assigné)
export async function getMissionQrTokenApi(missionId: string): Promise<string> {
  const { data } = await api.get<ApiResponse<string>>(`/api/missions/${missionId}/qr`);
  if (!data.data) throw new Error('Token QR non disponible');
  return data.data;
}

// Détail complet d'une mission
export async function getMissionDetailApi(missionId: string): Promise<MissionDto> {
  const { data } = await api.get<ApiResponse<MissionDto>>(`/api/missions/${missionId}`);
  if (!data.data) throw new Error('Mission introuvable');
  return data.data;
}

// Compat: ancien nom utilisé dans missionStore
export const completeMissionApi = deliverMissionApi;
