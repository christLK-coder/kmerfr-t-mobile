import { create } from 'zustand';
import {
  getActiveMissionsApi,
  getHistoryMissionsApi,
  getAvailableMissionsApi,
  createMissionApi,
  acceptMissionApi,
  markDriverArrivedApi,
  startTransitApi,
  deliverMissionApi,
  getMissionDetailApi,
  cancelMissionApi,
  type CreateMissionPayload,
  type MissionDto,
} from '../api/missions.api';
import type { MissionResponse } from '../types';

interface MissionState {
  activeMissions: MissionResponse[];
  historyMissions: MissionResponse[];
  availableMissions: MissionResponse[];
  currentMission: MissionResponse | null;  // mission sélectionnée (detail/active)
  isLoading: boolean;
  error: string | null;
}

interface MissionActions {
  fetchActiveMissions: () => Promise<void>;
  fetchHistoryMissions: () => Promise<void>;
  fetchAvailableMissions: () => Promise<void>;
  fetchMissionDetail: (id: string) => Promise<MissionResponse>;
  createMission: (payload: CreateMissionPayload) => Promise<MissionResponse>;
  acceptMission: (id: string) => Promise<void>;
  markArrived: (id: string) => Promise<void>;
  startTransit: (id: string) => Promise<void>;
  completeMission: (id: string, qrToken: string) => Promise<void>;
  cancelMission: (id: string) => Promise<void>;
  setCurrentMission: (m: MissionResponse | null) => void;
  clearError: () => void;
  // Rétro-compat
  fetchMyMissions: () => Promise<void>;
  setActiveMission: (m: MissionResponse | null) => void;
}

const err = (e: unknown) => (e as { message?: string })?.message ?? 'Erreur inconnue';

export const useMissionStore = create<MissionState & MissionActions>((set, get) => ({
  activeMissions: [],
  historyMissions: [],
  availableMissions: [],
  currentMission: null,
  isLoading: false,
  error: null,

  fetchActiveMissions: async () => {
    set({ isLoading: true, error: null });
    try { set({ activeMissions: await getActiveMissionsApi() }); }
    catch (e) { set({ error: err(e) }); }
    finally { set({ isLoading: false }); }
  },

  fetchHistoryMissions: async () => {
    set({ isLoading: true, error: null });
    try { set({ historyMissions: await getHistoryMissionsApi() }); }
    catch (e) { set({ error: err(e) }); }
    finally { set({ isLoading: false }); }
  },

  fetchAvailableMissions: async () => {
    set({ isLoading: true, error: null });
    try { set({ availableMissions: await getAvailableMissionsApi() }); }
    catch (e) { set({ error: err(e) }); }
    finally { set({ isLoading: false }); }
  },

  fetchMissionDetail: async (id) => {
    const m = await getMissionDetailApi(id);
    set({ currentMission: m });
    return m;
  },

  createMission: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const m = await createMissionApi(payload);
      set(s => ({ activeMissions: [m, ...s.activeMissions] }));
      return m;
    } catch (e) { set({ error: err(e) }); throw e; }
    finally { set({ isLoading: false }); }
  },

  acceptMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const m = await acceptMissionApi(id);
      set({ currentMission: m });
    } catch (e) { set({ error: err(e) }); throw e; }
    finally { set({ isLoading: false }); }
  },

  markArrived: async (id) => {
    try {
      const m = await markDriverArrivedApi(id);
      set({ currentMission: m });
    } catch (e) { set({ error: err(e) }); throw e; }
  },

  startTransit: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const m = await startTransitApi(id);
      set({ currentMission: m });
    } catch (e) { set({ error: err(e) }); throw e; }
    finally { set({ isLoading: false }); }
  },

  completeMission: async (id, qrToken) => {
    set({ isLoading: true, error: null });
    try {
      const m = await deliverMissionApi(id, qrToken);
      set({ currentMission: m });
      await get().fetchActiveMissions();
    } catch (e) { set({ error: err(e) }); throw e; }
    finally { set({ isLoading: false }); }
  },

  cancelMission: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const m = await cancelMissionApi(id);
      set({ currentMission: m });
      await get().fetchActiveMissions();
    } catch (e) { set({ error: err(e) }); throw e; }
    finally { set({ isLoading: false }); }
  },

  setCurrentMission: (m) => set({ currentMission: m }),
  clearError: () => set({ error: null }),

  // Rétro-compat
  fetchMyMissions: async () => get().fetchActiveMissions(),
  setActiveMission: (m) => set({ currentMission: m }),
}));
