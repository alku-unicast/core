import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor, X } from "lucide-react";
import { useSettingsStore } from "../../stores/settingsStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function LinuxWarningModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { setHideLinuxWindowWarning } = useSettingsStore();
  const [dontShow, setDontShow] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShow) setHideLinuxWindowWarning(true);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease]"
      onClick={(e) => e.target === e.currentTarget && handleConfirm()}
    >
      <div className="w-[360px] max-w-[90vw] rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-2xl animate-[slideUp_0.2s_cubic-bezier(0.34,1.56,0.64,1)]">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/25 text-amber-400">
            <Monitor size={20} />
          </div>
          <button
            onClick={handleConfirm}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">
          {t("linux_warning.title")}
        </h2>
        <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">
          {t("linux_warning.description_prefix")}{" "}
          <span className="font-bold text-[var(--text-primary)] uppercase">
            {t("linux_warning.description_emphasis")}
          </span>
          {". "}{t("linux_warning.description_suffix")}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
            />
            {t("linux_warning.dont_show_again")}
          </label>
          <button
            onClick={handleConfirm}
            className="
              px-4 py-2 rounded-xl text-sm font-medium text-white
              bg-[var(--accent)] hover:bg-[var(--accent-hover)]
              active:scale-[0.97] transition-all duration-150
            "
          >
            {t("linux_warning.understood")}
          </button>
        </div>
      </div>
    </div>
  );
}
