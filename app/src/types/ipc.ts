// ── Tauri Command Payloads & Returns ──────────────────────────────────────────

export interface EncoderResult {
  name: string;       // e.g. "nvh264enc"
  hwType: string;     // e.g. "NVIDIA", "Intel QSV", "AMD AMF", "Software"
}

export interface WindowInfo {
  id: number;         // HWND (Win) / CGWindowID (Mac) / XID (Linux)
  title: string;
  processName: string;
  icon?: string;      // base64 PNG, optional
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface AudioDevice {
  id: string;         // device GUID / PulseAudio sink name
  name: string;
  isDefault: boolean;
}

export interface PinVerifyResult {
  success: boolean;
  message: string;
  attemptsRemaining?: number;
}

export interface StartStreamResult {
  success: boolean;
  pid: number;
}

// ── Tauri Event Payloads ──────────────────────────────────────────────────────

export interface StreamHealthEvent {
  rttMs: number;
  quality: "excellent" | "good" | "degraded" | "poor" | "lost";
}

export interface EncoderFoundEvent {
  name: string;
  hwType: string;
}

export interface StreamErrorEvent {
  code: number;
  message: string;
}

export interface StreamStartedEvent {
  pid: number;
}

export interface StreamStoppedEvent {
  reason: "user" | "error" | "pi_disconnect";
}
