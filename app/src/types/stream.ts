export type ConnectionPhase =
  | "idle"
  | "waking"
  | "hdmi_ready"
  | "awaiting_pin"
  | "authenticating"
  | "streaming";

export type StreamMode = "fullscreen" | "window";

export type NetworkQuality = "excellent" | "good" | "degraded" | "poor" | "lost";

export type StreamQualityMode = "presentation" | "video";

export interface StreamConfig {
  targetIp: string;
  resolution: string;
  fps: number;
  bitrate: number;
  delayBufferMs: number;
  encoderName: string;
  streamMode: StreamMode;
  qualityMode: StreamQualityMode;
  windowId?: number;
  monitorIndex?: number;
  audioEnabled: boolean;
  audioDeviceId: string | null;
}
