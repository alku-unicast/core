# Raspberry Pi 5 — UniCast Receiver Kurulum Rehberi

Bu rehber, bir Raspberry Pi 5'i sıfırdan kurarak UniCast alıcısına dönüştürmek için gereken tüm adımları içerir.
Çoklu Pi dağıtımı (Master İmaj, klonlama, sıfır-dokunuş kimlik) için `pi_deployment.md`'ye bakın.

> **Hedef OS:** Raspberry Pi OS **Bookworm (Debian 12)** veya **Trixie (Debian 13)** — 64-bit Lite
> Her ikisi de çalışır. Pi 5'te HW H.264 decoder yoktur, proje yazılımsal `avdec_h264` kullanır.
> Trixie'deki HW decoder regresyon raporları bu projeyi ETKİLEMEZ.

## Gereksinimler
- Raspberry Pi 5 (Herhangi bir varyant)
- MicroSD Kart (Min 16GB, Class 10)
- Raspberry Pi OS Lite **Bookworm veya Trixie** (64-bit)
- Aktif İnternet Bağlantısı (Kurulum için)

---

## Adım 1: OS Kurulumu ve İlk Ayarlar

1. **Raspberry Pi Imager** uygulamasını açın.
2. **OS:** `Raspberry Pi OS Lite (64-bit)` seçin (Bookworm veya Trixie).
3. **OS Customization (Ctrl+Shift+X):**
   - **Hostname:** `unicast-pi`
   - **Username/Password:** Belirleyin (Örn: `pi` / güçlü şifre)
   - **Wi-Fi:** Bağlanılacak okul/ofis ağını girin (Eduroam ise Adım 7'ye bakın).
   - **SSH:** Aktif edin.
4. Yazma işlemini tamamlayıp kartı Pi 5'e takın ve cihazı başlatın.

---

## Adım 2: Sistem Güncelleme ve Bağımlılıklar

SSH ile bağlanın: `ssh pi@unicast-pi.local`

### 2.1 Sistem Güncelleme
```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 GStreamer ve Medya Araçları
```bash
sudo apt install -y \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav \
  gstreamer1.0-alsa python3-gi python3-gst-1.0
```

### 2.3 Donanım Kontrol Araçları
```bash
sudo apt install -y cec-utils alsa-utils v4l-utils python3-pil
```

### 2.4 Kullanıcı İzinleri (DRM/KMS Erişimi)
Pi 5'te ekran çıkışı DRM/KMS üzerinden çalışır. `pi` kullanıcısının bu cihazlara erişmesi şart:
```bash
sudo usermod -aG video,render pi
```
> Bu komuttan sonra oturumu kapatıp tekrar açın veya `newgrp video` çalıştırın.

---

## Adım 3: Python Ortamı ve Proje Kurulumu

```bash
# Çalışma dizinini oluştur
mkdir -p ~/core/src/receiver
cd ~/core

# Sanal ortam oluştur (sistem paketlerine erişimle)
python3 -m venv --system-site-packages venv
source venv/bin/activate

# Gerekli Python paketleri
pip install Pillow psutil pandas
```

> `psutil` ve `pandas` — test aracı (`src/test/receiver/agent.py`) için gerekli.
> `Pillow` — idle ekranı PNG üretimi için gerekli.

---

## Adım 4: Standby (Bekleme) Ekranı

UniCast, yayın yokken ekranda minimalist bir bilgi ekranı gösterir.
Pi 5'te eski framebuffer (`/dev/fb0`) yerine **DRM/KMS** kullanılır.
Bu yüzden `fbi`/`fim` değil, **GStreamer `kmssink`** kullanılır.

**Mimari Karar:** Production `agent.py`, **Python GI bindings** ile GStreamer pipeline'larını
**tek process içinden** yönetecek (subprocess spawn/kill değil). Bu, test `agent.py`'nin
zaten kullandığı kanıtlanmış pattern'dir. Avantajları:
- Geçiş ~200ms (GStreamer state machine, OS process değil)
- Zombie process riski yok
- Hata yakalama kolay (GStreamer bus messages)

### 4.1 Pillow ile PNG Oluşturma (Python'da) --> renk paleti değişti beyaz zemin üzerinde yapıldı
```python
from PIL import Image, ImageDraw, ImageFont

def generate_idle_screen(pin, ip, temp):
    img = Image.new('RGB', (1920, 1080), color='black')
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
    
    draw.text((960, 350), f"PIN: {pin}", fill='white', font=font, anchor='mm')
    draw.text((960, 500), f"IP: {ip}", fill='white', font=font, anchor='mm')
    draw.text((960, 650), f"CPU: {temp}°C", fill='gray', font=font, anchor='mm')
    
    img.save('/tmp/idle.png')
```

### 4.2 DRM/KMS Üzerinden Gösterme
```bash
# Manuel test komutu — PNG'yi ekrana bas
gst-launch-1.0 filesrc location=/tmp/idle.png ! pngdec ! imagefreeze \
  ! videoconvert ! video/x-raw,width=1920,height=1080 \
  ! kmssink
```

> **Eğer "Permission denied" hatası alırsanız:** Adım 2.4'teki `usermod` komutunu uyguladığınızdan ve oturumu yeniden açtığınızdan emin olun.

### 4.3 Yayın Geçiş Mantığı (Python GI — tek process)
```
IDLE:     Pillow PNG üret → Gst.parse_launch("filesrc ! ... ! kmssink") → PLAYING
YAYINA:   idle_pipeline.set_state(NULL) → 200ms → receiver_pipeline → PLAYING
BİTİŞ:    receiver_pipeline.set_state(NULL) → idle_pipeline yeniden oluştur → PLAYING
```
> Tüm geçişler GStreamer state machine ile yönetilir. Tek Python process, subprocess yok.

---

## Adım 5: Donanım Kontrolü (HDMI-CEC ve Ekran Gücü)

Pi 5'te ekran kontrolü eski modellerden farklıdır. `vcgencmd display_power` artık çalışmaz.

- **HDMI-CEC Yapılandırması (İlk Sefer):**
  ```bash
  cec-ctl --playback
  ```

- **Projeksiyonu Aç (Yayına Başlarken):**
  ```bash
  cec-ctl -d /dev/cec0 --to 0 --image-view-on
  ```

- **Projeksiyonu Kapat/Beklemeye Al (Yayın Biterken):**
  ```bash
  cec-ctl -d /dev/cec0 --to 0 --standby
  ```

- **HDMI Sinyal Kontrolü (Pi 5 Lite / DRM):**
  Ekrana giden sinyali yazılımsal olarak kesmek için (CEC desteklemeyen cihazlar için):
  ```bash
  # Ekranı kapat (Sinyal yok)
  sudo sh -c 'echo "1" > /sys/class/graphics/fb0/blank'
  # Ekranı aç
  sudo sh -c 'echo "0" > /sys/class/graphics/fb0/blank'
  ```

> [!NOTE]
> CEC desteği projeksiyona bağlıdır. Monitörlerde genellikle kapalıdır. Saha testinde doğrulanmalıdır.

---

## Adım 6: Port Mimarisi ve Firewall

### 6.1 UniCast Port Haritası

| Port | Protokol | Amaç |
|------|----------|------|
| 5000 | UDP | Video RTP Stream |
| 5001 | UDP | PIN Auth + Heartbeat |
| 5002 | UDP | Audio RTP Stream |
| 5005 | UDP | Latency Echo (RTT) |
| 22   | TCP | SSH (yönetim) |

### 6.2 Firewall Kuralları
```bash
sudo apt install -y ufw
sudo ufw allow 5000/udp comment "UniCast Video"
sudo ufw allow 5001/udp comment "UniCast Auth"
sudo ufw allow 5002/udp comment "UniCast Audio"
sudo ufw allow 5005/udp comment "UniCast RTT Echo"
sudo ufw allow 22/tcp comment "SSH"
sudo ufw enable
```

---

## Adım 7: Eduroam / Wi-Fi Yapılandırması (Opsiyonel)

Eduroam gibi 802.1X kurumsal ağlarda `wpa_supplicant` konfigürasyonu:

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

```ini
network={
    ssid="eduroam"
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="unicast-proje@alanya.edu.tr"
    password="..."
    phase2="auth=MSCHAPV2"
}
```

> IT departmanından süresiz, çoklu bağlantı limitli bir **IoT servis hesabı** talep edin.
> Detaylar için `pi_deployment.md` Bölüm 2.1'e bakın.

---

## Adım 8: Otomatik Başlatma (Systemd)

Cihaz her açıldığında servisin başlaması için:

```bash
sudo nano /etc/systemd/system/unicast-agent.service
```

```ini
[Unit]
Description=UniCast Receiver Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=video
WorkingDirectory=/home/pi/core/src/receiver
ExecStartPre=/bin/sleep 10
ExecStart=/home/pi/core/venv/bin/python3 /home/pi/core/src/receiver/agent.py
Environment=PYTHONUNBUFFERED=1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Servisi aktifleştir:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now unicast-agent
```

**Önemli notlar:**
- `Group=video` → DRM/KMS (`kmssink`) erişimi sağlar
- `ExecStartPre=/bin/sleep 10` → Eduroam DHCP gecikmesini absorbe eder
- `PYTHONUNBUFFERED=1` → `journalctl -u unicast-agent -f` ile canlı log izlenebilir

---

## Adım 9: Test Doğrulama — GStreamer Pipeline

Tam sistemi test etmeden önce tek başına receiver pipeline'ını test edin:

```bash
# Terminal 1 (Pi'de): Sadece video alımı testi
source ~/core/venv/bin/activate
gst-launch-1.0 -v \
  udpsrc port=5000 caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=200 \
  ! rtph264depay ! h264parse ! avdec_h264 \
  ! videoconvert ! videoscale ! video/x-raw,width=1920,height=1080 \
  ! kmssink sync=true
```

```powershell
# Terminal 2 (PC'de): Video gönder
gst-launch-1.0.exe `
  d3d11screencapturesrc ! videoconvert ! video/x-raw,format=I420,framerate=30/1 `
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 `
  ! rtph264pay config-interval=1 pt=96 `
  ! udpsink host=<PI_IP> port=5000
```

> Pi 5'te HW H.264 decoder yoktur. `avdec_h264` (yazılımsal) kullanılır.
> Pi 5 CPU'su 1080p@30fps decode için yeterli güçtedir (~%40-60 CPU).

---

## Doğrulama Listesi

- [ ] `sudo usermod -aG video,render pi` uygulandı ve oturum yeniden açıldı mı?
- [ ] `gst-launch-1.0 videotestsrc ! kmssink` komutu ekranda görüntü veriyor mu?
- [ ] Pi açıldığında `/tmp/idle.png` oluşturulup `kmssink` ile gösteriliyor mu?
- [ ] PC'den video yayını başlatıldığında görüntü saniyeler içinde geliyor mu?
- [ ] `cec-ctl --playback` ile cihaz konfigüre edildi mi?
- [ ] `cec-ctl -d /dev/cec0 --to 0 --image-view-on` projeksiyonu açıyor mu?
- [ ] `sudo ufw status` tüm portları (5000, 5001, 5002, 5005, 22) gösteriyor mu?
- [ ] `journalctl -u unicast-agent -f` ile servis logları izlenebiliyor mu?
- [ ] `vcgencmd measure_temp` veya `cat /sys/class/thermal/thermal_zone0/temp` çalışıyor mu?

---

> **Firebase Notu:** Firebase entegrasyonu henüz tamamlanmadı. Bu rehber, Pi'yi Firebase olmadan
> temel GStreamer receiver olarak ayağa kaldırmak içindir. Firebase hazır olduğunda:
> - `pip install firebase-admin` eklenecek
> - `firebase-key.json` deploy edilecek
> - `agent.py`'ye Firebase presence modülü yazılacak

> **Donanım Notu:** Pi 5'te H.264 donanımsal çözücü yoktur. `avdec_h264` (yazılımsal) kullanılır.
> Şu ana kadar soğutmasız testlerde sorun yaşanmamıştır. Uzun süreli yayınlarda
> termal throttling gözlemlenirse aktif soğutucu eklenmelidir.
