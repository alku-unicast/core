# UniCast — Bekleyen Kararlar ve Teknik Notlar

## 1. Linux AppImage — Wayland / pipewiresrc Eksikliği

**Sorun:** Arch Linux (ve Wayland kullanan diğer dağıtımlar) AppImage'da stream başlamıyor.

**Root Cause:** `build.yml`'de `gstreamer1.0-pipewire` paketi yüklü değil. Bu yüzden `pipewiresrc` elementi AppImage'a bundle edilmiyor. Kod `WAYLAND_DISPLAY` algıladığında `pipewiresrc`'ye geçiyor ama element bulunamıyor → pipeline başlamıyor.

**Çözüm:** `build.yml` Linux apt kurulum listesine tek satır ekle:
```yaml
gstreamer1.0-pipewire
```

**Etkilenen dosya:** `.github/workflows/build.yml` — Linux apt-get install bloğu

**Risk:** Düşük. Ubuntu CI runner'da PipeWire daemon'ı çalışmıyor olsa bile plugin dosyası bundle edilir; kullanıcının sisteminde PipeWire çalışıyorsa bağlanır.

---

## 2. macOS Ses — ScreenCaptureKit Geçişi

**Mevcut durum:** `pipeline.rs`'de macOS sesi tamamen kapalı (P9 — no reliable loopback).

**Neden kapalı:** macOS'ta sistem sesi yakalamak için built-in loopback yok. `wasapi2src loopback` (Windows) veya `pulsesrc monitor` (Linux) karşılığı yok.

**Önerilen çözüm: ScreenCaptureKit**
- Apple'ın macOS 12.3+ yerleşik API'si
- `screencapturekit` GStreamer elementi (gst-plugins-bad, 1.22+) ekran + sistem sesini tek elementten yakalar
- Ek yazılım gerektirmez (BlackHole gibi)
- Bizim bundle GStreamer 1.24.13 bu elementi içeriyor olmalı

**Önce doğrulanması gereken:** Arkadaşın Mac'inde build kurulduğunda:
```bash
# Bundled GStreamer ile:
GST_PLUGIN_PATH=... gst-inspect-1.0 screencapturekit
```
Element varsa geçiş yapılabilir.

**Alternatif (BlackHole):** Kullanıcı BlackHole sanal ses sürücüsünü kendisi kurar, `osxaudiosrc device="BlackHole 2ch"` ile yakalarız. Eğitim ortamında yönetimi zor.

**Geçiş yapılacak pipeline değişikliği (screencapturekit varsa):**

`pipeline.rs` macOS ses bloğu:
```rust
#[cfg(target_os = "macos")]
{
    // ScreenCaptureKit: captures system audio alongside video
    // NOTE: avfvideosrc in build_video_src must also be replaced with screencapturekit
    format!(
        " screencapturekit name=sck ! queue ! audioconvert ! audioresample ! \
         opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={_ip} port=5002"
    )
}
```

Video src da değişecek — `avfvideosrc` yerine `screencapturekit` kullanılacak, aynı element hem video hem ses verecek (`tee` veya named element ile dallanacak).

**Etkilenen dosyalar:**
- `app/src-tauri/src/gstreamer/pipeline.rs` — `build_audio_part` ve `build_video_src` (macOS kolu)

**Durum:** Arkadaşın Mac testi bekleniyor.

---

## 3. Platform Destek Matrisi (Güncel)

| Platform | Video | Ses | Test | Notlar |
|---|---|---|---|---|
| Windows (D3D11) | ✅ | ✅ | ✅ | D3D11 + DX9 + GDI fallback zinciri |
| Windows (DX9) | ✅ | ✅ | ✅ | Pencere modu yok, monitor fallback |
| Ubuntu 22.04 X11 | ✅ | ✅ | ✅ | AppImage, ximagesrc + pulsesrc |
| Ubuntu 22.04 Wayland | ✅ | ✅ | ⚠️ | pipewiresrc bundle eksik olabilir |
| Arch Linux Wayland | ❌ | ❓ | ❌ | pipewiresrc bundle yok — fix bekliyor |
| macOS ARM64 | ✅ | ❌ | ⚠️ | Sadece CI build; ses kapalı |
