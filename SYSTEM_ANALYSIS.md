# UniCast — Sistem Mimarisi ve Teknik Analiz
# Oluşturulma: 2026-04-14
# Durum: AKTİF GELİŞTİRME

---

## 1. Kod Yapısı (Code Structure)

```
app/src-tauri/
├── src/
│   ├── main.rs                     ← Tauri giriş noktası, tray, WDA_EXCLUDE
│   ├── lib.rs                      ← Komut kayıtları, setup hook
│   ├── commands/
│   │   ├── encoder.rs              ← detect_encoder (GPU chain test)
│   │   ├── stream.rs               ← start/stop_stream, heartbeat
│   │   ├── auth.rs                 ← verify_pin, wake_pi_hdmi (UDP)
│   │   ├── audio.rs                ← get_audio_devices, mute_system_audio
│   │   ├── network.rs              ← RTT monitor, stream-health events
│   │   ├── windows.rs              ← get_open_windows (EnumWindows)
│   │   ├── monitors.rs             ← get_monitors (EnumDisplayMonitors)
│   │   ├── capture.rs              ← set_bar_capture_exclusion
│   │   ├── settings.rs             ← read_settings, write_settings
│   │   └── mod.rs
│   ├── gstreamer/
│   │   ├── path_setup.rs           ← get_gst_launch(), PATH env setup
│   │   └── pipeline.rs             ← build_pipeline(), encoder_params()
│   └── utils/
│       ├── process.rs              ← kill_gstreamer()
│       └── capture_exclusion.rs    ← WDA_EXCLUDEFRONCAPTURE (Windows)
└── gstreamer/                      ← BUNDLED GStreamer (portable)
    ├── bin/                        ← gst-launch-1.0.exe + 154 dosya
    ├── lib/                         ← DLL'ler ve gstreamer-1.0 plugin'leri
    ├── etc/, include/, libexec/, share/  ← TEMİZLENECEK
    └── lib/gstreamer-1.0/          ← 259 plugin dosyası
```

---

## 2. GStreamer Pipeline

### Video Pipeline (Windows)
```
d3d11screencapturesrc monitor-index=0 ! queue ! d3d11download ! videoconvert ! videoscale !
video/x-raw,format=NV12,width=1920,height=1080,framerate=30/1 ! queue !
{encoder} bitrate=3000 {encoder_params} !
rtph264pay config-interval=1 ! queue ! udpsink host={IP} port=5000
```

### Audio Pipeline (Windows)
```
wasapi2src loopback=true device={device_id} ! queue ! audioconvert ! audioresample !
opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={IP} port=5002
```

---

## 3. Encoder Zinciri ve Parametreleri

### Windows Encoder Chain (pipeline.rs)
```rust
const ENCODER_CHAIN: &[(&str, &str)] = &[
    ("nvh264enc", "NVIDIA"),
    ("qsvh264enc", "Intel QSV"),
    ("amfh264enc", "AMD AMF"),
    ("x264enc", "Software"),
];
```

### Encoder Parametreleri
| Encoder | Parametreler |
|---------|-------------|
| x264enc | tune=zerolatency speed-preset=superfast key-int-max=15 intra-refresh=true |
| nvh264enc | zerolatency=true gop-size=15 |
| qsvh264enc | target-usage=balanced rate-control=cbr |
| amfh264enc | rate-control=cbr target-usage=balanced |
| vtenc_h264 | real-time=true |
| vaapih264enc | rate-control=cbr |

---

## 4. GStreamer Klasörü — GERÇEK İçerik

### bin/ (155 dosya)
Gerekli: `gst-launch-1.0.exe` (1 tane)

Silinecek: `gst-dots-viewer.exe` (17MB), `gst-play-1.0.exe`, `gst-discoverer-1.0.exe`, `ges-launch-1.0.exe`, `gdbus.exe`, `gsettings.exe`, `pkg-config.exe`, `json-glib-*.exe`, tüm `.exe` debug araçları (42+ exe)

### lib/gstreamer-1.0/ (259 plugin)
**Kullanılan (keep):**
- `gstd3d11.dll` — Windows D3D11 screen capture
- `gstx264.dll` — H.264 software encoder
- `gstopus.dll`, `gstopusparse.dll` — Opus audio codec
- `gstrtp.dll`, `gstrtpmanager.dll` — RTP streaming
- `gstudp.dll` — UDP sink
- `gstaudio.dll`, `gstaudioconvert.dll`, `gstaudioresample.dll`, `gstvolume.dll` — Audio processing
- `gstvideo.dll`, `gstvideoconvertscale.dll` — Video processing
- `gstwasapi2.dll` — Windows audio (loopback)
- `gstcoreelements.dll` — queue, tee, fakesink
- `gstcuda.dll` — NVIDIA CUDA support

**Silinecek (259'dan):**
- WebRTC: `gstwebrtc.dll`, `gstrswebrtc.dll`, `gstrwebrtchttp.dll`, `gstwebrtcdsp.dll`
- Cloud/AI: `gstaws.dll`, `gstelevenlabs.dll`
- Codec'ler: `gstx265.dll` (HEVC), `gstrav1e.dll` (AV1), `gstvpx.dll` (VP8/9), `gstdav1d.dll`, `gstopenh264.dll`
- Editing: `gstges.dll`, `ges-1.0-0.dll`
- Format'lar: `gstmatroska.dll`, `gstflv.dll`, `gstmp4.dll` (muxer değil parser — gerekebilir)
- Ses alternatif: `gstflac.dll`, `gstspeex.dll`, `gstsbc.dll`, `gstlame.dll` (MP3)
- Donanım: `gstdecklink.dll`, `gstndi.dll`
- Linux/macOS: `gstjack.dll`, `gstwasapi.dll` (eski Windows API)
- Debug: `gstcheck.dll`, `gstdebug.dll`
- Diğer: `gstpython.dll`, `gstjavascript.dll`, `gstfrei0r.dll`, `gstlibav.dll`

### Klasörler (temizlenecek)
- `include/` — C++ header dosyaları (compile-time, runtime gerekmiyor)
- `share/` — Doküman + 42 dil locale dosyası (locale temizlenebilir)
- `libexec/` — Helper servisleri
- `frei0r-1/` — Video efekt plugin'leri
- `site-packages/` — Python paketleri (cairo, pygobject)

---

## 5. Bilinen Sorunlar

### A. Encoder detection gerçek capture'ı test etmiyor
`encoder.rs` şu anda `videotestsrc` ile test ediyor. Bu GPU yolunu test etmez — bazı sistemlerde `videotestsrc` çalışır ama `d3d11screencapturesrc` çalışmaz.

### B. \\?\ path prefix sorunu
`tauri::path().resource_dir()` Windows'ta `\\?\D:\...` formatında path döndürüyor. `cmd.exe` bu formatı anlamıyor. Şu an `path_setup.rs`'de strip ediliyor ama çift kontrol yapılıyor (hem path_setup hem stream).

### C. Audio device ID tam pipeline'a aktarılıyor
`pipeline.rs` artık `wasapi2src device={id}` kullanıyor — bu doğru.

### D. macOS'ta ses yakalama yok
`pipeline.rs`'de macOS için audio bölümü boş döndürülüyor. Kullanıcı ses seçse bile yayın yapılmıyor.

---

## 6. UI Durumu (ui_issues.md — 2026-04-14)

**Çözülenler:**
- stopStream fonksiyonu ana ekranda tanımsız hatası (ConnectionSetup.tsx)
- Ses widget üst yuvarlatma kesilmesi
- stopStream referans hatası (mini ada çalışıyor, ana ekran çalışmıyor)

**Devam Eden:**
- Mini ada kapalıyken ana ekranda eksik widget'lar (ses slider, network health)
- Translucent dark ile normal dark arasında görsel fark yok

---

## 7. Pi Tarafı Protokol

```
UDP:5001 — PIN doğrulama ve kontrol
  PIN:<pin>       → OK / FAIL:<kalan> / BUSY
  WAKE            → READY (HDMI açılır)
  HEARTBEAT       → (Pi timeout'u resetler, 5s timeout var)
  STOP            → Graceful shutdown

UDP:5005 — RTT echo (stream-health ölçümü)
  PING → PONG (RTT hesaplanır)

Video: UDP:5000 (RTP/H264)
Audio: UDP:5002 (RTP/Opus)
```

---

## 8. Önemli Kararlar

| Karar | Durum |
|-------|-------|
| Tailwind v3 (v4 WebView uyumsuzluğu) | ✅ Kesin |
| Firebase JS SDK (güvenlik kurallarda) | ✅ Kesin |
| RTT-based quality indicator | ✅ Kesin |
| WDA_EXCLUDEFROMCAPTURE (Win 10+) | ✅ Kesin |
| macOS'ta ses yok (native loopback yok) | ✅ Kesin |
| Encoder zinciri: nvh264enc → qsv → amf → x264 | ✅ Kesin |

---

## 9. Henüz Çözülmemiş Sorular

1. **Encoder detection** `videotestsrc` yerine `d3d11screencapturesrc` ile test edilmeli mi?
2. **AMD AMF** gerçek donanımda test edilmeli — parametreler doğru mu?
3. **d3d11download** her Windows sistemde gerekli mi, yoksa sadece cross-adapter (laptop) durumunda mı?
4. **Thinning** — plugin silme işlemi hangi sırayla yapılmalı (önce test gerekenler mi, yoksa görüldüğü gibi silinenler mi)?