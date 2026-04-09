import { useEffect, useRef, ReactNode } from "react";
import {
  X, Cpu, Volume2, Wifi, LayoutPanelTop, Palette, Info,
  RefreshCw, ChevronRight,
} from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSystemStore }   from "../../stores/systemStore";

interface SettingsModalProps {
  onClose: () => void;
}

// ─── Nav sections ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "stream",  label: "Yayın",          icon: <Cpu size={15} /> },
  { id: "audio",   label: "Ses",            icon: <Volume2 size={15} /> },
  { id: "network", label: "Ağ",             icon: <Wifi size={15} /> },
  { id: "bar",     label: "Kontrol Çubuğu", icon: <LayoutPanelTop size={15} /> },
  { id: "appear",  label: "Görünüm",        icon: <Palette size={15} /> },
  { id: "about",   label: "Hakkında",       icon: <Info size={15} /> },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Main Modal ───────────────────────────────────────────────────────────────

export function SettingsModal({ onClose }: SettingsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

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

  // ── Apply theme change immediately ─────────────────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appearance.mainTheme);
  }, [appearance.mainTheme]);

  // ── Section scroll refs ────────────────────────────────────────────────────
  const sectionRefs: Record<SectionId, React.RefObject<HTMLDivElement>> = {
    stream:  useRef<HTMLDivElement>(null),
    audio:   useRef<HTMLDivElement>(null),
    network: useRef<HTMLDivElement>(null),
    bar:     useRef<HTMLDivElement>(null),
    appear:  useRef<HTMLDivElement>(null),
    about:   useRef<HTMLDivElement>(null),
  };

  const scrollTo = (id: SectionId) => {
    sectionRefs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const encoderName = detectedEncoder?.name ?? encoder.detected ?? null;
  const encoderType = detectedEncoder?.hwType ?? null;

  const encoderLabel = encoderName
    ? `${encoderName}${encoderType ? ` (${encoderType})` : ""}`
    : "Algılanmadı";

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
          animate-in
        "
        style={{ animation: "modal-in 0.18s ease-out" }}
      >
        {/* ── Left nav ───────────────────────────────────────────────────── */}
        <nav className="w-44 shrink-0 bg-[var(--bg-secondary)] border-r border-[var(--border)] py-4 flex flex-col gap-0.5 px-2">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Ayarlar
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
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Ayarlar</h2>
            <button
              id="btn-settings-close"
              onClick={onClose}
              className="
                w-8 h-8 flex items-center justify-center rounded-lg
                text-[var(--text-muted)] hover:text-[var(--text-primary)]
                hover:bg-[var(--bg-tertiary)] transition-colors duration-100
              "
              aria-label="Kapat"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-8 scrollbar-none">

            {/* ── 1. Yayın ─────────────────────────────────────────────── */}
            <Section ref={sectionRefs.stream} title="Yayın" icon={<Cpu size={15} />}>

              {/* Resolution */}
              <SettingRow label="Çözünürlük" description="Video kalitesi">
                <Select
                  id="select-resolution"
                  value={stream.resolution}
                  onChange={(v) => updateSettings({ stream: { ...stream, resolution: v as any } })}
                  options={[
                    { value: "1080p", label: "1080p — Tam HD" },
                    { value: "720p",  label: "720p — HD" },
                    { value: "480p",  label: "480p — SD" },
                  ]}
                />
              </SettingRow>

              {/* FPS */}
              <SettingRow label="Kare Hızı" description="Saniyedeki kare sayısı">
                <Select
                  id="select-fps"
                  value={String(stream.fps)}
                  onChange={(v) => updateSettings({ stream: { ...stream, fps: Number(v) as any } })}
                  options={[
                    { value: "30", label: "30 FPS (Önerilen)" },
                    { value: "20", label: "20 FPS" },
                    { value: "15", label: "15 FPS (Düşük bant)" },
                  ]}
                />
              </SettingRow>

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
                label="Encoder"
                description="H.264 donanım kodlayıcısı"
              >
                <div className="flex items-center gap-2 w-full">
                  <span
                    className={`
                      flex-1 px-3 py-1.5 rounded-lg text-sm font-mono
                      bg-[var(--bg-tertiary)] text-[var(--text-secondary)]
                      ${!encoderName ? "opacity-50" : ""}
                    `}
                  >
                    {encoderLabel}
                  </span>
                  <button
                    id="btn-rescan-encoder"
                    onClick={detectEncoder}
                    disabled={encoderDetecting}
                    title="GPU'nu yeniden tara"
                    className="
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-[var(--accent-subtle)] text-[var(--accent)]
                      hover:bg-[var(--accent)] hover:text-white
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-colors duration-150
                    "
                  >
                    <RefreshCw size={12} className={encoderDetecting ? "animate-spin" : ""} />
                    Tara
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  GPU'nu değiştirdiysen ya da yeni sürücü yüklediysen tekrar tara.
                </p>
              </SettingRow>
            </Section>

            {/* ── 2. Ses ───────────────────────────────────────────────── */}
            <Section ref={sectionRefs.audio} title="Ses" icon={<Volume2 size={15} />}>

              {/* Audio device */}
              <SettingRow label="Ses Kaynağı" description="WASAPI loopback cihazı">
                <Select
                  id="select-audio-device"
                  value={audio.deviceId ?? ""}
                  onChange={(v) =>
                    updateSettings({ audio: { ...audio, deviceId: v || null } })
                  }
                  options={[
                    { value: "", label: "Varsayılan (Sistem)" },
                    ...audioDevices.map((d) => ({
                      value: d.id,
                      label: d.name,
                    })),
                  ]}
                />
              </SettingRow>

              {/* Mute local */}
              <SettingRow
                label="Yayın sırasında hoparlörü kapat"
                description="Ses projektörden çalar; laptop'tan gelmez"
              >
                <Toggle
                  id="toggle-mute-local"
                  value={audio.muteLocal}
                  onChange={(v) => updateSettings({ audio: { ...audio, muteLocal: v } })}
                />
              </SettingRow>

              <InfoBox>
                WASAPI Loopback: Ses mikserin çıkışından alınır — hoparlör sessize alınsa bile
                GStreamer yakalamaya devam eder.
              </InfoBox>
            </Section>

            {/* ── 3. Ağ ────────────────────────────────────────────────── */}
            <Section ref={sectionRefs.network} title="Ağ" icon={<Wifi size={15} />}>
              <SettingRow
                label="Senkronizasyon Tamponu"
                description="Ağ titreşimini telafi eder (ms)"
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
                Varsayılan: 74ms. Ağda gecikme yaşanıyorsa artırabilirsin; düşük gecikme
                istiyorsan azalt.
              </InfoBox>
            </Section>

            {/* ── 4. Kontrol Çubuğu ────────────────────────────────────── */}
            <Section ref={sectionRefs.bar} title="Kontrol Çubuğu" icon={<LayoutPanelTop size={15} />}>

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
                    { value: "translucent-dark", label: "Şeffaf Koyu (Önerilen)" },
                    { value: "dark",             label: "Koyu" },
                    { value: "light",            label: "Açık" },
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

            {/* ── 5. Görünüm ───────────────────────────────────────────── */}
            <Section ref={sectionRefs.appear} title="Görünüm" icon={<Palette size={15} />}>
              <SettingRow label="Uygulama Teması" description="Ana pencere teması">
                <div className="grid grid-cols-2 gap-2 w-full">
                  {(["light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      id={`btn-theme-${t}`}
                      onClick={() =>
                        updateSettings({ appearance: { ...appearance, mainTheme: t } })
                      }
                      className={`
                        py-2 rounded-xl border-2 text-sm font-medium transition-all duration-150
                        ${
                          appearance.mainTheme === t
                            ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                            : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-hover)]"
                        }
                      `}
                    >
                      {t === "light" ? "☀️ Açık" : "🌙 Koyu"}
                    </button>
                  ))}
                </div>
              </SettingRow>
            </Section>

            {/* ── 6. Hakkında ──────────────────────────────────────────── */}
            <Section ref={sectionRefs.about} title="Hakkında" icon={<Info size={15} />}>
              <div className="flex flex-col gap-3 text-sm">
                <AboutRow label="Uygulama"  value="UniCast" />
                <AboutRow label="Sürüm"     value="0.1.0" />
                <AboutRow label="Platform"  value="Tauri v2 + React 18" />
                <AboutRow label="Üniversite" value="Alanya Alaaddin Keykubat Üniversitesi (ALKÜ)" />
                <AboutRow label="Lisans"    value="Akademik Proje — Okul İçi Kullanım" />
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
          absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200
          ${value ? "translate-x-5" : "translate-x-0.5"}
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

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-[var(--border)] last:border-0">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-primary)] font-medium">{value}</span>
    </div>
  );
}
