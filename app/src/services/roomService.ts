import { ref, onValue, off, DatabaseReference } from "firebase/database";
import { getFirebaseDB } from "./firebase";
import { useRoomStore } from "../stores/roomStore";
import { Room, RoomStatus } from "../types/room";

// Raw shape coming from Firebase — aligned with Pi Agent v3 / Rules
interface RawRoom {
  name?: string;      // formerly label
  floor?: string;
  pi_ip?: string;     // formerly ip
  pi_status?: string; // formerly status
  last_seen?: number;
}

function parseRoom(id: string, raw: RawRoom): Room {
  const validStatuses: RoomStatus[] = ["idle", "streaming", "offline"];
  
  // pi_status gelmediyse varsayılan offline
  const status = validStatuses.includes(raw.pi_status as RoomStatus)
    ? (raw.pi_status as RoomStatus)
    : "offline";

  return {
    id,
    label: raw.name ?? id,
    floor: raw.floor ?? "0",
    ip: raw.pi_ip ?? "",
    status,
    lastSeen: raw.last_seen ?? 0,
  };
}

let roomsRef: DatabaseReference | null = null;
let unsubscribed = false;

/**
 * Starts listening to /rooms in Firebase Realtime DB.
 * Pipes updates directly into roomStore.
 * Returns a cleanup function to stop listening.
 */
export function startRoomListener(): () => void {
  const { setRooms, setLoading, setError } = useRoomStore.getState();
  unsubscribed = false;

  try {
    const db = getFirebaseDB();
    if (!db) {
      console.warn("[roomService] Firebase not ready, showing mock room only");
      setError("Bağlantı kurulamadı, manuel IP ile bağlanabilirsiniz.");
      const mockRooms: Record<string, Room> = {
        "oda-mock": {
          id: "oda-mock",
          label: "Test Odası (Offline)",
          floor: "0",
          ip: "127.0.0.1",
          status: "idle",
          lastSeen: Date.now(),
        }
      };
      setRooms(mockRooms);
      setLoading(false);
      return () => {};
    }

    roomsRef = ref(db, "rooms");

    onValue(
      roomsRef,
    (snapshot) => {
      if (unsubscribed) return;

      const raw = snapshot.val() as Record<string, RawRoom> | null;

      if (!raw) {
        const rooms: Record<string, Room> = {
          "oda-mock": {
            id: "oda-mock",
            label: "Lokal Test Odası",
            floor: "0",
            ip: "127.0.0.1",
            status: "idle",
            lastSeen: Date.now(),
          }
        };
        setRooms(rooms);
        setLoading(false);
        return;
      }

      const rooms: Record<string, Room> = {};
      for (const [id, data] of Object.entries(raw)) {
        rooms[id] = parseRoom(id, data);
      }

      // --- MOCK MODE INJECTION ---
      // Hardcoded local room for testing without physical Raspberry Pi
      rooms["oda-mock"] = {
        id: "oda-mock",
        label: "Lokal Test Odası",
        floor: "0",
        ip: "127.0.0.1",
        status: "idle",
        lastSeen: Date.now(),
      };
      // ---------------------------

      setRooms(rooms);
      setLoading(false);
      setError(null);
    },
    (error) => {
      useRoomStore.getState().setError("Firebase connection error");
      useRoomStore.getState().setLoading(false);
    }
  );
} catch (e) {
    console.error("[roomService] Failed to start listener:", e);
    setError("Firebase connection failed. Check your network.");
    setLoading(false);
    
    // Inject mock room even if listener fails, so user can test GStreamer
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
  }

  return () => {
    unsubscribed = true;
    if (roomsRef) {
      off(roomsRef);
      roomsRef = null;
    }
  };
}
