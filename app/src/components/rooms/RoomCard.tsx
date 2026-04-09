import { Star, Wifi, WifiOff, Cast } from "lucide-react";
import { Room, RoomStatus } from "../../types/room";
import { useSettingsStore } from "../../stores/settingsStore";

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  RoomStatus,
  { dot: string; label: string; pulse: boolean }
> = {
  idle: {
    dot: "bg-[var(--status-idle)]",
    label: "Boş",
    pulse: true,
  },
  streaming: {
    dot: "bg-[var(--status-streaming)]",
    label: "Yayında",
    pulse: false,
  },
  offline: {
    dot: "bg-[var(--status-offline)]",
    label: "Çevrimdışı",
    pulse: false,
  },
};

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: RoomStatus }) {
  const { dot, pulse } = STATUS_CONFIG[status];
  return (
    <span className="relative flex items-center justify-center w-3 h-3">
      {pulse && (
        <span
          className={`absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping ${dot}`}
        />
      )}
      <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${dot}`} />
    </span>
  );
}

// ── RoomCard (full variant) ───────────────────────────────────────────────────

interface RoomCardProps {
  room: Room;
  onConnect: (room: Room) => void;
  variant?: "full" | "compact";
}

export function RoomCard({ room, onConnect, variant = "full" }: RoomCardProps) {
  const { favorites, toggleFavorite } = useSettingsStore();
  const isFavorite = favorites.includes(room.id);
  const { label: statusLabel } = STATUS_CONFIG[room.status];
  const canConnect = room.status === "idle";

  // ── Compact variant (used in FavoritesSection) ─────────────────────────────
  if (variant === "compact") {
    return (
      <div
        id={`room-card-compact-${room.id}`}
        className="
          flex flex-col items-center gap-2 p-3 w-24
          bg-[var(--bg-secondary)] border border-[var(--border)]
          rounded-xl shrink-0 cursor-pointer
          hover:border-[var(--border-hover)] hover:scale-[1.03]
          transition-all duration-150
        "
        onClick={() => canConnect && onConnect(room)}
      >
        <StatusDot status={room.status} />
        <span className="text-sm font-semibold text-[var(--text-primary)] leading-tight text-center">
          {room.label}
        </span>
        <span className="text-[10px] text-[var(--text-muted)]">{statusLabel}</span>
      </div>
    );
  }

  // ── Full variant (used in RoomGrid) ───────────────────────────────────────
  return (
    <div
      id={`room-card-${room.id}`}
      className="
        group relative flex flex-col gap-3 p-4
        bg-[var(--bg-secondary)] border border-[var(--border)]
        rounded-2xl
        hover:border-[var(--border-hover)] hover:shadow-lg hover:scale-[1.02]
        transition-all duration-150
      "
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        {/* Room label */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-bold text-[var(--text-primary)] leading-tight font-mono">
            {room.label}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            Kat {room.floor === "0" ? "Zemin" : room.floor}
          </span>
        </div>

        {/* Favorite star */}
        <button
          id={`btn-favorite-${room.id}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(room.id);
          }}
          className="p-1 rounded-lg hover:bg-[var(--accent-gold-subtle)] transition-colors duration-150"
          title={isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}
        >
          <Star
            size={18}
            className={`transition-colors duration-150 ${
              isFavorite
                ? "fill-[var(--accent-gold)] stroke-[var(--accent-gold)]"
                : "stroke-[var(--text-muted)] group-hover:stroke-[var(--accent-gold)]"
            }`}
          />
        </button>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-2">
        <StatusDot status={room.status} />
        <span
          className={`text-xs font-medium ${
            room.status === "idle"
              ? "text-[var(--status-idle)]"
              : room.status === "streaming"
              ? "text-[var(--status-streaming)]"
              : "text-[var(--status-offline)]"
          }`}
        >
          {statusLabel}
        </span>

        {room.status === "streaming" && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[var(--status-streaming)]">
            <Cast size={11} />
            Yayın devam ediyor
          </span>
        )}
      </div>

      {/* Connect button */}
      <button
        id={`btn-connect-${room.id}`}
        disabled={!canConnect}
        onClick={() => onConnect(room)}
        className={`
          mt-1 w-full py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2
          transition-all duration-150
          ${
            canConnect
              ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-95 cursor-pointer"
              : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
          }
        `}
      >
        {room.status === "offline" ? (
          <>
            <WifiOff size={14} />
            Çevrimdışı
          </>
        ) : room.status === "streaming" ? (
          <>
            <Cast size={14} />
            Meşgul
          </>
        ) : (
          <>
            <Wifi size={14} />
            Bağlan
          </>
        )}
      </button>
    </div>
  );
}
