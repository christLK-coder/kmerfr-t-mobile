// Interfaces TypeScript partagées — KmerFret

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'IMPORTER' | 'DRIVER' | 'ADMIN';

export interface LocalSession {
  id?: number;
  user_id: string;
  user_role: UserRole;
  jwt_token: string;
  refresh_token?: string;
  full_name?: string;
  phone?: string;
  expires_at: string;
  updated_at?: string;
}

// ─── Télémétrie ──────────────────────────────────────────────────────────────

export type HazardSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type HazardType =
  | 'POTHOLE'
  | 'CRACK'
  | 'BUMP'
  | 'FLOODING'
  | 'LANDSLIDE'
  | 'BROKEN_ROAD';

export interface LocalHazard {
  id: string;
  mission_id?: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  shock_magnitude: number;
  shock_axis?: string;
  speed_kmh?: number;
  severity: HazardSeverity;
  hazard_type?: HazardType;
  recorded_at: string;
  is_synced?: number;
}

export interface LocalPosition {
  id?: number;
  mission_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  heading?: number;
  accuracy?: number;
  recorded_at: string;
  is_synced?: number;
}

// ─── Synchronisation ─────────────────────────────────────────────────────────

export type SyncStatus = 'PENDING' | 'DONE' | 'FAILED';
export type SyncEntityType = 'HAZARD' | 'POSITION' | 'ALERT';

export interface SyncQueueItem {
  id: number;
  entity_type: SyncEntityType;
  local_id: string;
  server_id?: string;
  payload: string;
  status: SyncStatus;
  retry_count: number;
  last_error?: string;
  created_at: string;
  synced_at?: string;
}

// ─── Alertes ─────────────────────────────────────────────────────────────────

export type AlertType =
  | 'DISTRESS'
  | 'BREAKDOWN'
  | 'ACCIDENT'
  | 'DELAY'
  | 'ROUTE_CHANGE'
  | 'SYSTEM';

export interface LocalAlert {
  id: string;
  mission_id?: string;
  alert_type: AlertType;
  latitude?: number;
  longitude?: number;
  message?: string;
  sms_fallback?: number;
  created_at?: string;
  is_synced?: number;
}

// ─── Missions ────────────────────────────────────────────────────────────────

export type MissionStatusValue =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'DISPUTED';

export interface CachedMission {
  id: string;
  status: MissionStatusValue;
  origin_label: string;
  destination_label: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  cargo_description?: string;
  total_price?: number;
  driver_id?: string;
  importer_id?: string;
  qr_token?: string;
  raw_json?: string;
  cached_at?: string;
  expires_at?: string;
}

// ─── API responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  timestamp?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  role: UserRole;
  expiresIn: number;
}
