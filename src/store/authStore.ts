// État d'authentification global — Zustand
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { loginApi, registerApi, type LoginPayload, type RegisterPayload } from '../api/auth.api';
import { saveSession, getSession, clearSession, isSessionExpired } from '../database/sessionDb';
import type { UserRole, LocalSession } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  userRole: UserRole | null;
  fullName: string | null;
  phone: string | null;
  error: string | null;
}

interface AuthActions {
  checkSession: () => Promise<void>;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  userRole: null,
  fullName: null,
  phone: null,
  error: null,
};

async function persistSession(response: {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  role: UserRole;
  expiresIn: number;
  phone?: string;
}): Promise<void> {
  const expiresAt = new Date(Date.now() + response.expiresIn).toISOString();

  const session: LocalSession = {
    user_id: response.userId,
    user_role: response.role,
    jwt_token: response.accessToken,
    refresh_token: response.refreshToken,
    full_name: response.fullName,
    phone: response.phone,
    expires_at: expiresAt,
  };

  await saveSession(session);
  await SecureStore.setItemAsync('jwt_token', response.accessToken);
  await SecureStore.setItemAsync('refresh_token', response.refreshToken);
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...INITIAL_STATE,

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const session = await getSession();
      if (session && !isSessionExpired(session)) {
        set({
          isAuthenticated: true,
          userId: session.user_id,
          userRole: session.user_role,
          fullName: session.full_name ?? null,
          phone: session.phone ?? null,
        });
      } else {
        set({ isAuthenticated: false });
      }
    } catch {
      set({ isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginApi(payload);
      await persistSession({ ...response, phone: payload.phone });
      set({
        isAuthenticated: true,
        userId: response.userId,
        userRole: response.role,
        fullName: response.fullName,
        phone: payload.phone,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? 'Identifiants incorrects. Vérifiez votre numéro et mot de passe.';
      set({ error: message, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await registerApi(payload);
      await persistSession({ ...response, phone: payload.phone });
      set({
        isAuthenticated: true,
        userId: response.userId,
        userRole: response.role,
        fullName: response.fullName,
        phone: payload.phone,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })
          ?.response?.data?.message ?? 'Inscription impossible. Ce numéro est peut-être déjà utilisé.';
      set({ error: message, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearSession();
    await SecureStore.deleteItemAsync('jwt_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ ...INITIAL_STATE, isLoading: false });
  },

  clearError: () => set({ error: null }),
}));
