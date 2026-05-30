import { api } from './axios.config';
import type { ApiResponse } from '../types';

export type PaymentProvider = 'MTN_MOMO' | 'ORANGE_MONEY';

export interface PaymentInitResult {
  referenceId: string;
  status: 'ESCROWED' | 'PENDING';
  provider: PaymentProvider;
  amount: number;
}

export interface PaymentStatusResult {
  missionId: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  totalPrice: number;
  commissionAmount: number;
  driverPayout: number;
}

export async function initiateMtnMomoApi(
  missionId: string,
  phone: string
): Promise<PaymentInitResult> {
  const { data } = await api.post<ApiResponse<PaymentInitResult>>(
    `/api/payments/missions/${missionId}/mtn-momo?phone=${encodeURIComponent(phone)}`
  );
  if (!data.data) throw new Error(data.message ?? 'Erreur paiement MTN MoMo');
  return data.data;
}

export async function initiateOrangeMoneyApi(
  missionId: string,
  phone: string
): Promise<PaymentInitResult> {
  const { data } = await api.post<ApiResponse<PaymentInitResult>>(
    `/api/payments/missions/${missionId}/orange-money?phone=${encodeURIComponent(phone)}`
  );
  if (!data.data) throw new Error(data.message ?? 'Erreur paiement Orange Money');
  return data.data;
}

export async function getPaymentStatusApi(missionId: string): Promise<PaymentStatusResult> {
  const { data } = await api.get<ApiResponse<PaymentStatusResult>>(
    `/api/payments/missions/${missionId}/status`
  );
  if (!data.data) throw new Error('Statut paiement non disponible');
  return data.data;
}
