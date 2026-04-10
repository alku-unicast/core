import { useState, useEffect, useRef, useCallback } from "react";
import { Square, Monitor, AppWindow, Volume2, Volume1, VolumeX } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../stores/settingsStore";

import { NetworkQualityDot } from "../components/streaming-bar/NetworkQualityDot";
import { AudioPopup } from "../components/streaming-bar/AudioPopup";
import { NetworkQuality } from "../types/stream";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(totalSecs: number): string {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSecs % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function StreamingBarApp() {
  const { t } = useTranslation();
  const { appearance } = useSettingsStore();
  
  /* ── Local state (separate Tauri window — no shared Zustand) ──────────── */
  const [elapsed, setElapsed]               = useState(0);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("excellent");
  const [lastRTT, setLastRTT]               = useState<number | null>(null);
  const [isMuted, setIsMuted]               = useState(false);
  const [volume, setVolume]                 = useState(1.0);
  const [audioPopupOpen, setAudioPopupOpen] = useState(false);
  const [streamMode, setStreamMode]         = useState<"fullscreen" | "window">("fullscreen");
  const [stopping, setStopping]             = useState(false);

  /* ── Timer ────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Tauri event listeners ────────────────────────────────────────────── */
  useEffect(() => {
    const fns: Array<() => void> = [];

    // Network quality from RTT monitor (Rust emits every 2s to all windows)
    listen<{ rttMs: number; quality: string }>("stream-health", (ev) => {
      setNetworkQuality(ev.payload.quality as NetworkQuality);
      setLastRTT(ev.payload.rttMs);
    }).then((fn) => fns.push(fn));

    // Stream mode info sent from main window when stream starts
    listen<{ mode: string }>("stream-mode-info", (ev) => {
      setElapsed(0); // reset timer when stream is newly started
      if (ev.payload.mode === "fullscreen" || ev.payload.mode === "window") {
        setStreamMode(ev.payload.mode);
      }
    }).then((fn) => fns.push(fn));

    // Auto-close bar when stream stops (Rust or main window signals this)
    listen("stream-stopped", () => {
      import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
        getCurrentWebviewWindow().hide();
      });
    }).then((fn) => fns.push(fn));

    return () => fns.forEach((f) => f());
  }, []);

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const handleStop = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await invoke("stop_stream");
    } catch (e) {
      console.error("[StreamingBar] stop_stream failed:", e);
      setStopping(false);
    }
  }, [stopping]);

  const handleMuteToggle = useCallback(async () => {
    const next = !isMuted;
    setIsMuted(next);
    try {
      await invoke("set_stream_volume", { volume, mute: next });
    } catch {
      setIsMuted(!next); // revert on error
    }
  }, [isMuted, volume]);

  const handleVolumeChange = useCallback(
    async (v: number) => {
      setVolume(v);
      const shouldMute = v === 0;
      if (shouldMute !== isMuted) setIsMuted(shouldMute);
      try {
        await invoke("set_stream_volume", { volume: v, mute: shouldMute });
      } catch (e) {
        console.error("[StreamingBar] volume change failed:", e);
      }
    },
    [isMuted]
  );

  const handleModeToggle = useCallback(async () => {
    const next = streamMode === "fullscreen" ? "window" : "fullscreen";
    setStreamMode(next);
    try {
      await invoke("switch_stream_mode", { mode: next, windowId: null });
    } catch {
      setStreamMode(streamMode); // revert
    }
  }, [streamMode]);

  /* ── Volume icon helper ───────────────────────────────────────────────── */
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume > 0.5 ? Volume2 : Volume1;

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div className="w-screen h-screen bg-transparent flex justify-center items-start pt-0 relative select-none">
      <div
        className="w-full flex items-center gap-2 px-3 rounded-2xl relative"
        style={{
          height:               "56px",
          background:           "var(--bar-bg)",
          color:                "var(--bar-text)",
          border:               "1px solid var(--bar-border)",
          boxShadow:            "0 8px 32px rgba(0,0,0,0.4)",
        }}
        data-bar-theme={appearance.barTheme}
        data-tauri-drag-region
      >
      {/* ── Stream mode badge / toggle ──────────────────────────────────── */}
      <button
        id="btn-bar-mode-toggle"
        onClick={handleModeToggle}
        title={
          streamMode === "fullscreen"
            ? t("streaming_bar.mode_hint_fullscreen")
            : t("streaming_bar.mode_hint_window")
        }
        className="
          flex items-center gap-1.5 px-2 py-1 rounded-lg
          text-xs font-medium shrink-0
          bg-white/10 hover:bg-white/20
          transition-colors duration-150
        "
      >
        {streamMode === "fullscreen" ? (
          <>
            <Monitor size={12} />
            <span>{t("streaming_bar.mode_fullscreen_short")}</span>
          </>
        ) : (
          <>
            <AppWindow size={12} />
            <span>{t("streaming_bar.mode_window_short")}</span>
          </>
        )}
      </button>

      {/* ── Elapsed timer ──────────────────────────────────────────────── */}
      <span
        className="font-mono text-sm font-semibold tabular-nums shrink-0"
        data-tauri-drag-region
      >
        {formatTime(elapsed)}
      </span>

      {/* ── Network quality dot ─────────────────────────────────────────── */}
      <NetworkQualityDot quality={networkQuality} rtt={lastRTT} />

      {/* ── Spacer (draggable) ──────────────────────────────────────────── */}
      <div className="flex-1 min-w-0" data-tauri-drag-region />

      {/* ── Audio control ──────────────────────────────────────────────── */}
      <div className="relative shrink-0">
        <button
          id="btn-bar-audio"
          onClick={() => setAudioPopupOpen((o) => !o)}
          title={t("streaming_bar.audio_control")}
          className="
            w-8 h-8 flex items-center justify-center rounded-lg
            bg-white/10 hover:bg-white/20
            transition-colors duration-150
          "
          style={{ color: isMuted ? "#ef4444" : "var(--bar-text)" }}
        >
          <VolumeIcon size={15} />
        </button>

        {audioPopupOpen && (
          <AudioPopup
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={handleVolumeChange}
            onMuteToggle={handleMuteToggle}
            onClose={() => setAudioPopupOpen(false)}
          />
        )}
      </div>

      {/* ── Stop button ────────────────────────────────────────────────── */}
      <button
        id="btn-bar-stop"
        onClick={handleStop}
        disabled={stopping}
        title={t("streaming_bar.stop")}
        className="
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
          text-xs font-semibold text-white shrink-0
          bg-red-500/80 hover:bg-red-500
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-150
        "
      >
        {stopping ? (
          <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : (
          <Square size={10} fill="currentColor" />
        )}
        {stopping ? t("streaming_bar.stopping") : t("streaming_bar.stop_short")}
      </button>
      </div>
    </div>
  );
}
