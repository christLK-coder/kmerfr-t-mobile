import { api } from './axios.config';
import type { ApiResponse } from '../types';

export interface StripeIntentResult {
  clientSecret: string;
  paymentIntentId: string;
}

export interface MonetbillInitResult {
  paymentRef: string;
  paymentUrl?: string;
}

export async function initiateStripePaymentApi(
  missionId: string
): Promise<StripeIntentResult> {
  const { data } = await api.post<ApiResponse<StripeIntentResult>>(
    `/api/payments/mission/${missionId}/stripe/intent`
  );
  if (!data.data) throw new Error(data.message ?? 'Erreur Stripe');
  return data.data;
}

export async function initiateMonetbillPaymentApi(
  missionId: string,
  phoneNumber: string
): Promise<MonetbillInitResult> {
  const { data } = await api.post<ApiResponse<MonetbillInitResult>>(
    `/api/payments/mission/${missionId}/monetbill/initiate`,
    { phoneNumber }
  );
  if (!data.data) throw new Error(data.message ?? 'Erreur Monetbill');
  return data.data;
}

export async function getPaymentStatusApi(missionId: string): Promise<string> {
  const { data } = await api.get<ApiResponse<string>>(
    `/api/payments/mission/${missionId}/status`
  );
  if (!data.data) throw new Error('Statut paiement non disponible');
  return data.data;
}
