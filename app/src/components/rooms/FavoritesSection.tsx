import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Room } from "../../types/room";
import { RoomCard } from "./RoomCard";

interface FavoritesSectionProps {
  onConnect: (room: Room) => void;
}

export function FavoritesSection({ onConnect }: FavoritesSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { rooms } = useRoomStore();
  const { favorites } = useSettingsStore();

  const favoriteRooms = favorites
    .map((id) => rooms[id])
    .filter(Boolean) as Room[];

  if (favoriteRooms.length === 0) return null;

  return (
    <section className="px-5 flex flex-col gap-2">
      {/* Header */}
      <button
        id="btn-favorites-collapse"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 w-fit"
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        <span>⭐ Favoriler</span>
        <span className="text-[var(--text-muted)] font-normal">
          ({favoriteRooms.length})
        </span>
      </button>

      {/* Horizontal scroll container */}
      {!collapsed && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {favoriteRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              variant="compact"
              onConnect={onConnect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
