// Constantes globales KmerFret V3
import Constants from 'expo-constants';

function resolveApiUrl(): string {
  const envUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  if (envUrl) return envUrl;
  // En dev, utiliser l'IP du serveur Metro (même réseau que le backend)
  const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.experienceUrl ?? '';
  const match = debuggerHost.match(/(\d+\.\d+\.\d+\.\d+)/);
  if (match) return `http://${match[1]}:8081`;
  return 'http://localhost:8081';
}

export const API_BASE_URL = resolveApiUrl();

// ─── Télémétrie V3 — seuils robustes ─────────────────────────────────────────
// Seuils exprimés en g-force nette (après soustraction de la gravité)
export const SHOCK_THRESHOLDS = {
  LOW:      2.0,
  MEDIUM:   3.0,
  HIGH:     4.5,
  CRITICAL: 7.0,
} as const;

export const ACCEL_UPDATE_MS    = 50;      // 20 Hz — bon compromis précision/batterie
export const GPS_INTERVAL_MS    = 3000;    // Position GPS toutes les 3s
export const SHOCK_COOLDOWN_MS  = 3000;    // 3s minimum entre deux chocs
export const MIN_SPEED_KMH      = 3;       // Ignorer si quasi-stationnaire
export const MEDIAN_WINDOW_SIZE = 7;       // Fenêtre médiane (nb de samples)
export const GPS_FRESHNESS_MS   = 10000;   // Position GPS valide pendant 10s max
export const GRAVITY_ALPHA      = 0.85;    // Filtre passe-bas pour estimer la gravité

// ─── Sync & Réseau ────────────────────────────────────────────────────────────
export const SYNC_BATCH_HAZARDS  = 20;
export const SYNC_BATCH_POSITIONS = 50;
export const SYNC_RETRY_MAX      = 3;

// ─── Sessions & Auth ──────────────────────────────────────────────────────────
export const BIOMETRIC_VALIDITY_DAYS = 30;
export const OTP_LENGTH              = 6;
export const OTP_RESEND_COOLDOWN_S   = 60;

// ─── Métier ───────────────────────────────────────────────────────────────────
export const PRICE_PER_TON_FCFA     = 15_000;
export const EXPRESS_SURCHARGE_PCT  = 0.30;
export const NORMAL_COMMISSION_PCT  = 0.075;
export const EXPRESS_COMMISSION_PCT = 0.10;
export const FIRST_DEPOSIT_PCT      = 0.50;

// ─── Navigation (OSRM) ────────────────────────────────────────────────────────
export const OSRM_BASE_URL         = 'https://router.project-osrm.org/route/v1/driving';
export const REROUTE_THRESHOLD_M   = 200;  // Recalcul si déviation > 200m
export const REROUTE_CHECK_MS      = 5000; // Vérification toutes les 5s

// ─── Stripe ──────────────────────────────────────────────────────────────────
export const STRIPE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// ─── Websocket ────────────────────────────────────────────────────────────────
export const WS_RECONNECT_DELAY_MS = 3000;
export const WS_MAX_RECONNECTS     = 10;
