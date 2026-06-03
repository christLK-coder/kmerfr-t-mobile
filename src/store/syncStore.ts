import { create } from 'zustand';
import SyncService from '../services/SyncService';
import { getPendingItems } from '../database/syncDb';

interface SyncState {
  isSyncing:    boolean;
  isOnline:     boolean;
  lastSyncAt:   string | null;
  pendingCount: number;
  error:        string | null;
}

interface SyncActions {
  startListener:       () => void;
  stopListener:        () => void;
  triggerSync:         () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
  clearError:          () => void;
}

SyncService.setStateCallback((syncing, pending, error) => {
  useSyncStore.setState(prev => ({
    isSyncing:    syncing,
    isOnline:     SyncService.online,
    pendingCount: pending,
    error:        error ?? null,
    lastSyncAt:   !syncing && !error ? new Date().toISOString() : prev.lastSyncAt,
  }));
});

export const useSyncStore = create<SyncState & SyncActions>((set) => ({
  isSyncing:    false,
  isOnline:     true,
  lastSyncAt:   null,
  pendingCount: 0,
  error:        null,

  startListener: () => SyncService.startNetworkListener(),
  stopListener:  () => SyncService.stopNetworkListener(),
  triggerSync:   () => SyncService.sync(),

  refreshPendingCount: async () => {
    try {
      const items = await getPendingItems();
      set({ pendingCount: items.length });
    } catch {}
  },

  clearError: () => set({ error: null }),
}));
