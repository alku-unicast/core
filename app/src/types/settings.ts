export type Resolution = "1080p" | "720p" | "480p";
export type FPS = 30 | 20 | 15;
export type MainTheme = "light" | "dark";
export type BarTheme = "light" | "dark" | "translucent-dark";
export type Language = "tr" | "en";

export interface StreamProfile {
  resolution: Resolution;
  fps: FPS;
  bitrate: number;         // kbps
  delayBufferMs: number;
  audioEnabled: boolean;   // Persistent per-mode audio state
}

export interface Settings {
  version: number;
  language: Language;
  favorites: string[];       // room IDs
  profiles: {
    presentation: StreamProfile;
    video: StreamProfile;
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
  version: 2, // Increment version for migration
  language: "tr",
  favorites: [],
  profiles: {
    presentation: {
      resolution: "1080p",
      fps: 15,
      bitrate: 5000,
      delayBufferMs: 60,
      audioEnabled: false, // Default off for slides
    },
    video: {
      resolution: "1080p",
      fps: 30,
      bitrate: 4000,
      delayBufferMs: 74,
      audioEnabled: true,  // Default on for video
    },
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
