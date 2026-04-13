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
  const db = getFirebaseDB();
  roomsRef = ref(db, "rooms");
  unsubscribed = false;

  const { setRooms, setLoading, setError } = useRoomStore.getState();

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
      if (unsubscribed) return;
      console.error("[roomService] Firebase listener error:", error);
      useRoomStore.getState().setError("Firebase connection error");
      useRoomStore.getState().setLoading(false);
    }
  );

  return () => {
    unsubscribed = true;
    if (roomsRef) {
      off(roomsRef);
      roomsRef = null;
    }
  };
}
