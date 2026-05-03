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
  // 1. Convert raw last_seen (seconds) to milliseconds immediately
  let lastSeenSeconds = 0;
  if (typeof raw.last_seen === "number") {
    lastSeenSeconds = raw.last_seen;
  } else if (typeof raw.last_seen === "string" && raw.last_seen !== "") {
    lastSeenSeconds = parseInt(raw.last_seen, 10) || 0;
  }
  const lastSeenMs = lastSeenSeconds * 1000;

  // 2. Compute Smart Status (4-Tier)
  let status: RoomStatus = "offline";
  const now = Date.now();
  const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutes (Pi updates every 60s)

  if (!raw.pi_ip || raw.pi_ip.trim() === "") {
    // Case 1: Room defined in Firebase but Pi hasn't registered an IP yet
    status = "unconfigured";
  } else if (lastSeenMs > 0 && now - lastSeenMs > OFFLINE_THRESHOLD) {
    // Case 2: Pi has an IP but hasn't sent a heartbeat in > 5 minutes
    status = "offline";
  } else {
    // Case 3: Pi is active, trust the pi_status field (idle/streaming)
    const validStatuses: RoomStatus[] = ["idle", "streaming", "offline"];
    status = validStatuses.includes(raw.pi_status as RoomStatus)
      ? (raw.pi_status as RoomStatus)
      : "idle"; // Default to idle if IP is valid and heartbeat is fresh
  }

  return {
    id,
    label: raw.name ?? id,
    floor: raw.floor ?? "0",
    ip: raw.pi_ip ?? "",
    status,
    lastSeen: lastSeenMs,
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
        setRooms({});
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
    }
  };

  // Initial fetch
  fetchRooms();

  // Poll every 30 seconds (Pi updates every 60s, so 30s is more than enough)
  pollInterval = setInterval(fetchRooms, 30000);

  return () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}
