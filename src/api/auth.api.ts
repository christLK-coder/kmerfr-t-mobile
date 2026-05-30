import { api } from './axios.config';
import type { AuthResponse, ApiResponse } from '../types';

export interface RegisterPayload {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role: 'IMPORTER' | 'DRIVER';
}

export interface LoginPayload {
  phone: string;
  password: string;
}

function extractMessage(err: unknown): string {
  const e = err as { response?: { data?: ApiResponse } };
  return e?.response?.data?.message ?? 'Erreur de connexion au serveur';
}

export async function loginApi(payload: LoginPayload): Promise<AuthResponse> {
  try {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/login', payload);
    if (!data.data) throw new Error(data.message ?? 'Réponse invalide');
    return data.data;
  } catch (err: unknown) {
    throw new Error(extractMessage(err));
  }
}

export async function registerApi(payload: RegisterPayload): Promise<AuthResponse> {
  try {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/api/auth/register', payload);
    if (!data.data) throw new Error(data.message ?? 'Réponse invalide');
    return data.data;
  } catch (err: unknown) {
    throw new Error(extractMessage(err));
  }
}
