import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Wifi } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

import { useConnectionStore } from "../stores/connectionStore";
import { useSystemStore }     from "../stores/systemStore";
import { useSettingsStore }   from "../stores/settingsStore";

import { StreamModeSelector }   from "../components/connection/StreamModeSelector";
import { AudioToggle }          from "../components/connection/AudioToggle";
import { PINEntry }             from "../components/connection/PINEntry";
import { ConnectionProgress }   from "../components/connection/ConnectionProgress";

import { StreamConfig } from "../types/stream";

// ─────────────────────────────────────────────────────────────────────────────

export function ConnectionSetup() {
  const navigate = useNavigate();

  /* ── Stores ─────────────────────────────────────────────────────────────── */
  const {
    phase,
    targetRoom,
    pinError,
    audioEnabled,
    streamMode,
    submitPIN,
    startStream,
    setAudioEnabled,
    setPhase,
    switchStreamMode,
    reset,
  } = useConnectionStore();

  const {
    openWindows,
    selectedWindow,
    availableMonitors,
    selectedMonitorIndex,
    detectedEncoder,
    refreshWindows,
    setSelectedWindow,
    refreshMonitors,
    setSelectedMonitor,
    detectEncoder,
  } = useSystemStore();

  const { stream: streamSettings, audio: audioSettings, encoder } = useSettingsStore();

  /* ── Local UI state ──────────────────────────────────────────────────────── */
  const [pin, setPin]                   = useState("");
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [waking, setWaking]             = useState(false);

  /* ── Bootstrap on mount ──────────────────────────────────────────────────── */
  useEffect(() => {
    // If arrived without a target room (direct URL), go home
    if (!targetRoom) {
      navigate("/", { replace: true });
      return;
    }

    // Detect encoder if not already done
    if (!encoder.detected) {
      detectEncoder();
    }

    // Load monitors + windows in background
    refreshMonitors();
    handleRefreshWindows();

    // Wake Pi → HDMI on
    wakeAndProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── stream-stopped Tauri event: go back to home ─────────────────────────── */
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("stream-stopped", () => {
        reset();
        navigate("/", { replace: true });
      }).then((fn) => { unlisten = fn; });
    });

    return () => { unlisten?.(); };
  }, [navigate, reset]);

  /* ── Wake Pi HDMI ────────────────────────────────────────────────────────── */
  const wakeAndProgress = useCallback(async () => {
    if (!targetRoom) return;
    setWaking(true);
    try {
      await invoke<boolean>("wake_pi_hdmi", { targetIp: targetRoom.ip });
      setPhase("hdmi_ready");
      // Brief pause so user can see HDMI Ready step
      await new Promise((r) => setTimeout(r, 800));
    } catch (_) {
      // Non-fatal — Pi might already be awake
    } finally {
      setWaking(false);
      setPhase("awaiting_pin");
    }
  }, [targetRoom, setPhase]);

  /* ── Window list refresh ─────────────────────────────────────────────────── */
  const handleRefreshWindows = useCallback(async () => {
    setWindowsLoading(true);
    await refreshWindows();
    setWindowsLoading(false);
  }, [refreshWindows]);

  /* ── PIN submit ──────────────────────────────────────────────────────────── */
  const handlePINSubmit = useCallback(async () => {
    if (pin.length !== 4 || phase === "authenticating") return;

    const encoderName =
      detectedEncoder?.name ?? encoder.detected ?? "x264enc";

    const config: StreamConfig = {
      targetIp:      targetRoom!.ip,
      resolution:    streamSettings.resolution,
      fps:           streamSettings.fps,
      bitrate:       streamSettings.bitrate,
      delayBufferMs: streamSettings.delayBufferMs,
      encoderName,
      streamMode,
      windowId:      streamMode === "window" ? selectedWindow?.id : undefined,
      monitorIndex:  streamMode === "fullscreen" ? selectedMonitorIndex : undefined,
      audioEnabled,
      audioDeviceId: audioSettings.deviceId,
    };

    const ok = await submitPIN(pin);
    if (ok) {
      setPin("");
      await startStream(config);
    } else {
      setPin("");
    }
  }, [
    pin, phase, targetRoom, streamMode, selectedWindow, selectedMonitorIndex,
    audioEnabled, audioSettings, streamSettings, encoder, detectedEncoder,
    submitPIN, startStream,
  ]);

  /* ── Back button ─────────────────────────────────────────────────────────── */
  const handleBack = () => {
    reset();
    navigate("/");
  };

  if (!targetRoom) return null;

  /* ── Derived state ───────────────────────────────────────────────────────── */
  const isAuthenticating = phase === "authenticating";
  const isStreaming      = phase === "streaming";
  const pinDisabled      = isAuthenticating || isStreaming || waking;

  const statusLabel: Record<string, string> = {
    waking:        "Pi Uyandırılıyor...",
    hdmi_ready:    "HDMI Hazır",
    awaiting_pin:  "PIN Bekleniyor",
    authenticating:"Doğrulanıyor...",
    streaming:     "Yayın Başlıyor...",
  };

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        <button
          id="btn-back"
          onClick={handleBack}
          className="
            flex items-center justify-center w-8 h-8 rounded-lg
            text-[var(--text-muted)] hover:text-[var(--text-primary)]
            hover:bg-[var(--bg-tertiary)] transition-colors duration-150
          "
          aria-label="Geri"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-[var(--text-primary)] truncate">
            {targetRoom.label}
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono">{targetRoom.ip}</p>
        </div>

        {/* Status badge */}
        <span
          className={`
            flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full
            transition-colors duration-300
            ${
              phase === "streaming"
                ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                : waking || phase === "waking"
                ? "bg-amber-50/10 text-amber-400"
                : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
            }
          `}
        >
          <span
            className={`
              inline-block w-1.5 h-1.5 rounded-full
              ${
                phase === "streaming"
                  ? "bg-[var(--accent)] animate-pulse"
                  : waking || phase === "waking"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-[var(--text-muted)]"
              }
            `}
          />
          {statusLabel[phase] ?? "Bağlanıyor..."}
        </span>
      </header>

      {/* ── Scrollable body ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

        {/* ── Progress indicator ─────────────────────────────────────────── */}
        <section className="flex justify-center pt-2">
          <ConnectionProgress phase={phase} />
        </section>

        {/* ── Stream mode + audio card ──────────────────────────────────── */}
        <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-4">
          <StreamModeSelector
            mode={streamMode}
            onModeChange={(m) => switchStreamMode(m)}
            monitors={availableMonitors}
            selectedMonitor={selectedMonitorIndex}
            onMonitorChange={setSelectedMonitor}
            windows={openWindows}
            selectedWindow={selectedWindow}
            onWindowChange={setSelectedWindow}
            onRefreshWindows={handleRefreshWindows}
            windowsLoading={windowsLoading}
          />

          <div className="border-t border-[var(--border)]" />

          <AudioToggle
            enabled={audioEnabled}
            onChange={setAudioEnabled}
          />
        </section>

        {/* ── PIN entry card ────────────────────────────────────────────── */}
        <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center gap-5">
          {/* Radio icon decorative */}
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center">
            <Radio size={22} className="text-[var(--accent)]" />
          </div>

          <PINEntry
            value={pin}
            onChange={setPin}
            onSubmit={handlePINSubmit}
            error={pinError}
            disabled={pinDisabled}
          />

          {/* Submit button */}
          <button
            id="btn-start-stream"
            onClick={handlePINSubmit}
            disabled={
              pin.length < 4 || 
              pinDisabled || 
              (streamMode === "window" && !selectedWindow)
            }
            className="
              w-full max-w-xs py-3.5 rounded-2xl font-semibold text-sm
              bg-[var(--accent)] text-white
              hover:bg-[var(--accent-hover)] active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 shadow-lg shadow-[var(--accent)]/25
              flex items-center justify-center gap-2
            "
          >
            {isAuthenticating ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Doğrulanıyor...
              </>
            ) : (
              <>
                <Wifi size={16} />
                Yayını Başlat
              </>
            )}
          </button>

          <p className="text-[11px] text-[var(--text-muted)] text-center">
            Projektördeki 4 haneli PIN kodunu girin
          </p>
        </section>

        {/* ── Encoder info ─────────────────────────────────────────────── */}
        {encoder.detected && (
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Encoder:{" "}
            <span className="font-mono text-[var(--text-secondary)]">
              {encoder.detected}
            </span>
          </p>
        )}
      </main>

      {/* ── Cancel footer ────────────────────────────────────────────────── */}
      <footer className="px-5 pb-5 pt-3 shrink-0">
        <button
          id="btn-cancel"
          onClick={handleBack}
          className="
            w-full py-2.5 rounded-xl
            text-sm text-[var(--text-muted)]
            border border-[var(--border)]
            hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]
            transition-colors duration-150
          "
        >
          İptal
        </button>
      </footer>
    </div>
  );
}
