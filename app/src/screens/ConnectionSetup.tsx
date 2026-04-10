import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Wifi, Square } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

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
    if (!targetRoom) {
      navigate("/", { replace: true });
      return;
    }

    // Sequential to prevent concurrent Rust Mutex lock errors
    const bootstrap = async () => {
      await refreshMonitors();
      await handleRefreshWindows();      // monitors done first
      if (!encoder.detected) {
        detectEncoder();                  // fire-and-forget, non-blocking
      }
      wakeAndProgress();                  // UDP wake — also non-blocking
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── stream-stopped Tauri event: re-show main window + go home ───────────── */
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("stream-stopped", async () => {
        // Re-show main window (it was hidden when stream started)
        try {
          const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          const win = getCurrentWebviewWindow();
          await win.show();
          await win.setFocus();
        } catch (e) {
          console.warn("[ConnectionSetup] Could not re-show main window:", e);
        }
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

  /* ── Status Labels ──────────────────────────────────────────────────────── */
  const statusLabel = useMemo(() => ({
    waking:         t("connection.waking"),
    hdmi_ready:     t("connection.hdmi_ready"),
    awaiting_pin:   t("connection.awaiting_pin"),
    authenticating: t("connection.authenticating"),
    streaming:      t("connection.streaming"),
  }), [t]);

  if (!targetRoom) return null;

  /* ── Derived state ───────────────────────────────────────────────────────── */
  const isAuthenticating = phase === "authenticating";
  const isStreaming      = phase === "streaming";
  const pinDisabled      = isAuthenticating || isStreaming || waking;

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
          aria-label={t("common.back")}
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
          {statusLabel[phase as keyof typeof statusLabel] ?? t("common.loading")}
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

        {/* ── PIN entry or Streaming Active ─────────────────────────────────── */}
        {isStreaming ? (
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center justify-center gap-5 min-h-[200px]">
            <div className="w-16 h-16 rounded-[2rem] bg-[var(--status-streaming)] flex items-center justify-center animate-[pulse_2s_ease-in-out_infinite] shadow-lg shadow-[var(--status-streaming)]/20">
              <Wifi size={28} className="text-white" />
            </div>
            
            <div className="text-center">
              <h2 className="text-lg font-semibold text-[var(--accent)] mb-1">
                {t("connection.streaming")}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Yayınınız şu anda projektör ekranına aktarılıyor.
              </p>
            </div>

            <button
              id="btn-stop-stream"
              onClick={() => stopStream()}
              className="
                w-full max-w-xs mt-2 py-3.5 rounded-2xl font-semibold text-sm
                bg-[var(--status-error)] text-white
                hover:opacity-90 active:scale-[0.98]
                transition-all duration-150 shadow-lg shadow-[var(--status-error)]/25
                flex items-center justify-center gap-2
              "
            >
              <Square size={16} className="fill-current" />
              YAYINI DURDUR
            </button>
          </section>
        ) : (
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
                  {t("connection.authenticating")}
                </>
              ) : (
                <>
                  <Wifi size={16} />
                  {t("connection.start_stream")}
                </>
              )}
            </button>

            <p className="text-[11px] text-[var(--text-muted)] text-center">
              {t("connection.pin_placeholder")}
            </p>
          </section>
        )}

        {/* ── Encoder info ─────────────────────────────────────────────── */}
        {encoder.detected && (
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            {t("connection.encoder_info", { name: encoder.detected })}
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
          {t("common.cancel")}
        </button>
      </footer>
    </div>
  );
}
