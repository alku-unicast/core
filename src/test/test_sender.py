import socket
import time
import subprocess
import threading

# Pi Ayarları
PI_IP = "10.50.0.113"
CTRL_PORT = 5001
VIDEO_PORT = 5000
AUDIO_PORT = 5002

def send_heartbeat(stop_event):
    """Yayın sırasında Pi'ye her 2 saniyede bir 'Ben buradayım' der."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        while not stop_event.is_set():
            sock.sendto(b"HEARTBEAT", (PI_IP, CTRL_PORT))
            time.sleep(2)

def start_test_session(pin):
    """Oturumu başlatır, PIN doğrular ve GERÇEK EKRAN/SES yayını açar."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
        sock.settimeout(2)
        
        print(f"[{pin}] PIN kodu doğrulanıyor...")
        sock.sendto(f"AUTH {pin}".encode(), (PI_IP, CTRL_PORT))
        
        try:
            data, addr = sock.recvfrom(1024)
            if data.decode() == "SUCCESS":
                print("✓ BAŞARILI: Ekran ve Ses Paylaşımı Başlıyor!")
                
                # Heartbeat Başlat
                stop_hb = threading.Event()
                hb_thread = threading.Thread(target=send_heartbeat, args=(stop_hb,))
                hb_thread.start()
                
                # GERÇEK YAYIN KOMUTU (Windows Masaüstü + Sistem Sesi)
                # Not: d3d11screencapturesrc en düşük gecikmeli Windows yakalayıcıdır.
                cmd = (
                    f"gst-launch-1.0.exe -v "
                    f"d3d11screencapturesrc ! videoconvert ! video/x-raw,format=I420,framerate=30/1 ! "
                    f"x264enc tune=zerolatency bitrate=4000 speed-preset=superfast key-int-max=30 ! "
                    f"rtph264pay config-interval=1 pt=96 ! udpsink host={PI_IP} port={VIDEO_PORT} "
                    f"wasapisrc loopback=true ! audioconvert ! opusenc bitrate=128000 ! "
                    f"rtpopuspay ! udpsink host={PI_IP} port={AUDIO_PORT}"
                )
                
                print("\nŞU AN EKRANINIZ VE SESİNİZ PAYLAŞILIYOR!")
                print("Durdurmak için Ctrl+C tuşlarına basın.")
                
                try:
                    subprocess.run(cmd, shell=True)
                except KeyboardInterrupt:
                    print("\nYayın durduruldu.")
                finally:
                    stop_hb.set()
                    sock.sendto(b"STOP", (PI_IP, CTRL_PORT))
                    print("✓ Oturum kapatıldı (Pi 20 saniye bekleyecek).")
            else:
                print("✗ HATA: Yanlış PIN!")
        except socket.timeout:
            print("✗ HATA: Pi yanıt vermiyor.")

if __name__ == "__main__":
    print("--- UniCast Gerçek Ekran/Ses Yansıtma Testi ---")
    user_pin = input("Ekranda gördüğünüz PIN kodunu girin: ")
    start_test_session(user_pin)
