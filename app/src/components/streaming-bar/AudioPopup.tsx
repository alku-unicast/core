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
    // Positioned above the audio button
    <div
      ref={popupRef}
      className="
        absolute bottom-[calc(100%+8px)] right-0
        flex flex-col items-center gap-2
        px-3 py-3 rounded-xl
        border shadow-2xl z-50
        w-14
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
      {/* Volume % label */}
      <span className="text-[10px] font-semibold tabular-nums opacity-80">
        {pct}%
      </span>

      {/* Vertical slider — rotated range input */}
      <div className="relative flex items-center justify-center p-0" style={{ height: 80, width: 28 }}>
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
          className="appearance-none cursor-pointer absolute"
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            width: 80,  // The visual height when rotated
            height: 4,  // The visual width when rotated
            accentColor: "var(--bar-text)",
            background: "rgba(255,255,255,0.2)",
            borderRadius: 4,
          }}
          aria-label={t("streaming_bar.volume_hint")}
        />
      </div>

      {/* Mute toggle */}
      <button
        id="btn-popup-mute"
        onClick={onMuteToggle}
        className="
          w-8 h-8 flex items-center justify-center rounded-lg
          transition-colors duration-150
          hover:bg-white/20
        "
        style={{
          background: isMuted ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)",
          color:      isMuted ? "#ef4444" : "var(--bar-text)",
        }}
        title={isMuted ? t("streaming_bar.unmute") : t("streaming_bar.mute")}
      >
        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
