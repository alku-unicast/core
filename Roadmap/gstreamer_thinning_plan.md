# GStreamer Boyut Optimizasyonu (Thinning) Planı

UniCast yayını için kritik olmayan GStreamer dosyalarını temizleyerek uygulama boyutunu minimize etme stratejisidir.

> [!WARNING]
> Bu plandaki silme işlemleri henüz uygulanmamıştır. Uygulama için kullanıcı onayı beklenmektedir.

## 1. Silinecek Gereksiz Dizinler
Aşağıdaki dizinler derleme sonrası (`runtime`) çalışma için gerekli değildir:
- **`include/`**: C++ geliştirme başlık dosyaları.
- **`share/`**: Dokümantasyon, kılavuzlar ve yerelleştirme (man, doc, locale) dosyaları.
- **`etc/`**: Varsayılan konfigürasyonlar (Uygulama zaten kendi parametrelerini kullanıyor).
- **`libexec/`**: Yardımcı servisler.

## 2. Temizlenecek Yürütülebilir Dosyalar (`bin/`)
Sadece `gst-launch-1.0.exe` ve `gst-inspect-1.0.exe` bırakılacak, diğerleri silinecektir:
- `gst-dots-viewer.exe` (17MB)
- `pkg-config.exe`
- `ges-launch-1.0.exe`
- `gsettings.exe`
- `gdbus.exe`
- `gst-play-1.0.exe`, `gst-discoverer-1.0.exe` vb.

## 3. Temizlenecek Eklentiler (`lib/gstreamer-1.0/`)
UniCast sadece H264 (x264/NVENC/QSV) ve Opus kullanır. Aşağıdakiler silinebilir:
- **WebRTC Destekleri:** `gstrswebrtc.dll`, `gstrwebrtchttp.dll`.
- **Cloud/AI:** `gstaws.dll`, `gstelevenlabs.dll`.
- **Alternatif Codec'ler:** `gstrav1e.dll` (AV1), `gstvpx.dll` (VP8/9), `gstx265.dll` (HEVC).

## 4. Uygulama ve Güvenlik
Bu temizlik yapıldığında uygulama boyutu yaklaşık **150MB** seviyesine inecektir. Herhangi bir "plugin not found" hatası durumunda dosyalar orijinal GStreamer kurulumundan tekrar geri getirilebilir.
