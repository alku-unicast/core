import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRoomStore } from "../../stores/roomStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Room } from "../../types/room";
import { RoomCard } from "./RoomCard";

interface FavoritesSectionProps {
  onConnect: (room: Room) => void;
}

export function FavoritesSection({ onConnect }: FavoritesSectionProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const { rooms } = useRoomStore();
  const { favorites, toggleFavorite } = useSettingsStore();

  const favoriteRooms = favorites
    .map((id) => rooms[id])
    .filter(Boolean) as Room[];

  if (favoriteRooms.length === 0) return null;

  return (
    <section className="px-5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          id="btn-favorites-collapse"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          <span>{t("discovery.favorites")}</span>
          <span className="text-[var(--text-muted)] font-normal">
            ({favoriteRooms.length})
          </span>
        </button>
      </div>

      {/* Horizontal scroll container */}
      {!collapsed && (
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {favoriteRooms.map((room) => (
            <div key={room.id} className="relative shrink-0 group">
              <RoomCard
                room={room}
                variant="compact"
                onConnect={onConnect}
              />
              {/* Remove from favorites button */}
              <button
                id={`btn-unfavorite-${room.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(room.id);
                }}
                title={t("discovery.unfavorite", "Remove from favorites")}
                className="
                  absolute top-1.5 right-1.5
                  w-6 h-6 flex items-center justify-center rounded-full
                  bg-[var(--accent-gold)] text-white
                  opacity-0 group-hover:opacity-100
                  transition-opacity duration-150
                  shadow-sm
                "
              >
                <Star size={11} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
