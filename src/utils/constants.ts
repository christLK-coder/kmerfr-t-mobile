// Constantes globales KmerFret
// API_BASE_URL : lit EXPO_PUBLIC_API_URL depuis .env.local, sinon fallback IP courante
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL ?? '').trim() !== ''
    ? (process.env.EXPO_PUBLIC_API_URL as string).trim()
    : 'http://172.20.10.2:8080';

export const SHOCK_THRESHOLDS = {
  LOW: 1.5,
  MEDIUM: 2.5,
  HIGH: 3.5,
  CRITICAL: 5.0,
};

export const GPS_INTERVAL_MS = 5000;
export const ACCEL_UPDATE_MS = 100;
export const SHOCK_COOLDOWN_MS = 2000;
