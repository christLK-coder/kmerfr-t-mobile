import { create } from 'zustand';
import {
  getMyMissionsApi,
  getAvailableMissionsApi,
  createMissionApi,
  acceptMissionApi,
  completeMissionApi,
  type MissionDto,
  type MissionPayload,
} from '../api/missions.api';

interface MissionState {
  missions: MissionDto[];
  activeMission: MissionDto | null;
  isLoading: boolean;
  error: string | null;
}

interface MissionActions {
  fetchMyMissions: () => Promise<void>;
  fetchAvailableMissions: () => Promise<void>;
  createMission: (payload: MissionPayload) => Promise<MissionDto>;
  acceptMission: (missionId: string) => Promise<void>;
  completeMission: (missionId: string, qrToken: string) => Promise<void>;
  setActiveMission: (mission: MissionDto | null) => void;
  clearError: () => void;
}

export const useMissionStore = create<MissionState & MissionActions>((set, get) => ({
  missions: [],
  activeMission: null,
  isLoading: false,
  error: null,

  fetchMyMissions: async () => {
    set({ isLoading: true, error: null });
    try {
      const missions = await getMyMissionsApi();
      set({ missions });
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message ?? 'Erreur de chargement' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAvailableMissions: async () => {
    set({ isLoading: true, error: null });
    try {
      const missions = await getAvailableMissionsApi();
      set({ missions });
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message ?? 'Erreur de chargement' });
    } finally {
      set({ isLoading: false });
    }
  },

  createMission: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const mission = await createMissionApi(payload);
      set((s) => ({ missions: [mission, ...s.missions] }));
      return mission;
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Erreur lors de la création';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  acceptMission: async (missionId) => {
    set({ isLoading: true, error: null });
    try {
      const mission = await acceptMissionApi(missionId);
      set({
        activeMission: mission,
        missions: get().missions.map((m) => (m.id === missionId ? mission : m)),
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erreur lors de l'acceptation";
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  completeMission: async (missionId, qrToken) => {
    set({ isLoading: true, error: null });
    try {
      const mission = await completeMissionApi(missionId, qrToken);
      set({
        activeMission: null,
        missions: get().missions.map((m) => (m.id === missionId ? mission : m)),
      });
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Livraison non confirmée';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveMission: (mission) => set({ activeMission: mission }),
  clearError: () => set({ error: null }),
}));
