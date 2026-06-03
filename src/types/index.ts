// Interfaces TypeScript KmerFret V3

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'IMPORTER' | 'DRIVER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL';
export type ApplicationStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface LocalSession {
  id?: number;
  user_id: string;
  user_role: UserRole;
  jwt_token: string;
  refresh_token?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  expires_at: string;
  biometric_expires_at?: string;
  updated_at?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  expiresIn: number;
  biometricExpiresAt?: string;
}

export interface LoginInitiateResponse {
  sessionToken: string;
  expiresIn: number;
  maskedEmail: string;
}

export interface BiometricEnableResponse {
  biometricToken: string;
  expiresAt: string;
}

// ─── Télémétrie ───────────────────────────────────────────────────────────────

export type HazardSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type HazardType =
  | 'POTHOLE' | 'CRACK' | 'BUMP'
  | 'FLOODING' | 'LANDSLIDE' | 'BROKEN_ROAD';

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

// ─── Synchronisation ──────────────────────────────────────────────────────────

export type SyncStatus = 'PENDING' | 'DONE' | 'FAILED';
export type SyncEntityType = 'HAZARD' | 'POSITION' | 'ALERT' | 'CHAT_MESSAGE';

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
  | 'DISTRESS' | 'BREAKDOWN' | 'ACCIDENT'
  | 'DELAY' | 'ROUTE_CHANGE' | 'SYSTEM';

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
  | 'OPEN' | 'ASSIGNED' | 'IN_TRANSIT'
  | 'DELIVERED' | 'CANCELLED' | 'DISPUTED';

export type MissionType = 'NORMAL' | 'EXPRESS';

export type PaymentStatus =
  | 'PENDING' | 'ESCROWED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';

export type PaymentMethod = 'STRIPE' | 'MTN_MOMO' | 'ORANGE_MONEY';

export type CargoType =
  | 'GENERAL' | 'DANGEROUS' | 'PERISHABLE'
  | 'OVERSIZED' | 'LIQUID' | 'CONTAINER'
  | 'AGRICULTURAL' | 'LIVESTOCK' | 'COFFEE_COCOA'
  | 'CEREALS' | 'TIMBER' | 'FERTILIZER';

export interface MissionResponse {
  id: string;
  status: MissionStatusValue;
  missionType: MissionType;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;

  originLabel: string;
  destinationLabel: string;
  // Coordonnées (backend retourne ces noms)
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;

  cargoDescription: string;
  cargoType?: CargoType;
  cargoWeightTons?: number;
  specialInstructions?: string;
  distanceKm?: number;

  totalPrice: number;
  commissionAmount?: number;
  commissionRate?: number;
  driverPayout?: number;
  firstPaymentAmount?: number;

  pickupScheduledAt?: string;
  startedAt?: string;
  deliveredAt?: string;
  transitStartedAt?: string;
  driverArrivedAt?: string;
  firstPaymentAt?: string;
  secondPaymentAt?: string;
  qrDeliveryToken?: string;

  // Infos driver (flat depuis backend)
  driverId?: string;
  driverName?: string;
  driverEmail?: string;
  driverPhone?: string;

  // Infos importer
  importerId?: string;
  importerName?: string;
  importerEmail?: string;

  unreadMessages?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  avgRating?: number;
}

export interface CachedMission {
  id: string;
  status: MissionStatusValue;
  mission_type: MissionType;
  origin_label: string;
  destination_label: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  cargo_description?: string;
  cargo_type?: CargoType;
  total_price?: number;
  first_payment_amount?: number;
  driver_id?: string;
  driver_name?: string;
  importer_id?: string;
  qr_token?: string;
  pickup_scheduled_at?: string;
  raw_json?: string;
  cached_at?: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  missionId: string;
  senderId: string;
  senderName: string;
  content: string;
  msgType: MessageType;
  isRead: boolean;
  createdAt: string;
}

export interface LocalChatMessage {
  id: string;
  mission_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_synced: number;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  notifType: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

// ─── Route / Navigation GPS ───────────────────────────────────────────────────

export interface RouteResult {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  maneuver?: string;
}

// ─── Candidature chauffeur ────────────────────────────────────────────────────

export interface DriverApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  motivation?: string;
  status: ApplicationStatus;
  adminNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
}

export interface ApplicationMessage {
  id: string;
  applicationId: string;
  senderRole: 'APPLICANT' | 'ADMIN';
  content: string;
  attachmentUrl?: string;
  createdAt: string;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ImporterStats {
  totalMissions: number;
  activeMissions: number;
  completedMissions: number;
  totalSpending: number;
  totalSpendingThisMonth: number;
  topDestinations: { label: string; count: number }[];
  missionsByMonth: { month: string; count: number }[];
  spendingByMonth: { month: string; amount: number }[];
  openDisputes: number;
}

export interface DriverStats {
  totalMissions: number;
  completedMissions: number;
  totalRevenueTransferred: number;
  revenueThisMonth: number;
  avgRating: number;
  totalReviews: number;
  successRate: number;
  totalDistanceKm: number;
  loyaltyPoints: number;
  loyaltyTier: string;
  revenueByMonth: { month: string; amount: number }[];
  openDisputes: number;
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  timestamp?: string;
}
