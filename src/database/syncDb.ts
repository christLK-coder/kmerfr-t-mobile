// File de synchronisation offline→online — table sync_queue
import { db } from './schema';
import type { SyncQueueItem, SyncEntityType } from '../types';

export async function enqueue(
  entityType: SyncEntityType,
  localId: string,
  payload: object
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (entity_type, local_id, payload, status, retry_count)
     VALUES (?, ?, ?, 'PENDING', 0)`,
    [entityType, localId, JSON.stringify(payload)]
  );
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY created_at ASC`
  );
}

export async function markDone(id: number, serverId?: string): Promise<void> {
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'DONE', server_id = ?, synced_at = datetime('now')
     WHERE id = ?`,
    [serverId ?? null, id]
  );
}

export async function markFailed(id: number, error: string): Promise<void> {
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'FAILED', last_error = ?, retry_count = retry_count + 1
     WHERE id = ?`,
    [error, id]
  );
}

export async function resetFailedItems(): Promise<void> {
  await db.runAsync(
    `UPDATE sync_queue SET status = 'PENDING' WHERE status = 'FAILED' AND retry_count < 5`
  );
}
