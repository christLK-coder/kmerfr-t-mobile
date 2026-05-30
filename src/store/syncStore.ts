// État de synchronisation global — Zustand
import { create } from 'zustand';
import SyncService from '../services/SyncService';
import { getPendingItems } from '../database/syncDb';

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: string | null;
  pendingCount: number;
  error: string | null;
}

interface SyncActions {
  startListener: () => void;
  stopListener: () => void;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  clearSyncError: () => void;
}

export const useSyncStore = create<SyncState & SyncActions>((set) => {
  // Brancher le callback SyncService → store Zustand
  SyncService.setStateCallback((isSyncing, error) => {
    set(prev => ({
      isSyncing,
      error: error ?? null,
      lastSyncAt: !isSyncing && !error ? new Date().toISOString() : prev.lastSyncAt,
    }));
  });

  return {
    isSyncing: false,
    lastSyncAt: null,
    pendingCount: 0,
    error: null,

    startListener: () => SyncService.startNetworkListener(),
    stopListener:  () => SyncService.stopNetworkListener(),
    triggerSync:   () => SyncService.sync(),

    refreshPendingCount: async () => {
      try {
        const items = await getPendingItems();
        set({ pendingCount: items.length });
      } catch {
        // silencieux — pas bloquant
      }
    },

    clearSyncError: () => set({ error: null }),
  };
});
