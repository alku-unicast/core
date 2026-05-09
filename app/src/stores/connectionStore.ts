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

  // Stream error (shown when pipeline fails to start)
  streamError: string | null;

  // Auto-restart logic
  lastStreamConfig: StreamConfig | null;
  restartAttempts: number;
  lastRestartTime: number;
  isRestarting: boolean;
  restartTimeout: ReturnType<typeof setTimeout> | null;

  // Actions
  connect: (room: Room) => void;
  submitPIN: (pin: string) => Promise<boolean>;
  startStream: (config: StreamConfig) => Promise<boolean>;
  stopStream: () => Promise<void>;
  attemptAutoRestart: () => Promise<void>;
  toggleMute: () => Promise<void>;
  setStreamVolume: (volume: number) => Promise<void>;
  setAudioEnabled: (enabled: boolean) => void;
  switchStreamMode: (mode: StreamMode, windowId?: number) => Promise<void>;
  setPhase: (phase: ConnectionPhase) => void;
  setNetworkQuality: (quality: NetworkQuality, rtt: number) => void;
  incrementElapsed: () => void;
  reset: () => void;
  resetStream: (error?: string) => void;
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
  streamError: null as string | null,
  lastStreamConfig: null as StreamConfig | null,
  restartAttempts: 0,
  lastRestartTime: 0,
  isRestarting: false,
  restartTimeout: null as ReturnType<typeof setTimeout> | null,
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
    set({ streamError: null });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ success: boolean; pid: number }>("start_stream", { config });
      if (result.success) {
        set({
          streamPid: result.pid,
          streamElapsed: 0,
          lastStreamConfig: config,
          isRestarting: false,
          streamError: null,
          audioEnabled: config.audioEnabled,
        });

        // ── Streaming bar: show window + send current stream mode ─────────
        const { useSettingsStore } = await import("./settingsStore");
        if (useSettingsStore.getState().streamingBar.enabled) {
          try {
            const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
            const bar = await WebviewWindow.getByLabel("streaming-bar");
            if (bar) {
              await bar.show();
              await bar.setFocus();
              // Give bar a moment to mount before sending mode info
              setTimeout(() => {
                const state = get();
                bar.emit("stream-mode-info", { 
                  mode: config.streamMode, 
                  targetIp: state.targetRoom?.ip,
                  audioEnabled: config.audioEnabled,
                  volume: state.streamVolume,
                  isMuted: state.isMuted
                });
              }, 500);
            }
          } catch (e) {
            console.warn("[connectionStore] Could not show streaming bar:", e);
          }
        }

        // ── ISSUE-06: Mute local speakers if setting is enabled ──────────
        const { audio } = useSettingsStore.getState();
        if (audio.muteLocal) {
          invoke("mute_system_audio", { mute: true }).catch(console.warn);
        }

        // ── Minimize main window to tray ─────────────────────────────────
        if (useSettingsStore.getState().streamingBar.enabled) {
          try {
            const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
            await getCurrentWebviewWindow().hide();
          } catch (e) {
            console.warn("[connectionStore] Could not hide main window:", e);
          }
        }
      }
      return result.success;
    } catch (e) {
      console.error("[connectionStore] startStream failed:", e);
      set({ phase: "awaiting_pin", streamError: "Yayın başlatılamadı. Lütfen ağ bağlantısını ve eklentileri kontrol edin." });
      return false;
    }
  },

  attemptAutoRestart: async () => {
    const { lastStreamConfig, restartAttempts, lastRestartTime, restartTimeout, streamMode } = get();
    
    // Clear any existing timeout
    if (restartTimeout) clearTimeout(restartTimeout);

    // Safety checks
    if (!lastStreamConfig) return;
    
    // Only auto-restart on Linux window mode (this is where the BadMatch occurs)
    const isLinux = /linux/i.test(navigator.userAgent);
    if (!isLinux || streamMode !== "window") {
      set({ phase: "awaiting_pin", isRestarting: false });
      return;
    }

    const now = Date.now();
    const isRecent = now - lastRestartTime < 30000;
    const newCount = isRecent ? restartAttempts + 1 : 1;

    if (newCount > 3) {
      console.warn("[connectionStore] Max auto-restart attempts reached.");
      set({ 
        phase: "awaiting_pin", 
        isRestarting: false, 
        streamError: "Linux pencere modu kararsız olabilir. Lütfen pencere boyutunu değiştirmeyin veya Tam Ekran moduna geçin." 
      });
      return;
    }

    set({ 
      isRestarting: true, 
      restartAttempts: newCount, 
      lastRestartTime: now,
      streamError: "Görüntü kalitesi optimize ediliyor..." // Professional wording for "it crashed and we are fixing it"
    });

    const timeout = setTimeout(async () => {
      console.log("[connectionStore] Executing auto-restart attempt", newCount);
      await get().startStream(lastStreamConfig);
    }, 1500);

    set({ restartTimeout: timeout });
  },

  stopStream: async () => {
    const { restartTimeout } = get();
    if (restartTimeout) clearTimeout(restartTimeout);
    
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("stop_stream");
      // ISSUE-06: Always unmute on stop
      await invoke("mute_system_audio", { mute: false }).catch(console.warn);
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
      const { targetRoom } = get();
      await invoke("set_stream_volume", { 
        volume: streamVolume, 
        mute: next, 
        targetIp: targetRoom?.ip ?? null 
      });
    } catch (e) {
      set({ isMuted: !next });
    }
  },

  setStreamVolume: async (volume) => {
    set({ streamVolume: volume });
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { isMuted, targetRoom } = get();
      await invoke("set_stream_volume", { 
        volume, 
        mute: isMuted, 
        targetIp: targetRoom?.ip ?? null 
      });
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

  reset: () => {
    const { restartTimeout } = get();
    if (restartTimeout) clearTimeout(restartTimeout);
    set({ ...initialState });
  },

  resetStream: (error?) => set((s) => ({
    phase: "awaiting_pin" as ConnectionPhase,
    streamElapsed: 0,
    streamPid: null,
    streamError: error ?? null,
    networkQuality: "excellent" as NetworkQuality,
    lastRTT: null,
    isMuted: s.isMuted,
  })),
}));
