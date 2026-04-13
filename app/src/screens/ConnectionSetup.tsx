import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Wifi, Square, Volume2, Monitor } from "lucide-react";
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
    stopStream,
    reset,
  } = useConnectionStore();

  const isStreaming = phase === "streaming";
  const isAuthenticating = phase === "authenticating";

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

  const { profiles, audio: globalAudio, encoder, updateSettings } = useSettingsStore();

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

  /* ── Wake Projeksiyon HDMI ────────────────────────────────────────────────── */
  const wakeAndProgress = useCallback(async () => {
    if (!targetRoom) return;
    setWaking(true);
    try {
      await invoke<boolean>("wake_pi_hdmi", { targetIp: targetRoom.ip });
      setPhase("hdmi_ready");
      // Brief pause so user can see HDMI Ready step
      await new Promise((r) => setTimeout(r, 800));
    } catch (_) {
      // Non-fatal — device might already be awake
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

  /* ── Persistent profile update ── */
  const toggleProfileAudio = (mode: "presentation" | "video") => {
    updateSettings({
      profiles: {
        ...profiles,
        [mode]: { ...profiles[mode], audioEnabled: !profiles[mode].audioEnabled }
      }
    });
  };

  /* ── PIN submit with Mode ────────────────────────────────────────────────── */
  const handlePINSubmitWithMode = useCallback(async (mode: "presentation" | "video") => {
    if (pin.length !== 4 || phase === "authenticating") return;

    const currentProfile = profiles[mode];
    const encoderName = detectedEncoder?.name ?? encoder.detected ?? "x264enc";

    const config: StreamConfig = {
      targetIp:      targetRoom!.ip,
      resolution:    currentProfile.resolution,
      fps:           currentProfile.fps,
      bitrate:       currentProfile.bitrate,
      delayBufferMs: currentProfile.delayBufferMs,
      encoderName,
      streamMode,
      qualityMode:   mode,
      windowId:      streamMode === "window" ? selectedWindow?.id : undefined,
      monitorIndex:  streamMode === "fullscreen" ? selectedMonitorIndex : undefined,
      audioEnabled:  currentProfile.audioEnabled,
      audioDeviceId: globalAudio.deviceId,
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
    profiles, globalAudio, encoder, detectedEncoder,
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
  const pinDisabled      = isAuthenticating || isStreaming || (phase === "waking");

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
                : phase === "waking" || waking
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
                  : phase === "waking" || waking
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

        {/* ── Stream mode selection ──────────────────────────────────── */}
        <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-4">
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
        </section>

        {/* ── PIN entry or Streaming Active ─────────────────────────────────── */}
        {isStreaming ? (
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center justify-center gap-5 min-h-[220px]">
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

            {/* UI Parity: Simple controls when mini-bar is disabled */}
            {!useSettingsStore.getState().streamingBar.enabled && (
               <div className="w-full max-w-xs flex items-center gap-4 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)]">
                  <div className="flex items-center gap-2 flex-1">
                     <Volume2 size={14} className="text-[var(--text-muted)]" />
                     <input 
                       type="range"
                       min={0} max={1} step={0.01}
                       className="w-full h-1.5 accent-[var(--accent)]"
                       onChange={(e) => useConnectionStore.getState().setStreamVolume(Number(e.target.value))}
                     />
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Ağ Durumu: Harika" />
               </div>
            )}

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
            <PINEntry
              value={pin}
              onChange={setPin}
              onSubmit={() => {}} // Handle via mode buttons
              error={pinError}
              disabled={pinDisabled}
            />

            {/* Dual Mode Buttons with Persistent Audio Switches */}
            <div className="w-full flex flex-col gap-3">
              <div className="flex items-stretch gap-2">
                <button
                  id="btn-start-presentation"
                  onClick={() => handlePINSubmitWithMode("presentation")}
                  disabled={pin.length < 4 || pinDisabled || (streamMode === "window" && !selectedWindow)}
                  className="
                    flex-1 py-4 rounded-xl font-semibold text-xs
                    bg-[var(--accent)] text-white
                    hover:bg-[var(--accent-hover)] active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-150 shadow-lg shadow-[var(--accent)]/20
                    flex flex-col items-center gap-1
                  "
                >
                  {isAuthenticating ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Monitor size={16} />
                      <span>SUNUM OLARAK BAŞLAT</span>
                    </div>
                  )}
                  <span className="text-[9px] opacity-75 font-normal">Maksimum Keskinlik | {profiles.presentation.fps} FPS</span>
                </button>

                {/* Presentation Audio Toggle */}
                <button
                  onClick={() => toggleProfileAudio("presentation")}
                  className={`
                    w-12 px-2 rounded-xl border border-[var(--border)] flex flex-col items-center justify-center gap-1
                    transition-colors duration-200
                    ${profiles.presentation.audioEnabled ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}
                  `}
                  title="Sunumda Ses"
                >
                  <Volume2 size={16} className={profiles.presentation.audioEnabled ? "opacity-100" : "opacity-40"} />
                  <span className="text-[8px] font-bold">{profiles.presentation.audioEnabled ? "AÇIK" : "KAPALI"}</span>
                </button>
              </div>

              <div className="flex items-stretch gap-2">
                <button
                  id="btn-start-video"
                  onClick={() => handlePINSubmitWithMode("video")}
                  disabled={pin.length < 4 || pinDisabled || (streamMode === "window" && !selectedWindow)}
                  className="
                    flex-1 py-4 rounded-xl font-semibold text-xs
                    bg-[var(--bg-tertiary)] text-[var(--text-primary)]
                    border border-[var(--border)]
                    hover:bg-[var(--bg-secondary)] active:scale-[0.98]
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all duration-150
                    flex flex-col items-center gap-1
                  "
                >
                  {isAuthenticating ? (
                    <span className="w-5 h-5 border-2 border-[var(--accent)]/40 border-t-[var(--accent)] rounded-full animate-spin" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Radio size={16} />
                      <span>VİDEO OLARAK BAŞLAT</span>
                    </div>
                  )}
                  <span className="text-[9px] text-[var(--text-muted)] font-normal">Akıcı Hareket | {profiles.video.fps} FPS</span>
                </button>

                {/* Video Audio Toggle */}
                <button
                  onClick={() => toggleProfileAudio("video")}
                  className={`
                    w-12 px-2 rounded-xl border border-[var(--border)] flex flex-col items-center justify-center gap-1
                    transition-colors duration-200
                    ${profiles.video.audioEnabled ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}
                  `}
                  title="Videoda Ses"
                >
                  <Volume2 size={16} className={profiles.video.audioEnabled ? "opacity-100" : "opacity-40"} />
                  <span className="text-[8px] font-bold">{profiles.video.audioEnabled ? "AÇIK" : "KAPALI"}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] text-center">
              Lütfen projeksiyon ekranında gördüğünüz 4 haneli PIN kodunu girin.
            </p>
          </section>
        )}

        {/* ── Encoder info ─────────────────────────────────────────────── */}
        {encoder.detected && (
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            Kodlayıcı: {encoder.detected}
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
