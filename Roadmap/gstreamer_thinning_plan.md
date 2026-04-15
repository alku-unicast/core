# GStreamer Thinning (Boyut Optimizasyonu) Planı
# Güncelleme: 2026-04-14 — GERÇEK DOSYA LİSTESİNE DAYALI

## Mevcut Durum

GStreamer klasörü: `app/src-tauri/gstreamer/`
- **bin/** — 155 dosya (sadece 1 tanesi gerekli)
- **lib/gstreamer-1.0/** — 259 plugin dosyası (~20-30 tanesi kullanılıyor)
- **Diğer klasörler** — include, share, libexec, etc (tümü gereksiz)

---

## 1. Bin Klasörü — Silinecekler

**Gerekli:** `gst-launch-1.0.exe` (sadece bu)

**Silinecek (.exe dosyaları):**
- `gst-dots-viewer.exe` — 17MB debug görselleştirici
- `gst-play-1.0.exe`, `gst-player-1.0-0.dll` — medya oynatıcı
- `gst-discoverer-1.0.exe` — medya keşif aracı
- `gst-validate-*.exe` — validasyon araçları (6+ dosya)
- `gst-device-monitor-1.0.exe` — cihaz izleyici
- `ges-launch-1.0.exe` — video editing service launcher
- `gdbus.exe` — GLib D-Bus sistem aracı
- `gsettings.exe` — GLib ayar aracı
- `pkg-config.exe` — build tool
- `json-glib-*.exe` — debug/validasyon araçları
- `gdk-pixbuf-*.exe` — görsel araçlar
- `glib-compile-schemas.exe`, `gio-querymodules.exe` — GLib sistem araçları

**Silinecek (.dll dosyaları):**
- `ges-1.0-0.dll` — GStreamer Editing Services
- `gst-shell` — debug shell

**Tahmini kurtarılacak:** ~50MB+

---

## 2. Lib Klasörü — Silinecek Klasörler

**Silinecek:**
- `include/` — C++ header dosyaları (compile-time, runtime gerekmiyor)
- `libexec/` — yardımcı servisler
- `frei0r-1/` — video efekt plugin'leri (frei0r parametresi hiç kullanılmıyor)
- `site-packages/` — Python paketleri (cairo, pygobject, pycairo, gi)

**Kismen silinecek:**
- `share/` — dokümanlar silinebilir ama **locale/ klasörü kritik** olabilir (GStreamer kendi .DLL'leri için locale kullanabilir)
  - Test edilmeden silinmemeli — locale olmadan hata verebilir

**Silinecek alt klasörler (share/ içinde):**
- `aclocal/`, `fontconfig/`, `gstreamer-1.0/validate/` — debug/validasyon dosyaları

---

## 3. Plugin Klasörü (lib/gstreamer-1.0/) — Silinecekler

### A. WebRTC Grubu (~8 DLL) — KESİN SİL
```
gstwebrtc.dll
gstrswebrtc.dll
gstrwebrtchttp.dll
gstwebrtcdsp.dll
nice-10.dll          ← WebRTC dependency
srtp2-1.dll          ← WebRTC dependency (RTP encryption)
libsrt.dll           ← WebRTC/SRT dependency
gstsctp.dll          ← SCTP protocol
```
**Neden:** WebRTC kullanılmıyor. Pi ile UDP üzerinden direct streaming yapılıyor.

### B. Cloud/AI Servisleri (~3 DLL) — KESİN SİL
```
gstaws.dll           ← AWS Kinesis
gstelevenlabs.dll    ← ElevenLabs TTS
```
**Neden:** Kullanılmıyor, gereksiz bağımlılık.

### C. Alternatif Video Codec'ler (~6 DLL) — KESİN SİL
```
gstx265.dll          ← HEVC/H.265 (H.264 kullanıyoruz)
gstrav1e.dll         ← AV1 software encoder
gstdav1d.dll         ← AV1 decoder
gstvpx.dll           ← VP8/VP9 decoder/encoder
gstopenh264.dll     ← Açık kaynak H.264 (gstx264.dll zaten var)
gstsvtav1.dll        ← AV1 encoder
```
**Neden:** H.264 kullanılıyor, diğer codec'lere gerek yok.

### D. Video Editing Services (~2 DLL) — KESİN SİL
```
gstges.dll           ← GStreamer Editing Services
gsttranscoder.dll
```
**Neden:** Video düzenleme özelliği gerekmiyor.

### E. Python/JavaScript Bindings — KESİN SİL
```
gstpython.dll        ← Python GStreamer binding
gstjavascript.dll    ← JavaScript scripting
```
**Neden:** Kullanılmıyor.

### F. Donanım-Spesifik (Başka platformda çalışmaz) — SİL
```
gstdecklink.dll      ← Blackmagic DeckLink (donanım gerekli)
gstndi.dll           ← NewTek NDI (ayrı yazılım lisansı gerekli)
```
**Neden:** Bu donanımlar yoksa DLL yüklenemez.

### G. Linux/macOS Audio API'leri (Windows'ta işe yaramaz) — SİL
```
gstjack.dll          ← JACK audio (Linux)
gstwasapi.dll        ← Eski Windows Audio API (gstwasapi2.dll kullanılıyor)
gstdirectsoundsrc.dll ← DirectSound (eski API)
gstdirectsound.dll   ← DirectSound
```
**Neden:** Windows'ta bu API'ler yüklenemez veya kullanılmaz.

### H. Alternatif Audio Codec'ler — KESİN SİL
```
gstflac.dll          ← FLAC (Opus kullanıyoruz)
gstspeex.dll         ← Speex (Opus kullanıyoruz)
gstsbc.dll           ← Bluetooth SBC (kullanılmıyor)
gstg722.dll          ← G.722 codec
gstg726.dll          ← G.726 codec
gstg729.dll          ← G.729 codec
gstlame.dll          ← MP3 encoder (Opus kullanıyoruz)
gstmp3pars.dll       ← MP3 parser
vo-aacenc.dll        ← AAC encoder (Opus kullanıyoruz)
opencore-amrnb.dll   ← AMR-NB codec
opencore-amrwb.dll   ← AMR-WB codec
dca-0.dll            ← DTS decoder
```
**Neden:** Opus kullanılıyor, diğer codec'lere gerek yok.

### I. Debug/Test Plugins — SİL
```
gstcheck.dll         ← GStreamer unit testing
gstdebug.dll         ← Debug utilities
gstdebugutilsbad.dll ← Debug utilities
gstcoretracers.dll   ← Tracing
```
**Neden:** Runtime'da gerekli değil.

### J. Diğer Kullanılmayanler — SİL
```
gstlibav.dll         ← libav/FFmpeg wrapper (çakışma riski)
gstfrei0r.dll        ← Frei0r efekt plugin'leri
gstzbar.dll          ← Barcode scanner
gstbarcode.dll       ← Barcode
gstcef.dll           ← Chromium Embedded Framework
gstwebview2.dll      ← WebView2
gstclosedcaption.dll ← Closed caption
gstrsvg.dll          ← SVG rendering
rsvg-2-2.dll         ← SVG library
```
**Neden:** Kullanılmıyor.

---

## 4. KRİTİK: Silinemeyecekler (Dependency)

Birçok DLL diğer DLL'leri yüklenmeden çalışmaz. Şu bağımlılıklar korunmalı:

### Ses Codec Dependencies
- `opus-0.dll` — Opus codec ana kütüphane
- `ogg-0.dll` — Ogg container
- `vorbis-0.dll` — Vorbis (Opus'un dependency'si olabilir)

### Video Processing
- `avcodec-61.dll` — FFmpeg codec (gstx264.dll için gerekli olabilir)
- `swscale-8.dll` — FFmpeg scaling
- `avutil-59.dll` — FFmpeg utilities

### Sistem DLL'leri ( Korunmalı)
- `glib-2.0-0.dll`, `gobject-2.0-0.dll` — GLib base
- `gstreamer-1.0-0.dll` — Core
- `orc-0.4-0.dll` — ORC (optimized raster code)

---

## 5. Uygulama Adımları

### Adım 1 — Bin klasörünü temizle (Güvenli)
1. `gst-launch-1.0.exe` dışındaki tüm .exe'leri sil
2. `gst-shell`, `ges-*.dll` dışındaki .dll'leri sil
3. Test et — uygulama çalışıyorsa devam et

### Adım 2 — Plugin klasörünü temizle (Dikkatli)
1. Yukarıdaki "kesin sil" listesiyle eşleşen dosyaları sil
2. Her silme sonrası test et
3. Hata alırsan geri yükle

### Adım 3 — Locale klasörünü test et
1. `share/locale/` klasöründeki dilleri 1'e indir (sadece `en` veya `tr` bırak)
2. Test et — hata alırsan klasörü geri yükle

### Adım 4 — include ve libexec'i sil
1. Bu klasörler runtime'da kesinlikle gerekmiyor
2. Sil, test et

---

## 6. Hedef Boyut

**Mevcut:** ~400-500MB (tahmini)
**Hedef:** ~80-120MB
**Kurtarılacak:** ~300MB+

---

## 7. Doğrulama

Thinning sonrası şu testler yapılmalı:
1. `gst-launch-1.0.exe -a` (plugin list) çalışmalı
2. Encoder detection çalışmalı
3. Pipeline başlatılabilmeli
4. Ses+video yayını yapılabilmeli