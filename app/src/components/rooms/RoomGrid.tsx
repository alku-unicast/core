import { useTranslation } from "react-i18next";
import { useRoomStore } from "../../stores/roomStore";
import { Room } from "../../types/room";
import { RoomCard } from "./RoomCard";
import { Loader2 } from "lucide-react";

interface RoomGridProps {
  onConnect: (room: Room) => void;
}

export function RoomGrid({ onConnect }: RoomGridProps) {
  const { t } = useTranslation();
  const { isLoading, error, getRoomsByFloor } = useRoomStore();
  const rooms = getRoomsByFloor();

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
        <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="text-3xl">⚠️</span>
        <p className="text-sm font-medium text-[var(--status-error)]">{error}</p>
        <p className="text-xs text-[var(--text-muted)]">{t("discovery.showing_cached", "Showing cached data.")}</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="text-4xl">📡</span>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {t("discovery.no_rooms")}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {t("discovery.online_notice", "Rooms will appear here when projectors are online.")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 px-5">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} onConnect={onConnect} />
      ))}
    </div>
  );
}
