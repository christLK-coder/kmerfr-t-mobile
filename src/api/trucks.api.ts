import { api } from './axios.config';
import type { ApiResponse } from '../types';

export type TruckType = 'FLATBED' | 'TANKER' | 'REFRIGERATED' | 'CONTAINER_20' | 'CONTAINER_40' | 'TIPPER';

export interface TruckDto {
  id: string;
  driverId: string;
  driverName: string;
  plateNumber: string;
  brand?: string;
  model?: string;
  capacityTons: number;
  truckType: TruckType;
  insuranceExpiry?: string;
  docsVerified: boolean;
  createdAt: string;
}

export interface CreateTruckPayload {
  plateNumber: string;
  brand?: string;
  model?: string;
  capacityTons: number;
  truckType: TruckType;
  insuranceExpiry?: string;
}

export async function getMyTrucksApi(): Promise<TruckDto[]> {
  const { data } = await api.get<ApiResponse<TruckDto[]>>('/api/trucks/mine');
  return data.data ?? [];
}

export async function createTruckApi(payload: CreateTruckPayload): Promise<TruckDto> {
  const { data } = await api.post<ApiResponse<TruckDto>>('/api/trucks', payload);
  if (!data.data) throw new Error(data.message ?? 'Erreur création camion');
  return data.data;
}

export async function updateTruckApi(id: string, payload: CreateTruckPayload): Promise<TruckDto> {
  const { data } = await api.put<ApiResponse<TruckDto>>(`/api/trucks/${id}`, payload);
  if (!data.data) throw new Error(data.message ?? 'Erreur mise à jour');
  return data.data;
}
