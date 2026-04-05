import gi
import time
import threading
import sys
import os
import socket
import subprocess

gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

from benchmarker import Benchmarker

class ReceiverAgent:
    def __init__(self, video_port=5000, audio_port=5002, echo_port=5005):
        Gst.init(None)
        self.video_port = video_port
        self.audio_port = audio_port
        self.echo_port = echo_port
        self.benchmarker = Benchmarker()
        self.running = False
        
        # Maximize system volume on startup (Pi specific)
        self._max_system_volume()
        
        self.create_pipeline()

    def _max_system_volume(self):
        """Sets the Raspberry Pi system master volume to 100%."""
        try:
            # Try amixer first (ALSA)
            subprocess.run(["amixer", "sset", "Master", "100%"], capture_output=True)
            # Try pactl (PulseAudio)
            subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "100%"], capture_output=True)
        except Exception as e:
            print(f"Volume adjustment non-critical warning: {e}")

    def on_frame_decoded(self, pad, info):
        """Probe callback to count successfully rendered frames."""
        self.benchmarker.on_frame_decoded()
        return Gst.PadProbeReturn.OK

    def create_pipeline(self):
        """Combined Audio and Video pipeline for synchronized low-latency playback."""
        # Dual-branch pipeline string
        # Video: UDP 5000 -> JitterBuffer -> H.264 Depay -> Decode -> 1080p Scale -> FPS Display Sink
        # Audio: UDP 5002 -> JitterBuffer -> Opus Depay -> Decode -> Volume Boost -> Audio Sink
        pipeline_str = (
            # --- Video Branch ---
            f"udpsrc port={self.video_port} name=video_src "
            'caps="application/x-rtp, media=video, encoding-name=H264, payload=96" '
            "! rtpjitterbuffer name=vjbuf latency=200 mode=slave do-lost=true "
            "! rtph264depay ! h264parse ! avdec_h264 "
            "! videoconvert ! videoscale ! video/x-raw,width=1920,height=1080 "
            "! videoconvert ! fpsdisplaysink name=video_sink sync=true text-overlay=true "
            
            # --- Audio Branch ---
            f"udpsrc port={self.audio_port} name=audio_src "
            'caps="application/x-rtp, media=audio, encoding-name=OPUS, payload=96" '
            "! rtpjitterbuffer name=ajbuf latency=200 mode=slave do-lost=true "
            "! rtpopusdepay ! opusdec ! audioconvert ! volume volume=1.5 "
            "! audioresample ! autoaudiosink name=audio_sink sync=true"
        )
        
        print("Initializing High-Performance AV Pipeline...")
        self.pipeline = Gst.parse_launch(pipeline_str)
        
        # Attach probe to the video sink to count frames (FPS tracking)
        video_sink = self.pipeline.get_by_name("video_sink")
        # fpsdisplaysink is a bin, we probe its sink pad
        sink_pad = video_sink.get_static_pad("sink")
        sink_pad.add_probe(Gst.PadProbeType.BUFFER, self.on_frame_decoded)

    def _listen_stats(self):
        """Background thread to extract RTP Jitter and Packet Loss statistics."""
        vjbuf = self.pipeline.get_by_name("vjbuf")
        ajbuf = self.pipeline.get_by_name("ajbuf")
        
        while self.running:
            v_stats = vjbuf.get_property("stats")
            a_stats = ajbuf.get_property("stats")
            
            # Extract Video stats (get_uint64 returns [bool, value])
            v_success_j, v_jitter = v_stats.get_uint64("avg-jitter")
            v_success_l, v_loss = v_stats.get_uint64("num-lost")
            
            # Extract Audio stats
            a_success_j, a_jitter = a_stats.get_uint64("avg-jitter")
            a_success_l, a_loss = a_stats.get_uint64("num-lost")
            
            # Ensure we only log if access was successful (default to 0 otherwise)
            v_jitter = v_jitter if v_success_j else 0
            v_loss = v_loss if v_success_l else 0
            a_jitter = a_jitter if a_success_j else 0
            a_loss = a_loss if a_success_l else 0
            
            # Log to benchmarker
            self.benchmarker.collect_stats(
                v_jitter=v_jitter, 
                v_loss=v_loss, 
                a_jitter=a_jitter, 
                a_loss=a_loss
            )
            time.sleep(1.0)

    def _run_echo_service(self):
        """UDP Echo service for PC-side RTT (Latency) measurement."""
        echo_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            echo_socket.bind(("0.0.0.0", self.echo_port))
            print(f"Latency Echo Service active on port {self.echo_port}")
        except OSError:
            print(f"ERROR: Port {self.echo_port} is busy. Use 'sudo fuser -k {self.echo_port}/udp' to clear it.")
            self.running = False
            return
        
        while self.running:
            try:
                data, addr = echo_socket.recvfrom(1024)
                echo_socket.sendto(data, addr)
            except:
                break
        echo_socket.close()

    def start(self):
        self.running = True
        self.pipeline.set_state(Gst.State.PLAYING)
        
        # Start background services
        stats_thread = threading.Thread(target=self._listen_stats)
        echo_thread = threading.Thread(target=self._run_echo_service)
        stats_thread.daemon = True
        echo_thread.daemon = True
        stats_thread.start()
        echo_thread.start()
        
        print("UniCast Agent is now multi-streaming. PRESS CTRL+C TO STOP.")
        try:
            loop = GLib.MainLoop()
            loop.run()
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        print("\nShutting down UniCast Agent...")
        self.running = False
        self.pipeline.set_state(Gst.State.NULL)
        
        # Display session summary
        summary = self.benchmarker.get_summary()
        print("\n--- FINAL SESSION SUMMARY ---")
        for key, value in summary.items():
            print(f"{key}: {value}")
        sys.exit(0)

if __name__ == "__main__":
    agent = ReceiverAgent()
    agent.start()
