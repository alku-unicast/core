# UniCast — Uygulama Planı (Güncel Durum)
**Versiyon:** 3.0 | **Tarih:** Mayıs 2026

> Bu plan projenin **gerçek mevcut durumunu** yansıtır. Her bölüm ya tamamlanmış ya devam eden ya da planlanmış olarak işaretlenmiştir. Kod örnekleri mevcut implementasyona birebir karşılık gelir.

---

## İçindekiler

1. [Proje Genel Bakış](#1-genel-bakis)
2. [Mimari & Kritik Dosyalar](#2-mimari)
3. [UDP Protokol Referansı](#3-udp-protokol)
4. [Tauri Event Referansı](#4-tauri-events)
5. [Rust Komutları Referansı](#5-rust-komutlari)
6. [Tamamlanan: Ağ Katmanı](#6-ag-katmani)
7. [Tamamlanan: Oda Önbellekleme](#7-on-bellekleme)
8. [Tamamlanan: Favoriler](#8-favoriler)
9. [Tamamlanan: UI Bileşenleri](#9-ui-bilesenleri)
10. [Tamamlanan: Linux & Windows Platform Düzeltmeleri](#10-platform-duzeltmeleri)
11. [Tamamlanan: GStreamer Hata Yönetimi](#11-hata-yonetimi)
12. [Tamamlanan: Streaming Bar (Ayrı Pencere)](#12-streaming-bar)
13. [Tamamlanan: Ses Özellikleri](#13-ses)
14. [Tamamlanan: RTT / Ağ Kalitesi İzleme](#14-rtt)
15. [Tamamlanan: Ayarlar Sistemi](#15-ayarlar)
16. [Tamamlanan: Session Token Güvenliği](#16-session-token)
17. [Tamamlanan: Oda Durumu Hızlı Güncelleme](#17-oda-guncelleme)
18. [Devam Eden: Saha Testleri](#18-saha-testleri)
19. [Sonraki Faz: macOS](#19-macos)

---

## 1. Proje Genel Bakış

- **Proje:** Eğitim ortamları için düşük gecikmeli kablosuz ekran yansıtma
- **Hedef:** <150ms gecikme, Eduroam/LAN uyumlu, Cross-platform (Windows/Linux/macOS)
- **Pi IP (test ortamı):** `10.50.0.113`
- **Build:** GitHub Actions ile 3-lü Matrix Build (Windows / Linux / macOS ARM64)
- **Mevcut durum:** Tüm temel özellikler tamamlandı. Session token güvenliği eklendi. Saha testleri devam ediyor.

---

## 2. Mimari & Kritik Dosyalar

### Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| UI | React 18, Tailwind v3, Zustand, react-router-dom |
| Backend | Rust (Tauri v2) |
| Stream Engine | GStreamer 1.0 (portable bundle) |
| Pi Agent | Python 3 (asyncio, UDP server) |
| Veritabanı | Firebase Realtime DB (oda listesi) |
| Ayarlar/Cache | Rust `write_settings`/`read_settings`, `write_rooms_cache`/`read_rooms_cache` → AppData JSON |

### Kritik Dosyalar

```
app/
├── src/
│   ├── screens/
│   │   ├── RoomDiscovery.tsx          ← Ana ekran (oda listesi, favoriler)
│   │   ├── ConnectionSetup.tsx        ← Bağlantı akışı (PIN, stream kontrolü)
│   │   └── StreamingBarApp.tsx        ← Ayrı Tauri penceresi içeriği
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx             ← Üst bar (logo, ayarlar butonu)
│   │   │   ├── StatusBanner.tsx       ← Ağ durumu uyarı banner'ı
│   │   │   └── StatusSummary.tsx      ← Alt bar (son güncelleme, oda sayısı)
│   │   ├── rooms/
│   │   │   ├── RoomCard.tsx           ← Tekil oda kartı
│   │   │   ├── RoomGrid.tsx           ← Oda ızgarası
│   │   │   ├── FloorTabs.tsx          ← Kat filtre sekmeleri
│   │   │   ├── FavoritesSection.tsx   ← Favoriler bölümü
│   │   │   ├── ManualConnect.tsx      ← IP giriş formu
│   │   │   └── ManualConnectSection.tsx ← Manuel bağlantı sarmalayıcı
│   │   ├── connection/
│   │   │   ├── PINEntry.tsx           ← PIN giriş alanı
│   │   │   ├── ConnectionProgress.tsx ← Bağlantı adım göstergesi
│   │   │   ├── StreamModeSelector.tsx ← Tam ekran / pencere modu seçimi
│   │   │   └── AudioToggle.tsx        ← Ses etkin/devre dışı toggle
│   │   ├── modals/
│   │   │   └── LinuxWarningModal.tsx  ← Linux pencere modu uyarısı
│   │   ├── settings/
│   │   │   └── SettingsModal.tsx      ← Ayarlar modalı
│   │   └── streaming-bar/
│   │       ├── NetworkQualityDot.tsx  ← RTT kalite indikatörü
│   │       └── AudioPopup.tsx         ← Ses slider popup'u
│   ├── stores/
│   │   ├── connectionStore.ts         ← Bağlantı durumu, stream kontrolü
│   │   ├── roomStore.ts               ← Oda listesi, kat filtresi
│   │   ├── networkStore.ts            ← ONLINE/LOCAL_ONLY/NO_NETWORK
│   │   ├── settingsStore.ts           ← Kullanıcı ayarları (disk kalıcı)
│   │   └── systemStore.ts             ← Pencere listesi, monitör listesi, encoder
│   ├── services/
│   │   └── roomService.ts             ← Firebase polling, cache, refreshRoomsNow
│   └── types/
│       ├── room.ts                    ← Room, RoomStatus
│       ├── stream.ts                  ← StreamConfig, ConnectionPhase, StreamMode
│       └── settings.ts                ← Settings, DEFAULT_SETTINGS
│
├── src-tauri/src/
│   ├── commands/
│   │   ├── auth.rs                    ← verify_pin, wake_pi_hdmi
│   │   ├── stream.rs                  ← start_stream, stop_stream, set_stream_volume
│   │   ├── network.rs                 ← get_network_info, start_rtt_monitor
│   │   ├── firebase.rs                ← fetch_firebase_rooms
│   │   ├── cache.rs                   ← read_rooms_cache, write_rooms_cache
│   │   ├── settings.rs                ← read_settings, write_settings
│   │   ├── audio.rs                   ← mute_system_audio, list_audio_devices
│   │   ├── encoder.rs                 ← detect_encoder
│   │   ├── monitors.rs                ← list_monitors
│   │   ├── capture.rs                 ← list_windows (pencere yakalama)
│   │   └── windows.rs                 ← Tauri pencere yönetimi
│   └── gstreamer/
│       ├── path_setup.rs              ← KRİTİK: Smart Path + env setup
│       └── pipeline.rs                ← KRİTİK: Wayland/X11 tespiti, pipeline string
│
src/receiver/
└── agent.py                           ← Pi UDP sunucusu (PIN, HEARTBEAT, STOP, VOLUME)
```

---

## 3. UDP Protokol Referansı

Pi, `0.0.0.0:5001` üzerinde UDP dinler. Tüm kontrol komutları bu porta gönderilir.

### Kimlik Doğrulama Öncesi

| Komut | Gönderen | Format | Pi Yanıtı |
|-------|----------|--------|-----------|
| WAKE | Uygulama | `WAKE` | `READY` veya `OK` |
| PIN | Uygulama | `PIN:<pin>` | `OK:<token>` veya `FAIL:<kalan>` veya `BUSY` |

### Kimlik Doğrulama Sonrası (token zorunlu)

| Komut | Gönderen | Format | Açıklama |
|-------|----------|--------|----------|
| HEARTBEAT | Rust (otomatik, 2s) | `HEARTBEAT:<token>` | Pi 5s timeout'u engeller |
| STOP | Rust (stream durdurulunca) | `STOP:<token>` | Pi stream'i kapatır, yeni PIN oluşturur |
| VOLUME | Rust (ses değişince) | `VOLUME:<0-100>:<token>` | Pi HDMI çıkış sesini ayarlar |

### Port 5005 (Ping/RTT)

| Komut | Format | Pi Yanıtı |
|-------|--------|-----------|
| PING | `PING` | `PONG` |

### Token Güvenlik Kuralları (Pi Tarafı)

- Token: `secrets.token_hex(16)` → 32 karakter hex, 2^128 kombinasyon
- IP binding: Token, PIN gönderen IP ile eşleşmelidir (`session_ip`)
- Token olmayan/yanlış token'lı HEARTBEAT/STOP/VOLUME komutları reddedilir
- Token, `stop_streaming()` ve grace period sona erince silinir

---

## 4. Tauri Event Referansı

Rust → Frontend olayları (`app.emit(...)` ile tüm pencerelere yayınlanır):

| Olay | Payload | Yayıncı | Dinleyici |
|------|---------|---------|-----------|
| `stream-started` | `{ pid: number }` | stream.rs | ConnectionSetup, StreamingBarApp |
| `stream-stopped` | `{ reason: "user" \| "error" }` | stream.rs | ConnectionSetup, StreamingBarApp |
| `stream-health` | `{ rttMs: number, quality: string }` | network.rs | ConnectionSetup, StreamingBarApp |

Frontend → Streaming Bar penceresi (`bar.emit(...)`):

| Olay | Payload | Açıklama |
|------|---------|----------|
| `stream-mode-info` | `{ mode, targetIp, audioEnabled, volume, isMuted }` | Stream başlayınca bar'a bilgi gönderilir |

---

## 5. Rust Komutları Referansı

Tüm komutlar `invoke(...)` ile çağrılır:

| Komut | Dosya | İmza | Açıklama |
|-------|-------|------|----------|
| `verify_pin` | auth.rs | `(targetIp: string, pin: string) → PinVerifyResult` | PIN gönder, session token al |
| `wake_pi_hdmi` | auth.rs | `(targetIp: string) → bool` | HDMI güç açma sinyali |
| `start_stream` | stream.rs | `(config: StreamConfig, sessionToken: string) → StartStreamResult` | GStreamer pipeline başlat |
| `stop_stream` | stream.rs | `() → bool` | GStreamer durdur, `stream-stopped` eventi fırlat |
| `set_stream_volume` | stream.rs | `(volume: float, mute: bool, targetIp: string\|null) → bool` | Pi'ye VOLUME UDP gönder |
| `switch_stream_mode` | stream.rs | `(mode: string, windowId: number\|null) → bool` | Stream modu geçiş (frontend restart tetikler) |
| `get_network_info` | network.rs | `() → LocalNetworkInfo` | Yerel ağ arayüzü var mı? |
| `get_network_quality` | network.rs | `(targetIp: string) → NetworkQualityPayload` | Anlık RTT ölçümü |
| `fetch_firebase_rooms` | firebase.rs | `() → Record<string, RawRoom>` | Firebase'den oda listesi çek |
| `read_rooms_cache` | cache.rs | `() → RoomsCache\|null` | Disk cache'i oku |
| `write_rooms_cache` | cache.rs | `(cache: RoomsCache) → void` | Disk cache'e yaz |
| `read_settings` | settings.rs | `() → Settings` | Kullanıcı ayarlarını oku |
| `write_settings` | settings.rs | `(settings: Settings) → bool` | Kullanıcı ayarlarını kaydet |
| `mute_system_audio` | audio.rs | `(mute: bool) → void` | Sistem hoparlörünü sustur/aç |
| `list_audio_devices` | audio.rs | `() → AudioDevice[]` | Ses cihazı listesi |
| `detect_encoder` | encoder.rs | `() → string\|null` | Donanım encoder'ı tespit et (nvh264enc, vtenc_h264, x264enc) |
| `list_monitors` | monitors.rs | `() → Monitor[]` | Monitör listesi |
| `list_windows` | capture.rs | `() → WindowInfo[]` | Açık pencere listesi |

---

## 6.Tamamlanan: Ağ Katmanı

### Durum Makinesi

```
CHECKING → ONLINE        (Firebase başarılı)
CHECKING → LOCAL_ONLY    (yerel ağ var ama Firebase erişilemiyor)
CHECKING → NO_NETWORK    (yerel ağ arayüzü yok)
```

### Dosyalar

**`app/src/stores/networkStore.ts`**
```typescript
type NetworkState = "CHECKING" | "ONLINE" | "LOCAL_ONLY" | "NO_NETWORK";

interface NetworkStore {
  networkState: NetworkState;
  hasLocalInterface: boolean;
  localIp: string | null;
  checkLocalNetwork: () => Promise<void>;   // get_network_info invoke
  setNetworkState: (s: NetworkState) => void;
}
```

**`app/src-tauri/src/commands/network.rs`**
- `get_network_info()`: UDP socket bağlayıp `8.8.8.8:80`'e bağlanarak yerel IP'yi tespit eder (paket göndermez)
- `start_rtt_monitor(app)`: Arka plan loop, 2s'de bir Pi:5005'e PING → `stream-health` eventi fırlatır
- `get_network_quality(targetIp)`: Tek seferlik RTT ölçümü

### Akış

1. `RoomDiscovery` mount → `startRoomListener()` → `checkLocalNetwork()`
2. Firebase fetch başarılıysa: `setNetworkState("ONLINE")`
3. Firebase fetch başarısızsa + yerel ağ varsa: `setNetworkState("LOCAL_ONLY")`
4. Yerel ağ yoksa: `setNetworkState("NO_NETWORK")`

---

## 7.Tamamlanan: Oda Önbellekleme

### Strateji: Stale-While-Revalidate

```
Uygulama açılır
    ↓
1. read_rooms_cache → UI anında gösterir (bekleme yok)
    ↓
2. Arka planda fetch_firebase_rooms çağrılır
    ↓
3a. Başarılı → write_rooms_cache → UI güncellenir
3b. Başarısız → cache verisi korunur, NetworkState güncellenir
```

### Dosyalar

**`app/src/services/roomService.ts`**
- `startRoomListener()`: Cache yükle → Firebase çek → `setInterval(fetchRooms, 30000)`
- `activeFetchRooms`: Modül seviyesi değişken, `refreshRoomsNow()` için referans
- `refreshRoomsNow()`: Dışarıdan anında Firebase fetch tetiklemek için

**`app/src-tauri/src/commands/cache.rs`**
- Cache yolu: `AppData/unicast/rooms_cache.json`
- Struct: `RoomsCache { rooms: Vec<CachedRoom>, lastUpdated: i64, version: u32 }`

**`app/src-tauri/src/commands/firebase.rs`**
- Anonymous Firebase auth token → 50 dakika cache (modül seviyesi `TOKEN_CACHE`)
- 3 saniyelik timeout → LOCAL_ONLY tespiti için
- Başarılı yanıt `null` ise `Ok(HashMap::new())`

---

## 8.Tamamlanan: Favoriler

### Mimari Karar

Favoriler `Settings.favorites: string[]` (oda ID listesi) olarak `settings.json`'da saklanır.  
`@tauri-apps/plugin-store` kullanılmaz — Rust komutları `read_settings`/`write_settings` ile JSON R/W yapılır.

### Dosyalar

**`app/src/types/settings.ts`**
```typescript
export interface Settings {
  version: number;        // Şu an: 2
  favorites: string[];    // Oda ID'leri: ["101", "003-005"]
  // ...diğer alanlar
}
```

**`app/src/stores/settingsStore.ts`**
- `toggleFavorite(roomId)`: Favoriyi ekle/çıkar → `saveToDisk()` → `write_settings` invoke
- `loadFromDisk()`: Uygulama açılışında `read_settings` invoke
- `hideLinuxWindowWarning`: Linux pencere modu uyarısını gizle

**`app/src/components/rooms/FavoritesSection.tsx`**
- Favori odaları üstte gösterir
- Favori listesi boşsa bölüm gizlenir

**`app/src/components/rooms/RoomCard.tsx`**
- Favori toggle butonu entegre
- Durum: `idle` (yeşil), `streaming` (mavi), `offline` (gri), `unconfigured` (sarı)

---

## 9.Tamamlanan: UI Bileşenleri

### Bileşen Haritası

| Bileşen | Dosya | Açıklama |
|---------|-------|----------|
| `TopBar` | `layout/TopBar.tsx` | Logo, ayarlar butonu |
| `StatusBanner` | `layout/StatusBanner.tsx` | LOCAL_ONLY / NO_NETWORK uyarı banner'ı |
| `StatusSummary` | `layout/StatusSummary.tsx` | Alt bar: son güncelleme zamanı, oda sayısı |
| `FloorTabs` | `rooms/FloorTabs.tsx` | "Tümü \| Kat 0 \| Kat 1 \| ..." sekme filtresi |
| `RoomGrid` | `rooms/RoomGrid.tsx` | Filtrelenmiş oda ızgarası |
| `RoomCard` | `rooms/RoomCard.tsx` | Tekil oda: durum, favori, bağlan butonu |
| `FavoritesSection` | `rooms/FavoritesSection.tsx` | Favori odalar yatay listesi |
| `ManualConnect` | `rooms/ManualConnect.tsx` | IP giriş formu |
| `ManualConnectSection` | `rooms/ManualConnectSection.tsx` | NO_NETWORK'te gizlenen sarmalayıcı |
| `PINEntry` | `connection/PINEntry.tsx` | PIN giriş + hata gösterimi |
| `ConnectionProgress` | `connection/ConnectionProgress.tsx` | Bağlantı adım göstergesi |
| `StreamModeSelector` | `connection/StreamModeSelector.tsx` | Tam ekran / pencere modu seçimi |
| `AudioToggle` | `connection/AudioToggle.tsx` | Ses etkin/devre dışı toggle |
| `LinuxWarningModal` | `modals/LinuxWarningModal.tsx` | Linux pencere modu uyarısı |
| `SettingsModal` | `settings/SettingsModal.tsx` | Tüm kullanıcı ayarları |
| `NetworkQualityDot` | `streaming-bar/NetworkQualityDot.tsx` | RTT kalite göstergesi (renkli nokta) |
| `AudioPopup` | `streaming-bar/AudioPopup.tsx` | Ses slider popup'u (streaming bar'da) |

### RoomDiscovery Ekranı Yapısı

```
RoomDiscovery
├── TopBar
├── StatusBanner          (sadece problem varsa görünür)
├── FavoritesSection      (favoriler varsa görünür)
├── FloorTabs
├── RoomGrid
├── ManualConnectSection  (NO_NETWORK'te gizlenir)
└── StatusSummary
    └── SettingsModal (lazy, isteğe bağlı)
```

### Oda Durumu Gösterimi

`roomService.ts::parseRoom()` mantığı:
- `pi_ip` geçersiz/yok → `unconfigured` (sarı)
- `last_seen` > 2 dakika geçmiş → `offline` (gri)
- `pi_status` değeri `"streaming"` → `streaming` (mavi)
- `pi_status` değeri `"idle"` → `idle` (yeşil)

---

## 10.Tamamlanan: Platform Düzeltmeleri

### Linux: Pencere Modu Uyarı Modalı

**Dosya:** `app/src/components/modals/LinuxWarningModal.tsx`

- Linux + pencere modu seçilince `LinuxWarningModal` açılır
- "Bir daha gösterme" seçeneği → `settingsStore.setHideLinuxWindowWarning(true)` → disk'e kaydedilir
- `settingsStore.hideLinuxWindowWarning` false ise uyarı her pencere modu seçiminde gösterilir

### Linux: BadMatch (X11 MIT-SHM) Düzeltmesi

**Dosya:** `app/src-tauri/src/commands/stream.rs`

```rust
#[cfg(target_os = "linux")]
{
    cmd.env("_X11_NO_MITSHM", "1");  // BadMatch crash'ini önler
}
```

### Linux: Auto-Restart (GStreamer Crash Recovery)

**Dosya:** `app/src/stores/connectionStore.ts::attemptAutoRestart()`

- Yalnızca Linux + pencere modunda devreye girer
- 3 deneme hakkı, 3 saniye bekleme aralıkları
- `lastRestartTime` kontrolü: 30s içinde 4'ten fazla deneme → hata mesajı göster

### Windows: CREATE_NO_WINDOW

**Dosya:** `app/src-tauri/src/commands/stream.rs`

```rust
#[cfg(target_os = "windows")]
{
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW — CMD popup önlenir
}
```

`taskkill` komutuna da uygulanır:
```rust
std::process::Command::new("taskkill")
    .args(["/F", "/T", "/PID", &pid.to_string()])
    .creation_flags(0x08000000)
    .output();
```

---

## 11.Tamamlanan: GStreamer Hata Yönetimi

### İki Katmanlı Hata Tespiti

**Katman 1 — Anlık crash (≤500ms) — `stream.rs`:**

```rust
std::thread::sleep(std::time::Duration::from_millis(500));
if let Ok(Some(status)) = child.try_wait() {
    if !status.success() {
        if config.encoder_name != "x264enc" {
            // Donanım encoder başarısız → software fallback (x264enc)
            let mut fallback_config = config.clone();
            fallback_config.encoder_name = "x264enc".to_string();
            return Box::pin(start_stream(app, fallback_config, session_token)).await;
        } else {
            return Err(format!("GStreamer pipeline failed..."));
        }
    }
}
```

Frontend `invoke` exception → `catch` bloğu:
```typescript
set({ phase: "awaiting_pin", streamError: "Yayın başlatılamadı..." });
```

**Katman 2 — Gecikmeli crash (>500ms) — Background Watcher:**

```rust
tokio::task::spawn_blocking(move || {
    loop {
        // child.try_wait() ile crash kontrolü
        // Crash → app_clone.emit("stream-stopped", { "reason": "error" })
    }
});
```

Frontend `stream-stopped` listener — `ConnectionSetup.tsx`:
- `reason === "error"` → `resetStream("Akış beklenmedik şekilde durdu...")` → kullanıcı bağlantı ekranında kalır, kırmızı banner görünür
- `reason === "user"` → `reset()` + `navigate("/")` → ana sayfaya dön

### streamError State

**`connectionStore.ts`:**
```typescript
streamError: string | null;     // Gösterilecek hata mesajı
resetStream: (error?: string) => void;  // targetRoom'u koruyarak stream state'i sıfırla
```

---

## 12.Tamamlanan: Streaming Bar (Ayrı Pencere)

### Mimari

Streaming bar, ayrı bir Tauri `WebviewWindow`'dur. **Önemli kısıtlamalar:**

- Ayrı JS context: Zustand store'lar sıfırdan başlar (sessionToken=null, rooms={})
- `startRoomListener()` bu pencerede çağrılmaz → `refreshRoomsNow()` buradan çalışmaz
- Session token bu pencereden okunamaz → Rust global static `SESSION_TOKEN` kullanılır

### Başlatma Akışı

`connectionStore.ts::startStream()` stream başlayınca:
```typescript
const bar = await WebviewWindow.getByLabel("streaming-bar");
if (bar) {
    await bar.show();
    await bar.setFocus();
    setTimeout(() => {
        bar.emit("stream-mode-info", { mode, targetIp, audioEnabled, volume, isMuted });
    }, 500);  // Bar'ın mount edilmesi için beklenir
}
await getCurrentWebviewWindow().hide();  // Ana pencereyi gizle
```

### Durdurma Akışı

`stream-stopped` eventi tüm pencerelere yayınlanır.  
`StreamingBarApp.tsx` eventi alınca: bar gizlenir.  
`ConnectionSetup.tsx` eventi alınca: ana pencere gösterilir, `reason` kontrolü yapılır.

### Dosyalar

- `app/src/screens/StreamingBarApp.tsx`: Bar içeriği (elapsed timer, mute, ses, ağ kalitesi, durdur)
- `app/src/components/streaming-bar/NetworkQualityDot.tsx`: RTT kalite renk noktası
- `app/src/components/streaming-bar/AudioPopup.tsx`: Ses slider popup'u

### Ses Kontrolü (Bar'dan)

Bar, `invoke("set_stream_volume", { volume, mute, targetIp })` çağırır.  
Rust `set_stream_volume` komutu, `session_token_handle()` global'inden token'ı okur (JS state paylaşımı gerekmez).

---

## 13.Tamamlanan: Ses Özellikleri

### Özellikler

| Özellik | Mekanizma |
|---------|-----------|
| Ses etkin/devre dışı (stream öncesi) | `StreamConfig.audioEnabled` → GStreamer pipeline `pulsesrc`/`wasapisrc` dahil edilir veya dışlanır |
| Sustur/Aç (stream sırasında) | `VOLUME:0:<token>` veya `VOLUME:<vol>:<token>` UDP komutu |
| Ses seviyesi (0-100) | `VOLUME:<val>:<token>` UDP → Pi HDMI çıkışı ayarlar |
| Yerel hoparlör susturma | `mute_system_audio(mute: bool)` → stream başlarken susturur, biterken açar |
| Ses cihazı seçimi | `list_audio_devices()` → `StreamConfig.audioDeviceId` olarak iletilir |

### Profil Başına Ses Ayarı

`settings.ts::StreamProfile.audioEnabled` — presentation profili default `false`, video profili default `true`.

### Akış

```
Kullanıcı ses slider'ı hareket ettirir
    ↓
set_stream_volume(volume, mute, targetIp) invoke
    ↓ (Rust)
SESSION_TOKEN global'inden token al
VOLUME:<val>:<token> → UDP:5001 gönder
    ↓ (Pi)
token doğrula → HDMI ses seviyesini ayarla
```

---

## 14.Tamamlanan: RTT / Ağ Kalitesi İzleme

### Rust Tarafı (`network.rs`)

```rust
// Background loop: 2s'de bir UDP PING → PONG RTT ölçer
pub async fn start_rtt_monitor(app: AppHandle) {
    loop {
        tokio::time::sleep(Duration::from_secs(2)).await;
        // measure_rtt() → app.emit("stream-health", payload)
    }
}
```

RTT → Kalite eşiği:
```rust
fn quality_from_rtt(rtt_ms: u32) -> &'static str {
    match rtt_ms {
        0..=4    => "excellent",
        5..=19   => "good",
        20..=49  => "degraded",
        _        => "poor",
    }
}
```

### Frontend Tarafı

`ConnectionSetup.tsx` ve `StreamingBarApp.tsx` `stream-health` eventini dinler.  
`connectionStore.setNetworkQuality(quality, rtt)` state günceller.  
`NetworkQualityDot` bileşeni RTT kalitesini renkli nokta olarak gösterir.

---

## 15.Tamamlanan: Ayarlar Sistemi

### Yapı (`app/src/types/settings.ts`)

```typescript
export interface Settings {
  version: number;           // Şu an: 2 (migration için)
  language: "tr" | "en";
  favorites: string[];
  profiles: {
    presentation: StreamProfile;   // fps:15, bitrate:5000, audio:false
    video: StreamProfile;          // fps:30, bitrate:4000, audio:true
  };
  audio: {
    deviceId: string | null;
    muteLocal: boolean;            // Default: true
  };
  encoder: {
    detected: string | null;       // "nvh264enc" | "vtenc_h264" | "x264enc"
    lastScan: string | null;
  };
  appearance: {
    mainTheme: "light" | "dark";
    barTheme: "light" | "dark" | "translucent-dark";
    barOpacity: number;            // 0.5 - 1.0
  };
  streamingBar: {
    enabled: boolean;
  };
  hideLinuxWindowWarning: boolean;
}
```

### Disk Kalıcılığı

- Yolu: `{AppData}/unicast/settings.json`
- Rust komutları: `read_settings()` / `write_settings(settings)`
- `settingsStore.loadFromDisk()`: Uygulama açılışında çağrılır
- `settingsStore.saveToDisk()`: Herhangi bir ayar değişince çağrılır

### Encoder Tespiti

`detect_encoder()` → hardware encoder'ları dener (nvh264enc → vtenc_h264 → x264enc), bulduğunu `settings.encoder.detected`'a kaydeder.  
`start_stream` sırasında `config.encoderName` olarak kullanılır.  
Pipeline crash → 500ms sonra `x264enc` fallback otomatik denenir.

---

## 16.Tamamlanan: Session Token Güvenliği

### Motivasyon

Öğrenciler PIN'i bilse de (sınıfta görünür), dışarıdan UDP mesaj göndererek yayını durduramaz veya ses ayarını manipüle edemez.  
WPA2-Enterprise WiFi: per-kullanıcı PTK şifrelemesi → başka kullanıcılar trafiği dinleyemez.  
Switched Ethernet: switch sadece hedef porta yönlendirir → diğer cihazlar göremez.

### Token Yaşam Döngüsü

```
PIN başarılı → Pi: secrets.token_hex(16) üretir → "OK:<token>" gönderir
    ↓
Rust (auth.rs): "OK:<token>" parse eder → PinVerifyResult.sessionToken
    ↓
Frontend (connectionStore): sessionToken state'e kaydeder
    ↓
start_stream invoke → sessionToken Rust'a geçirilir → SESSION_TOKEN global'e saklanır
    ↓
Heartbeat her 2s: "HEARTBEAT:<token>" → Pi doğrular
    ↓
stop_stream → "STOP:<token>" → Pi stream kapatır → session_token = None
    ↓
SESSION_TOKEN global = None
```

### Pi Tarafı (`src/receiver/agent.py`)

```python
import secrets

# PIN başarılı:
token = secrets.token_hex(16)
self.session_token = token
self.session_ip = ip          # IP binding: token sadece bu IP'den geçerli
response = f"OK:{token}".encode()

# Doğrulama:
def _validate_token(self, token: str, ip: str) -> bool:
    return (
        self.session_token is not None and
        token == self.session_token and
        ip == self.session_ip
    )

# Her komut için:
# HEARTBEAT:<token> → msg[10:]
# STOP:<token>      → msg[5:]
# VOLUME:<val>:<token> → parts = msg.split(":"); token = parts[2]
```

### Rust Tarafı

**`auth.rs`:**
```rust
pub struct PinVerifyResult {
    pub success: bool,
    pub message: String,
    pub attempts_remaining: Option<u8>,
    pub session_token: Option<String>,  // "OK:<token>" → Some(token)
}
```

**`stream.rs`:**
```rust
// Global static — tüm WebviewWindow'lardan erişilebilir
static SESSION_TOKEN: OnceLock<Arc<Mutex<Option<String>>>> = OnceLock::new();

// set_stream_volume — JS'ten token almaz, Rust global'den okur
pub async fn set_stream_volume(volume: f32, mute: bool, target_ip: Option<String>) -> Result<bool, String> {
    if let Some(ip) = target_ip {
        let token = session_token_handle().lock().unwrap().clone();
        if let Some(token) = token {
            let msg = format!("VOLUME:{}:{}", vol_value, token);
            socket.send_to(msg.as_bytes(), &addr);
        }
    }
}
```

**`connectionStore.ts`:**
```typescript
sessionToken: string | null;       // submitPIN sonrası set edilir

// startStream:
const { sessionToken } = get();
invoke("start_stream", { config, sessionToken: sessionToken ?? "" });

// toggleMute / setStreamVolume: sessionToken parametresi YOK
// (Rust global'den okur)
invoke("set_stream_volume", { volume, mute, targetIp });
```

---

## 17.Tamamlanan: Oda Durumu Hızlı Güncelleme

### Problem

Yayın bitince Pi anında yeni PIN oluşturur, ancak UI 30 saniyelik polling nedeniyle "yayın devam ediyor" görüntüsü verir.

### Çözüm

`ConnectionSetup.tsx` → `stream-stopped` eventi → iki kademeli gecikmeyle Firebase refresh:

```typescript
// 3s: STOP mesajı Pi'ye ulaştıysa, Pi Firebase'i güncellemiş olur
setTimeout(async () => {
    const { refreshRoomsNow } = await import("../services/roomService");
    refreshRoomsNow();
}, 3000);

// 7s: STOP kaybolup heartbeat timeout (5s) ile Pi kapattıysa
setTimeout(async () => {
    const { refreshRoomsNow } = await import("../services/roomService");
    refreshRoomsNow();
}, 7000);
```

**Neden streaming bar'dan değil:**  
Streaming bar, ayrı JS context'te çalışır → `activeFetchRooms` modül değişkeni orada `null`'dır.  
Ana pencere `ConnectionSetup` her zaman `stream-stopped` eventini alır (Tauri tüm pencerelere yayınlar).

**`roomService.ts`:**
```typescript
let activeFetchRooms: (() => Promise<void>) | null = null;

export function refreshRoomsNow(): void {
    if (activeFetchRooms) activeFetchRooms().catch(() => {});
}

// startRoomListener içinde:
activeFetchRooms = fetchRooms;  // polling başlamadan önce set edilir
```

---

## 18.Devam Eden: Saha Testleri

### Yapılan Testler

| Platform | Durum | Notlar |
|----------|-------|--------|
| Windows (CI/CD build) | Tamamlandı | Hardware encoder fallback çalışıyor |
| Linux (AppImage) | Tamamlandı | a11y uyarıları zararsız, stream çalışıyor |
| macOS | Planlanan | Henüz test edilmedi |

### Bilinen Durumlar

- Linux AppImage: GTK a11y bus uyarıları (`at-spi`) normaldir, tüm GTK uygulamalarında görülür
- oda durumu güncelleme gecikmesi: ~3-7 saniye (çözüldü, eski 20-25s'nin yerine)

---

## 19.Sonraki Faz: macOS

### Gereklilikler

- [ ] macOS bundle testi (mevcut CI/CD ARM64 build var, saha testi gerekli)
- [ ] Ses cihazı (coreaudio) entegrasyon testi
- [ ] GStreamer framework path'i (Hibrit Arama ADR #7 uygulandı, doğrulama gerekli)
- [ ] Code signing & notarization (Gatekeeper için)

### macOS GStreamer Path Stratejisi (ADR #7)

`path_setup.rs` macOS için:
1. Önce resmi path: `GStreamer.framework/Versions/1.0/bin/gst-launch-1.0`
2. Bulunamazsa: Deep Search (framework dizini altında `gst-launch-1.0` aranır)

### macOS Ses (CoreAudio)

GStreamer pipeline'da `osxaudiosrc` kullanılır (Windows'ta `wasapisrc`, Linux'ta `pulsesrc`).  
`pipeline.rs` içinde platform-specific `audio_src` değişkeni ile kontrol edilir.

### macOS Signing Adımları (Planlı)

1. Apple Developer hesabı gerekli
2. `tauri.conf.json` → `bundle.macOS.signingIdentity` ekle
3. GitHub Actions'a `APPLE_CERTIFICATE` ve `APPLE_CERTIFICATE_PASSWORD` secret'ları ekle
4. Notarization için `APPLE_ID` ve `APPLE_APP_SPECIFIC_PASSWORD` ekle
5. `build.yml` → macOS step'e `notarize: true` ekle

### macOS CI/CD Kontrol Listesi

- [x] Remote Fetch: `msiexec /a` (Windows), `hdiutil` (macOS PKG) — ADR #6/#7
- [x] Cache: `actions/cache` ile GStreamer binary'leri önbellekte
- [x] 3-lü Matrix Build: Windows + Linux + macOS ARM64
- [ ] macOS ARM64 saha testi
- [ ] Code signing ve Gatekeeper testleri

---

## Bağımlılık Haritası

```
RoomDiscovery
├── startRoomListener() [roomService]
│   ├── invoke("read_rooms_cache") [cache.rs]
│   ├── invoke("fetch_firebase_rooms") [firebase.rs]
│   └── setInterval(30s)
├── checkLocalNetwork() [networkStore]
│   └── invoke("get_network_info") [network.rs]
└── Bileşenler: TopBar, StatusBanner, FavoritesSection, FloorTabs, RoomGrid, ManualConnectSection, StatusSummary

ConnectionSetup
├── submitPIN() [connectionStore]
│   └── invoke("verify_pin") [auth.rs] → "OK:<token>"
├── startStream() [connectionStore]
│   ├── invoke("start_stream", config, sessionToken) [stream.rs]
│   │   ├── build_pipeline() [gstreamer/pipeline.rs]
│   │   ├── get_gst_launch() [gstreamer/path_setup.rs]
│   │   ├── SESSION_TOKEN global ← token saklanır
│   │   └── spawn_heartbeat() → "HEARTBEAT:<token>" UDP 2s
│   └── WebviewWindow("streaming-bar").show()
├── stopStream() [connectionStore]
│   ├── invoke("stop_stream") [stream.rs] → "STOP:<token>" UDP
│   └── invoke("mute_system_audio", false)
└── stream-stopped event handler
    ├── reason "user" → reset() + navigate("/")
    ├── reason "error" → resetStream(errMsg) → kırmızı banner
    ├── refreshRoomsNow() [3s delay]
    └── refreshRoomsNow() [7s delay]

StreamingBarApp (ayrı WebviewWindow)
├── invoke("set_stream_volume") [stream.rs] ← SESSION_TOKEN global'den token okur
├── invoke("stop_stream") [stream.rs]
├── stream-health event → NetworkQualityDot
└── stream-stopped event → bar.hide()
```
