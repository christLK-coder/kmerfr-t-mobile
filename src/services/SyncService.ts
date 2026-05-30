// Synchronisation offline→online — envoi batch des données SQLite vers l'API REST
import NetInfo from '@react-native-community/netinfo';
import type { NetInfoState } from '@react-native-community/netinfo';
import { api } from '../api/axios.config';
import { getPendingItems, markDone, markFailed, resetFailedItems } from '../database/syncDb';
import { markHazardsSynced } from '../database/hazardsDb';
import type { SyncQueueItem } from '../types';

// Shapes des payloads stockés dans sync_queue.payload (JSON stringifié par TelemetryService)
interface HazardPayload {
  missionId?: string | null;
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  shockMagnitude: number;
  shockAxis?: string;
  speedKmh?: number | null;
  severity: string;
  hazardType?: string;
  recordedAt: string;
}

interface PositionPayload {
  missionId: string;
  latitude: number;
  longitude: number;
  speedKmh?: number | null;
  headingDeg?: number | null;
  accuracyM?: number | null;
  recordedAt: string;
}

type StateCallback = (isSyncing: boolean, error?: string) => void;

class SyncService {
  private isSyncing = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  private onStateChange: StateCallback | null = null;

  setStateCallback(cb: StateCallback): void {
    this.onStateChange = cb;
  }

  // Démarrer l'écoute réseau — déclenche sync() dès que la connexion revient
  startNetworkListener(): void {
    if (this.unsubscribeNetInfo) return;

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      if (connected) {
        this.sync().catch((err: unknown) =>
          console.warn('[SyncService] listener sync error:', (err as Error)?.message)
        );
      }
    });
  }

  stopNetworkListener(): void {
    this.unsubscribeNetInfo?.();
    this.unsubscribeNetInfo = null;
  }

  // Synchronisation complète — à appeler manuellement ou depuis le listener
  async sync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.onStateChange?.(true);

    try {
      // Remettre en PENDING les items échoués éligibles (retry_count < 5)
      await resetFailedItems();

      const pending = await getPendingItems();
      if (pending.length === 0) return;

      const hazardItems   = pending.filter(i => i.entity_type === 'HAZARD');
      const positionItems = pending.filter(i => i.entity_type === 'POSITION');
      // ALERT items : pas d'endpoint batch backend — laissés en PENDING jusqu'au prochain cycle

      await this.syncHazards(hazardItems);
      await this.syncPositions(positionItems);

    } catch (err: unknown) {
      console.error('[SyncService] sync global error:', (err as Error)?.message);
      this.onStateChange?.(false, (err as Error)?.message ?? 'Erreur de synchronisation');
      return;
    } finally {
      this.isSyncing = false;
      this.onStateChange?.(false);
    }
  }

  // ─── Batch hazards → POST /api/hazards/batch ─────────────────────────────

  private async syncHazards(items: SyncQueueItem[]): Promise<void> {
    if (items.length === 0) return;

    const body = items.map(item => {
      const p = JSON.parse(item.payload) as HazardPayload;
      return {
        missionId:      p.missionId ?? null,
        latitude:       p.latitude,
        longitude:      p.longitude,
        altitudeM:      p.altitude ?? null,
        accuracyM:      p.accuracy ?? null,
        shockMagnitude: p.shockMagnitude,
        shockAxis:      p.shockAxis ?? 'Z',
        speedKmh:       p.speedKmh ?? null,
        severity:       p.severity,
        hazardType:     p.hazardType ?? 'POTHOLE',
        recordedAt:     p.recordedAt,
        wasOffline:     true,
      };
    });

    try {
      await api.post('/api/hazards/batch', body);
      await markHazardsSynced(items.map(i => i.local_id));
      for (const item of items) await markDone(item.id);
      console.log(`[SyncService] ${items.length} hazards synchronisés`);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'batch hazards échoué';
      console.error('[SyncService] syncHazards failed:', msg);
      for (const item of items) await markFailed(item.id, msg);
    }
  }

  // ─── Batch positions → POST /api/telemetry/batch ─────────────────────────

  private async syncPositions(items: SyncQueueItem[]): Promise<void> {
    if (items.length === 0) return;

    const body = items
      .map(item => JSON.parse(item.payload) as PositionPayload)
      .filter(p => !!p.missionId)
      .map(p => ({
        missionId:  p.missionId,
        latitude:   p.latitude,
        longitude:  p.longitude,
        speedKmh:   p.speedKmh  ?? null,
        headingDeg: p.headingDeg ?? null,
        accuracyM:  p.accuracyM  ?? null,
        recordedAt: p.recordedAt,
        wasOffline: true,
      }));

    if (body.length === 0) return;

    try {
      await api.post('/api/telemetry/batch', body);
      for (const item of items) await markDone(item.id);
      console.log(`[SyncService] ${items.length} positions synchronisées`);
    } catch (err: unknown) {
      const msg = (err as Error)?.message ?? 'batch positions échoué';
      console.error('[SyncService] syncPositions failed:', msg);
      for (const item of items) await markFailed(item.id, msg);
    }
  }
}

export default new SyncService();
