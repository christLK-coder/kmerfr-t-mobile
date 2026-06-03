import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'system') return Appearance.getColorScheme() === 'dark';
  return mode === 'dark';
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  isDark: false,

  setMode: async (mode) => {
    await AsyncStorage.setItem('theme_mode', mode);
    set({ mode, isDark: resolveIsDark(mode) });
  },

  loadTheme: async () => {
    const saved = (await AsyncStorage.getItem('theme_mode')) as ThemeMode | null;
    const mode: ThemeMode = saved ?? 'light';
    set({ mode, isDark: resolveIsDark(mode) });
  },
}));
