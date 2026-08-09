import { create } from "zustand";
import { Settings, DEFAULT_SETTINGS } from "../types/settings";
import { isMacOS } from "../utils/platform";

interface SettingsStore extends Settings {
  // Actions
  toggleFavorite: (roomId: string) => void;
  setHideLinuxWindowWarning: (value: boolean) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  resetToDefaults: () => Promise<void>;
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  streamingBar: { enabled: !isMacOS() },

  setHideLinuxWindowWarning: (value) => {
    set({ hideLinuxWindowWarning: value });
    get().saveToDisk();
  },

  toggleFavorite: (roomId) => {
    const { favorites } = get();
    const next = favorites.includes(roomId)
      ? favorites.filter((id) => id !== roomId)
      : [...favorites, roomId];
    set({ favorites: next });
    get().saveToDisk();
  },

  updateSettings: (partial) => {
    set((state) => ({ ...state, ...partial }));
    get().saveToDisk();
  },

  resetToDefaults: async () => {
    set({ ...DEFAULT_SETTINGS });
    await get().saveToDisk();
  },

  loadFromDisk: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<Settings>("read_settings");
      if (data.version < 2) {
        set({ ...DEFAULT_SETTINGS });
        await get().saveToDisk();
      } else {
        set({ ...data });
      }
    } catch (e) {
      console.error("[settingsStore] loadFromDisk failed:", e);
    }
  },

  saveToDisk: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const state = get();
      const payload: Settings = {
        version: state.version,
        language: state.language,
        favorites: state.favorites,
        profiles: state.profiles,
        audio: state.audio,
        encoder: state.encoder,
        appearance: state.appearance,
        streamingBar: state.streamingBar,
        hideLinuxWindowWarning: state.hideLinuxWindowWarning,
      };
      await invoke("write_settings", { settings: payload });
      const { emit } = await import("@tauri-apps/api/event");
      await emit("settings-updated");
    } catch (e) {
      console.error("[settingsStore] saveToDisk failed:", e);
    }
  },
}));
