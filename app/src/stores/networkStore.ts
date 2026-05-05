import { create } from "zustand";
import type { NetworkState } from "../types/network";

interface NetworkStore {
  networkState: NetworkState;
  localIp: string | null;
  hasLocalInterface: boolean;

  // Called once on app startup — only checks local interface presence.
  // roomService.ts updates to ONLINE / LOCAL_ONLY after Firebase check.
  checkLocalNetwork: () => Promise<void>;
  setNetworkState: (state: NetworkState) => void;
}

export const useNetworkStore = create<NetworkStore>((set) => ({
  networkState: "CHECKING",
  localIp: null,
  hasLocalInterface: false,

  checkLocalNetwork: async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<{ has_local_interface: boolean; local_ip: string | null }>(
        "get_network_info"
      );
      if (!info.has_local_interface) {
        set({ networkState: "NO_NETWORK", localIp: null, hasLocalInterface: false });
      } else {
        set({ localIp: info.local_ip, hasLocalInterface: true });
        // Stay at CHECKING — roomService will update to ONLINE or LOCAL_ONLY
      }
    } catch {
      set({ networkState: "NO_NETWORK", localIp: null, hasLocalInterface: false });
    }
  },

  setNetworkState: (state) => set({ networkState: state }),
}));
