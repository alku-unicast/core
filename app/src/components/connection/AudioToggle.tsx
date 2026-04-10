import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AudioToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

export function AudioToggle({ enabled, onChange }: AudioToggleProps) {
  const { t } = useTranslation();

  return (
    <button
      id="btn-audio-toggle"
      onClick={() => onChange(!enabled)}
      className={`
        w-full flex items-center justify-between px-4 py-3 rounded-xl border
        transition-all duration-150 cursor-pointer
        ${
          enabled
            ? "bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]"
            : "bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-muted)]"
        }
      `}
    >
      <div className="flex items-center gap-3">
        {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {t("connection.audio_title")}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {enabled ? t("connection.audio_enabled") : t("connection.audio_disabled")}
          </span>
        </div>
      </div>

      {/* Toggle switch */}
      <div
        className={`
          relative w-11 h-6 rounded-full transition-colors duration-200
          ${enabled ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"}
        `}
      >
        <span
          className={`
          absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full shadow-sm
          transition-[left] duration-200
          ${enabled ? "left-[22px]" : "left-[2px]"}
          `}
        />
      </div>
    </button>
  );
}
