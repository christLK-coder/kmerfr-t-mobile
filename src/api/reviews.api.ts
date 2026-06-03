import { api } from './axios.config';
import type { ApiResponse } from '../types';

export interface ReviewDto {
  id: string;
  missionId: string;
  reviewerId: string;
  reviewerName: string;
  reviewedId: string;
  reviewedName: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface RatingStats {
  userId: string;
  averageRating: number;
  totalReviews: number;
}

export interface CreateReviewPayload {
  missionId: string;
  rating: number;
  comment?: string;
}

export async function createReviewApi(payload: CreateReviewPayload): Promise<ReviewDto> {
  const { data } = await api.post<ApiResponse<ReviewDto>>('/api/reviews', payload);
  if (!data.data) throw new Error(data.message ?? 'Erreur notation');
  return data.data;
}

export async function getUserReviewsApi(userId: string): Promise<ReviewDto[]> {
  const { data } = await api.get<ApiResponse<ReviewDto[]>>(`/api/reviews/user/${userId}`);
  return data.data ?? [];
}

export async function getRatingStatsApi(userId: string): Promise<RatingStats> {
  const { data } = await api.get<ApiResponse<RatingStats>>(`/api/reviews/user/${userId}/stats`);
  if (!data.data) throw new Error('Stats non disponibles');
  return data.data;
}
