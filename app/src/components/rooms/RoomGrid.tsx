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
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || rooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 py-8 text-center">
        <span className="text-4xl">{error ? "⚠️" : "📡"}</span>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {error || t("discovery.no_rooms")}
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
