export type Resolution = "1080p" | "720p" | "480p";
export type FPS = 30 | 20 | 15;
export type MainTheme = "light" | "dark";
export type BarTheme = "light" | "dark" | "translucent-dark";
export type Language = "tr" | "en";

export interface Settings {
  version: number;
  language: Language;
  favorites: string[];       // room IDs
  stream: {
    resolution: Resolution;
    fps: FPS;
    bitrate: number;         // kbps, 1000-8000
    delayBufferMs: number;   // default 74
  };
  audio: {
    deviceId: string | null;
    muteLocal: boolean;
  };
  encoder: {
    detected: string | null; // e.g. "nvh264enc"
    lastScan: string | null; // ISO timestamp
  };
  appearance: {
    mainTheme: MainTheme;
    barTheme: BarTheme;
    barOpacity: number;      // 0.5 - 1.0
  };
  streamingBar: {
    enabled: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  language: "tr",
  favorites: [],
  stream: {
    resolution: "1080p",
    fps: 30,
    bitrate: 3000,
    delayBufferMs: 74,
  },
  audio: {
    deviceId: null,
    muteLocal: true,
  },
  encoder: {
    detected: null,
    lastScan: null,
  },
  appearance: {
    mainTheme: "light",
    barTheme: "translucent-dark",
    barOpacity: 0.9,
  },
  streamingBar: {
    enabled: true,
  },
};
