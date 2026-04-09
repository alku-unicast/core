export type RoomStatus = "idle" | "streaming" | "offline";

export interface Room {
  id: string;           // Firebase key, e.g. "101", "003-005"
  label: string;        // Display name, e.g. "101", "003/005"
  floor: string;        // e.g. "0", "1", "2"
  ip: string;           // Pi IP address
  status: RoomStatus;
  lastSeen: number;     // Unix timestamp ms
}
