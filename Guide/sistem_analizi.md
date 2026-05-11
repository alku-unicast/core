# UniCast — Sistem Mimarisi ve Teknik Analiz
# Güncelleme: 2026-05-11
# Durum: AKTİF GELİŞTİRME

---

## 1. Kod Yapısı

```
app/src-tauri/
├── src/
│   ├── main.rs                     ← Tauri giriş noktası, tray, WDA_EXCLUDE
│   ├── lib.rs                      ← Komut kayıtları, setup hook, RTT monitor başlatma
│   ├── commands/
│   │   ├── auth.rs                 ← verify_pin (UDP PIN + session token parse), wake_pi_hdmi
│   │   ├── stream.rs               ← start_stream, stop_stream, set_stream_volume,
│   │   │                               SESSION_TOKEN global static, heartbeat spawner
│   │   ├── network.rs              ← get_network_info, start_rtt_monitor, get_network_quality
│   │   ├── firebase.rs             ← fetch_firebase_rooms (anonymous auth + 50min token cache)
│   │   ├── cache.rs                ← read_rooms_cache, write_rooms_cache → AppData JSON
│   │   ├── settings.rs             ← read_settings, write_settings → AppData JSON
│   │   ├── encoder.rs              ← detect_encoder (hardware chain test)
│   │   ├── audio.rs                ← list_audio_devices, mute_system_audio
│   │   ├── monitors.rs             ← list_monitors
│   │   ├── capture.rs              ← list_windows (pencere yakalama)
│   │   ├── windows.rs              ← Tauri WebviewWindow yönetimi
│   │   └── mod.rs
│   └── gstreamer/
│       ├── path_setup.rs           ← get_gst_launch(), Smart Path, env setup
│       └── pipeline.rs             ← build_pipeline(), Wayland/X11 tespiti, encoder params

app/src/
├── screens/
│   ├── RoomDiscovery.tsx           ← Ana ekran (oda listesi, favoriler, ağ durumu)
│   ├── ConnectionSetup.tsx         ← Bağlantı akışı (WAKE→PIN→STREAM), stream-stopped handler
│   └── StreamingBarApp.tsx         ← Ayrı Tauri WebviewWindow — timer, ses, ağ kalitesi
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx              ← Logo, ayarlar butonu
│   │   ├── StatusBanner.tsx        ← LOCAL_ONLY/NO_NETWORK uyarı banner'ı
│   │   └── StatusSummary.tsx       ← Alt bar: son güncelleme zamanı, oda sayısı
│   ├── rooms/
│   │   ├── RoomCard.tsx            ← Tekil oda kartı (durum rengi, favori butonu)
│   │   ├── RoomGrid.tsx            ← Filtrelenmiş oda ızgarası
│   │   ├── FloorTabs.tsx           ← "Tümü | Kat 0 | Kat 1..." filtresi
│   │   ├── FavoritesSection.tsx    ← Favoriler yatay listesi (boşsa gizlenir)
│   │   ├── ManualConnect.tsx       ← IP giriş formu bileşeni
│   │   └── ManualConnectSection.tsx ← NO_NETWORK'te gizlenen sarmalayıcı
│   ├── connection/
│   │   ├── PINEntry.tsx            ← PIN giriş alanı + hata gösterimi
│   │   ├── ConnectionProgress.tsx  ← Bağlantı adım göstergesi
│   │   ├── StreamModeSelector.tsx  ← Tam ekran / pencere modu seçimi
│   │   └── AudioToggle.tsx         ← Ses etkin/devre dışı toggle
│   ├── modals/
│   │   └── LinuxWarningModal.tsx   ← Linux pencere modu uyarısı (bir daha gösterme seçeneği ile)
│   ├── settings/
│   │   └── SettingsModal.tsx       ← Tüm kullanıcı ayarları (lazy loaded)
│   └── streaming-bar/
│       ├── NetworkQualityDot.tsx   ← RTT kalite göstergesi (renkli nokta)
│       └── AudioPopup.tsx          ← Ses slider popup'u
├── stores/
│   ├── connectionStore.ts          ← Bağlantı fazı, stream kontrolü, sessionToken, auto-restart
│   ├── roomStore.ts                ← Oda listesi, kat filtresi, cache güncelleme zamanı
│   ├── networkStore.ts             ← ONLINE/LOCAL_ONLY/NO_NETWORK durum makinesi
│   ├── settingsStore.ts            ← Kullanıcı ayarları (disk kalıcı), toggleFavorite
│   └── systemStore.ts              ← Pencere listesi, monitör listesi, encoder
├── services/
│   └── roomService.ts              ← Firebase polling (30s), cache, refreshRoomsNow()
└── types/
    ├── room.ts                     ← Room, RoomStatus
    ├── stream.ts                   ← StreamConfig, ConnectionPhase, StreamMode, NetworkQuality
    └── settings.ts                 ← Settings, StreamProfile, DEFAULT_SETTINGS

src/receiver/
└── agent.py                        ← Pi UDP sunucusu: PIN auth, session token, heartbeat, stream
```

---

## 2. GStreamer Pipeline

### Video — Windows (D3D11)

```
d3d11screencapturesrc monitor-index={idx} !
queue !
d3d11download !
videoconvert !
videoscale !
video/x-raw,format=NV12,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

### Video — Linux (X11 / Wayland Fallback)

```
ximagesrc display-name=:0 use-damage=0 !
videoconvert !
videoscale !
video/x-raw,format=I420,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

> Wayland tespiti: `WAYLAND_DISPLAY` env var varlığına göre `pipewiresrc` kullanılır.  
> Pencere modu Wayland'de desteklenmez — fullscreen fallback yapılır.

### Video — macOS (AVFoundation)

```
avfvideosrc capture-screen=true !
videoconvert !
videoscale !
video/x-raw,format=I420,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

### Ses Pipeline (Tüm Platformlar — audioEnabled=true ise eklenir)

| Platform | Source |
|----------|--------|
| Windows | `wasapi2src loopback=true device={id}` |
| Linux | `pulsesrc device={id}` |
| macOS | `osxaudiosrc` *(loopback yakalama desteksiz — sistem sesi değil mikrofon)* |

```
{audio_src} !
queue !
audioconvert !
audioresample !
opusenc bitrate=128000 !
rtpopuspay !
queue !
udpsink host={IP} port=5002
```

---

## 3. Encoder Zinciri ve Parametreleri

### Encoder Öncelik Sırası (`encoder.rs`)

```
nvh264enc   (NVIDIA)     → CUDA tabanlı, en hızlı
qsvh264enc  (Intel QSV)  → entegre grafik
amfh264enc  (AMD AMF)    → Radeon
vtenc_h264  (macOS)      → VideoToolbox (Apple Silicon + Intel Mac)
x264enc     (Software)   → Her platformda çalışır, CPU yoğun
```

### Encoder Parametreleri (`pipeline.rs`)

| Encoder | Parametreler |
|---------|-------------|
| x264enc | `tune=zerolatency speed-preset=superfast key-int-max=15 intra-refresh=true` |
| nvh264enc | `zerolatency=true gop-size=15` |
| qsvh264enc | `target-usage=balanced rate-control=cbr` |
| amfh264enc | `rate-control=cbr target-usage=balanced` |
| vtenc_h264 | `real-time=true` |

### Fallback Mekanizması (`stream.rs`)

```
start_stream(config, session_token)
    ↓
500ms bekle → child.try_wait()
    ↓
Başarısız + encoder ≠ x264enc?
    → fallback_config.encoder_name = "x264enc"
    → Box::pin(start_stream(app, fallback_config, session_token)).await
    ↓
x264enc de başarısız?
    → Err(exit_code + GST_PLUGIN_PATH)
```

---

## 4. UDP Protokolü (Tam Referans)

### Port 5001 — Kontrol Kanalı

Pi `0.0.0.0:5001` dinler. Token olmayan/hatalı token'lı komutlar sessizce reddedilir.

| Komut | Format | Token Gerekli | Pi Yanıtı |
|-------|--------|--------------|-----------|
| WAKE | `WAKE` | ❌ | `READY` |
| PIN | `PIN:<pin>` | ❌ | `OK:<token>` veya `FAIL:<kalan>` veya `BUSY` |
| HEARTBEAT | `HEARTBEAT:<token>` | ✅ | *(yanıt yok)* |
| STOP | `STOP:<token>` | ✅ | *(Pi stream kapatır, yeni PIN üretir)* |
| VOLUME | `VOLUME:<0-100>:<token>` | ✅ | *(Pi HDMI ses seviyesini ayarlar)* |

### Port 5005 — RTT Kanalı

| Komut | Format | Pi Yanıtı |
|-------|--------|-----------|
| PING | `PING` | `PONG` |

### Veri Kanalları

| Port | Protokol | İçerik |
|------|---------|--------|
| 5000 | UDP/RTP | H.264 video |
| 5002 | UDP/RTP | Opus ses |

### Session Token Güvenliği

- Token: `secrets.token_hex(16)` → 32 karakter hex, 2^128 kombinasyon
- IP binding: Token sadece PIN gönderen IP'den geçerli (`session_ip`)
- Yaşam döngüsü: `stop_streaming()` veya heartbeat 5s timeout → token silinir
- Rust'ta global static `SESSION_TOKEN` (OnceLock) tüm WebviewWindow'lardan erişilebilir
- Streaming bar, token'ı JS state'ten değil Rust global'den okur

---

## 5. Tauri Olayları

Rust → Frontend (tüm pencerelere `app.emit(...)` ile yayınlanır):

| Olay | Payload | Tetikleyici |
|------|---------|------------|
| `stream-started` | `{ pid: number }` | `start_stream` başarılı |
| `stream-stopped` | `{ reason: "user" \| "error" }` | `stop_stream` veya background watcher crash tespiti |
| `stream-health` | `{ rttMs: number, quality: string }` | `start_rtt_monitor` (2s aralıkla) |

Frontend → Streaming Bar penceresi:

| Olay | Payload | Tetikleyici |
|------|---------|------------|
| `stream-mode-info` | `{ mode, targetIp, audioEnabled, volume, isMuted }` | `startStream()` 500ms sonra |

---

## 6. Veri Kalıcılığı

| Veri | Dosya | Konum |
|------|-------|-------|
| Kullanıcı ayarları | `settings.json` | `{AppData}/unicast/` |
| Oda önbelleği | `rooms_cache.json` | `{AppData}/unicast/` |

### Ayarlar Yapısı (version: 2)

```typescript
{
  version: 2,
  language: "tr" | "en",
  favorites: string[],        // Oda ID listesi
  profiles: {
    presentation: { resolution, fps, bitrate, delayBufferMs, audioEnabled },
    video:        { resolution, fps, bitrate, delayBufferMs, audioEnabled }
  },
  audio: { deviceId, muteLocal },
  encoder: { detected, lastScan },
  appearance: { mainTheme, barTheme, barOpacity },
  streamingBar: { enabled },
  hideLinuxWindowWarning: boolean
}
```

---

## 7. Ağ Durum Makinesi

```
CHECKING
  ├─→ ONLINE       (fetch_firebase_rooms başarılı)
  ├─→ LOCAL_ONLY   (yerel ağ var, Firebase timeout/hata)
  └─→ NO_NETWORK   (get_network_info: yerel arayüz yok)
```

**Tespiti:** `get_network_info()` → UDP socket'i `8.8.8.8:80`'e bağlar (paket göndermez), `local_addr()` döner.  
**LOCAL_ONLY eşiği:** Firebase isteği 3 saniye içinde yanıt vermezse.  
**UI etkisi:** `StatusBanner` LOCAL_ONLY/NO_NETWORK'te görünür. `ManualConnectSection` NO_NETWORK'te gizlenir.

---

## 8. Streaming Bar Mimarisi

Streaming bar, ayrı bir Tauri `WebviewWindow`'dur (`label: "streaming-bar"`).

**Kritik kısıtlamalar:**
- Ayrı JS module context → Zustand store'lar bağımsız başlar (sessionToken=null, rooms={})
- `startRoomListener()` bu pencerede çağrılmaz → `refreshRoomsNow()` çalışmaz
- Session token JS'ten okunamaz → Rust global `SESSION_TOKEN` üzerinden iletişim kurulur

**Ses kontrolü akışı (bar → pi):**
```
Bar: invoke("set_stream_volume", { volume, mute, targetIp })
     ↓ (stream.rs)
SESSION_TOKEN global → token al
"VOLUME:<val>:<token>" → UDP:5001
```

---

## 9. Bilinen Sorunlar ve Durumları

| Sorun | Durum |
|-------|-------|
| Encoder detection `videotestsrc` ile test ediyor (gerçek ekran yakalamayı test etmiyor) | ⚠️ Devam ediyor |
| `\\?\` path prefix Windows'ta `cmd.exe` uyumsuzluğu | ✅ Çözüldü: `path_setup.rs`'de strip ediliyor |
| Audio device ID pipeline'a aktarılmıyor | ✅ Çözüldü: `wasapi2src device={id}` |
| macOS'ta ses loopback yakalama yok | ⚠️ Bilinen kısıt: AVFoundation loopback desteği yok |
| Linux pencere modu BadMatch (MIT-SHM) | ✅ Çözüldü: `_X11_NO_MITSHM=1` + auto-restart |
| Windows'ta GStreamer CMD popup | ✅ Çözüldü: `CREATE_NO_WINDOW (0x08000000)` |
| Streaming bar'dan ses slider çalışmıyordu | ✅ Çözüldü: Rust global SESSION_TOKEN |
| Yayın bitince UI 20-25s gecikme ile güncelleniyor | ✅ Çözüldü: 3s+7s refreshRoomsNow() |
| x264enc crash → hata görmezden geliniyordu | ✅ Çözüldü: `try_wait()` tüm encoder'larda |

---

## 10. Mimari Kararlar

| Karar | Gerekçe | Durum |
|-------|---------|-------|
| Tailwind v3 (v4 değil) | Tauri WebView uyumsuzluğu | ✅ Kesin |
| Firebase JS SDK değil, Rust HTTP | Güvenlik kuralları + CORS yok | ✅ Kesin |
| Firebase anonymous auth | Repo açık, API key görunür — rules ile kısıtlı | ✅ Kesin |
| RTT-based quality indicator (port 5005) | Düşük overhead, basit | ✅ Kesin |
| WDA_EXCLUDEFROMCAPTURE (Win 10+) | Streaming bar yakalanmasın | ✅ Kesin |
| macOS ses yok (native loopback yok) | AVFoundation kısıtı | ✅ Kesin |
| Encoder zinciri: nvh264enc→qsv→amf→x264 | GPU önce, CPU fallback | ✅ Kesin |
| Session token (32 char hex, IP bound) | UDP abuse engellemek için | ✅ Kesin |
| Tauri Store değil, Rust R/W settings.json | Daha az bağımlılık, Rust'tan da okunabilir | ✅ Kesin |
| Stale-while-revalidate cache stratejisi | UI anında açılır, Firebase arka planda | ✅ Kesin |
| Streaming bar → Rust global SESSION_TOKEN | Ayrı JS context sorunu bypass | ✅ Kesin |
| refreshRoomsNow() main window'dan | Bar'ın ayrı context'i activeFetchRooms'u bilmez | ✅ Kesin |
| Linux: APPIMAGE_BUNDLE_GSTREAMER=1 | Root/kurulum gerektirmez | ✅ Kesin |
| Windows: msiexec /a (lessmsi değil) | GitHub runner uyumsuzluğu | ✅ Kesin |
| macOS: Direct Target + Deep Search | Framework path yapısı değişkenlik gösteriyor | ✅ Kesin |

---

## 11. GStreamer Plugin Referansı (Windows Bundle)

### Kullanılan Plugin'ler

| DLL | Görev |
|-----|-------|
| `gstd3d11.dll` | Windows ekran yakalama (D3D11) |
| `gstx264.dll` | H.264 software encoder |
| `gstopus.dll`, `gstopusparse.dll` | Opus audio codec |
| `gstrtp.dll`, `gstrtpmanager.dll` | RTP paketleme |
| `gstudp.dll` | UDP sink |
| `gstaudio.dll`, `gstaudioconvert.dll`, `gstaudioresample.dll` | Ses işleme |
| `gstvideo.dll`, `gstvideoconvertscale.dll` | Video işleme |
| `gstwasapi2.dll` | Windows ses yakalama (loopback) |
| `gstcoreelements.dll` | queue, tee, fakesink |
| `gstcuda.dll` | NVIDIA CUDA destek |

### Çıkarılabilecek Plugin'ler

- WebRTC: `gstwebrtc.dll`, `gstrswebrtc.dll`
- Cloud/AI: `gstaws.dll`, `gstelevenlabs.dll`
- Gereksiz codec: `gstx265.dll`, `gstrav1e.dll`, `gstvpx.dll`, `gstdav1d.dll`
- Editing: `gstges.dll`
- Alternatif ses: `gstflac.dll`, `gstspeex.dll`, `gstlame.dll`
- Broadcast: `gstdecklink.dll`, `gstndi.dll`
- Debug: `gstcheck.dll`, `gstdebug.dll`
- Script: `gstpython.dll`, `gstjavascript.dll`
