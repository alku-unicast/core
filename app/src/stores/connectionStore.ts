import { create } from "zustand";
import { Room } from "../types/room";
import { ConnectionPhase, StreamMode, NetworkQuality, StreamConfig } from "../types/stream";

interface ConnectionStore {
  phase: ConnectionPhase;
  targetRoom: Room | null;
  streamElapsed: number;        // seconds
  streamMode: StreamMode;
  streamPid: number | null;

  // PIN
  pinError: string | null;
  pinAttempts: number;          // attempts used (max 3)

  // Audio
  audioEnabled: boolean;        // include audio in stream
  isMuted: boolean;
  streamVolume: number;         // 0.0 - 1.0

  // Network quality
  networkQuality: NetworkQuality;
  lastRTT: number | null;       // ms

  // Actions
  connect: (room: Room) => void;
  submitPIN: (pin: string) => Promise<boolean>;
  startStream: (config: StreamConfig) => Promise<boolean>;
  stopStream: () => Promise<void>;
  toggleMute: () => Promise<void>;
  setStreamVolume: (volume: number) => Promise<void>;
  setAudioEnabled: (enabled: boolean) => void;
  switchStreamMode: (mode: StreamMode, windowId?: number) => Promise<void>;
  setPhase: (phase: ConnectionPhase) => void;
  setNetworkQuality: (quality: NetworkQuality, rtt: number) => void;
  incrementElapsed: () => void;
  reset: () => void;
}

const initialState = {
  phase: "idle" as ConnectionPhase,
  targetRoom: null,
  streamElapsed: 0,
  streamMode: "fullscreen" as StreamMode,
  streamPid: null,
  pinError: null,
  pinAttempts: 0,
  audioEnabled: true,
  isMuted: false,
  streamVolume: 1.0,
  networkQuality: "excellent" as NetworkQuality,
  lastRTT: null,
};

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  ...initialState,

  connect: (room) => {
    set({ targetRoom: room, phase: "waking", pinError: null, pinAttempts: 0 });
  },

  submitPIN: async (pin) => {
    const { targetRoom } = get();
    if (!targetRoom) return false;

    set({ phase: "authenticating" });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ success: boolean; message: string; attemptsRemaining?: number }>(
        "verify_pin",
        { targetIp: targetRoom.ip, pin }
      );

      if (result.success) {
        set({ phase: "streaming", pinError: null, pinAttempts: 0 });
        return true;
      } else {
        const used = get().pinAttempts + 1;
        set({
          phase: "awaiting_pin",
          pinError: result.message,
          pinAttempts: used,
        });
        return false;
      }
    } catch (e) {
      set({ phase: "awaiting_pin", pinError: "Connection error" });
      return false;
    }
  },

  startStream: async (config) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ success: boolean; pid: number }>("start_stream", { config });
      if (result.success) {
        set({ streamPid: result.pid, streamElapsed: 0 });
      }
      return result.success;
    } catch (e) {
      console.error("[connectionStore] startStream failed:", e);
      return false;
    }
  },

  stopStream: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_stream");
    } catch (e) {
      console.error("[connectionStore] stopStream failed:", e);
    }
    get().reset();
  },

  toggleMute: async () => {
    const { isMuted, streamVolume } = get();
    const next = !isMuted;
    set({ isMuted: next });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_stream_volume", { volume: streamVolume, mute: next });
    } catch (e) {
      // Revert on error
      set({ isMuted: !next });
    }
  },

  setStreamVolume: async (volume) => {
    set({ streamVolume: volume });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { isMuted } = get();
      await invoke("set_stream_volume", { volume, mute: isMuted });
    } catch (e) {
      console.error("[connectionStore] setStreamVolume failed:", e);
    }
  },

  switchStreamMode: async (mode, windowId) => {
    set({ streamMode: mode });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("switch_stream_mode", { mode, windowId: windowId ?? null });
    } catch (e) {
      console.error("[connectionStore] switchStreamMode failed:", e);
    }
  },

  setPhase: (phase) => set({ phase }),
  setAudioEnabled: (enabled) => set({ audioEnabled: enabled }),

  setNetworkQuality: (quality, rtt) => set({ networkQuality: quality, lastRTT: rtt }),

  incrementElapsed: () => set((s) => ({ streamElapsed: s.streamElapsed + 1 })),

  reset: () => set({ ...initialState }),
}));
