// CRUD local — table local_road_hazards
import { db } from './schema';
import type { LocalHazard } from '../types';

export async function insertHazard(hazard: LocalHazard): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO local_road_hazards
       (id, mission_id, latitude, longitude, altitude, accuracy,
        shock_magnitude, shock_axis, speed_kmh, severity, hazard_type,
        recorded_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      hazard.id,
      hazard.mission_id ?? null,
      hazard.latitude,
      hazard.longitude,
      hazard.altitude ?? null,
      hazard.accuracy ?? null,
      hazard.shock_magnitude,
      hazard.shock_axis ?? 'Z',
      hazard.speed_kmh ?? null,
      hazard.severity,
      hazard.hazard_type ?? 'POTHOLE',
      hazard.recorded_at,
    ]
  );
}

export async function getUnsyncedHazards(): Promise<LocalHazard[]> {
  return db.getAllAsync<LocalHazard>(
    `SELECT * FROM local_road_hazards WHERE is_synced = 0 ORDER BY recorded_at ASC`
  );
}

export async function markHazardsSynced(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE local_road_hazards SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
}
