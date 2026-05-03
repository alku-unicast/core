import { invoke } from "@tauri-apps/api/core";
import { useRoomStore } from "../stores/roomStore";
import { Room, RoomStatus } from "../types/room";

// Raw shape coming from Firebase — aligned with Pi Agent v3 / Rules
interface RawRoom {
  name?: string;
  floor?: string;
  pi_ip?: string;
  pi_status?: string;
  last_seen?: number | string | null;
}

function parseRoom(id: string, raw: RawRoom): Room {
  const validStatuses: RoomStatus[] = ["idle", "streaming", "offline"];
  
  const status = validStatuses.includes(raw.pi_status as RoomStatus)
    ? (raw.pi_status as RoomStatus)
    : "offline";

  // Handle number, string, or null for last_seen
  let lastSeen = 0;
  if (typeof raw.last_seen === "number") {
    lastSeen = raw.last_seen;
  } else if (typeof raw.last_seen === "string" && raw.last_seen !== "") {
    lastSeen = parseInt(raw.last_seen, 10) || 0;
  }

  return {
    id,
    label: raw.name ?? id,
    floor: raw.floor ?? "0",
    ip: raw.pi_ip ?? "",
    status,
    lastSeen,
  };
}

let pollInterval: any = null;

/**
 * Starts fetching rooms from Firebase via Rust backend.
 * Bypasses CORS issues on Linux.
 * Returns a cleanup function to stop polling.
 */
export function startRoomListener(): () => void {
  const { setRooms, setLoading, setError } = useRoomStore.getState();
  
  const fetchRooms = async () => {
    try {
      console.log("[roomService] Fetching rooms via Rust...");
      const raw = await invoke("fetch_firebase_rooms") as Record<string, RawRoom> | null;

      if (!raw) {
        injectMockRoom();
        return;
      }

      const rooms: Record<string, Room> = {};
      for (const [id, data] of Object.entries(raw)) {
        rooms[id] = parseRoom(id, data);
      }

      setRooms(rooms);
      setLoading(false);
      setError(null);
    } catch (e) {
      console.error("[roomService] Failed to fetch rooms:", e);
      setError("Firebase verisi çekilemedi. Rust köprüsü hatası.");
      setLoading(false);
      injectMockRoom();
    }
  };

  const injectMockRoom = () => {
    const mockRooms: Record<string, Room> = {
      "oda-mock": {
        id: "oda-mock",
        label: "Lokal Test Odası (Offline)",
        floor: "0",
        ip: "127.0.0.1",
        status: "idle",
        lastSeen: Date.now(),
      }
    };
    setRooms(mockRooms);
  };

  // Initial fetch
  fetchRooms();

  // Poll every 10 seconds for "live" updates
  pollInterval = setInterval(fetchRooms, 10000);

  return () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}
