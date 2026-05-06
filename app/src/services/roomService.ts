import { invoke } from "@tauri-apps/api/core";
import { useRoomStore } from "../stores/roomStore";
import { useNetworkStore } from "../stores/networkStore";
import { Room, RoomStatus } from "../types/room";

// Raw shape coming from Firebase — aligned with Pi Agent v3 / Rules
interface RawRoom {
  name?: string;
  floor?: string;
  pi_ip?: string;
  pi_status?: string;
  last_seen?: number | string | null;
}

interface CachedRoom {
  id: string;
  label: string;
  floor: string;
  ip: string;
  status: string;
  lastSeen: number;
}

interface RoomsCache {
  rooms: CachedRoom[];
  lastUpdated: number;
  version: number;
}

function parseRoom(id: string, raw: RawRoom): Room {
  let lastSeenSeconds = 0;
  if (typeof raw.last_seen === "number") {
    lastSeenSeconds = raw.last_seen;
  } else if (typeof raw.last_seen === "string" && raw.last_seen !== "") {
    lastSeenSeconds = parseInt(raw.last_seen, 10) || 0;
  }
  const lastSeenMs = lastSeenSeconds * 1000;

  let status: RoomStatus = "offline";
  const now = Date.now();
  const OFFLINE_THRESHOLD = 5 * 60 * 1000;

  // ISSUE-03 Fix: Use regex to validate actual IPv4 address
  // This catches "No network", "N/A", or any other invalid placeholder from the Pi
  const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!raw.pi_ip || !IP_PATTERN.test(raw.pi_ip.trim())) {
    status = "unconfigured";
  } else if (lastSeenMs > 0 && now - lastSeenMs > OFFLINE_THRESHOLD) {
    status = "offline";
  } else {
    const validStatuses: RoomStatus[] = ["idle", "streaming", "offline"];
    status = validStatuses.includes(raw.pi_status as RoomStatus)
      ? (raw.pi_status as RoomStatus)
      : "idle";
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

function cachedRoomsToRecord(cached: CachedRoom[]): Record<string, Room> {
  const rooms: Record<string, Room> = {};
  for (const r of cached) {
    rooms[r.id] = {
      id: r.id,
      label: r.label,
      floor: r.floor,
      ip: r.ip,
      status: r.status as RoomStatus,
      lastSeen: r.lastSeen,
    };
  }
  return rooms;
}

function roomsToCache(rooms: Record<string, Room>): RoomsCache {
  return {
    rooms: Object.values(rooms).map((r) => ({
      id: r.id,
      label: r.label,
      floor: r.floor,
      ip: r.ip,
      status: r.status,
      lastSeen: r.lastSeen,
    })),
    lastUpdated: Date.now(),
    version: 1,
  };
}

let pollInterval: any = null;

/**
 * Starts fetching rooms from Firebase via Rust backend.
 * On first run: loads cache instantly, then fetches Firebase in background.
 * Updates networkStore to ONLINE or LOCAL_ONLY based on Firebase reachability.
 * Returns a cleanup function to stop polling.
 */
export function startRoomListener(): () => void {
  const { setRooms, setLoading, setError, setRefreshing, setLastCacheUpdate } =
    useRoomStore.getState();
  const { checkLocalNetwork, setNetworkState } = useNetworkStore.getState();

  // Step 1: check local network presence
  checkLocalNetwork();

  // Step 2: load cache instantly so UI shows something before Firebase
  const loadCache = async () => {
    try {
      const cache = await invoke<RoomsCache | null>("read_rooms_cache");
      if (cache && cache.rooms.length > 0) {
        setRooms(cachedRoomsToRecord(cache.rooms));
        setLastCacheUpdate(cache.lastUpdated);
        setLoading(false);
        console.log("[roomService] Loaded", cache.rooms.length, "rooms from cache.");
      }
    } catch (e) {
      console.warn("[roomService] Cache load failed:", e);
    }
  };

  // Step 3: fetch fresh data from Firebase
  const fetchRooms = async () => {
    const { rooms: currentRooms } = useRoomStore.getState();
    const hasCachedData = Object.keys(currentRooms).length > 0;

    if (hasCachedData) setRefreshing(true);

    try {
      const raw = (await invoke("fetch_firebase_rooms")) as Record<string, RawRoom> | null;

      if (!raw) {
        setRooms({});
      } else {
        const rooms: Record<string, Room> = {};
        for (const [id, data] of Object.entries(raw)) {
          rooms[id] = parseRoom(id, data);
        }
        setRooms(rooms);

        // Save fresh data to cache
        try {
          await invoke("write_rooms_cache", { cache: roomsToCache(rooms) });
          setLastCacheUpdate(Date.now());
        } catch (e) {
          console.warn("[roomService] Cache save failed:", e);
        }
      }

      setLoading(false);
      setRefreshing(false);
      setError(null);
      setNetworkState("ONLINE");
    } catch (e: any) {
      console.error("[roomService] Firebase fetch failed:", e);
      setRefreshing(false);

      const isTimeout =
        typeof e === "string" &&
        (e.includes("timeout") || e.includes("timed out") || e.includes("Timeout"));

      if (isTimeout || useNetworkStore.getState().hasLocalInterface) {
        setNetworkState("LOCAL_ONLY");
      } else {
        setNetworkState("NO_NETWORK");
      }

      // Don't overwrite cached rooms on error
      const { rooms } = useRoomStore.getState();
      if (Object.keys(rooms).length === 0) {
        setError("Oda listesi alınamadı.");
        setLoading(false);
      }
    }
  };

  // Run startup sequence
  loadCache().then(() => {
    fetchRooms();
    pollInterval = setInterval(fetchRooms, 30000);
  });

  return () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}
