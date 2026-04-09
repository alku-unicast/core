import { NetworkQuality } from "../../types/stream";

interface NetworkQualityDotProps {
  quality: NetworkQuality;
  rtt: number | null;
}

const QUALITY_CONFIG: Record<
  NetworkQuality,
  { color: string; label: string; pulse: boolean }
> = {
  excellent: { color: "#22c55e", label: "Mükemmel",  pulse: false },
  good:      { color: "#eab308", label: "İyi",        pulse: false },
  degraded:  { color: "#f97316", label: "Zayıf",      pulse: true  },
  poor:      { color: "#ef4444", label: "Kötü",       pulse: true  },
  lost:      { color: "#6b7280", label: "Bağlantı Yok", pulse: true },
};

export function NetworkQualityDot({ quality, rtt }: NetworkQualityDotProps) {
  const cfg = QUALITY_CONFIG[quality] ?? QUALITY_CONFIG.lost;
  const rttLabel = rtt !== null && rtt > 0 ? ` (${rtt}ms)` : "";

  return (
    <div
      className="relative flex items-center justify-center w-5 h-5 shrink-0"
      title={`Ağ Kalitesi: ${cfg.label}${rttLabel}`}
    >
      {/* Pulse ring (only for bad states) */}
      {cfg.pulse && (
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-50"
          style={{ backgroundColor: cfg.color }}
        />
      )}
      {/* Core dot */}
      <span
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: cfg.color }}
      />
    </div>
  );
}
