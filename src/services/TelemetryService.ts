// Service de télémétrie — détection de nids-de-poule via accéléromètre + GPS
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import type { LocationObject, LocationSubscription } from 'expo-location';
import uuid from 'react-native-uuid';
import dayjs from 'dayjs';

import {
  SHOCK_THRESHOLDS,
  ACCEL_UPDATE_MS,
  GPS_INTERVAL_MS,
  SHOCK_COOLDOWN_MS,
} from '../utils/constants';
import { insertHazard } from '../database/hazardsDb';
import { insertPosition } from '../database/positionsDb';
import { enqueue } from '../database/syncDb';
import type { LocalHazard, LocalPosition, HazardSeverity } from '../types';

type HazardCallback = (severity: HazardSeverity, magnitude: number) => void;
type PositionCallback = (speedKmh: number | null) => void;

class TelemetryService {
  private missionId: string | null = null;
  private lastShockTime: number = 0;
  private currentPosition: LocationObject | null = null;
  private accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private locationSubscription: LocationSubscription | null = null;
  private onHazardCallback: HazardCallback | null = null;
  private onPositionCallback: PositionCallback | null = null;

  async startTracking(
    missionId: string,
    callbacks?: {
      onHazard?: HazardCallback;
      onPosition?: PositionCallback;
    }
  ): Promise<void> {
    if (this.missionId) this.stopTracking();

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission GPS refusée — impossible de démarrer la télémétrie');
    }

    this.missionId = missionId;
    this.onHazardCallback = callbacks?.onHazard ?? null;
    this.onPositionCallback = callbacks?.onPosition ?? null;

    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_INTERVAL_MS,
        distanceInterval: 10,
      },
      (location) => {
        this.currentPosition = location;
        this.recordPosition(location).catch(() => {});
      }
    );

    Accelerometer.setUpdateInterval(ACCEL_UPDATE_MS);
    this.accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      this.onAccelerometerData({ x, y, z });
    });
  }

  stopTracking(): void {
    this.accelSubscription?.remove();
    this.locationSubscription?.remove();
    this.accelSubscription = null;
    this.locationSubscription = null;
    this.missionId = null;
    this.currentPosition = null;
    this.lastShockTime = 0;
    this.onHazardCallback = null;
    this.onPositionCallback = null;
  }

  get isTracking(): boolean {
    return this.missionId !== null;
  }

  private onAccelerometerData({ x, y, z }: { x: number; y: number; z: number }): void {
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const now = Date.now();

    if (magnitude >= SHOCK_THRESHOLDS.LOW && now - this.lastShockTime > SHOCK_COOLDOWN_MS) {
      this.lastShockTime = now;
      const severity = this.getSeverity(magnitude);
      this.onHazardCallback?.(severity, magnitude);
      this.recordHazard(magnitude, severity).catch(() => {});
    }
  }

  private async recordHazard(magnitude: number, severity: HazardSeverity): Promise<void> {
    if (!this.missionId) return;

    const coords = this.currentPosition?.coords;
    const id = uuid.v4() as string;
    const recorded_at = dayjs().toISOString();

    const hazard: LocalHazard = {
      id,
      mission_id: this.missionId,
      latitude: coords?.latitude ?? 0,
      longitude: coords?.longitude ?? 0,
      altitude: coords?.altitude ?? undefined,
      accuracy: coords?.accuracy ?? undefined,
      shock_magnitude: magnitude,
      shock_axis: 'Z',
      speed_kmh: coords?.speed != null && coords.speed >= 0 ? coords.speed * 3.6 : undefined,
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
      shockAxis: 'Z',
      speedKmh: hazard.speed_kmh ?? null,
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

    this.onPositionCallback?.(speedKmh);

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
    if (magnitude >= SHOCK_THRESHOLDS.HIGH) return 'HIGH';
    if (magnitude >= SHOCK_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }
}

export default new TelemetryService();
