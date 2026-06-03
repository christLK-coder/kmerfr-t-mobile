// CRUD local — table local_positions
import { db } from './schema';
import type { LocalPosition } from '../types';

export async function insertPosition(position: LocalPosition): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_positions
       (mission_id, latitude, longitude, speed_kmh, heading, accuracy, recorded_at, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      position.mission_id,
      position.latitude,
      position.longitude,
      position.speed_kmh ?? null,
      position.heading ?? null,
      position.accuracy ?? null,
      position.recorded_at,
    ]
  );
}

export async function getUnsyncedPositions(missionId: string): Promise<LocalPosition[]> {
  return db.getAllAsync<LocalPosition>(
    `SELECT * FROM local_positions
     WHERE mission_id = ? AND is_synced = 0
     ORDER BY recorded_at ASC`,
    [missionId]
  );
}

export async function getAllUnsyncedPositions(): Promise<LocalPosition[]> {
  return db.getAllAsync<LocalPosition>(
    `SELECT * FROM local_positions WHERE is_synced = 0 ORDER BY recorded_at ASC`
  );
}

export async function markPositionsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE local_positions SET is_synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
}
