import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Radio, Wifi, Square, Volume2, Monitor } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";

import { useConnectionStore } from "../stores/connectionStore";
import { useSystemStore }     from "../stores/systemStore";
import { useSettingsStore }   from "../stores/settingsStore";
import { LinuxWarningModal }  from "../components/modals/LinuxWarningModal";
import { isMacOS }            from "../utils/platform";

import { StreamModeSelector }   from "../components/connection/StreamModeSelector";
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
    pinLockedUntil,
    streamError,
    audioEnabled,
    streamMode,
    submitPIN,
    startStream,
    setPhase,
    switchStreamMode,
    stopStream,
    reset,
    resetStream,
    isRestarting,
    isMuted,
  } = useConnectionStore();

  const isStreaming = phase === "streaming";
  const isAuthenticating = phase === "authenticating";
  const mac = isMacOS();

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

  const { profiles, audio: globalAudio, encoder, updateSettings, hideLinuxWindowWarning } = useSettingsStore();

  /* ── Local UI state ──────────────────────────────────────────────────────── */
  const [pin, setPin]                   = useState("");
  const [windowsLoading, setWindowsLoading] = useState(false);
  const [waking, setWaking]             = useState(false);
  const [linuxWarningOpen, setLinuxWarningOpen] = useState(false);

  /* ── Bootstrap on mount ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!targetRoom) {
      navigate("/", { replace: true });
      return;
    }

    // Sequential to prevent concurrent Rust Mutex lock errors
    const bootstrap = async () => {
      await refreshMonitors();
      if (!isMacOS()) {
        await handleRefreshWindows();    // skip on macOS (window mode disabled)
      }
      if (!encoder.detected) {
        detectEncoder();                  // fire-and-forget, non-blocking
      }
      wakeAndProgress();                  // UDP wake — also non-blocking
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── stream-stopped Tauri event: re-show main window ────────────────────── */
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<{ reason: string }>("stream-stopped", async (event) => {
        // Re-show main window (it was hidden when stream started)
        try {
          const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          const win = getCurrentWebviewWindow();
          await win.show();
          await win.setFocus();
        } catch (e) {
          console.warn("[ConnectionSetup] Could not re-show main window:", e);
        }

        // Hide streaming bar if visible
        try {
          const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          const bar = await WebviewWindow.getByLabel("streaming-bar");
          if (bar) await bar.hide();
        } catch (_) {}

        if (event.payload.reason === "error") {
          // Always unmute speakers on crash — mute_system_audio(false) is only
          // called in stopStream(), not in resetStream(), so we do it here.
          invoke("mute_system_audio", { mute: false }).catch(() => {});

          // Linux window-mode auto-restart logic
          const { attemptAutoRestart, resetStream } = useConnectionStore.getState();
          const isLinux = /linux/i.test(navigator.userAgent);
          const isWindow = useConnectionStore.getState().streamMode === "window";

          if (isLinux && isWindow) {
            attemptAutoRestart();
          } else {
            resetStream("Stream stopped unexpectedly. Please try reconnecting.");
          }
        } else {
          reset();
          navigate("/", { replace: true });
        }

        // Refresh room list so Pi's new status (idle) appears quickly.
        // Delay 3s: gives Pi time to receive STOP and update Firebase.
        // Delay 7s: fallback if STOP was delayed (heartbeat timeout path = 5s).
        setTimeout(async () => {
          const { refreshRoomsNow } = await import("../services/roomService");
          refreshRoomsNow();
        }, 3000);
        setTimeout(async () => {
          const { refreshRoomsNow } = await import("../services/roomService");
          refreshRoomsNow();
        }, 7000);
      }).then((fn) => { unlisten = fn; });
    });

    return () => { unlisten?.(); };
  }, [navigate, reset, resetStream]);

  /* ── Linux window-mode warning modal ────────────────────────────────────── */
  useEffect(() => {
    const isLinux = /linux/i.test(navigator.userAgent);
    if (isLinux && streamMode === "window" && !hideLinuxWindowWarning) {
      setLinuxWarningOpen(true);
    } else {
      setLinuxWarningOpen(false);
    }
  }, [streamMode, hideLinuxWindowWarning]);

  /* ── macOS: force fullscreen (window mode unsupported) ──────────────────── */
  useEffect(() => {
    if (isMacOS() && streamMode === "window") {
      switchStreamMode("fullscreen");
    }
  }, [streamMode, switchStreamMode]);

  /* ── Block browser history back ────────────────────────────────────────── */
  useEffect(() => {
    // Push a dummy state to history to enable popstate interception
    window.history.pushState(null, "", window.location.href);

    const handlePopState = () => {
      // Re-push dummy state to stay on current page
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

    const isWindow = streamMode === "window";
    const config: StreamConfig = {
      targetIp:      targetRoom!.ip,
      resolution:    currentProfile.resolution,
      fps:           currentProfile.fps,
      bitrate:       currentProfile.bitrate,
      delayBufferMs: currentProfile.delayBufferMs,
      encoderName,
      streamMode,
      qualityMode:   mode,
      windowId:      isWindow ? selectedWindow?.id : undefined,
      monitorIndex:  streamMode === "fullscreen" ? selectedMonitorIndex : undefined,
      audioEnabled:  mac ? false : currentProfile.audioEnabled,
      audioDeviceId: globalAudio.deviceId,
      muteLocal:     mac ? false : globalAudio.muteLocal,
      // macOS: physical-pixel bounds for videocrop
      windowX:  isWindow ? selectedWindow?.x : undefined,
      windowY:  isWindow ? selectedWindow?.y : undefined,
      windowW:  isWindow ? selectedWindow?.w : undefined,
      windowH:  isWindow ? selectedWindow?.h : undefined,
      screenW:  isWindow ? selectedWindow?.screenW : undefined,
      screenH:  isWindow ? selectedWindow?.screenH : undefined,
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
  const isLocked    = !!pinLockedUntil && Date.now() < pinLockedUntil;
  const pinDisabled = isAuthenticating || isStreaming || (phase === "waking") || isLocked;

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">

      {/* ── Linux window-mode warning modal ──────────────────────────────── */}
      <LinuxWarningModal
        isOpen={linuxWarningOpen}
        onClose={() => setLinuxWarningOpen(false)}
      />

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
        {!isStreaming && (
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
        )}

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
      <main className="flex-1 min-h-0 overflow-y-auto px-5 py-2 flex flex-col gap-2">

        {/* ── Progress indicator ─────────────────────────────────────────── */}
        <section className="flex justify-center pt-2">
          <ConnectionProgress phase={phase} />
        </section>

        {/* ── Stream error banner ────────────────────────────────────────── */}
        {streamError && (
          <section className={`
            ${isRestarting ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'} 
            rounded-xl px-4 py-3 flex gap-3 items-start transition-colors duration-300
          `}>
            {isRestarting ? (
              <div className="w-4 h-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin mt-0.5 shrink-0" />
            ) : (
              <span className="text-red-400 text-base leading-none mt-0.5">✕</span>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isRestarting ? 'text-amber-500' : 'text-red-400'} mb-0.5`}>
                {isRestarting ? t("connection.restarting_title") : t("connection.error_title")}
              </p>
              <p className={`text-xs ${isRestarting ? 'text-amber-500/70' : 'text-red-400/70'} break-words`}>{streamError}</p>
            </div>
          </section>
        )}

        {/* ── Stream mode selection — hidden while streaming ─────────── */}
        {!isStreaming && (
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
              hideWindow={mac}
            />
          </section>
        )}

        {/* ── PIN entry or Streaming Active ─────────────────────────────────── */}
        {isStreaming ? (
          <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center justify-center gap-4 h-auto min-h-[240px]">
            <div className="w-16 h-16 rounded-[2rem] bg-[var(--status-streaming)] flex items-center justify-center animate-[pulse_2s_ease-in-out_infinite] shadow-lg shadow-[var(--status-streaming)]/20 my-2 shrink-0">
              <Wifi size={28} className="text-white" />
            </div>
            
            <div className="text-center mb-1">
              <h2 className="text-lg font-semibold text-[var(--accent)] mb-1">
                {t("connection.streaming")}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                {t("connection.streaming_subtitle")}
              </p>
            </div>
 
            {/* UI Parity: Simple controls when mini-bar is disabled */}
            {!useSettingsStore.getState().streamingBar.enabled && audioEnabled && (
               <div className="w-full max-w-xs flex items-center gap-4 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border)] shrink-0">
                  <div className="flex items-center gap-2 flex-1">
                     <Volume2 size={14} className="text-[var(--text-muted)]" />
                     <input 
                       type="range"
                       min={0} max={1} step={0.01}
                       value={isMuted ? 0 : useConnectionStore.getState().streamVolume}
                       className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
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
              {t("connection.stop_stream")}
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
              lockedUntil={pinLockedUntil}
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
                      <span>{t("connection.presentation_button")}</span>
                    </div>
                  )}
                  <span className="text-[9px] opacity-75 font-normal">{t("connection.max_clarity")} | {profiles.presentation.fps} FPS</span>
                </button>

                {/* Presentation Audio Toggle — hidden on macOS */}
                {!mac && (
                  <button
                    onClick={() => toggleProfileAudio("presentation")}
                    className={`
                      w-12 px-2 rounded-xl border border-[var(--border)] flex flex-col items-center justify-center gap-1
                      transition-colors duration-200
                      ${profiles.presentation.audioEnabled ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}
                    `}
                    title={t("connection.audio_presentation_title")}
                  >
                    <Volume2 size={16} className={profiles.presentation.audioEnabled ? "opacity-100" : "opacity-40"} />
                    <span className="text-[8px] font-bold">{profiles.presentation.audioEnabled ? t("connection.audio_on") : t("connection.audio_off")}</span>
                  </button>
                )}
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
                      <span>{t("connection.video_button")}</span>
                    </div>
                  )}
                  <span className="text-[9px] text-[var(--text-muted)] font-normal">{t("connection.smooth_motion")} | {profiles.video.fps} FPS</span>
                </button>

                {/* Video Audio Toggle — hidden on macOS */}
                {!mac && (
                  <button
                    onClick={() => toggleProfileAudio("video")}
                    className={`
                      w-12 px-2 rounded-xl border border-[var(--border)] flex flex-col items-center justify-center gap-1
                      transition-colors duration-200
                      ${profiles.video.audioEnabled ? "bg-green-500/10 border-green-500/30 text-green-500" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}
                    `}
                    title={t("connection.audio_video_title")}
                  >
                    <Volume2 size={16} className={profiles.video.audioEnabled ? "opacity-100" : "opacity-40"} />
                    <span className="text-[8px] font-bold">{profiles.video.audioEnabled ? t("connection.audio_on") : t("connection.audio_off")}</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-[var(--text-muted)] text-center">
              {t("connection.pin_hint")}
            </p>
          </section>
        )}

        {/* ── Encoder info ─────────────────────────────────────────────── */}
        {encoder.detected && (
          <p className="text-center text-[11px] text-[var(--text-muted)]">
            {t("connection.encoder_label")}: {encoder.detected}
          </p>
        )}
      </main>

      {/* ── Cancel footer ────────────────────────────────────────────────── */}
      {!isStreaming && (
        <footer className="px-5 pb-6 pt-3 shrink-0">
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
      )}
    </div>
  );
}
