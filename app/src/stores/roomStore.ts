import { create } from "zustand";
import { Room } from "../types/room";

interface RoomStore {
  rooms: Record<string, Room>;
  activeFloor: string;       // "all" | "0" | "1" | "2" ...
  isLoading: boolean;
  error: string | null;

  // Derived helpers
  getFloors: () => string[];
  getRoomsByFloor: () => Room[];

  // Actions
  setRooms: (rooms: Record<string, Room>) => void;
  setActiveFloor: (floor: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: {},
  activeFloor: "all",
  isLoading: true,
  error: null,

  getFloors: () => {
    const rooms = Object.values(get().rooms);
    const floors = [...new Set(rooms.map((r) => r.floor))].sort();
    return floors;
  },

  getRoomsByFloor: () => {
    const { rooms, activeFloor } = get();
    const all = Object.values(rooms);
    if (activeFloor === "all") return all;
    return all.filter((r) => r.floor === activeFloor);
  },

  setRooms: (rooms) => set({ rooms }),
  setActiveFloor: (floor) => set({ activeFloor: floor }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
