import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { StatusSummary } from "../components/layout/StatusSummary";
import { FavoritesSection } from "../components/rooms/FavoritesSection";
import { FloorTabs } from "../components/rooms/FloorTabs";
import { RoomGrid } from "../components/rooms/RoomGrid";
import { Room } from "../types/room";
import { useConnectionStore } from "../stores/connectionStore";
import { initFirebase } from "../services/firebase";
import { startRoomListener } from "../services/roomService";

// Lazy-load SettingsModal to keep initial bundle small
import { lazy, Suspense } from "react";
const SettingsModal = lazy(() =>
  import("../components/settings/SettingsModal").then((m) => ({
    default: m.SettingsModal,
  }))
);

export function RoomDiscovery() {
  const navigate = useNavigate();
  const { connect } = useConnectionStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize Firebase + start room listener once on mount
  useEffect(() => {
    let stopListener: (() => void) | null = null;

    initFirebase()
      .then(() => {
        stopListener = startRoomListener();
      })
      .catch((e) => {
        console.error("[RoomDiscovery] Firebase init failed:", e);
      });

    return () => {
      stopListener?.();
    };
  }, []);

  const handleConnect = (room: Room) => {
    connect(room);
    navigate("/connect");
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <TopBar onSettingsClick={() => setSettingsOpen(true)} />

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <main className="flex flex-col flex-1 overflow-y-auto gap-4 py-4">
        {/* Favorites — hidden if empty */}
        <FavoritesSection onConnect={handleConnect} />

        {/* Floor filter tabs */}
        <FloorTabs />

        {/* Room grid */}
        <RoomGrid onConnect={handleConnect} />
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <StatusSummary />

      {/* ── Settings Modal (lazy) ───────────────────────────────────── */}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
