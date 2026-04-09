import { create } from "zustand";
import { WindowInfo, MonitorInfo, AudioDevice, EncoderResult } from "../types/ipc";

interface SystemStore {
  // Window capture
  openWindows: WindowInfo[];
  selectedWindow: WindowInfo | null;

  // Monitors
  availableMonitors: MonitorInfo[];
  selectedMonitorIndex: number;

  // Audio devices
  audioDevices: AudioDevice[];

  // Encoder detection
  detectedEncoder: EncoderResult | null;
  encoderDetecting: boolean;

  // Actions
  refreshWindows: () => Promise<void>;
  setSelectedWindow: (window: WindowInfo | null) => void;
  refreshMonitors: () => Promise<void>;
  setSelectedMonitor: (index: number) => void;
  refreshAudioDevices: () => Promise<void>;
  detectEncoder: () => Promise<void>;
}

export const useSystemStore = create<SystemStore>((set) => ({
  openWindows: [],
  selectedWindow: null,
  availableMonitors: [],
  selectedMonitorIndex: 0,
  audioDevices: [],
  detectedEncoder: null,
  encoderDetecting: false,

  refreshWindows: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const windows = await invoke<WindowInfo[]>("get_open_windows");
      set({ openWindows: windows });
    } catch (e) {
      console.error("[systemStore] refreshWindows failed:", e);
    }
  },

  setSelectedWindow: (window) => set({ selectedWindow: window }),

  refreshMonitors: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const monitors = await invoke<MonitorInfo[]>("get_monitors");
      set({ availableMonitors: monitors });
    } catch (e) {
      console.error("[systemStore] refreshMonitors failed:", e);
    }
  },

  setSelectedMonitor: (index) => set({ selectedMonitorIndex: index }),

  refreshAudioDevices: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const devices = await invoke<AudioDevice[]>("get_audio_devices");
      set({ audioDevices: devices });
    } catch (e) {
      console.error("[systemStore] refreshAudioDevices failed:", e);
    }
  },

  detectEncoder: async () => {
    set({ encoderDetecting: true });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<EncoderResult>("detect_encoder");
      set({ detectedEncoder: result, encoderDetecting: false });
    } catch (e) {
      console.error("[systemStore] detectEncoder failed:", e);
      set({ encoderDetecting: false });
    }
  },
}));
