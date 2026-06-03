import { api } from './axios.config';
import type { ApiResponse } from '../types';

export interface UserStats {
  role: string;
  totalMissions: number;
  delivered: number;
  inTransit: number;
  open: number;
  totalAmount: number;
  averageRating: number;
  totalReviews: number;
}

export async function getMyStatsApi(): Promise<UserStats> {
  const { data } = await api.get<ApiResponse<UserStats>>('/api/stats/me');
  if (!data.data) throw new Error('Stats non disponibles');
  return data.data;
}
