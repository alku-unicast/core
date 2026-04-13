import os
import time
import socket
import random
import signal
import threading
import subprocess

from PIL import Image, ImageDraw, ImageFont
import gi

gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

# ─── Firebase (optional — graceful fallback if not installed/configured) ────────
try:
    import firebase_admin
    from firebase_admin import credentials, db as firebase_db
    _FIREBASE_AVAILABLE = True
except ImportError:
    _FIREBASE_AVAILABLE = False
    print("[WARN] firebase-admin not installed. Running without Firebase.")

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION — Master Image logic
# ─────────────────────────────────────────────────────────────────────────────

def get_config_room_id():
    """Reads ROOM_ID from SD card boot partition for easy cloning."""
    config_paths = ["/boot/firmware/unicast_config.txt", "/boot/unicast_config.txt"]
    for path in config_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    for line in f:
                        if line.startswith("ROOM_ID="):
                            return line.split("=")[1].strip()
            except Exception:
                pass
    return "213"  # Default fallback for your lab

ROOM_ID           = get_config_room_id()
SERVICE_ACCOUNT   = "/home/unicast_pi/core/src/receiver/firebase-key.json"
FIREBASE_DB_URL   = "https://unicast-8a705-default-rtdb.europe-west1.firebasedatabase.app"

HEARTBEAT_TIMEOUT = 5    # seconds
GRACE_PERIOD      = 20   # seconds
FIREBASE_INTERVAL = 60   # seconds

# ─────────────────────────────────────────────────────────────────────────────

class State:
    IDLE         = "idle"
    STREAMING    = "streaming"
    RECONNECTING = "reconnecting"
    OFFLINE      = "offline"


class UniCastReceiver:
    def __init__(self):
        Gst.init(None)
        self.main_loop = GLib.MainLoop()

        # Pipelines
        self.idle_pipe  = None
        self.video_pipe = None
        self.audio_pipe = None

        # Core state
        self.current_state  = State.IDLE
        self.pin            = self._generate_pin()
        self.ip_address     = self._get_ip()
        self.last_heartbeat = 0
        self.pin_attempts: dict[str, int] = {}  # ip -> failed attempts

        # Firebase reference
        self._fb_ref = None

        # ALKÜ brand palette
        self.COLORS = {
            'bg_primary':  '#F2F5F7',
            'navy':        '#1C407D',
            'turquoise':   '#00AECD',
            'gold':        '#D1AD53',
            'text_muted':  '#5D6B82',
        }

        self._idle_image = "/tmp/unicast_idle.png"

        # UDP socket — port 5001 (auth + heartbeat + wake)
        self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.udp_sock.bind(('0.0.0.0', 5001))

        # RTT echo socket — port 5005
        self.echo_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.echo_sock.bind(('0.0.0.0', 5005))

        # Signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._shutdown_handler)
        signal.signal(signal.SIGINT,  self._shutdown_handler)

        print(f"[UniCast] Agent v3.1 Master Image | Room: {ROOM_ID} | IP: {self.ip_address} | PIN: {self.pin}")

        # Firebase init
        self._init_firebase()

        # Build idle screen
        self.setup_idle_screen()

        # Background threads
        threading.Thread(target=self._udp_listener,    daemon=True).start()
        threading.Thread(target=self._echo_listener,   daemon=True).start()
        threading.Thread(target=self._session_monitor, daemon=True).start()
        threading.Thread(target=self._firebase_heartbeat, daemon=True).start()

    # ─────────────────────────────────────────────────────────────────────────
    # Firebase
    # ─────────────────────────────────────────────────────────────────────────

    def _init_firebase(self):
        if not _FIREBASE_AVAILABLE:
            print("[Firebase] firebase-admin library missing. No cloud presence.")
            return
        if not os.path.exists(SERVICE_ACCOUNT):
            print(f"[Firebase] Key not found at {SERVICE_ACCOUNT}. Presence local-only.")
            return
        try:
            cred = credentials.Certificate(SERVICE_ACCOUNT)
            firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_DB_URL})
            self._fb_ref = firebase_db.reference(f"/rooms/{ROOM_ID}")
            self._fb_write_status(State.IDLE)
            print(f"[Firebase] Active — Heartbeats updating /rooms/{ROOM_ID}")
        except Exception as e:
            print(f"[Firebase] Connection error: {e}")
            self._fb_ref = None

    def _fb_write_status(self, status: str):
        """Write room status to Firebase using the user's security rules alignment."""
        if self._fb_ref is None:
            return
        try:
            # Floor decoding: room 213 -> floor 2
            floor = "0"
            if "-" in ROOM_ID:
                parts = ROOM_ID.split("-")
                for p in parts:
                    if p.isdigit(): floor = p[0]; break
            elif any(c.isdigit() for c in ROOM_ID):
                for c in ROOM_ID:
                    if c.isdigit(): floor = c; break

            self._fb_ref.update({
                "pi_ip":      self.ip_address,
                "pi_status":  status,
                "last_seen":  int(time.time()),
                "name":       ROOM_ID,  # Matches user's ".validate": "newData.isString()" rule
                "floor":      floor,     # Matches user's rule
            })
        except Exception as e:
            print(f"[Firebase] DB Update failed: {e}")

    def _firebase_heartbeat(self):
        """Background daemon: refreshes last_seen every FIREBASE_INTERVAL seconds."""
        while True:
            time.sleep(FIREBASE_INTERVAL)
            if self.current_state != State.OFFLINE:
                self._fb_write_status(self.current_state)
                print(f"[Firebase] Heartbeat — status: {self.current_state}")

    # ─────────────────────────────────────────────────────────────────────────
    # Utilities
    # ─────────────────────────────────────────────────────────────────────────

    def _generate_pin(self) -> str:
        return str(random.randint(1000, 9999))

    def _get_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except Exception:
            return "No network"

    def _get_cpu_temp(self) -> str:
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                return f"{int(f.read()) / 1000.0:.0f}"
        except Exception:
            return "??"

    # ─────────────────────────────────────────────────────────────────────────
    # Idle Screen
    # ─────────────────────────────────────────────────────────────────────────

    def _create_idle_image(self):
        img  = Image.new('RGB', (1920, 1080), color=self.COLORS['bg_primary'])
        draw = ImageDraw.Draw(img)
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        try:
            f_title = ImageFont.truetype(font_path, 80)
            f_pin   = ImageFont.truetype(font_path, 180)
            f_label = ImageFont.truetype(font_path, 50)
            f_info  = ImageFont.truetype(font_path, 60)
        except Exception:
            f_title = f_pin = f_label = f_info = ImageFont.load_default()

        # Turquoise top accent bar
        draw.rectangle([0, 0, 1920, 15], fill=self.COLORS['turquoise'])

        # Title
        draw.text((960, 200), "UniCast Mirroring", fill=self.COLORS['turquoise'],
                  font=f_title, anchor='mm')

        # Room label
        draw.text((960, 290), ROOM_ID.upper(), fill=self.COLORS['text_muted'],
                  font=f_label, anchor='mm')

        # PIN or status
        if self.current_state == State.RECONNECTING:
            draw.text((960, 400), "BAGLANTI KOPTU — BEKLENIYOR",
                      fill=self.COLORS['gold'], font=f_label, anchor='mm')
        else:
            draw.text((960, 400), "GIRIS KODU", fill=self.COLORS['text_muted'],
                      font=f_label, anchor='mm')

        draw.text((960, 560), self.pin, fill=self.COLORS['navy'],
                  font=f_pin, anchor='mm')

        # Footer info
        draw.text((480, 900), "IP ADRESI", fill=self.COLORS['text_muted'],
                  font=f_label, anchor='mm')
        draw.text((480, 970), self.ip_address, fill=self.COLORS['navy'],
                  font=f_info, anchor='mm')
        draw.text((1440, 900), "SISTEM", fill=self.COLORS['text_muted'],
                  font=f_label, anchor='mm')
        draw.text((1440, 970), f"AKTIF — {self._get_cpu_temp()}C",
                  fill=self.COLORS['gold'], font=f_info, anchor='mm')

        # Navy bottom bar
        draw.rectangle([0, 1065, 1920, 1080], fill=self.COLORS['navy'])

        img.save(self._idle_image)

    def setup_idle_screen(self):
        self._create_idle_image()
        if self.idle_pipe:
            self.idle_pipe.set_state(Gst.State.NULL)
        pipeline_str = (
            f"filesrc location={self._idle_image} ! pngdec ! imagefreeze ! "
            f"videoconvert ! video/x-raw,width=1920,height=1080 ! kmssink sync=false"
        )
        self.idle_pipe = Gst.parse_launch(pipeline_str)
        self.idle_pipe.set_state(Gst.State.PLAYING)

    # ─────────────────────────────────────────────────────────────────────────
    # HDMI-CEC
    # ─────────────────────────────────────────────────────────────────────────

    def _cec_power_on(self):
        try:
            subprocess.run(["cec-ctl", "-d", "/dev/cec0", "--to", "0", "--image-view-on"],
                           timeout=5, capture_output=True)
        except Exception:
            pass  # CEC unavailable — non-fatal

    def _cec_standby(self):
        try:
            subprocess.run(["cec-ctl", "-d", "/dev/cec0", "--to", "0", "--standby"],
                           timeout=5, capture_output=True)
        except Exception:
            pass

    # ─────────────────────────────────────────────────────────────────────────
    # Streaming
    # ─────────────────────────────────────────────────────────────────────────

    def start_streaming(self):
        if self.current_state == State.STREAMING:
            return
        print("[UniCast] Starting AV stream...")

        if self.idle_pipe:
            self.idle_pipe.set_state(Gst.State.NULL)

        self._cec_power_on()

        v_pipeline = (
            'udpsrc port=5000 caps="application/x-rtp, media=video, '
            'encoding-name=H264, payload=96" ! '
            'rtpjitterbuffer latency=200 ! rtph264depay ! h264parse ! avdec_h264 ! '
            'videoconvert ! video/x-raw,width=1920,height=1080 ! kmssink sync=true'
        )
        a_pipeline = (
            'udpsrc port=5002 caps="application/x-rtp, media=audio, '
            'clock-rate=48000, encoding-name=OPUS, payload=96" ! '
            'rtpopusdepay ! opusdec ! audioconvert ! alsasink sync=true'
        )

        self.video_pipe = Gst.parse_launch(v_pipeline)
        self.audio_pipe = Gst.parse_launch(a_pipeline)
        self.video_pipe.set_state(Gst.State.PLAYING)
        self.audio_pipe.set_state(Gst.State.PLAYING)
        self.current_state = State.STREAMING

        # Firebase: streaming
        self._fb_write_status(State.STREAMING)
        print(f"[UniCast] Streaming | Firebase: streaming")

    def stop_streaming(self, immediate_new_pin: bool = False):
        if self.video_pipe:
            self.video_pipe.set_state(Gst.State.NULL)
        if self.audio_pipe:
            self.audio_pipe.set_state(Gst.State.NULL)

        if immediate_new_pin:
            self.pin = self._generate_pin()
            self.pin_attempts.clear()
            self.current_state = State.IDLE
            print(f"[UniCast] Stream stopped | New PIN: {self.pin}")
            self._fb_write_status(State.IDLE)
        else:
            self.current_state = State.RECONNECTING
            print("[UniCast] Stream paused — grace period started (PIN unchanged)")
            self._fb_write_status(State.IDLE)   # Show idle to sender UI

        self.setup_idle_screen()

    # ─────────────────────────────────────────────────────────────────────────
    # UDP Listener — port 5001
    # Protocol (matches Rust auth.rs):
    #   WAKE            → responds "READY" (HDMI-CEC power-on)
    #   PIN:<4digit>    → responds "OK" or "FAIL:<attempts_remaining>" or "BUSY"
    #   HEARTBEAT       → updates last_heartbeat timestamp
    #   STOP            → enters grace period
    # ─────────────────────────────────────────────────────────────────────────

    def _udp_listener(self):
        MAX_ATTEMPTS = 3

        while True:
            try:
                data, addr = self.udp_sock.recvfrom(1024)
            except Exception:
                continue

            msg = data.decode(errors="replace").strip()
            ip  = addr[0]

            # ── WAKE ─────────────────────────────────────────────────────────
            if msg == "WAKE":
                self._cec_power_on()
                self.udp_sock.sendto(b"READY", addr)
                print(f"[Auth] WAKE from {ip}")

            # ── PIN:<code> ────────────────────────────────────────────────────
            elif msg.startswith("PIN:"):
                received = msg[4:].strip()

                if self.current_state == State.STREAMING:
                    self.udp_sock.sendto(b"BUSY", addr)
                    print(f"[Auth] BUSY — already streaming (from {ip})")
                    continue

                attempts = self.pin_attempts.get(ip, 0)

                if received == self.pin:
                    self.pin_attempts.pop(ip, None)  # reset on success
                    self.udp_sock.sendto(b"OK", addr)
                    self.last_heartbeat = time.time()
                    print(f"[Auth] OK from {ip}")
                    self.start_streaming()
                else:
                    attempts += 1
                    self.pin_attempts[ip] = attempts
                    remaining = max(0, MAX_ATTEMPTS - attempts)
                    self.udp_sock.sendto(f"FAIL:{remaining}".encode(), addr)
                    print(f"[Auth] FAIL from {ip} ({attempts}/{MAX_ATTEMPTS})")
                    if attempts >= MAX_ATTEMPTS:
                        print(f"[Auth] MAX attempts — blocking {ip} for this PIN cycle")

            # ── HEARTBEAT ─────────────────────────────────────────────────────
            elif msg == "HEARTBEAT":
                self.last_heartbeat = time.time()
                if self.current_state == State.RECONNECTING:
                    print("[UniCast] Reconnect heartbeat — resuming stream")
                    self.start_streaming()

            # ── STOP (sender user request) ────────────────────────────────────
            elif msg == "STOP":
                self.stop_streaming(immediate_new_pin=False)
                self.last_heartbeat = time.time()

            else:
                print(f"[Auth] Unknown message from {ip}: {msg!r}")

    # ─────────────────────────────────────────────────────────────────────────
    # RTT Echo Listener — port 5005
    # ─────────────────────────────────────────────────────────────────────────

    def _echo_listener(self):
        while True:
            try:
                data, addr = self.echo_sock.recvfrom(64)
                self.echo_sock.sendto(data, addr)   # echo back
            except Exception:
                continue

    # ─────────────────────────────────────────────────────────────────────────
    # Session Monitor
    # ─────────────────────────────────────────────────────────────────────────

    def _session_monitor(self):
        while True:
            time.sleep(1)
            now = time.time()

            if self.current_state == State.STREAMING:
                if now - self.last_heartbeat > HEARTBEAT_TIMEOUT:
                    print("[UniCast] Heartbeat lost — entering grace period")
                    self.stop_streaming(immediate_new_pin=False)

            elif self.current_state == State.RECONNECTING:
                if now - self.last_heartbeat > GRACE_PERIOD:
                    print("[UniCast] Grace period expired — new PIN")
                    self.pin = self._generate_pin()
                    self.pin_attempts.clear()
                    self.current_state = State.IDLE
                    self._fb_write_status(State.IDLE)
                    self.setup_idle_screen()

    # ─────────────────────────────────────────────────────────────────────────
    # Graceful Shutdown
    # ─────────────────────────────────────────────────────────────────────────

    def _shutdown_handler(self, signum, frame):
        print(f"[UniCast] Received signal {signum} — shutting down...")
        self.current_state = State.OFFLINE

        # Firebase: offline
        self._fb_write_status(State.OFFLINE)
        print("[Firebase] Status set to offline")

        # Stop pipelines
        if self.video_pipe: self.video_pipe.set_state(Gst.State.NULL)
        if self.audio_pipe: self.audio_pipe.set_state(Gst.State.NULL)
        if self.idle_pipe:  self.idle_pipe.set_state(Gst.State.NULL)

        # CEC standby
        self._cec_standby()

        self.main_loop.quit()

    # ─────────────────────────────────────────────────────────────────────────
    # Entry Point
    # ─────────────────────────────────────────────────────────────────────────

    def run(self):
        print("[UniCast] GLib.MainLoop running...")
        self.main_loop.run()
        print("[UniCast] Shutdown complete.")


if __name__ == "__main__":
    receiver = UniCastReceiver()
    receiver.run()
