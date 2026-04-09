import os
import time
import socket
import random
import threading
from PIL import Image, ImageDraw, ImageFont
import gi

gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

class State:
    IDLE = "IDLE"
    STREAMING = "STREAMING"
    RECONNECTING = "RECONNECT"

class UniCastReceiver:
    def __init__(self):
        Gst.init(None)
        self.main_loop = GLib.MainLoop()
        
        # Pipelines
        self.idle_pipe = None
        self.video_pipe = None
        self.audio_pipe = None
        self.current_state = State.IDLE
        
        # Session Data
        self.pin = self.generate_new_pin()
        self.ip_address = self.get_ip_address()
        self.last_heartbeat = 0
        self.grace_period = 20 # saniye (Hocaya geri gelme şansı)
        
        self.COLORS = {
            'bg_primary': '#F2F5F7',
            'navy': '#1C407D',
            'turquoise': '#00AECD',
            'gold': '#D1AD53',
            'text_muted': '#5D6B82'
        }
        
        self.idle_image_path = "/tmp/idle.png"
        self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.udp_sock.bind(('0.0.0.0', 5001))
        
        print(f"UniCast Smart Agent v2 Başlatıldı. PIN: {self.pin}")
        self.setup_idle_screen()
        
        threading.Thread(target=self.udp_listener, daemon=True).start()
        threading.Thread(target=self.session_monitor, daemon=True).start()

    def generate_new_pin(self):
        return str(random.randint(1000, 9999))

    def get_ip_address(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        except: return "Ağ Bağlantısı Yok"

    def get_cpu_temp(self):
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return f"{int(f.read()) / 1000.0:.0f}"
        except: return "??"

    def create_ui_image(self):
        img = Image.new('RGB', (1920, 1080), color=self.COLORS['bg_primary'])
        draw = ImageDraw.Draw(img)
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        
        try:
            f_title = ImageFont.truetype(font_path, 80)
            f_pin = ImageFont.truetype(font_path, 180)
            f_label = ImageFont.truetype(font_path, 50)
            f_info = ImageFont.truetype(font_path, 60)
        except: f_title = f_pin = f_label = f_info = ImageFont.load_default()

        # Tasarım
        draw.rectangle([0, 0, 1920, 15], fill=self.COLORS['turquoise'])
        draw.text((960, 200), "UniCast Mirroring", fill=self.COLORS['turquoise'], font=f_title, anchor='mm')
        
        if self.current_state in [State.IDLE, State.RECONNECTING]:
            if self.current_state == State.RECONNECTING:
                draw.text((960, 400), "BAĞLANTI KOPTU - BEKLENİYOR", fill=self.COLORS['gold'], font=f_label, anchor='mm')
            else:
                draw.text((960, 400), "GİRİŞ KODU", fill=self.COLORS['text_muted'], font=f_label, anchor='mm')
            
            draw.text((960, 540), self.pin, fill=self.COLORS['navy'], font=f_pin, anchor='mm')

        draw.text((640, 900), "IP ADRESİ", fill=self.COLORS['text_muted'], font=f_label, anchor='mm')
        draw.text((640, 970), self.ip_address, fill=self.COLORS['navy'], font=f_info, anchor='mm')
        draw.text((1280, 900), "SİSTEM", fill=self.COLORS['text_muted'], font=f_label, anchor='mm')
        draw.text((1280, 970), f"AKTİF — {self.get_cpu_temp()}°C", fill=self.COLORS['gold'], font=f_info, anchor='mm')
        draw.rectangle([0, 1065, 1920, 1080], fill=self.COLORS['navy'])
        img.save(self.idle_image_path)

    def setup_idle_screen(self):
        self.create_ui_image()
        if self.idle_pipe: self.idle_pipe.set_state(Gst.State.NULL)
        pipeline_str = f"filesrc location={self.idle_image_path} ! pngdec ! imagefreeze ! videoconvert ! video/x-raw,width=1920,height=1080 ! kmssink sync=false"
        self.idle_pipe = Gst.parse_launch(pipeline_str)
        self.idle_pipe.set_state(Gst.State.PLAYING)

    def start_streaming(self):
        if self.current_state == State.STREAMING: return
        print("Yayına Geçiliyor (Görüntü + Ses)...")
        if self.idle_pipe: self.idle_pipe.set_state(Gst.State.NULL)
        
        # Video Pipeline (Port 5000)
        v_pipeline = (
            f"udpsrc port=5000 caps=\"application/x-rtp, media=video, encoding-name=H264, payload=96\" ! "
            f"rtpjitterbuffer latency=200 ! rtph264depay ! h264parse ! avdec_h264 ! "
            f"videoconvert ! video/x-raw,width=1920,height=1080 ! kmssink sync=true"
        )
        
        # Audio Pipeline (Port 5002)
        a_pipeline = (
            f"udpsrc port=5002 caps=\"application/x-rtp, media=audio, clock-rate=48000, encoding-name=OPUS, payload=96\" ! "
            f"rtpopusdepay ! opusdec ! audioconvert ! alsasink sync=true"
        )
        
        self.video_pipe = Gst.parse_launch(v_pipeline)
        self.audio_pipe = Gst.parse_launch(a_pipeline)
        
        self.video_pipe.set_state(Gst.State.PLAYING)
        self.audio_pipe.set_state(Gst.State.PLAYING)
        self.current_state = State.STREAMING

    def stop_streaming(self, immediate_new_pin=False):
        """Yayını durdurur. immediate_new_pin=True ise beklemeden PIN yeniler."""
        if self.video_pipe: self.video_pipe.set_state(Gst.State.NULL)
        if self.audio_pipe: self.audio_pipe.set_state(Gst.State.NULL)
        
        if immediate_new_pin:
            self.pin = self.generate_new_pin()
            print(f"PIN Hemen Yenilendi: {self.pin}")
            self.current_state = State.IDLE
        else:
            # Grace period'a (bekleme süresine) gir
            self.current_state = State.RECONNECTING
            print("Yayın durdu, hoca bekleniyor (PIN aynı kaldı)...")
            
        self.setup_idle_screen()

    def udp_listener(self):
        while True:
            data, addr = self.udp_sock.recvfrom(1024)
            msg = data.decode().strip()
            
            if msg.startswith("AUTH "):
                received_pin = msg.split(" ")[1]
                if received_pin == self.pin:
                    self.udp_sock.sendto(b"SUCCESS", addr)
                    self.last_heartbeat = time.time()
                    self.start_streaming()
                else: self.udp_sock.sendto(b"FAIL", addr)
            
            elif msg == "HEARTBEAT":
                self.last_heartbeat = time.time()
                if self.current_state == State.RECONNECTING:
                    print("Bağlantı tazelendi, yayına devam!")
                    self.start_streaming()
            
            elif msg == "STOP":
                # STOP komutu gelince 15 saniye pay veriyoruz, hemen PIN değiştirmiyoruz
                self.stop_streaming(immediate_new_pin=False)
                self.last_heartbeat = time.time() # Grace period buradan başlıyor

    def session_monitor(self):
        while True:
            time.sleep(1)
            now = time.time()
            
            if self.current_state == State.STREAMING:
                if now - self.last_heartbeat > 5: # 5 saniye heartbeat yoksa kesildi say
                    self.stop_streaming(immediate_new_pin=False)
            
            elif self.current_state == State.RECONNECTING:
                # Grace period'u (20sn) doldurduysa artık PIN değiştir ve IDLE'a dön
                if now - self.last_heartbeat > self.grace_period:
                    print("Bekleme süresi bitti. Yeni PIN üretiliyor...")
                    self.pin = self.generate_new_pin()
                    self.current_state = State.IDLE
                    self.setup_idle_screen()

    def run(self):
        try: self.main_loop.run()
        except KeyboardInterrupt: pass

if __name__ == "__main__":
    receiver = UniCastReceiver()
    receiver.run()
