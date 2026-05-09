import { useEffect, useRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AudioPopupProps {
  volume: number;      // 0.0 – 1.0
  isMuted: boolean;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
  onClose: () => void;
}

export function AudioPopup({
  volume,
  isMuted,
  onVolumeChange,
  onMuteToggle,
  onClose,
}: AudioPopupProps) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Use capture so we get the event before anything else
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  const pct = Math.round(isMuted ? 0 : volume * 100);

  return (
    // Positioned above the audio button - updated for 80px window height
    <div
      ref={popupRef}
      className="
        absolute bottom-[calc(100%+8px)] right-[-12px]
        flex items-center gap-3
        px-3 py-2 rounded-xl
        border shadow-2xl z-50
        w-[180px]
      "
      style={{
        background:   "var(--bar-bg)",
        borderColor:  "var(--bar-border)",
        color:        "var(--bar-text)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        // @ts-ignore — Tauri-specific CSS property
        WebkitAppRegion: "no-drag",
      }}
      // Prevent drag from interfering
      data-no-drag="true"
    >
      {/* Mute toggle */}
      <button
        id="btn-popup-mute"
        onClick={onMuteToggle}
        className="
          w-8 h-8 flex items-center justify-center rounded-lg
          transition-colors duration-150
          hover:bg-white/20 shrink-0
        "
        style={{
          background: isMuted ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)",
          color:      isMuted ? "#ef4444" : "var(--bar-text)",
        }}
        title={isMuted ? t("streaming_bar.unmute") : t("streaming_bar.mute")}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>

      {/* Horizontal slider */}
      <div className="flex-1 relative flex items-center h-4">
        <input
          id="bar-volume-slider"
          type="range"
          min={0}
          max={100}
          step={1}
          value={isMuted ? 0 : Math.round(volume * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            onVolumeChange(v);
          }}
          className="appearance-none cursor-pointer w-full"
          style={{
            height: 4,
            accentColor: "var(--accent)",
            background: `linear-gradient(to right, var(--accent) ${pct}%, rgba(255,255,255,0.2) ${pct}%)`,
            borderRadius: 4,
          }}
          aria-label={t("streaming_bar.volume_hint")}
        />
      </div>

      {/* Volume % label */}
      <span className="text-[10px] font-semibold tabular-nums opacity-80 min-w-[28px] text-right">
        {pct}%
      </span>
    </div>
  );
}
