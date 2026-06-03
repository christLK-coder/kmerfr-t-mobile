import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  loginInitiateApi,
  loginVerifyApi,
  registerApi,
  biometricLoginApi,
  enableBiometricApi,
  disableBiometricApi,
  type LoginInitiatePayload,
  type RegisterPayload,
} from '../api/auth.api';
import { saveSession, getSession, clearSession, isSessionExpired } from '../database/sessionDb';
import type { UserRole, LocalSession, AuthResponse, LoginInitiateResponse } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  userRole: UserRole | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  biometricExpiresAt: string | null;
  // État OTP (pendant le flow login en 2 étapes)
  pendingSessionToken: string | null;
  pendingMaskedEmail: string | null;
  pendingOtpExpiresIn: number | null;
  error: string | null;
}

interface AuthActions {
  checkSession: () => Promise<void>;
  // Étape 1 : email + mot de passe
  initiateLogin: (payload: LoginInitiatePayload) => Promise<LoginInitiateResponse>;
  // Étape 2 : OTP
  verifyOtp: (otpCode: string) => Promise<void>;
  // Connexion biométrique
  loginWithBiometric: () => Promise<boolean>;
  // Inscription
  register: (payload: RegisterPayload) => Promise<void>;
  // Biométrie settings
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  checkBiometricValid: () => boolean;
  // Déconnexion
  logout: () => Promise<void>;
  clearError: () => void;
  clearPendingLogin: () => void;
}

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  userId: null,
  userRole: null,
  fullName: null,
  email: null,
  phone: null,
  biometricExpiresAt: null,
  pendingSessionToken: null,
  pendingMaskedEmail: null,
  pendingOtpExpiresIn: null,
  error: null,
};

async function persistSession(response: AuthResponse): Promise<void> {
  const expiresAt = new Date(Date.now() + response.expiresIn * 1000).toISOString();

  const session: LocalSession = {
    user_id: response.userId,
    user_role: response.role,
    jwt_token: response.accessToken,
    refresh_token: response.refreshToken,
    full_name: response.fullName,
    email: response.email,
    phone: response.phone,
    biometric_expires_at: response.biometricExpiresAt,
    expires_at: expiresAt,
  };

  await saveSession(session);
  await SecureStore.setItemAsync('jwt_token', response.accessToken);
  await SecureStore.setItemAsync('refresh_token', response.refreshToken);
  if (response.userId) {
    await SecureStore.setItemAsync('user_id', response.userId);
  }
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
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
          email: session.email ?? null,
          phone: session.phone ?? null,
          biometricExpiresAt: session.biometric_expires_at ?? null,
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

  initiateLogin: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginInitiateApi(payload);
      set({
        pendingSessionToken: response.sessionToken,
        pendingMaskedEmail: response.maskedEmail,
        pendingOtpExpiresIn: response.expiresIn,
      });
      return response;
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Identifiants incorrects';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  verifyOtp: async (otpCode) => {
    const { pendingSessionToken } = get();
    if (!pendingSessionToken) throw new Error('Aucune session OTP en cours');

    set({ isLoading: true, error: null });
    try {
      const response = await loginVerifyApi({ sessionToken: pendingSessionToken, otpCode });
      await persistSession(response);
      set({
        isAuthenticated: true,
        userId: response.userId,
        userRole: response.role,
        fullName: response.fullName,
        email: response.email,
        phone: response.phone ?? null,
        biometricExpiresAt: response.biometricExpiresAt ?? null,
        pendingSessionToken: null,
        pendingMaskedEmail: null,
        pendingOtpExpiresIn: null,
        error: null,
      });
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Code incorrect ou expiré';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithBiometric: async () => {
    try {
      const userId = await SecureStore.getItemAsync('user_id');
      const biometricToken = await SecureStore.getItemAsync('biometric_token');
      if (!userId || !biometricToken) return false;

      const response = await biometricLoginApi({ userId, biometricToken });
      await persistSession(response);
      set({
        isAuthenticated: true,
        userId: response.userId,
        userRole: response.role,
        fullName: response.fullName,
        email: response.email,
        phone: response.phone ?? null,
        biometricExpiresAt: response.biometricExpiresAt ?? null,
        error: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      await registerApi(payload);
    } catch (err: unknown) {
      const message = (err as Error).message ?? 'Inscription impossible';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  enableBiometric: async () => {
    try {
      const result = await enableBiometricApi();
      await SecureStore.setItemAsync('biometric_token', result.biometricToken);
      const { fullName } = get();
      if (fullName) await SecureStore.setItemAsync('biometric_user_name', fullName);
      set({ biometricExpiresAt: result.expiresAt });
    } catch (err: unknown) {
      throw new Error((err as Error).message ?? 'Activation biométrie échouée');
    }
  },

  disableBiometric: async () => {
    await disableBiometricApi();
    await SecureStore.deleteItemAsync('biometric_token');
    await SecureStore.deleteItemAsync('biometric_user_name');
    set({ biometricExpiresAt: null });
  },

  checkBiometricValid: () => {
    const { biometricExpiresAt } = get();
    if (!biometricExpiresAt) return false;
    return new Date(biometricExpiresAt) > new Date();
  },

  logout: async () => {
    await clearSession();
    await SecureStore.deleteItemAsync('jwt_token');
    await SecureStore.deleteItemAsync('refresh_token');
    // On garde user_id et biometric_token pour permettre la reconnexion biométrique
    set({ ...INITIAL_STATE, isLoading: false });
  },

  clearError: () => set({ error: null }),
  clearPendingLogin: () => set({ pendingSessionToken: null, pendingMaskedEmail: null, pendingOtpExpiresIn: null }),
}));
