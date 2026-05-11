# GStreamer Kurulum ve Kullanım Rehberi

Bu belge, GStreamer komutlarını test veya hata ayıklama amacıyla manuel çalıştırmak isteyen **geliştiriciler** için hazırlanmıştır.

> **UniCast uygulamasının son kullanıcılarının GStreamer kurmasına gerek yoktur.**  
> Uygulama, desteklenen tüm platformlarda GStreamer'ı otomatik olarak kendi içinde paketlenmiş şekilde getirir:
>
> - **Windows**: GStreamer MSVC binary dosyaları kurulum paketine dahildir
> - **Linux**: GStreamer, AppImage içine gömülüdür (`APPIMAGE_BUNDLE_GSTREAMER=1`)
> - **macOS**: `GStreamer.framework` uygulama paketiyle birlikte gelir

---

# 1. Geliştirici Kurulumu

Sistem mimarisi iki role ayrılmıştır:

- **Gönderici (Sender)**
- **Alıcı (Receiver)**

Cihazınızın rolüne göre aşağıdaki adımları uygulayın.

---

## Gönderici Bilgisayar Kurulumu (Developer Setup)

### Windows

Resmi GStreamer sitesinden **MSVC 64-bit Complete** sürümünü indirin:

`https://gstreamer.freedesktop.org/download/`

Kurulum sırasında tüm pluginlerin yüklenmesi için mutlaka **Complete** seçeneğini işaretleyin.

Kurulum tamamlandıktan sonra aşağıdaki dizini Windows ortam değişkenlerine (`PATH`) ekleyin:

```text
C:\gstreamer\1.0\msvc_x86_64\bin
````

> **Not:**
> UniCast uygulaması sistemde kurulu olan GStreamer'ı kullanmaz.
> Uygulama kendi paketlenmiş GStreamer kopyasını kullanır.
>
> Bu kurulum yalnızca terminalden manuel olarak `gst-launch-1.0` komutlarını çalıştırmak için gereklidir.

---

### Linux (Debian / Ubuntu)

```bash
sudo apt update
sudo apt install -y \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  gstreamer1.0-pipewire
```

> UniCast AppImage paketi kendi GStreamer sürümünü içerir.
> Yukarıdaki paketler yalnızca manuel terminal testleri için gereklidir.

---

### macOS

Manuel testler için Homebrew yerine resmi GStreamer framework sürümünü kurun.

İndirme adresi:

`https://gstreamer.freedesktop.org/download/`

**macOS universal installer** sürümünü indirip varsayılan konuma kurun:

```text
/Library/Frameworks/GStreamer.framework/
```

Daha sonra shell profilinize aşağıdaki satırı ekleyin:

```bash
export PATH="/Library/Frameworks/GStreamer.framework/Versions/Current/bin:$PATH"
```

> `brew install gstreamer` komutu farklı bir derleme kurar ve gerekli bazı pluginleri içermeyebilir (`vtenc_h264`, `avfvideosrc` gibi).
> En iyi uyumluluk için resmi kurulum paketi kullanılmalıdır.

---

## Alıcı Cihaz Kurulumu (Receiver Setup)

### Raspberry Pi 5 (ve diğer Linux tabanlı alıcılar)

Pi alıcısı, `src/receiver/agent.py` scriptini çalıştırır ve GStreamer pipeline'larını otomatik olarak yönetir.

Gerekli paketleri kurun:

```bash
sudo apt update
sudo apt install -y \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  python3-pip

pip3 install firebase-admin
```

Ardından agent'ı başlatın:

```bash
python3 src/receiver/agent.py
```

Agent:

* UDP `5001` portunu dinler
* Kontrol komutlarını alır
* Yayın başladığında gerekli GStreamer receive pipeline'ını otomatik oluşturur

---

# 2. Manuel Pipeline Komutları (Sadece Test Amaçlı)

Bu komutlar, UniCast uygulamasını çalıştırmadan doğrudan video aktarım yolunu test etmek için kullanılabilir.

`<PI_IP_ADDRESS>` kısmını Raspberry Pi cihazınızın yerel IP adresiyle değiştirin.

> **Sıralama:**
> Önce **Receiver**, sonra **Sender** başlatılmalıdır.

---

## Senaryo 1: Windows Sender → Raspberry Pi 5 Receiver

### Adım 1 — Raspberry Pi 5 (Receiver)

```bash
gst-launch-1.0 -v udpsrc port=5000 \
  caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=200 \
  ! rtph264depay \
  ! avdec_h264 \
  ! autovideosink sync=false
```

---

### Adım 2 — Windows (Sender)

```cmd
gst-launch-1.0.exe ^
  d3d11screencapturesrc monitor-index=0 ^
  ! queue ^
  ! d3d11download ^
  ! videoconvert ^
  ! videoscale ^
  ! "video/x-raw,format=NV12,width=1920,height=1080,framerate=30/1" ^
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=15 intra-refresh=true ^
  ! rtph264pay config-interval=1 pt=96 ^
  ! queue ^
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

> Windows tarafında `d3d11download` zorunludur.
> Bu eleman, görüntünün GPU belleğinden CPU belleğine aktarılmasını sağlar.
>
> Kullanılmazsa pipeline `caps negotiation` hatası verir.

---

## Senaryo 2: Linux Sender → Raspberry Pi 5 Receiver

### Adım 1 — Raspberry Pi 5 (Receiver)

Senaryo 1'deki receiver komutuyla aynıdır.

---

### Adım 2 — Linux (Sender)

```bash
gst-launch-1.0 \
  ximagesrc display-name=:0 use-damage=0 \
  ! videoconvert \
  ! videoscale \
  ! "video/x-raw,format=I420,width=1920,height=1080,framerate=30/1" \
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=15 intra-refresh=true \
  ! rtph264pay config-interval=1 pt=96 \
  ! queue \
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

> Wayland ortamında `ximagesrc` yerine `pipewiresrc` kullanılmalıdır.
>
> UniCast uygulaması bunu otomatik olarak yönetir.

---

## Senaryo 3: Raspberry Pi 3B+ (Düşük Güçlü Receiver)

Pi 3B+, `1080p@30fps` çözünürlüğü yazılımsal olarak decode edemez.

Bu nedenle daha düşük ayarlar kullanılmalıdır.

---

### Pi 3B+ Receiver

```bash
DISPLAY=:0 gst-launch-1.0 udpsrc port=5000 \
  caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=100 \
  ! rtph264depay \
  ! h264parse \
  ! avdec_h264 \
  ! videoconvert \
  ! kmssink sync=false
```

---

### Windows Sender → Pi 3B+

```cmd
gst-launch-1.0.exe ^
  d3d11screencapturesrc monitor-index=0 ^
  ! queue ^
  ! d3d11download ^
  ! videoconvert ^
  ! videoscale ^
  ! "video/x-raw,format=NV12,width=1280,height=720,framerate=15/1" ^
  ! x264enc tune=zerolatency bitrate=2000 speed-preset=ultrafast key-int-max=30 intra-refresh=true ^
  ! rtph264pay config-interval=1 pt=96 ^
  ! queue ^
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

---

# 3. Test Sonuçları

## Raspberry Pi 5 (Ana Hedef Platform)

| Metrik              | Sonuç                            |
| ------------------- | -------------------------------- |
| Gecikme             | `< 150 ms`                       |
| Çözünürlük          | `1080p@30fps`'e kadar            |
| Stabilite           | Kararlı                          |
| Donanım hızlandırma | Receiver tarafında gerekli değil |

---

## Raspberry Pi 3B+ (Düşük Güçlü Sistem)

| Metrik          | Sonuç                                   |
| --------------- | --------------------------------------- |
| Çözünürlük      | `720p`                                  |
| FPS             | `15`                                    |
| Stabilite       | Çalışıyor ancak tam optimize değil      |
| Kullanılan sink | `kmssink` (masaüstü ortamı gerektirmez) |

---

# 4. Sorun Giderme

| Problem                                      | Sebep                                | Çözüm                                                    |
| -------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `No such element: d3d11screencapturesrc`     | Eksik GStreamer kurulumu             | MSVC Complete sürümünü kur                               |
| Windows'ta `caps negotiation failed`         | `d3d11download` eksik                | `videoconvert` öncesine `! d3d11download !` ekle         |
| `Could not open display`                     | X11 oturumu yok                      | `DISPLAY=:0` ayarla veya Wayland'da `pipewiresrc` kullan |
| Pi headless modda `autovideosink` çalışmıyor | Fiziksel ekran bağlı değil           | `kmssink` veya `fpsdisplaysink` kullan                   |
| Yüksek gecikme (`>300ms`)                    | `rtpjitterbuffer latency` çok yüksek | `latency=50` veya `latency=100` kullan                   |
| Pi'de siyah ekran                            | Decoder buffer underrun              | Bitrate artır veya çözünürlüğü düşür                     |
