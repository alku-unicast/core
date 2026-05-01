import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "../components/layout/TopBar";
import { StatusSummary } from "../components/layout/StatusSummary";
import { FavoritesSection } from "../components/rooms/FavoritesSection";
import { FloorTabs } from "../components/rooms/FloorTabs";
import { RoomGrid } from "../components/rooms/RoomGrid";
import { Room } from "../types/room";
import { useConnectionStore } from "../stores/connectionStore";
import { useRoomStore } from "../stores/roomStore";
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
    let isMounted = true;

    // We must await initFirebase (which has a 5s timeout) 
    // to ensure the DB is ready before starting the listener.
    // If it fails or times out, the listener will handle the fallback.
    // Safety timeout: If rooms don't load in 8s, force-stop the loader
    // so the user can at least use Manual IP connection.
    const safetyTimeout = setTimeout(() => {
      const { isLoading, setLoading } = useRoomStore.getState();
      if (isLoading && isMounted) {
        console.warn("[RoomDiscovery] Safety timeout reached, forcing loader to stop.");
        setLoading(false);
      }
    }, 8000);

    initFirebase()
      .then(() => {
        console.log("[RoomDiscovery] Firebase init finished.");
        if (isMounted) {
          stopListener = startRoomListener();
        }
      })
      .catch((e) => {
        console.error("[RoomDiscovery] Firebase init failed:", e);
        if (isMounted) {
          stopListener = startRoomListener();
        }
      });

    return () => {
      isMounted = false;
      stopListener?.();
      clearTimeout(safetyTimeout);
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
