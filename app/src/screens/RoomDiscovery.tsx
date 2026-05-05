import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { StatusSummary } from "../components/layout/StatusSummary";
import { StatusBanner } from "../components/layout/StatusBanner";
import { FavoritesSection } from "../components/rooms/FavoritesSection";
import { FloorTabs } from "../components/rooms/FloorTabs";
import { RoomGrid } from "../components/rooms/RoomGrid";
import { ManualConnectSection } from "../components/rooms/ManualConnectSection";
import { Room } from "../types/room";
import { useConnectionStore } from "../stores/connectionStore";
import { useRoomStore } from "../stores/roomStore";
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

  // Start room listener immediately on mount
  useEffect(() => {
    console.log("[RoomDiscovery] Starting room listener...");
    const stopListener = startRoomListener();

    return () => {
      console.log("[RoomDiscovery] Stopping room listener.");
      stopListener();
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
        {/* Network state banner — only visible when there's a problem */}
        <StatusBanner />

        {/* Favorites — hidden if empty */}
        <FavoritesSection onConnect={handleConnect} />

        {/* Floor filter tabs */}
        <FloorTabs />

        {/* Room grid */}
        <RoomGrid onConnect={handleConnect} />

        {/* Manual IP connect — hidden when NO_NETWORK */}
        <ManualConnectSection />
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
