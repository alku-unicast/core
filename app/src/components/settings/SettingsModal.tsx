import { useEffect, useRef, useState, ReactNode, useMemo } from "react";
import {
  X, Cpu, Volume2, LayoutPanelTop, Info,
  RefreshCw, ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSystemStore }   from "../../stores/systemStore";
import unicastLogo from "../../assets/UniCast.png";
import alkuLogo    from "../../assets/alku-yatay-logo-rgb.png";

interface SettingsModalProps {
  onClose: () => void;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const SECTIONS = useMemo(() => [
    { id: "stream",  label: t("settings.tabs.stream"),  icon: <Cpu size={15} /> },
    { id: "audio",   label: t("settings.tabs.audio"),   icon: <Volume2 size={15} /> },
    { id: "bar",     label: t("settings.tabs.appearance"), icon: <LayoutPanelTop size={15} /> },
    { id: "about",   label: t("settings.tabs.about"),   icon: <Info size={15} /> },
  ] as const, [t]);

  type SectionId = (typeof SECTIONS)[number]["id"];

  // ── Stores ─────────────────────────────────────────────────────────────────
  const {
    stream, audio, encoder, appearance, streamingBar,
    updateSettings,
  } = useSettingsStore();

  const {
    detectedEncoder, encoderDetecting, audioDevices,
    detectEncoder, refreshAudioDevices,
  } = useSystemStore();

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    refreshAudioDevices();
  }, []);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // ── Section scroll refs ────────────────────────────────────────────────────
  const sectionRefs: Record<SectionId, React.RefObject<HTMLDivElement>> = {
    stream:  useRef<HTMLDivElement>(null),
    audio:   useRef<HTMLDivElement>(null),
    bar:     useRef<HTMLDivElement>(null),
    about:   useRef<HTMLDivElement>(null),
  };

  const scrollTo = (id: SectionId) => {
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const encoderName = detectedEncoder?.name ?? encoder.detected ?? null;
  const encoderType = detectedEncoder?.hwType ?? null;

  const encoderLabel = encoderName
    ? t("settings.stream.detected", { name: `${encoderName}${encoderType ? ` (${encoderType})` : ""}` })
    : t("settings.stream.not_detected");

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        id="settings-modal"
        className="
          bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-2xl
          w-[600px] max-h-[78vh] flex overflow-hidden
        "
        style={{ animation: "modal-in 0.18s ease-out" }}
      >
        {/* ── Left nav ───────────────────────────────────────────────────── */}
        <nav className="w-44 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] py-4 flex flex-col gap-0.5 px-2">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t("settings.title")}
          </p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              id={`settings-nav-${s.id}`}
              onClick={() => scrollTo(s.id)}
              className="
                flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                hover:bg-[var(--bg-tertiary)] transition-colors duration-100 text-left
              "
            >
              <span className="text-[var(--accent)] shrink-0">{s.icon}</span>
              {s.label}
              <ChevronRight size={12} className="ml-auto opacity-40" />
            </button>
          ))}
        </nav>

        {/* ── Right content ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("settings.title")}</h2>
            <button
              id="btn-settings-close"
              onClick={onClose}
              className="
                w-8 h-8 flex items-center justify-center rounded-lg
                text-[var(--text-muted)] hover:text-[var(--text-primary)]
                hover:bg-[var(--bg-tertiary)] transition-colors duration-100
              "
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-8 scrollbar-none">

            {/* ── 1. Yayın ─────────────────────────────────────────────── */}
            <Section ref={sectionRefs.stream} title={t("settings.tabs.stream")} icon={<Cpu size={15} />}>

              {/* Resolution */}
              <SettingRow label={t("settings.stream.resolution")} description="Video kalitesi">
                <Select
                  id="select-resolution"
                  value={stream.resolution}
                  onChange={(v) => updateSettings({ stream: { ...stream, resolution: v as any } })}
                  options={[
                    { value: "1080p", label: "1080p — Full HD" },
                    { value: "720p",  label: "720p — HD" },
                    { value: "480p",  label: "480p — SD" },
                  ]}
                />
              </SettingRow>

              {/* FPS */}
              <SettingRow label={t("settings.stream.fps")} description="Saniyedeki kare sayısı">
                <Select
                  id="select-fps"
                  value={String(stream.fps)}
                  onChange={(v) => updateSettings({ stream: { ...stream, fps: Number(v) as any } })}
                  options={[
                    { value: "30", label: "30 FPS" },
                    { value: "20", label: "20 FPS" },
                    { value: "15", label: "15 FPS" },
                  ]}
                />
              </SettingRow>

              {/* ── Gelişmiş ── */}
              <div className="flex flex-col gap-0">
                <button
                  id="btn-advanced-toggle"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="
                    flex items-center gap-1.5 text-xs font-medium
                    text-[var(--accent)] hover:opacity-80
                    transition-opacity duration-150 self-start py-1
                  "
                >
                  {advancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {t("settings.stream.advanced")}
                </button>

                {advancedOpen && (
                  <div className="flex flex-col gap-4 mt-3 pl-3 border-l-2 border-[var(--border)]">

                    {/* Bitrate */}
                    <SettingRow
                      label="Bit Hızı"
                      description={`${stream.bitrate.toLocaleString()} kbps`}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <span className="text-xs text-[var(--text-muted)] shrink-0">1000</span>
                        <input
                          id="slider-bitrate"
                          type="range"
                          min={1000}
                          max={8000}
                          step={500}
                          value={stream.bitrate}
                          onChange={(e) =>
                            updateSettings({ stream: { ...stream, bitrate: Number(e.target.value) } })
                          }
                          className="flex-1 accent-[var(--accent)]"
                        />
                        <span className="text-xs text-[var(--text-muted)] shrink-0">8000</span>
                      </div>
                    </SettingRow>

                    {/* Encoder */}
                    <SettingRow
                      label={t("settings.stream.encoder")}
                      description="H.264 hardware encoder"
                    >
                      <div className="flex items-center gap-2 w-full max-w-[200px]">
                        <span
                          className={`
                            flex-1 px-3 py-1.5 rounded-lg text-[11px] font-mono truncate
                            bg-[var(--bg-tertiary)] text-[var(--text-secondary)]
                            ${!encoderName ? "opacity-50" : ""}
                          `}
                          title={encoderLabel}
                        >
                          {encoderLabel}
                        </span>
                        <button
                          id="btn-rescan-encoder"
                          onClick={detectEncoder}
                          disabled={encoderDetecting}
                          title={t("settings.stream.scan")}
                          className="
                            flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium shrink-0
                            bg-[var(--accent-subtle)] text-[var(--accent)]
                            hover:bg-[var(--accent)] hover:text-white
                            disabled:opacity-40 disabled:cursor-not-allowed
                            transition-colors duration-150
                          "
                        >
                          <RefreshCw size={11} className={encoderDetecting ? "animate-spin" : ""} />
                          {t("settings.stream.scan")}
                        </button>
                      </div>
                    </SettingRow>

                    {/* Delay Buffer */}
                    <SettingRow
                      label={t("settings.network.buffer")}
                      description="Ağ titreşimini telafi eder"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          id="input-delay-buffer"
                          type="number"
                          min={0}
                          max={500}
                          step={10}
                          value={stream.delayBufferMs}
                          onChange={(e) =>
                            updateSettings({
                              stream: { ...stream, delayBufferMs: Number(e.target.value) },
                            })
                          }
                          className="
                            w-24 px-3 py-1.5 rounded-lg border border-[var(--border)]
                            bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]
                            focus:outline-none focus:border-[var(--accent)]
                            transition-colors duration-150
                          "
                        />
                        <span className="text-sm text-[var(--text-muted)]">ms</span>
                      </div>
                    </SettingRow>

                    <InfoBox>
                      {t("settings.network.buffer_desc", "Default: 74ms. Increase if you experience lag; decrease for lowest possible delay.")}
                    </InfoBox>
                  </div>
                )}
              </div>
            </Section>

            {/* ── 2. Ses ───────────────────────────────────────────────── */}
            <Section ref={sectionRefs.audio} title={t("settings.tabs.audio")} icon={<Volume2 size={15} />}>

              {/* Audio device */}
              <SettingRow label={t("settings.audio.device")} description="WASAPI loopback source">
                <Select
                  id="select-audio-device"
                  value={audio.deviceId ?? ""}
                  onChange={(v) =>
                    updateSettings({ audio: { ...audio, deviceId: v || null } })
                  }
                  options={[
                    { value: "", label: "System Default" },
                    ...audioDevices.map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                />
              </SettingRow>

              {/* Mute local */}
              <SettingRow
                label={t("settings.audio.mute_local")}
                description="Audio plays on projector only"
              >
                <Toggle
                  id="toggle-mute-local"
                  value={audio.muteLocal}
                  onChange={(v) => updateSettings({ audio: { ...audio, muteLocal: v } })}
                />
              </SettingRow>

              <InfoBox>
                {t("settings.audio.info", "WASAPI Loopback: Audio is captured from mixer output — GStreamer continues to capture even if speaker is muted.")}
              </InfoBox>
            </Section>

            {/* ── 3. Kontrol Çubuğu ────────────────────────────────────── */}
            <Section ref={sectionRefs.bar} title={t("settings.tabs.appearance")} icon={<LayoutPanelTop size={15} />}>

              <SettingRow
                label="Kontrol çubuğunu göster"
                description="Yayın sırasında ekranda küçük widget"
              >
                <Toggle
                  id="toggle-streaming-bar"
                  value={streamingBar.enabled}
                  onChange={(v) => updateSettings({ streamingBar: { enabled: v } })}
                />
              </SettingRow>

              <SettingRow label="Çubuk Teması" description="Bağımsız tema">
                <Select
                  id="select-bar-theme"
                  value={appearance.barTheme}
                  onChange={(v) =>
                    updateSettings({
                      appearance: { ...appearance, barTheme: v as any },
                    })
                  }
                  options={[
                    { value: "translucent-dark", label: "Translucent Dark" },
                    { value: "dark",             label: "Dark" },
                    { value: "light",            label: "Light" },
                  ]}
                />
              </SettingRow>

              <SettingRow
                label="Saydamlık"
                description={`%${Math.round(appearance.barOpacity * 100)}`}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-xs text-[var(--text-muted)] shrink-0">%50</span>
                  <input
                    id="slider-bar-opacity"
                    type="range"
                    min={50}
                    max={100}
                    step={5}
                    value={Math.round(appearance.barOpacity * 100)}
                    onChange={(e) =>
                      updateSettings({
                        appearance: {
                          ...appearance,
                          barOpacity: Number(e.target.value) / 100,
                        },
                      })
                    }
                    className="flex-1 accent-[var(--accent)]"
                  />
                  <span className="text-xs text-[var(--text-muted)] shrink-0">%100</span>
                </div>
              </SettingRow>
            </Section>

            {/* ── 4. Hakkında ──────────────────────────────────────────── */}
            <Section ref={sectionRefs.about} title={t("settings.tabs.about")} icon={<Info size={15} />}>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Application</span>
                  <span className="text-[var(--text-primary)] font-medium">UniCast</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">{t("settings.about.version", "Version")}</span>
                  <span className="text-[var(--text-primary)] font-medium">0.1.0</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">University</span>
                  <span className="text-[var(--text-primary)] font-medium text-right leading-snug">
                    {t("settings.about.university")}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">License</span>
                  <span className="text-[var(--text-primary)] font-medium">Academic Project</span>
                </div>

                {/* GitHub link */}
                <a
                  id="link-github"
                  href="https://github.com/alku-unicast/core"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex items-center justify-center gap-2 mt-1 py-2 rounded-xl
                    border border-[var(--border)] text-xs text-[var(--text-muted)]
                    hover:border-[var(--accent)] hover:text-[var(--accent)]
                    transition-colors duration-150
                  "
                >
                  <ExternalLink size={12} />
                  {t("settings.about.repo")}
                </a>

                {/* Logos */}
                <div className="flex items-center justify-center gap-6 mt-3 pt-3 border-t border-[var(--border)]">
                  <img
                    src={unicastLogo}
                    alt="UniCast"
                    className="h-10 object-contain opacity-90"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="w-px h-8 bg-[var(--border)]" />
                  <img
                    src={alkuLogo}
                    alt="ALKÜ"
                    className="h-8 object-contain opacity-90"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              </div>
            </Section>

            {/* Bottom padding */}
            <div className="h-4" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(6px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

import { forwardRef } from "react";

const Section = forwardRef<
  HTMLDivElement,
  { title: string; icon: ReactNode; children: ReactNode }
>(({ title, icon, children }, ref) => (
  <div ref={ref} className="flex flex-col gap-4">
    <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
      <span className="text-[var(--accent)]">{icon}</span>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
    </div>
    {children}
  </div>
));
Section.displayName = "Section";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {description && (
          <span className="text-xs text-[var(--text-muted)] leading-snug">{description}</span>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">{children}</div>
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="
        px-3 py-1.5 rounded-lg border border-[var(--border)]
        bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)]
        focus:outline-none focus:border-[var(--accent)]
        transition-colors duration-150 cursor-pointer
        min-w-[160px]
      "
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  id,
  value,
  onChange,
}: {
  id: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      className={`
        relative w-11 h-6 rounded-full transition-colors duration-200
        ${value ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"}
      `}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`
          absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full shadow-sm
          transition-[left] duration-200
          ${value ? "left-[22px]" : "left-[2px]"}
        `}
      />
    </button>
  );
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-[var(--accent-subtle)] text-[11px] text-[var(--text-secondary)] leading-relaxed">
      {children}
    </div>
  );
}
