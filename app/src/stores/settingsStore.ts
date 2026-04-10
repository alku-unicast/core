import { create } from "zustand";
import { Settings, DEFAULT_SETTINGS } from "../types/settings";

interface SettingsStore extends Settings {
  // Actions
  toggleFavorite: (roomId: string) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  loadFromDisk: () => Promise<void>;
  saveToDisk: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,

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

  loadFromDisk: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<Settings>("read_settings");
      set({ ...data });
    } catch (e) {
      console.error("[settingsStore] loadFromDisk failed:", e);
    }
  },

  saveToDisk: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const state = get();
      // Extract only Settings fields (not store actions)
      const payload: Settings = {
        version: state.version,
        language: state.language,
        favorites: state.favorites,
        stream: state.stream,
        audio: state.audio,
        encoder: state.encoder,
        appearance: state.appearance,
        streamingBar: state.streamingBar,
      };
      await invoke("write_settings", { settings: payload });
      const { emit } = await import("@tauri-apps/api/event");
      await emit("settings-updated");
    } catch (e) {
      console.error("[settingsStore] saveToDisk failed:", e);
    }
  },
}));
