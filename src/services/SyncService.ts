// SyncService V3 — synchronisation offline→online avec priorités
// Priorité (DESC) : 10=SOS, 8=Hazards, 6=Positions, 4=Chat, 2=Notifications
import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import { api } from '../api/axios.config';
import { getPendingItems, markDone, markFailed, resetFailedItems } from '../database/syncDb';
import { markHazardsSynced } from '../database/hazardsDb';
import { db } from '../database/schema';
import type { SyncQueueItem } from '../types';
import { SYNC_BATCH_HAZARDS, SYNC_BATCH_POSITIONS, SYNC_RETRY_MAX } from '../utils/constants';

type StateCallback = (syncing: boolean, pending: number, error?: string) => void;

// ─── Helpers DB ───────────────────────────────────────────────────────────────

async function getUnsyncedChats() {
  return db.getAllAsync<{ id: string; missionId: string; senderId: string; content: string; createdAt: string }>(
    `SELECT id, mission_id as missionId, sender_id as senderId, content, created_at as createdAt
     FROM local_chat_messages WHERE is_synced = 0 ORDER BY created_at ASC LIMIT 20`
  );
}

async function markChatSynced(ids: string[]) {
  if (!ids.length) return;
  await db.runAsync(
    `UPDATE local_chat_messages SET is_synced = 1 WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids
  );
}

export async function saveLocalNotification(
  title: string, body: string, type: string, refId?: string
): Promise<void> {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync(
    `INSERT OR IGNORE INTO local_notifications (id, title, body, notif_type, reference_id) VALUES (?, ?, ?, ?, ?)`,
    [id, title, body, type, refId ?? null]
  );
}

export async function getLocalNotifications(limit = 30) {
  return db.getAllAsync<{
    id: string; title: string; body: string; notif_type: string;
    reference_id: string | null; is_read: number; created_at: string;
  }>(`SELECT * FROM local_notifications ORDER BY created_at DESC LIMIT ?`, [limit]);
}

export async function markNotificationsRead() {
  await db.runAsync(`UPDATE local_notifications SET is_read = 1`);
}

export async function cacheRoute(
  missionId: string, routeJson: string, distanceM: number, durationS: number
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO cached_routes (mission_id, route_json, distance_m, duration_s) VALUES (?, ?, ?, ?)`,
    [missionId, routeJson, distanceM, durationS]
  );
}

export async function getCachedRoute(missionId: string) {
  return db.getFirstAsync<{ routeJson: string; distanceM: number; durationS: number }>(
    `SELECT route_json as routeJson, distance_m as distanceM, duration_s as durationS
     FROM cached_routes WHERE mission_id = ?`, [missionId]
  );
}

// ─── SyncService ──────────────────────────────────────────────────────────────

class SyncService {
  private syncing    = false;
  private unsub:     (() => void) | null = null;
  private onState:   StateCallback | null = null;
  private isOnline   = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  setStateCallback(cb: StateCallback) { this.onState = cb; }
  get online(): boolean { return this.isOnline; }

  startNetworkListener(): void {
    if (this.unsub) return;
    this.unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const ok = state.isConnected === true && state.isInternetReachable !== false;
      this.isOnline = ok;
      if (ok) this.sync().catch(() => {});
    });
  }

  stopNetworkListener(): void {
    this.unsub?.();
    this.unsub = null;
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      await resetFailedItems(SYNC_RETRY_MAX);
      const pending = await getPendingItems();

      this.onState?.(true, pending.length);

      // Ordre de priorité strict
      const alerts    = pending.filter(i => i.entity_type === 'ALERT');
      const hazards   = pending.filter(i => i.entity_type === 'HAZARD').slice(0, SYNC_BATCH_HAZARDS);
      const positions = pending.filter(i => i.entity_type === 'POSITION').slice(0, SYNC_BATCH_POSITIONS);

      await this._syncAlerts(alerts);
      await this._syncHazards(hazards);
      await this._syncPositions(positions);
      await this._syncChats();

      const remaining = await getPendingItems();
      this.onState?.(false, remaining.length);

      // Re-sync dans 30s s'il reste des items
      if (remaining.length > 0 && this.isOnline) {
        this.retryTimer = setTimeout(() => this.sync().catch(() => {}), 30_000);
      }
    } catch (e) {
      this.onState?.(false, 0, (e as Error)?.message ?? 'Erreur sync');
    } finally {
      this.syncing = false;
    }
  }

  private async _syncAlerts(items: SyncQueueItem[]) {
    for (const item of items) {
      try {
        await api.post('/api/alerts', JSON.parse(item.payload));
        await markDone(item.id);
      } catch (e) { await markFailed(item.id, (e as Error)?.message); }
    }
  }

  private async _syncHazards(items: SyncQueueItem[]) {
    if (!items.length) return;
    const body = items.map(i => {
      const p = JSON.parse(i.payload);
      return {
        missionId: p.missionId ?? null, latitude: p.latitude, longitude: p.longitude,
        altitudeM: p.altitude ?? null, accuracyM: p.accuracy ?? null,
        shockMagnitude: p.shockMagnitude, shockAxis: p.shockAxis ?? 'Z',
        speedKmh: p.speedKmh ?? null, severity: p.severity,
        hazardType: p.hazardType ?? 'POTHOLE', recordedAt: p.recordedAt, wasOffline: true,
      };
    });
    try {
      await api.post('/api/hazards/batch', body);
      await markHazardsSynced(items.map(i => i.local_id));
      for (const item of items) await markDone(item.id);
    } catch (e) {
      for (const item of items) await markFailed(item.id, (e as Error)?.message);
    }
  }

  private async _syncPositions(items: SyncQueueItem[]) {
    if (!items.length) return;
    const body = items
      .map(i => JSON.parse(i.payload))
      .filter(p => !!p.missionId)
      .map(p => ({
        missionId: p.missionId, latitude: p.latitude, longitude: p.longitude,
        speedKmh: p.speedKmh ?? null, headingDeg: p.headingDeg ?? null,
        accuracyM: p.accuracyM ?? null, recordedAt: p.recordedAt, wasOffline: true,
      }));
    if (!body.length) return;
    try {
      await api.post('/api/telemetry/batch', body);
      for (const item of items) await markDone(item.id);
    } catch (e) {
      for (const item of items) await markFailed(item.id, (e as Error)?.message);
    }
  }

  private async _syncChats() {
    const unsent = await getUnsyncedChats();
    if (!unsent.length) return;
    const synced: string[] = [];
    for (const msg of unsent) {
      try {
        await api.post(`/api/chat/mission/${msg.missionId}`, { content: msg.content, msgType: 'TEXT' });
        synced.push(msg.id);
      } catch { /* retry later */ }
    }
    if (synced.length) await markChatSynced(synced);
  }
}

export default new SyncService();
