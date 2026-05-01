import { useTranslation } from "react-i18next";
import { useRoomStore } from "../../stores/roomStore";
import { Room } from "../../types/room";
import { RoomCard } from "./RoomCard";
import { Loader2 } from "lucide-react";
import { ManualConnect } from "./ManualConnect";

interface RoomGridProps {
  onConnect: (room: Room) => void;
}

export function RoomGrid({ onConnect }: RoomGridProps) {
  const { t } = useTranslation();
  const { isLoading, error, getRoomsByFloor } = useRoomStore();
  const rooms = getRoomsByFloor();

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          <span className="text-sm">{t("common.loading")}</span>
        </div>
        
        <div className="w-full max-w-sm px-6 pt-8 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-center text-[var(--text-muted)] mb-4">
            {t("discovery.taking_too_long", "Taking too long? You can connect directly:")}
          </p>
          <ManualConnect onConnect={onConnect} />
        </div>
      </div>
    );
  }

  if (error || rooms.length === 0) {
    return (
      <div className="flex-1 flex flex-col gap-6 py-8">
        <div className="flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="text-4xl">{error ? "⚠️" : "📡"}</span>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {error || t("discovery.no_rooms")}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {t("discovery.online_notice", "Rooms will appear here when projectors are online.")}
          </p>
        </div>
        
        <ManualConnect onConnect={onConnect} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 px-5">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} onConnect={onConnect} />
        ))}
      </div>
      
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <ManualConnect onConnect={onConnect} />
      </div>
    </div>
  );
}
