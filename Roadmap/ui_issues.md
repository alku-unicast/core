
devam eden sorunlar:

ses açma kapatma çalışıyor ama ses seviyesi ayarı yapılamıyor slider çalışmıyor.
ayırca bir ux sorunu var eğer kullanıcı sessiz yayın yapacaksa slider ayarına ses ayarlarına erişmesine hiç gerek yok zaten onlar gözükmemeli hem mini ada hem mini ada olmadan.
mini ada olmadan yayın yapııldığında wifi sembolüne benzeyen yayın başlatılıyor yazısının üstündeki turuncu sembol taşıyor üstü de kesik gözüküyor oranın ayar daha düzgün yapılmalı. 
asıl sorun midi ada, mini ada yayına kocaman siyah şerit gönderiyor. Eğer bu böyle devam edecekse tam ekran modunda yayını olduğu gibi aktarsak da sadece mini ada gözükse kocamaan siyah şerit yerine olur mu?

onun dışında agent tarafına ethernet'i çekince çevrimdışı dedi oldu yani.

yukarıda yazan sorunlar çözülmek üzere implementasyonlar yapıldı.kalan bazı sorunlar şunlar:
"abi ses kısımında şöyle mini adada ses olmadan başlattığı zaman mini adada olması gerektiği gibi ses ayarı gidiyor ama mini ada kapalıyken ve ses olmadan yayın yapıldığı zaman ses ayar kısmı kaybolmuyor.
öte yandan windowsta tam istediğimiz gibi ses kapalı ama yayına ses giderken linuxta sesli yayın yapsan da sesi kapatıyor sessiz yayın yapsan da sesi kapatıyor ve daha kötüsü ses kapalı olduğu için yayına ses gtmiyor.
bir ufak mevzu da,
abi o turuncu buton hala tam gözükmüyor üst kısım biraz yularıda kalmış biraz aşağı inmesi lazım, aşağıdaki yayını durdur da taşmış,
aslında dışındaki konteyner büyüse biraz sorun çözülür gibi, şu anda değil sorunları not edip hdmi cec ile yarın yapalım
"

# UniCast — UI & System Issues (Saha Testi, May 5 2026)

Tüm sorunlar saha testinden türetilmiştir. Her biri için köken analizi, etkilenen dosyalar ve önerilen çözüm verilmiştir.

---

## ISSUE-01 — Çift Manuel Bağlantı Bölümü

**Durum:** Yüksek Öncelik  
**Tür:** Görsel hata / kopya bileşen

### Belirtiler
- Oda listesi ekranında "Direct Connection" ve "Manuel Bağlantı" olarak iki ayrı IP giriş alanı görünüyor.

### Kök Neden
`app/src/components/rooms/RoomGrid.tsx` eski `ManualConnect` bileşenini **üç yerde** render ediyor: yüklenirken, hata/boş durumda ve oda listesinin altında.  
`app/src/screens/RoomDiscovery.tsx` aynı zamanda yeni `ManualConnectSection`'ı `<main>` içine ekliyor.  
İki farklı bileşen (`ManualConnect` + `ManualConnectSection`) aynı anda ekranda oluyor.

### Çözüm
`RoomGrid.tsx`'ten `ManualConnect` import ve kullanımlarını tamamen kaldır. Yeni `ManualConnectSection` zaten `RoomDiscovery.tsx` seviyesinde her zaman mevcut.

### Etkilenen Dosyalar
- `app/src/components/rooms/RoomGrid.tsx` — ManualConnect import/render kaldırılacak
- `app/src/components/rooms/ManualConnect.tsx` — artık kullanılmıyor; silinebilir

---

## ISSUE-02 — Manuel Bağlantı Bölümü Her Zaman Görünüyor (İnternet Varken de)

**Durum:** Orta Öncelik  
**Tür:** UX tasarım sorunu

### Belirtiler
- Hem network hem internet bağlıyken `ManualConnectSection` yine de altta görünüyor.

### Kök Neden
`app/src/components/rooms/ManualConnectSection.tsx` satır 23:
```tsx
if (networkState === "NO_NETWORK" || !hasLocalInterface) return null;
```
Sadece `NO_NETWORK` durumunda gizleniyor. `ONLINE` durumunda `hasLocalInterface=true` olduğu için her zaman render ediliyor.  
Tasarım amacı "her zaman fallback mevcut olsun" iken kullanıcı deneyimi "oda listesi varken gereksiz alan" olarak algılanıyor.

### Tartışma / Çözüm Seçenekleri
**A) ONLINE + odalar varken gizle:**  
`ManualConnectSection` içinde `const { rooms } = useRoomStore()` ekle; `Object.keys(rooms).length > 0 && networkState === "ONLINE"` ise `return null` döndür.

**B) Daima göster ama minimize et:**  
`ONLINE` durumunda küçük bir link/düğme olarak göster ("IP ile bağlan →"), genişletince input görünür.

**C) Mevcut tasarımı koru:**  
Bazı kullanıcıların Firebase'de kayıtlı olmayan ekranlara bağlanması gerekebilir — fallback her zaman görünür mantıklı. ISSUE-01 çözülünce çift görünüm sorunu ortadan kalkar.

**Öneri:** A seçeneği — ONLINE + oda varken gizle, sorun yaşandığında otomatik göster.

### Etkilenen Dosyalar
- `app/src/components/rooms/ManualConnectSection.tsx`
- `app/src/stores/roomStore.ts`

---

## ISSUE-03 — pi_ip: "No network" Durumunda Yanlış Oda Statüsü

**Durum:** Yüksek Öncelik  
**Tür:** Veri doğruluk hatası

### Belirtiler
Firebase'de `pi_ip: "No network"` olan oda `idle` (bağlanılabilir) olarak listeleniyor. Bağlantı denemesi başarısız oluyor.

### Firebase Verisi (Gerçek)
```json
{
  "213": {
    "floor": "2",
    "last_seen": 1777984950,
    "name": "213",
    "pi_ip": "No network",
    "pi_status": "idle"
  }
}
```

### Kök Neden
`app/src/services/roomService.ts` içinde `parseRoom()` satır 43:
```typescript
if (!raw.pi_ip || raw.pi_ip.trim() === "") {
  status = "unconfigured";
}
```
Sadece boş string kontrolü var. `"No network"` boş değil → `unconfigured` branch'e girmiyor → `idle` olarak işaretleniyor.

### Çözüm
Boş string yerine gerçek IPv4 regex doğrulaması kullan:
```typescript
const IP_PATTERN = /^(\d{1,3}\.){3}\d{1,3}$/;
if (!raw.pi_ip || !IP_PATTERN.test(raw.pi_ip.trim())) {
  status = "unconfigured";
}
```
Bu yaklaşım `""`, `"No network"`, `"N/A"`, `"unknown"` ve diğer tüm geçersiz değerleri yakalar.

### Etkilenen Dosyalar
- `app/src/services/roomService.ts` — `parseRoom()` satır 43

---

## ISSUE-04 — Pi Ağa Yeniden Bağlandığında Firebase Güncellenmiyor

**Durum:** Orta Öncelik  
**Tür:** Pi agent davranış hatası (backend/Pi-side)

### Belirtiler
1. Pi internet bağlantısı kesildiğinde `pi_ip: "No network"` ve `pi_status: "idle"` Firebase'e yazılıyor.
2. Ethernet kablosu yeniden takıldığında Pi gerçek IP adresini Firebase'e **güncellemiyor** — `"No network"` kalıyor.
3. Bağlantı yokken açılan uygulama `LOCAL_ONLY` durumunda kalıyor, ağ geri gelince `ONLINE` durumuna geçmiyor (30s polling sayesinde aslında geçiyor — test tekrar edilmeli).

### Kök Neden
**Pi tarafı:** `agent.py` muhtemelen sadece başlangıçta IP alarak Firebase'e yazıyor. Ağ tekrar geldiğinde tetikleyici (network-reconnect event veya polling) yok.  
**Frontend tarafı:** `roomService.ts` 30 saniyelik polling yapıyor — ağ geri gelince Firebase'i tekrar deneyecek ve `ONLINE` durumuna geçecek. Bu kısım doğru çalışıyor; sorun Pi agent'ta.

### Çözüm (UYGULANDI)
**Pi agent.py'ye eklenen mantık:**
1. **Sentinel Loop:** `last_registered_ip` değişkeni ile periyodik kontrol.
2. **Değişim Algılama:** IP `None`'dan bir adrese geçtiğinde veya adresten `None`'a düştüğünde Firebase güncellenir.
3. **Zaman Damgası:** Her başarılı kontrolde `last_seen` güncellenerek "online" durumu korunur.

**Not:** Frontend tarafında ISSUE-03 fix'i sayesinde geçersiz IP'ler artık `unconfigured` olarak filtreleniyor.

### Etkilenen Dosyalar
- `pi/agent.py` (Pi tarafı)

---

## ISSUE-05 — CMD Penceresi Anlık Görünüp Kayboluyor

**Durum:** Yüksek Öncelik  
**Tür:** Windows process oluşturma hatası

### Belirtiler
- Uygulama açılırken siyah CMD penceresi anlık geliyor.
- "Bağlantı" ekranına girildiğinde CMD penceresi ~5-6 saniye kalıyor, birkaç kez göstergiliyor.
- Ayarlar modalına girildiğinde de CMD penceresi görünüyor.

### Kök Neden
Windows'ta `CREATE_NO_WINDOW (0x08000000)` flag'i **sadece** `app/src-tauri/src/commands/stream.rs`'teki `start_stream` komutuna eklendi.

Diğer GStreamer süreçleri hâlâ pencere açıyor:

1. **`app/src-tauri/src/commands/encoder.rs` satır 55** — `detect_encoder()` `tokio::process::Command` kullanıyor, `creation_flags` yok.  
   Tetiklendiği yer: Ayarlar modalı açılırken + bağlantı ekranı ilk yüklenirken.

2. Uygulama açılışında tetiklenen herhangi bir GStreamer komutu.

### Çözüm
Windows'ta tüm `tokio::process::Command` ve `std::process::Command` çağrılarına `creation_flags(0x08000000)` ekle.

**encoder.rs** (tokio::process::Command için):
```rust
// tokio::process::Command da std::os::windows::process::CommandExt trait'ini kullanır
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// detect_encoder() içinde Windows bloku:
#[cfg(target_os = "windows")]
{
    tokio::process::Command::new(&gst_launch)
        .args(["-q"])
        .args(pipeline.split_whitespace())
        .current_dir(&bin_dir)
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .await
}
```

**Kontrol edilecek diğer dosyalar:**
```
grep -r "Command::new" app/src-tauri/src/
```

### Etkilenen Dosyalar
- `app/src-tauri/src/commands/encoder.rs` — `detect_encoder()` düzeltilecek
- `app/src-tauri/src/commands/stream.rs` — mevcut diğer spawn'lar kontrol edilecek

---

## ISSUE-06 — "Yayın Sırasında Sesi Kapat" Ayarı Çalışmıyor

**Durum:** Yüksek Öncelik  
**Tür:** Özellik bağlantısı eksik

### Belirtiler
Ayarlarda "Yayın sırasında hoparlörü kapat" butonu aktif görünüyor ancak yayın başlayınca gönderen cihazda ses çalmaya devam ediyor.

### Kök Neden
`audio.muteLocal` ayarı `app/src/types/settings.ts` içinde tanımlı, varsayılan `true`.  
`app/src-tauri/src/commands/audio.rs` içinde `mute_system_audio(mute: bool)` komutu hazır ve tüm platformlarda çalışıyor:
- Windows: IAudioEndpointVolume (Windows API)
- macOS: `osascript -e 'set volume output muted'`
- Linux: `pactl set-sink-mute @DEFAULT_SINK@`

**Ancak** `app/src/stores/connectionStore.ts` `startStream()` başarılıyken ve `stopStream()` tamamlandığında bu komutu **hiç çağırmıyor**.

### Çözüm
`connectionStore.ts` `startStream()` içinde `result.success` bloğuna ekle:
```typescript
// Mute local speakers if setting is enabled
const { audio } = useSettingsStore.getState();
if (audio.muteLocal) {
  invoke("mute_system_audio", { mute: true }).catch(console.warn);
}
```

`stopStream()` içine ekle (her durumda unmute — ayar değişmiş olabilir):
```typescript
invoke("mute_system_audio", { mute: false }).catch(console.warn);
```

**Dikkat:** Sistem hoparlörünü kapatır, alıcı (Raspberry Pi) tarafındaki ses etkilenmez.

### Etkilenen Dosyalar
- `app/src/stores/connectionStore.ts` — `startStream()` ve `stopStream()` içine `mute_system_audio` çağrısı eklenecek

---

## ISSUE-07 — Streaming Bar Fullscreen Yakalamada Siyah Görünüyor (Windows)

**Durum:** Orta Öncelik  
**Tür:** Windows API davranışı / platform sınırı

### Belirtiler
Windows'ta tam ekran yakalama (d3d11screencapturesrc) yapıldığında, streaming bar Raspberry Pi ekranında siyah dikdörtgen olarak görünüyor.

### Kök Neden
`app/src-tauri/src/commands/capture.rs` `WDA_EXCLUDEFROMCAPTURE (0x11)` flag'i kullanıyor.  
Bu flag'in **tasarım gereği davranışı**: yakalama ekranında pencere içeriği siyah olarak değiştirilir (Windows 11+). Pencereyi hiç göstermemek yerine siyah maskeleme yapıyor.

Bu Microsoft'un resmi API davranışıdır — içerik gizlenir ama pencere alanı siyah kalır.

### Çözüm (UYGULANDI)
**WDA_MONITOR (0x01) Çözümü:**
- `app/src-tauri/src/utils/capture_exclusion.rs` içinde `WDA_EXCLUDEFROMCAPTURE` (0x11) yerine `WDA_MONITOR` (0x01) kullanıldı.
- **Sonuç:** Windows 10/11'de bar alanı siyah kutu yerine masaüstü arka planını (veya yakalanan ekranın altını) gösterir. Bu, projeksiyon ortamında siyah şeridi neredeyse görünmez kılar.

**Linux Notu:** Linux'ta `ximagesrc` doğası gereği her şeyi yakalar. Barın görünmesi "beklenen davranış" olarak dökümante edildi.

### Etkilenen Dosyalar
- `app/src-tauri/src/commands/capture.rs`
- `app/src-tauri/src/gstreamer/pipeline.rs`

---

## ISSUE-08 — Bar Ses Kontrolleri Çalışmıyor

**Durum:** Orta Öncelik  
**Tür:** IPC / invoke hatası — kök neden belirsiz, teşhis gerekli

### Belirtiler
Streaming bar'daki ses ikonu ve slider'a tıklanınca ses değişmiyor.

### Olası Kök Nedenler

**1. set_stream_volume'da alıcı IP eksik:**  
`app/src-tauri/src/commands/stream.rs` satır 254'te `set_stream_volume` alıcı Pi IP'sine UDP sinyal gönderiyor. Bar penceresi ayrı bir Tauri window — `connectionStore` paylaşılmıyor, dolayısıyla alıcı IP bilinmiyor.

**2. Capabilities:**  
`app/src-tauri/capabilities/default.json` hem "main" hem "streaming-bar" pencerelerini kapsıyor — izin sorunu olmamalı.

**3. invoke hatası sessizce yutuluyor:**  
`StreamingBarApp.tsx` `handleVolumeChange` ve `handleMuteToggle` içindeki `invoke` hataları `console.error` ile loglanıyor ama kullanıcıya gösterilmiyor.

### Teşhis Adımları
1. Tauri dev modunda `streaming-bar` penceresinin devtools'unu aç (`"devtools": true` var).
2. Ses butonuna tıkla, console'da error loglarına bak.
3. Eğer `set_stream_volume` çağrısında alıcı IP undefined/null ise kök neden 1'dir.

### Çözüm (Kök Neden 1 ise)
`stream-mode-info` eventi ile birlikte Pi IP'sini de bar'a gönder:
```typescript
// connectionStore.ts — startStream() içinde:
bar.emit("stream-mode-info", { mode: config.streamMode, targetIp: targetRoom?.ip });
```
Bar'da bu değeri state'te sakla, `set_stream_volume` çağrısında kullan.

### Etkilenen Dosyalar
- `app/src/screens/StreamingBarApp.tsx`
- `app/src/stores/connectionStore.ts`
- `app/src-tauri/src/commands/stream.rs`

---

## ISSUE-09 — AudioPopup Windows'ta Yarısı Kesik Görünüyor

**Durum:** Yüksek Öncelik  
**Tür:** Window boyutu / CSS pozisyonlama hatası

### Belirtiler
Windows'ta ses butonuna tıklandığında açılan popup (volume slider + mute toggle) yarısı görünüyor, yarısı kayboluyor.  
Linux'ta sorun yok.

### Kök Neden
`streaming-bar` penceresinin yüksekliği `app/src-tauri/tauri.conf.json` satır 32'de **80px**.

`app/src/components/streaming-bar/AudioPopup.tsx` satır 41:
```tsx
className="absolute bottom-[calc(100%+8px)] right-[-12px] ..."
```
Bu `position: absolute` ile ana butonun 8px üstüne konumlanıyor.  
Popup ~48px yüksekliğinde + 8px boşluk = **56px yukarıda başlıyor**.  
Ama pencere sadece 80px → popup, pencere sınırında kesiliyor.

**Linux'ta neden sorun yok:** Linux pencere yöneticisi bazı durumlarda WebView içeriğinin pencere sınırı dışına taşmasına izin veriyor. Windows WebView2 daha katı.

### Çözüm
`tauri.conf.json`'da `streaming-bar` penceresinin yüksekliğini **80 → 200px** yap.  
Bar bileşeni `flex items-end pb-3` ile pencerenin altına yerleşiyor — üstteki boş alan şeffaf kalır ve popup oraya açılır.

```json
{
  "label": "streaming-bar",
  "width": 380,
  "height": 200
}
```

**Dikkat:** Pencere büyüdüğünde `set_bar_capture_exclusion` daha geniş şeffaf alan hariç tutacak. Popup kapalıyken boş şeffaf alan görünmeyecek (transparent window sayesinde).

### Etkilenen Dosyalar
- `app/src-tauri/tauri.conf.json` — height: 80 → 200

---

## ISSUE-10 — Linux Uyarı Modalı İçerik Düzeltmeleri

**Durum:** Düşük Öncelik  
**Tür:** UI metin/tasarım düzeltmesi

### Belirtiler
1. Modalın altındaki "💡 Tam ekrana geçmek için F11 tuşuna basabilirsiniz." kutusu kaldırılmalı.
2. Ana açıklama metni "istediğiniz boyuta getirin" yerine **"TAM EKRANA GETİRİN"** (kalın, büyük harf) olmalı.

### Kök Neden
`app/src/components/modals/LinuxWarningModal.tsx` satır 50-53'te tip kutusu mevcut.  
`app/src/i18n/locales/tr.json` `linux_warning.tip` ve `linux_warning.description` metinleri güncellenmeli.

### Çözüm

**LinuxWarningModal.tsx** — tip bloğunu tamamen kaldır (satır 50-53).

**tr.json** güncelle — tip key'i kaldır, description güncelle:
```json
"linux_warning": {
  "title": "Pencere Modu Uyarısı",
  "description_prefix": "Linux'ta pencere modunda yayın yaparken en iyi deneyim için yayını başlatmadan önce",
  "description_emphasis": "TAM EKRANA GETİRİN",
  "description_suffix": "Yayın sırasında pencereyi yeniden boyutlandırmak akışın kesilmesine neden olabilir.",
  "dont_show_again": "Bir daha gösterme",
  "understood": "Anladım"
}
```

Modal JSX'ini güncelle (kalın metin için):
```tsx
<p className="text-sm text-[var(--text-muted)] leading-relaxed mb-5">
  {t("linux_warning.description_prefix")}{" "}
  <strong className="text-[var(--text-primary)] font-bold uppercase">
    {t("linux_warning.description_emphasis")}
  </strong>
  {". "}{t("linux_warning.description_suffix")}
</p>
```

### Etkilenen Dosyalar
- `app/src/components/modals/LinuxWarningModal.tsx`
- `app/src/i18n/locales/tr.json`
- `app/src/i18n/locales/en.json`

---

## Özet Tablo

| ID | Başlık | Durum | Tür | Çözüm |
|----|--------|---------|-----|--------|
| ISSUE-01 | Çift Manuel Bağlantı UI | **ÇÖZÜLDÜ** | Frontend | RoomGrid temizlendi |
| ISSUE-02 | ManualConnect ONLINE'da görünüyor | **ÇÖZÜLDÜ** | Frontend | Akıllı gizleme eklendi |
| ISSUE-03 | pi_ip "No network" yanlış idle | **ÇÖZÜLDÜ** | Frontend | IPv4 Regex eklendi |
| ISSUE-04 | Pi ağa döndüğünde güncellemiyor | **ÇÖZÜLDÜ** | Pi agent | Sentinel Loop mantığı |
| ISSUE-05 | CMD penceresi yanıp sönüyor | **ÇÖZÜLDÜ** | Rust/Windows | CREATE_NO_WINDOW |
| ISSUE-06 | muteLocal ses kapatmıyor | **ÇÖZÜLDÜ** | Frontend | Lifecycle bağlantısı |
| ISSUE-07 | Bar fullscreen'de siyah (Win) | **ÇÖZÜLDÜ** | Rust/Windows | WDA_MONITOR |
| ISSUE-08 | Bar ses kontrolleri çalışmıyor | **ÇÖZÜLDÜ** | IPC/Frontend | targetIp + UDP implementasyonu |
| ISSUE-09 | AudioPopup yarısı kesik (Win) | **ÇÖZÜLDÜ** | Window config | 200px Buffer |
| ISSUE-10 | Linux modal metin düzeltmesi | **ÇÖZÜLDÜ** | i18n/JSX | İçerik temizliği |

**Önerilen sıra:** ISSUE-01 → ISSUE-03 → ISSUE-05 → ISSUE-09 → ISSUE-06 → ISSUE-02 → ISSUE-10 → ISSUE-08 → ISSUE-07 → ISSUE-04

---

*Oluşturulma: May 5, 2026*
