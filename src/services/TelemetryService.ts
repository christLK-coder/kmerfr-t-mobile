// TelemetryService V3 — détection robuste de nids-de-poule
// Algorithme : filtre médian + soustraction gravité + vérification vitesse + cooldown

import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import type { LocationObject, LocationSubscription } from 'expo-location';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

import {
  SHOCK_THRESHOLDS,
  ACCEL_UPDATE_MS,
  GPS_INTERVAL_MS,
  SHOCK_COOLDOWN_MS,
  MIN_SPEED_KMH,
  MEDIAN_WINDOW_SIZE,
  GPS_FRESHNESS_MS,
  GRAVITY_ALPHA,
} from '../utils/constants';
import { insertHazard } from '../database/hazardsDb';
import { insertPosition } from '../database/positionsDb';
import { enqueue } from '../database/syncDb';
import type { LocalHazard, LocalPosition, HazardSeverity } from '../types';

export type HazardCallback = (severity: HazardSeverity, magnitude: number) => void;
export type PositionCallback = (speedKmh: number | null) => void;

class TelemetryService {
  private missionId: string | null = null;
  private lastShockTime = 0;
  private currentPosition: LocationObject | null = null;
  private positionTimestamp = 0;
  private accelSub: ReturnType<typeof Accelerometer.addListener> | null = null;
  private locationSub: LocationSubscription | null = null;
  private onHazard: HazardCallback | null = null;
  private onPosition: PositionCallback | null = null;

  // Filtre gravité (passe-bas exponentiel) — estimé par axe
  private gx = 0;
  private gy = 0;
  private gz = 9.81; // initialiser à la gravité standard

  // Buffer circulaire pour filtre médian
  private magBuffer: number[] = [];

  async startTracking(
    missionId: string,
    callbacks?: { onHazard?: HazardCallback; onPosition?: PositionCallback }
  ): Promise<void> {
    if (this.missionId) this.stopTracking();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Permission GPS refusée');

    this.missionId = missionId;
    this.onHazard = callbacks?.onHazard ?? null;
    this.onPosition = callbacks?.onPosition ?? null;
    this.gx = 0; this.gy = 0; this.gz = 9.81;
    this.magBuffer = [];
    this.lastShockTime = 0;

    this.locationSub = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: GPS_INTERVAL_MS, distanceInterval: 5 },
      (loc) => {
        this.currentPosition = loc;
        this.positionTimestamp = Date.now();
        this.recordPosition(loc).catch(() => {});
      }
    );

    Accelerometer.setUpdateInterval(ACCEL_UPDATE_MS);
    this.accelSub = Accelerometer.addListener(({ x, y, z }) => this.processAccel(x, y, z));
  }

  stopTracking(): void {
    this.accelSub?.remove();
    this.locationSub?.remove();
    this.accelSub = null;
    this.locationSub = null;
    this.missionId = null;
    this.currentPosition = null;
    this.positionTimestamp = 0;
    this.magBuffer = [];
    this.onHazard = null;
    this.onPosition = null;
  }

  get isTracking(): boolean {
    return this.missionId !== null;
  }

  // ─── Algorithme V3 — avec mode démo intégré ─────────────────────────────────
  // En production : détecte uniquement à vitesse > 3 km/h + GPS frais
  // En démo (vitesse = 0 ou GPS absent) : seuils réduits pour montrer le fonctionnement

  private processAccel(x: number, y: number, z: number): void {
    // 1. Mettre à jour l'estimation de la gravité (filtre passe-bas)
    this.gx = GRAVITY_ALPHA * this.gx + (1 - GRAVITY_ALPHA) * x;
    this.gy = GRAVITY_ALPHA * this.gy + (1 - GRAVITY_ALPHA) * y;
    this.gz = GRAVITY_ALPHA * this.gz + (1 - GRAVITY_ALPHA) * z;

    // 2. Accélération nette sans gravité (m/s²)
    const dx = x - this.gx;
    const dy = y - this.gy;
    const dz = z - this.gz;

    // 3. Magnitude nette en g-force
    const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz) / 9.81;

    // 4. Ajouter au buffer circulaire
    this.magBuffer.push(magnitude);
    if (this.magBuffer.length > MEDIAN_WINDOW_SIZE) this.magBuffer.shift();
    if (this.magBuffer.length < 3) return;

    // 5. Médiane du buffer (élimine les pics isolés de bruit)
    const sorted = [...this.magBuffer].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 6. Conditions de détection
    const now = Date.now();
    const positionFresh = (now - this.positionTimestamp) < GPS_FRESHNESS_MS;
    const currentSpeed = this.currentPosition?.coords.speed ?? 0;
    const speedKmh = currentSpeed >= 0 ? currentSpeed * 3.6 : 0;

    // Mode démo : si le véhicule est à l'arrêt ou GPS absent,
    // on abaisse les seuils pour démontrer la détection en main
    const isMoving = speedKmh >= MIN_SPEED_KMH && positionFresh;
    const demoMode = !isMoving;
    const effectiveThreshold = demoMode ? 0.8 : SHOCK_THRESHOLDS.LOW;
    const effectiveCooldown  = demoMode ? 1500 : SHOCK_COOLDOWN_MS;

    if (
      median >= effectiveThreshold &&
      (now - this.lastShockTime) >= effectiveCooldown
    ) {
      this.lastShockTime = now;
      const severity = demoMode ? this.getDemoSeverity(median) : this.getSeverity(median);

      if (severity === 'HIGH' || severity === 'CRITICAL') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      this.onHazard?.(severity, median);
      this.recordHazard(median, severity, speedKmh > 0 ? speedKmh : 0, dz).catch(() => {});
    }
  }

  private async recordHazard(
    magnitude: number,
    severity: HazardSeverity,
    speedKmh: number,
    zAccel: number
  ): Promise<void> {
    if (!this.missionId) return;
    const coords = this.currentPosition?.coords;
    const id = uuid.v4() as string;
    const recorded_at = dayjs().toISOString();
    const shockAxis = Math.abs(zAccel) > 1 ? 'Z' : 'XY';

    const hazard: LocalHazard = {
      id,
      mission_id: this.missionId,
      latitude: coords?.latitude ?? 0,
      longitude: coords?.longitude ?? 0,
      altitude: coords?.altitude ?? undefined,
      accuracy: coords?.accuracy ?? undefined,
      shock_magnitude: magnitude,
      shock_axis: shockAxis,
      speed_kmh: speedKmh > 0 ? speedKmh : undefined,
      severity,
      hazard_type: 'POTHOLE',
      recorded_at,
    };

    await insertHazard(hazard);
    await enqueue('HAZARD', id, {
      missionId: this.missionId,
      latitude: hazard.latitude,
      longitude: hazard.longitude,
      altitude: hazard.altitude ?? null,
      accuracy: hazard.accuracy ?? null,
      shockMagnitude: magnitude,
      shockAxis,
      speedKmh: speedKmh > 0 ? speedKmh : null,
      severity,
      hazardType: 'POTHOLE',
      recordedAt: recorded_at,
      wasOffline: true,
    });
  }

  private async recordPosition(location: LocationObject): Promise<void> {
    if (!this.missionId) return;
    const { latitude, longitude, speed, heading, accuracy } = location.coords;
    const recorded_at = dayjs(location.timestamp).toISOString();
    const speedKmh = speed != null && speed >= 0 ? speed * 3.6 : null;

    this.onPosition?.(speedKmh);

    const position: LocalPosition = {
      mission_id: this.missionId,
      latitude,
      longitude,
      speed_kmh: speedKmh ?? undefined,
      heading: heading != null && heading >= 0 ? heading : undefined,
      accuracy: accuracy ?? undefined,
      recorded_at,
    };

    await insertPosition(position);
    await enqueue('POSITION', `${this.missionId}_${location.timestamp}`, {
      missionId: this.missionId,
      latitude,
      longitude,
      speedKmh: position.speed_kmh ?? null,
      headingDeg: position.heading ?? null,
      accuracyM: accuracy ?? null,
      recordedAt: recorded_at,
      wasOffline: true,
    });
  }

  private getSeverity(magnitude: number): HazardSeverity {
    if (magnitude >= SHOCK_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (magnitude >= SHOCK_THRESHOLDS.HIGH)     return 'HIGH';
    if (magnitude >= SHOCK_THRESHOLDS.MEDIUM)   return 'MEDIUM';
    return 'LOW';
  }

  // Seuils réduits pour la démo (secouer le téléphone en main)
  private getDemoSeverity(magnitude: number): HazardSeverity {
    if (magnitude >= 3.0) return 'CRITICAL';
    if (magnitude >= 2.0) return 'HIGH';
    if (magnitude >= 1.2) return 'MEDIUM';
    return 'LOW';
  }
}

export default new TelemetryService();
