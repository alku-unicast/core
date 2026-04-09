import gi
import time
import threading
import sys
import os
import socket
import subprocess
import argparse

gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

from benchmarker import Benchmarker

class ReceiverAgent:
    def __init__(self, mode="audio", video_port=5000, audio_port=5002, echo_port=5005):
        """
        mode: "silent" = video only, "audio" = video + audio
        """
        Gst.init(None)
        self.mode = mode
        self.video_port = video_port
        self.audio_port = audio_port
        self.echo_port = echo_port
        self.benchmarker = Benchmarker()
        self.running = False

        if self.mode == "audio":
            self._max_system_volume()

        self.create_pipeline()

    def _max_system_volume(self):
        try:
            subprocess.run(["amixer", "sset", "Master", "100%"], capture_output=True)
            subprocess.run(["pactl", "set-sink-volume", "@DEFAULT_SINK@", "100%"], capture_output=True)
        except Exception as e:
            print(f"Volume adjustment non-critical warning: {e}")

    def on_frame_decoded(self, pad, info):
        self.benchmarker.on_frame_decoded()
        return Gst.PadProbeReturn.OK

    def on_video_buffer(self, pad, info):
        """Probe for throughput measurement: counts bytes on the video udpsrc src pad."""
        buf = info.get_buffer()
        if buf:
            self.benchmarker.on_bytes_received(buf.get_size())
        return Gst.PadProbeReturn.OK

    def create_pipeline(self):
        if self.mode == "audio":
            print("Initializing Audio+Video Pipeline...")
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
        else:
            print("Initializing Video-Only (Silent) Pipeline...")
            pipeline_str = (
                f"udpsrc port={self.video_port} name=video_src "
                'caps="application/x-rtp, media=video, encoding-name=H264, payload=96" '
                "! rtpjitterbuffer name=vjbuf latency=200 mode=slave do-lost=true "
                "! rtph264depay ! h264parse ! avdec_h264 "
                "! videoconvert ! videoscale ! video/x-raw,width=1920,height=1080 "
                "! videoconvert ! fpsdisplaysink name=video_sink sync=true text-overlay=true"
            )

        self.pipeline = Gst.parse_launch(pipeline_str)

        # Probe: frame counter on video sink
        video_sink = self.pipeline.get_by_name("video_sink")
        sink_pad = video_sink.get_static_pad("sink")
        sink_pad.add_probe(Gst.PadProbeType.BUFFER, self.on_frame_decoded)

        # Probe: throughput counter on video udpsrc src pad
        video_src = self.pipeline.get_by_name("video_src")
        src_pad = video_src.get_static_pad("src")
        src_pad.add_probe(Gst.PadProbeType.BUFFER, self.on_video_buffer)

    def _listen_stats(self):
        vjbuf = self.pipeline.get_by_name("vjbuf")

        # Audio jitter buffer only exists in audio mode
        ajbuf = None
        if self.mode == "audio":
            ajbuf = self.pipeline.get_by_name("ajbuf")

        while self.running:
            v_stats = vjbuf.get_property("stats")
            v_success_j, v_jitter = v_stats.get_uint64("avg-jitter")
            v_success_l, v_loss   = v_stats.get_uint64("num-lost")
            v_jitter = v_jitter if v_success_j else 0
            v_loss   = v_loss   if v_success_l else 0

            a_jitter, a_loss = 0, 0
            if ajbuf:
                a_stats = ajbuf.get_property("stats")
                a_success_j, a_jitter = a_stats.get_uint64("avg-jitter")
                a_success_l, a_loss   = a_stats.get_uint64("num-lost")
                a_jitter = a_jitter if a_success_j else 0
                a_loss   = a_loss   if a_success_l else 0

            self.benchmarker.collect_stats(
                v_jitter=v_jitter,
                v_loss=v_loss,
                a_jitter=a_jitter,
                a_loss=a_loss
            )
            time.sleep(1.0)

    def _run_echo_service(self):
        """UDP Echo service for RTT (latency) measurement from PC side."""
        echo_socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            echo_socket.bind(("0.0.0.0", self.echo_port))
            echo_socket.settimeout(1.0)
            print(f"Latency Echo Service active on port {self.echo_port}")
        except OSError:
            print(f"ERROR: Port {self.echo_port} busy. Run: sudo fuser -k {self.echo_port}/udp")
            self.running = False
            return

        while self.running:
            try:
                data, addr = echo_socket.recvfrom(1024)
                echo_socket.sendto(data, addr)
            except socket.timeout:
                continue
            except:
                break
        echo_socket.close()

    def start(self):
        self.running = True
        self.pipeline.set_state(Gst.State.PLAYING)

        stats_thread = threading.Thread(target=self._listen_stats, daemon=True)
        echo_thread  = threading.Thread(target=self._run_echo_service, daemon=True)
        stats_thread.start()
        echo_thread.start()

        print(f"UniCast Agent running in [{self.mode.upper()}] mode. Press Ctrl+C to stop.")
        try:
            loop = GLib.MainLoop()
            loop.run()
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        print("\nShutting down UniCast Agent...")
        self.running = False
        self.pipeline.set_state(Gst.State.NULL)

        summary = self.benchmarker.get_summary()
        print("\n--- FINAL SESSION SUMMARY ---")
        for key, value in summary.items():
            print(f"  {key}: {value}")
        sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UniCast Receiver Agent")
    parser.add_argument("--mode", choices=["silent", "audio"], default="audio",
                        help="silent = video only, audio = video + audio")
    parser.add_argument("--video-port",    type=int, default=5000)
    parser.add_argument("--audio-port",    type=int, default=5002)
    parser.add_argument("--echo-port",     type=int, default=5005)
    parser.add_argument("--benchmark-csv", type=str, default="benchmark_log.csv")
    parser.add_argument("--iteration",     type=int, default=0,
                        help="Iteration number passed by orchestrator (0 = standalone)")
    args = parser.parse_args()

    agent = ReceiverAgent(
        mode=args.mode,
        video_port=args.video_port,
        audio_port=args.audio_port,
        echo_port=args.echo_port
    )
    # Pass metadata to benchmarker so it gets written to CSV
    agent.benchmarker = __import__('benchmarker').Benchmarker(log_path=args.benchmark_csv)
    agent.benchmarker.set_test_metadata(mode=args.mode, iteration=args.iteration)
    agent.start()