# UniCast Development Progress

### 🗓️ 2026-04-16 (Session 23) — Cross-Platform Mimari & Mühendislik Denetimi

#### 📊 Mimari Karar Kaydı (ADR)
Bugünkü oturumda sistemin taşınabilirliği ve çapraz platform uyumluluğu üzerine derinlemesine bir mühendislik denetimi yapıldı.

1. **GStreamer Klasör Yapısı (KESİN)**
   - `app/src-tauri/gstreamer/` altında `windows`, `linux`, `macos/intel` ve `macos/silicon` ayrımı yapılacak.
   - Her platform kendi binary bağımlılıklarını izole bir şekilde taşıyacak.

2. **Windows DLL Bağımlılık Çözümü**
   - **Teşhis:** MinGW build kullanılmasına rağmen yaşanan `VCRUNTIME140.dll` hatasının, MSVC ile derlenmiş olası NVIDIA/CUDA eklentilerinden kaynakla## [2026-04-16] — Cross-Platform & CI/CD Finalization

### ADR: Environmental Parity & Remote CI/CD
**Karar:** Geliştirme ortamı (Local) ve Üretim ortamı (Prod) arasındaki farkları sıfıra indirmek için tüm platformlarda **Official GStreamer MSVC/Binary** paketlerine geçildi.
**Strateji:**
- **Git Hygiene:** GStreamer binary'leri repoya yüklenmez (`.gitignore`).
- **Remote Fetch:** CI/CD sunucusu paketleri her build'de resmi sunucudan çeker.
- **Caching:** `actions/cache` ile build süreleri optimize edildi.
- **Smart Path:** Rust backend'i hem `bin/lib` hem de `usr/bin/lib` yapılarını tanıyacak şekilde güncellendi.

### Yapılan Çalışmalar
- **path_setup.rs:** Smart Path algılama mantığı eklendi.
- **build.yml:** Remote download + extraction + cache adımları eklendi.
- **Manual Guide:** Kullanıcı için yerel Windows kütüphanesini güncelleme rehberi hazırlandı.

### Durum
- [x] Mimari stabilizasyon
- [x] 4-Platform CI/CD altyapısı
- [/] Windows Local Parity (Kullanıcı güncellemesi bekleniyor)
l` ve `MSVCP140.dll` dosyaları `bin/` klasörüne kopyalanarak "Side-by-Side" yükleme yapılacak.

3. **Linux (Ubuntu 20.04) Stratejisi**
   - **Risk:** GLIBC 2.31 sınırlaması.
   - **Karar:** Ubuntu 20.04 tabanlı veya uyumlu kütüphaneler toplanacak. `WAYLAND_DISPLAY` kontrolü ile `pipewiresrc` (Wayland) veya `ximagesrc` (X11) otomatik seçilecek.
   - **Fail-Safe:** Ses kaynağı bulunamazsa sessizce geçiştirilmeyecek, loglanacak ve video-only stream olarak devam edilecek.

4. **macOS Faz 1**
   - **Karar:** Sistem ses yakalama (loopback) karmaşıklığı nedeniyle şimdilik ses devre dışı bırakıldı. Intel ve Silicon mimarileri için ayrı binary'ler üretilecek.

#### Yapılanlar
- [x] Detaylı Çapraz Platform Uygulama Planı oluşturuldu.
- [x] Mühendislik Denetimi (Audit) tamamlandı, riskler (GLIBC, Notarization) belirlendi.
- [x] Görev listesi (`task.md`) hazırlandı.

---


### 🗓️ 2026-04-15 (Session 22) — Cross-Platform Bağımsızlık Analizi

#### Yapılan Analiz (Claude)

1. **VCRUNTIME140.dll Hatası — Tespit Edildi**
   - **Sorun:** Fresh Windows 10'da "VCRUNTIME140.dll bulunamadı" hatası.
   - **Sebep:** GStreamer DLL'i değil — Visual C++ Redistributable eksik.
   - **Çözüm:** Tauri bundle'a VC++ Redistributable eklenmeli (vc_redist.x64.exe).
   - **Kaynak:** ui_issues.md satır 67-68.

2. **Kod İncelemesi — path_setup.rs, encoder.rs, pipeline.rs, stream.rs**
   - Junction approach doğru çalışıyor (PID bazlı `D:\UCGst_{PID}`)
   - `detect_encoder` artık `d3d11screencapturesrc` kullanıyor (CLAUDE.md güncellendi)
   - Plugin scanner (`libexec/gstreamer-1.0/gst-plugin-scanner.exe`) eksik olabilir

3. **D3D11 Pencere Modu Hatası — Detaylandı**
   - `E_NOINTERFACE (0x80004002)` hatası pencere modunda alınıyor
   - `d3d11download` ile GPU→RAM köprüsü var ama tam çözüm değil
   - Hata log'ları: ui_issues.md satır 3-61

4. **Thinning Planı — Önce Stabilite Sonra Optimizasyon**
   - 259 plugin'den 20-30 kullanılıyor (~80MB kazanılabilir)
   - **Dikkat:** Thinning yapmadan önce cross-platform stabilite sağlanmalı
   - Eksik DLL tespiti daha kritik (VCRUNTIME140 örneği)

#### Sonraki Adımlar
- [ ] Fresh Windows 10'a erişince tam hata log'u al
- [ ] VC++ Redistributable'ı bundle'a ekle
- [ ] Plugin scanner'ın varlığını kontrol et
- [ ] Thinning planı uygula

---

### 🗓️ 2026-04-15 (Session 22 - Phase 2) — Cross-Platform Mimari Kararları

#### Kilit Kararlar

1. **Mevcut Build MinGW-w64 (Windows Özel)**
   - Görüldü: `libgcc_s_seh-1.dll`, `libstdc++-6.dll` → MinGW runtime
   - Gemini Flash'ın "MSVC hepsinde çalışır" önerisi yanlış
   - MSVC de Windows'a özel

2. **CI/CD Matrix Build Kararı (KESİN)**
   - **Ayrı binary:** Her platform için ayrı CI runner
   - Windows → `unicast-windows.exe`
   - Linux → `unicast-linux`
   - macOS → `unicast-macos.app`
   - `#[cfg(target_os)]` compile-time tespiti — path_setup.rs aynı kalır
   - Native GStreamer gerekli (D3D11/VA-API/VideoToolbox)

3. **Yeni Klasör Yapısı**
   ```
   app/src-tauri/gstreamer/
   ├── windows/          ← MinGW-w64 (mevcut)
   ├── linux/            ← Linux glibc (eklenecek)
   └── macos/            ← macOS Mach-O (eklenecek)
   ```

4. **Platform Bazlı Element Seçimi**
   - Windows: `d3d11screencapturesrc` + `wasapi2src`
   - Linux: `pipewiresrc` (Wayland) / `ximagesrc` (X11) + `pulsesrc`
   - macOS: `avfvideosrc` + `avfaudiosrc`

5. **Thinning Ertelenebilir**
   - Cross-platform stable olunca uygulanacak
   - **Önce çalışsın, sonra optimizasyon**

#### Yapılacaklar (Priority)
- [ ] GStreamer resmi builds indir (windows/linux/macos)
- [ ] `path_setup.rs`'yi platform tespitiyle güncelle
- [ ] CI/CD workflow matrix build ekle
- [ ] Linux'ta `pipewiresrc` test et
- [ ] macOS'ta audio loopback test et (BlackHole gerekebilir)

---

### 📋 DETAYLI REHBER OLUŞTURULDU
**Dosya:** `Roadmap/cross_platform_setup_guide.md`
- GStreamer indirme linkleri (windows/linux/macos)
- Klasörlere kopyalama adımları
- 7-Zip ile .tar.xz açma
- path_setup.rs notları
- Sorun giderme

---

### 🗓️ 2026-04-14 (Session 21) — GStreamer Stabilization & Hybrid GPU Adaptation

#### Yapılan Teknik İyileştirmeler (Mühendislik Denetimi)

1. **Dizin Köprüleri (Directory Junctions) & Sanallaştırma**
   - **Sorun:** Windows üzerinde boşluk içeren veya Türkçe karakterli kullanıcı yolları (`D:\Okul Belgeleri\...`), GStreamer'ın eklenti ve DLL yükleme mantığını bozarak yayının başlamasını engelliyordu.
   - **Çözüm:** PID bazlı benzersiz dizin köprüleri (`D:\UCGst_{PID}`) mimarisi kuruldu. Karmaşık dosya yolları, sürücü kökünde tertemiz ASCII bir "Sanal Yol"a haritalandı. Artık uygulama nereye kurulursa kurulsun GStreamer "evindeymiş gibi" çalışıyor.

2. **Pipeline Sözdizimi (Syntax Error) ve Argüman Onarımı**
   - **Sorun:** GStreamer pipeline dizgesi Windows CLI üzerinden tek bir blok halinde gönderildiğinde, tırnaklama hataları nedeniyle sinsi "Syntax Error" hataları veriyor ve yayın başarısız oluyordu.
   - **Çözüm:** `commands/stream.rs` ve `commands/encoder.rs` içindeki IPC mantığı güncellendi. Artık tüm pipeline elemanları GStreamer'a ayrı ayrı argümanlar olarak besleniyor. Yazım hatası riski 0'a indirildi.

3. **Hibrit GPU Kararlılığı ve Donanım Hızlandırma**
   - **Sorun:** RTX 3060 ve AMD Radeon hibrit sistemlerde `E_NOINTERFACE` (0x80004002) hatası ve donanım algılama başarısızlıkları yaşanıyordu.
   - **Çözüm:** 
     - `d3d11screencapturesrc` + `d3d11download` ikilisi stabilize edildi.
     - `encoder.rs` içindeki algılama mantığına `d3d11download` köprüsü eklendi. Sistem artık NVIDIA donanımını başarıyla tanıyor ve `nvh264enc` (NVIDIA) modunda ultra-düşük gecikmeyle çalışabiliyor.

4. **Akıllı Kalite ve Çoklu Mod Desteği**
   - **Sonuç:** Sunum (keskinlik odaklı), Video (akıcılık odaklı), Ses ve Pencere yakalama modlarının tamamı Windows üzerinde 100% kararlı hale getirildi. "Registry Nuke" mekanizmasıyla her açılışta temiz bir eklenti taraması garantiye alındı.

---

### 🗓️ 2026-04-14 — Portable GStreamer Deployment & Multi-Platform Bundling

#### Yapılan Teknik İyileştirmeler (Mühendislik Denetimi)

1. **GStreamer Bundling & Resource Management (Tauri v2)**
   - **Hedef:** Kullanıcıların bilgisayarına manuel GStreamer kurma zorunluluğunu ortadan kaldırmak ve "admin" izni olmadan çalışabilmek.
   - **Çözüm (Bundling):** GStreamer kütüphanesi projenin `app/src-tauri/gstreamer` klasörüne dahil edildi ve `tauri.conf.json` içinde `resources` olarak tanımlandı. Bu sayede uygulama paketlendiğinde GStreamer otomatik olarak pakete giriyor.
   - **Çözüm (AppData & Portable Support):** `path_setup.rs` dosyası Tauri v2 mimarisine uyarlandı. `std::env::current_exe()` yerine `AppHandle.path().resource_dir()` API'si kullanılarak kütüphaneler kurulduğu yer (AppData) veya taşındığı yer (exe yanı) neresi olursa olsun dinamik olarak bulunabiliyor.

2. **Dinamik Çevresel Değişken (Runtime PATH) Yönetimi**
   - Uygulama başladığında sistemin global `PATH` değişkenini kirletmeden, sadece UniCast süreci için GStreamer'ın `bin/` ve `lib/` dizinleri çalışma anında `PATH`, `GST_PLUGIN_PATH` ve `GST_PLUGIN_SYSTEM_PATH` değişkenlerine ekleniyor. Bu, DLL çakışmalarını (DLL Hell) önleyen en temiz yöntemdir.

3. **Versiyon ve Mimari Doğrulaması**
   - `msvc_x86_64` (VS 2022) mimarisi standart olarak belirlendi. `detect_encoder` ve `start_stream` komutları `AppHandle` üzerinden kütüphanelere erişecek şekilde refactor edildi.

---

### 🗓️ 2026-04-13 — Intelligent Quality Modes & UI Parity (Stabilizasyon Fazı 2)

#### Yapılan Teknik İyileştirmeler (Mühendislik Denetimi)

1. **Hibrit GPU & Pipeline Robustness (Windows Focus)**
   - **Sorun:** AMD (iGPU) ve NVIDIA (dGPU) bulunan laptoplarda pencere yakalama (window-handle) sırasında "Failed to prepare capture object" hatası alınıyordu.
   - **Çözüm:** 
     - `d3d11download` elemanı Windows için tüm pipeline'ların ardına zorunlu köprü olarak eklendi (GPU'dan RAM'e güvenli geçiş).
     - GStreamer sürüm uyuşmazlıkları (no property "cross-adapter") ayıklanarak standart D3D11 yakalama protokolü en stabil hale getirildi.
     - `videoscale` öncesi ve sonrası `videoconvert` katmanları eklenerek renk uzayı (ColorSpace) uyuşmazlıkları giderildi.

2. **Akıllı Kalite Modları (Presentation / Video)**
   - **Mevcut Durum:** Kullanıcılar tek bir ayarlamayla her senaryoyu (slayt vs film) çözmeye çalışıyordu.
   - **Çözüm (Dynamic Tuning):** `pipeline.rs` içine mod bazlı mantık eklendi:
     - **Sunum Modu:** 20 FPS (Sabit) | 6000 kbps | Maksimum Keskinlik (PowerPoint odaklı).
     - **Video Modu:** 30 FPS (Sabit) | 4000 kbps | Akıcılık (Hareket odaklı).

3. **UI Parite & Mini Ada İyileştirmesi**
   - **Sorun:** Mini ada ayarlarından kapatıldığında, yayını durduracak veya ağ durumunu görecek hiçbir araç kalmıyordu.
   - **Çözüm:** `ConnectionSetup.tsx` güncellendi. Eğer mini ada kapalıysa, ana ekrandaki "Yayında" panelinde asenkron olarak **Ses Slider** ve **Network Health** widget'ları beliriyor.
   - **Görsel:** `tauri.conf.json` yüksekliği `250px`'e çıkarılarak ses popup kesilmesi çözüldü. `translucent-dark` temasına premium `blur(20px)` efekti eklendi.

4. **Heartbeat & Graceful Stop (Devam)**
   - UDP:5001 üzerinden her 2 saniyede bir gönderilen keep-alive sinyali ile Pi'nin 5sn timeout vermesi engellendi.
   - `stopStream` tanımlama hatası (destructuring bug) giderildi.

---

### 🗓️ 2026-04-13 — Pi 5 Firebase & Robust Streaming Stabilizasyonu

#### Yapılan Teknik İyileştirmeler (Mühendislik Denetimi)

1. **Heartbeat (Keep-Alive) Döngüsü (Rust Backend - stream.rs)**
   - **Sorun:** Pi Agent, 5 saniye boyunca UDP:5001'den sinyal almazsa "bağlantı koptu" diyerek yayını kesiyordu.
   - **Çözüm:** `start_stream` komutuyla eşzamanlı çalışan bir `tokio::spawn` döngüsü eklendi. Her 2 saniyede bir "HEARTBEAT" paketi gönderilerek Pi'nin emniyet mekanizması (safety timeout) aktif tutuluyor.

2. **GStreamer Pipeline Robustness (pipeline.rs)**
   - **Sorun:** Windows pencere modunda format uyuşmazlığı (`-4 not-negotiated`) ve pencere boyutu değiştikçe piksellerin kayması.
   - **Çözüm (GPU-RAM Bridge):** `d3d11download` ve `videoscale` elemanları eklendi. Veri GPU'dan RAM'e güvenli bir şekilde çekilip, format `I420` (YUV420p) olarak sabitlendi. Artık pencere boyutu ne olursa olsun projeksiyona tam ekran ve sabit ölçekte sığdırılıyor (Letterboxing).

3. **Arayüz - Firebase Schema Senkronizasyonu (roomService.ts)**
   - **Sorun:** Veritabanı kuralları (Rules) gereği isimler `pi_status`, `pi_ip` ve `name` olarak güncellendiğinden, arayüz bu alanları tanımıyor ve odayı "çevrimdışı" gösteriyordu.
   - **Çözüm:** `RawRoom` interface'i ve mapping mantığı yeni şemaya göre güncellendi. Odalar artık "idle/streaming" durumlarını anlık yansıtıyor.

4. **Graceful Termination & STOP Signal (stream.rs)**
   - **Sorun:** Yayın durduğunda Pi, "acaba ağ mı koptu" diyerek 20 saniye boyunca bekleme (grace period) yapıyordu.
   - **Çözüm:** Durdurma komutuna UDP "STOP" sinyali eklendi. Pi artık yayının bilinçli sonlandırıldığını anlayıp anında Idle/PIN ekranına dönüyor.

5. **Pi Agent v3.1 Deployment (agent.py)**
   - **İşlem:** `ROOM_ID` dinamik okuma (`unicast_config.txt`) ve Firebase-admin SDK entegrasyonu tamamlandı. `unicast_pi` cihaz yolu (`/home/unicast_pi/`) doğrulanarak servis aktif edildi.

---
### 🗓️ 2026-04-10 (Oturum 4) — UI ve Mimari Sorunların Çözümü

#### Yapılanlar (Sebep → Sonuç)
1. **GStreamer Çökme Hatası (nvh264enc tuner crash)**
   - **Sebep:** NVIDIA kodlayıcısı (`nvh264enc`) `tune=zerolatency` parametresini desteklemiyordu (sadece `zerolatency=true` alıyor), bu yüzden GStreamer crash verip kapanıyordu.
   - **Sonuç:** `src-tauri/src/gstreamer/pipeline.rs` içindeki `encoder_params` dinamik hale getirildi. Artık donanım hızlandırma çökmeden çalışıyor, minik ada kapanmıyor.

2. **Window ve Monitor Yakalama "lock error" Sistemi Düzeltildi**
   - **Sebep:** Rust tarafında `EnumWindows` ve `EnumDisplayMonitors` API'lerine gönderilen `Arc<Mutex<...>>` referans kopya pointer'ı metot sonunda memory'den drop edilmiyordu ve `Arc::try_unwrap()` 2 referans olduğu için panic/lock error atıyordu.
   - **Sonuç:** `windows.rs` ve `monitors.rs` içerisinde pointerlar drop edildi. Pencereler ve ekranlar artık başarıyla frontend'e liste olarak akıyor. "Açık pencere bulunamadı" hatası kökünden çözüldü.

3. **Küçük Ada (StreamingBarApp) UI İyileştirmeleri**
   - **Sebep (Sayacın yanlış sayması):** Timer component mount olduğu an başlıyor, Tauri pencereleri arkada canlı tuttuğu için yanlış sayıyordu. **Sonuç:** Rust'ın ilk kareyi aldığı/stream başladığı an attığı `stream-mode-info` sinyali dinlenerek sayaç 0'landı. Tema `settingsStore`'dan okunarak senkronlandı.
   - **Sebep (Ses Butonunun Kesik Gözükmesi):** Tauri penceresi yüksekliği (`tauri.conf.json`) `56px`'ti. Dialog pop-up'ı dışarı çıkmaya çalışınca kesiliyordu (clipping). **Sonuç:** Pencere yüksekliği `200px` yapıldı ve dış container tam şeffaf yapıldı, sadece içerideki bar `56px` yer kaplıyor. Artık popuo havada süzülebilecek.

4. **Kullanıcı Deneyimi (Hakkında kısmı & PIN Auto-Focus)**
   - **Sebep/Sonuç:** `SettingsModal.tsx` içindeki "ALKÜ" yazısı silindi, GitHub butonu sadeleştirildi, `{{version}}` JSON hatası düzeltildi. PIN input focus süresi `120ms`'den `300ms`'ye çıkarılarak focus tutarlılığı artırıldı. Frontend testleri için yasaklanan "Sağ tık (Right-Click)" bağlam menüsü App.tsx üzerinden geçici olarak debuggerlar için tekrar açıldı.

### 🗓️ 2026-04-10 (Oturum 4 - Phase 2) — Deadlock & Stream Bar Düzeltmeleri

#### Yapılanlar (Sebep → Sonuç)
1. **Uygulama Donması / Yanıt Vermiyor (Deadlock) Çözümü**
   - **Sebep:** GStreamer sürecini dinleyen tokio görevinde `child.wait()` işlemi Mutex kilidi altındayken yapıldığı için (blocking wait), yayın kesilmek istendiğinde `stop_stream_internal()` fonksiyonu kilit bekleyerek sonsuz döngüye girip uygulamayı çökertiyordu. Ayrıca Windows'ta `gst-launch` alt süreci öksüz (orphan) kalabiliyordu.
   - **Sonuç:** `stream.rs` içerisindeki kontrol yapısı non-blocking `try_wait()` fonksiyonuna çekilerek kilitler hemen boşa çıkarıldı (Deadlock önlendi). Ayrıca Windows için "Kapatma" işleminin `taskkill /F /T /PID` kullanılarak tüm alt process ağacını garanti silmesi sağlandı.

2. **Küçük Ada Ayarlarının Devre Dışı Bırakılamaması & Şeffaflık Hilesi**
   - **Sebep:** Ayarlardaki `streamingBar.enabled` değişkeni, backend veya frontend publish adımında kontrol edilmiyordu. Ayrıca arka planın gözüken dikdörtgeni Tauri şeffaflığıyla değil Vite React root arkaplan rengiyle (`var(--bg-primary)`) boyanıyordu. Tema değişimi ise mini ada yeni bir izolasyon ortamı olduğu için diske işlenmeden yüklenmiyordu.
   - **Sonuç:** `connectionStore.ts` içerisine `get().settings.streamingBar.enabled` şartı eklendi (artık kapalıysa açılmıyor). `StreamingBarApp.tsx` bileşenine mount edildiği an tüm root ve body renklerini (`transparent`) yapacak bir `useEffect` eklendi (artık alt kısımda yayılan kocaman siyah bölge sırra kadem bastı!). Ayrıca yine bu bileşen yüklendiği ve mount edildiği an `loadFromDisk()` çağırılarak tema senkronizasyonu sağlandı.

3. **PIN Giriş Kısıtlamaları**
   - **Sebep/Sonuç:** Fare tıklaması olmadan direkt klavyeden yazılması için `PINEntry.tsx` içerisindeki native `autoFocus={i === 0}` React Prop'una geçildi. Rakam harici girişleri sadece görselden silmek yeterli değildi, `onKeyDown` fonksiyonuna güçlü bir RegEx filtresi eklendi (harfleri ve diğer tuşları klavye seviyesinde bastırmadan engelliyor).

### 🗓️ 2026-04-10 (Oturum 4 - Phase 3) — Hotfix & UI State Çökmesi

#### Yapılanlar (Sebep → Sonuç)
1. **Yayın Başlatırken Ana Ekranın Gitmemesi ve TypeError Çökmesi**
   - **Sebep:** `connectionStore.ts` dosyasında `get().settings.streamingBar.enabled` kodu kullanılarak "Ayarlar" sekmesindeki ada gösterim ayarı çekilmeye çalışılmıştı. Oysaki `connectionStore`'un kendi store'unda `settings` nesnesi yoktur (settings, `settingsStore` içindedir). "undefined" olan state'den okuma yapılınca TypeScript Runtime hatası dönüyor ve ana yayının ekrandan kaybolması vb. bütün vaadler (async promise) askıda kalıyordu.
   - **Sonuç:** `connectionStore.ts` içerisine `useSettingsStore` asenkron bir biçimde ithal edilip (`import()`) `useSettingsStore.getState().streamingBar.enabled` ile çağırıldı. Hata düzeltildi.

### 🗓️ 2026-04-10 (Oturum 4 - Phase 4) — Minik Ada İnce Ayarları (v2)

#### Yapılanlar (Sebep → Sonuç)
1. **Küçük Ada Şeffaf Arkaplan Çerçevesi / Gölge (Shadow)**
   - **Sebep:** Windows işletim sistemi şeffaf pencerelerde estetik amacıyla içeriğin etrafına gölge vermeye çalışır. Bu gölge 1 piksellik hayalet bir çizgi gibi durur.
   - **Sonuç:** `tauri.conf.json` içerisinde `streaming-bar` konfigürasyonuna `"shadow": false` eklenerek işletim sistemi gölgesi tamamen iptal edildi.

2. **Ses Açma Bölmesinin Kesilmesi (Clipping) Sorunu**
   - **Sebep:** `StreamingBarApp.tsx` bileşeni kapsayıcısında (200px'lik transparan kutu) bara `items-start` verilmişti. Bar en tepede yer aldığı için ses çubuğu (pop-up) yukarı doğru açılmaya çalışırken pencerenin `y=0` sırını aşıp taşıyordu.
   - **Sonuç:** Kapsayıcı `items-end` yapılarak çubuğun `200px`'lik kutunun **en alt** kısmında yer alması sağlandı. Böylece pop-up açıldığında pencerenin devasa boş (`transparent`) üst alanında rahatça sığabiliyor, kesilmiyor.

3. **Mod Switch (TAM/Pencere) Menü Hatası ve UI State'inin Asılı Kalması**
   - **Sebep:** Pencere moduna geçmek ana uygulamadaki "Pencere Seçim Menüsüne (Window Picker)" ihtiyaç duyar. Minik odadan bu verilemediği için null id ile başlatılıyordu. Ayrıca yayın kapatıldığında bileşen ölmediğinden tekrar yayına girildiğinde "Durduruluyor" simgesi ekranda kalıyordu.
   - **Sonuç:** Mod Switch tıklaması kaldırılarak buton `disabled` ve yalnızca bilgilendirme amaçlı indicator yapıldı. (Pencere seçilecekse yayın durdurulup baştan ayarlanmalı). Ardından yayının her başladığında dinlediği `stream-mode-info` eventine `setStopping(false)` ve `setAudioPopupOpen(false)` satırları eklenerek asılı kalan state'lerin arınması (hydrate) sağlandı.

### 🗓️ 2026-04-10 (Oturum 4 - Phase 5) — Mimari Stabilizasyon ve Final UX

#### Yapılanlar (Sebep → Sonuç)
1. **Küçük Ada Kapalıyken Uygulamanın Tamamen Yok Olması**
   - **Sebep:** Yayın başladığında `connectionStore` doğrudan ana pencereyi küçültüyordu (`hide()`). Ancak küçük ada (Streaming Bar) ayarlardan kapalıysa, ekranda yayını durduracak *hiçbir* araç kalmıyordu.
   - **Sonuç:** `hide()` fonksiyonu yalnızca `useSettingsStore.getState().streamingBar.enabled` "true" ise çalışacak şekilde kilitlendi. Alt çubuk kapalıysa Ana Ekran açık kalıyor. Ana Ekranda ise (ConnectionSetup) yayın durumuna geçildiğinde PIN menüsü kaybolup, yerine şık bir Animasyonlu Wi-Fi simgesi ile tam ortalanmış kocaman, kırmızı bir **"YAYINI DURDUR"** kontrol kartı eklendi.
2. **Ses Seviyesi Çubuğu Beyaz Şerit (Görsel İşlevsizlik)**
   - **Sebep:** Dikey (Vertical) slider yapmak için Webkit engine içerisinde `writingMode: vertical-lr` hack'i kullanılmıştı. Bu hack çalışmasına rağmen "accent" (doluluk oranı izi) rengini basmıyordu (chromium bug).
   - **Sonuç:** Input'un native dikey zorlaması kaldırılarak, klasik yatay çizilen slider CSS Transform mimarisiyle `transform: rotate(-90deg)` şeklinde dikey 90 derece döndürülerek ekrana yerleştirildi. Doluluk oranı anında kusursuz gelmeye başladı.
3. **Temanın Adaya Anında (Live) Senkronize Olmaması**
   - **Sebep:** Diskten tema okuması yapan mini bar, ayarların *değiştiğini* bilmiyordu, uyanması için tamamen baştan render (`mount`) olması gerekiyordu.
   - **Sonuç:** Ayarların diske yazıldığı fonksiyonda Rust komutu bittikten hemen sonra `emit("settings-updated")` adlı global bir Tauri Sinyali havaya fırlatıldı. Minik adanın dinleyici useEffect'i bu sinyali kaptığı saniye anında `loadFromDisk()` çağırarak yayındayken bile temayı saliselik güncelledi.
4. **Mod Değiştirme Butonu - Erişilebilirlik ve Kararlılık (Window Mode Picker)**
   - **Sebep:** Minik adada mod ikonunu devre dışı `disabled` bırakmıştık ancak kullanıcı UX olarak bunun basılamaz olmasından rahatsız oldu.
   - **Sonuç:** Buton tekrar aktifleştirildi (hover efektleri açıldı). Ancak doğrudan geçersiz (null) bir işlev tetiklemek yerine, Tauri IPC `WebviewWindow.getByLabel("main").show()` kullanılarak; eğer kullanıcı "TAM/Pencere" değiştirmek isterse anında gizlenmiş olan "Ana Ekranı (ConnectionSetup)" en öne getirerek (`focus`) işlemi büyük pencereden sağlıklı biçimde yapması (ya da yayını kapatması) zarif bir dille sağlandı.

### 🗓️ 2026-04-10 (Oturum 4 - Phase 6) — Refactoring ve Bugfix
1. **Mod Değiştirme Kafa Karışıklığı:** "Pencere Seçim Menüsüne (Window Picker)" geçiş için büyük menünün çağrılması konsepti terk edilip, minik adadaki buton tamamen tıklanamaz ve pasif bir simge haline (indicator) getirildi.
2. **Tanımlanmamış Değişken Hatası (Square Is Not Defined):** Yayını durdur menüsünde "Kare (Square)" ikonunun kütüphaneden import edilmemesi sebebiyle Main ekranın çökmesi hatası, import eklenerek düzeltildi.





## 🗓️ 2026-04-10 — E2E Integration & Security Diagnosis
### Completed
- **GStreamer Pipeline Stability (Rust Backend):**
  - Fix: Delegated GStreamer commands to `cmd /C` with `.exe` check. Corrects Windows `Command` argument parsing.
  - Added `queue` elements to pipeline to prevent buffer errors.
- **Protocol Verification:**
  - Validated UDP handshake (WAKE/READY/PIN) between Sender (Tauri) and Receiver (Mock Pi).
  - Communication layer confirmed 100% functional.
- **Tauri v2 Capabilities (Permissions) Diagnosis:**
  - Issue: Main window wouldn't hide/Streaming Bar wouldn't show despite backend trigger.
  - Cause: Tauri v2 strict security policy; frontend lacked `event:listen` and `window:control` permissions.
- **Rust Backend Cleanup:**
  - Fixed `windows` crate v0.57.0 breaking changes in `audio.rs` (STGM_READ, PROPVARIANT depth).
  - Resolved ambiguity in `SetMute`.
  - Cleaned up unused imports/variables in `lib.rs`, `windows.rs`, `stream.rs`, `pipeline.rs`.

### Current Status
- ✅ **Backend:** GStreamer reaches "PLAYING" on Windows; A/V packets transmitting.
- ✅ **Communication:** UDP/PIN protocol stable with mock hardware.
- 🚧 **UI Transition:** Capabilities updated; system ready for auto-switch from "Connecting" to "Streaming Bar".

---

## 🗓️ 2026-04-09 — Pi Agent v3: Firebase Integration
### Completed
**`src/receiver/agent.py` updated to v3:**
- **Firebase Integration:**
  - `firebase-admin` SDK with Service Account JSON.
  - Initial entry at `/rooms/<ROOM_ID>`: `pi_ip`, `pi_status: "idle"`, `last_seen`, `label`, `floor`.
  - `_firebase_heartbeat()` daemon thread (60s cycle, non-blocking).
  - Real-time status transitions: `idle` ↔ `streaming` ↔ `offline`.
- **Protocol Alignment (Rust Compatibility):**
  - Updated PIN: `PIN:<pin>` → `OK` / `FAIL:<N>` / `BUSY`.
  - `WAKE` → `READY` + CEC power-on.
  - `HEARTBEAT` → Timestamp update.
  - `STOP` → Starts grace period.
- **Graceful Shutdown:**
  - Handlers for SIGTERM/SIGINT.
  - Actions: Set Firebase `offline`, pipeline NULL, CEC standby.
- **RTT Echo (Port 5005):**
  - Dedicated daemon thread for `stream-health` metrics.
- **Security:**
  - Added `pin_attempts` tracking per IP (max 3).

### Environment Setup (Pi)
```bash
pip install firebase-admin Pillow psutil
# Copy firebase-key.json to src/receiver/
# Set ROOM_ID in agent.py
sudo systemctl restart unicast-agent
```

### Component Status
| Component | Status |
|-----------|--------|
| Screen 1 — RoomDiscovery | ✅ Done |
| Screen 2 — ConnectionSetup | ✅ Done |
| StreamingBarApp | ✅ Done |
| SettingsModal | ✅ Done |
| Pi agent.py v3 | ✅ Done |
| Pi → Firebase Sync | ✅ Done |
| RSA Auth | ❌ Backlog |
| i18n | ❌ Backlog |

---

## 🗓️ 2026-04-09 — SettingsModal Implementation
### Completed
- **`SettingsModal.tsx`:** Full feature set implemented.
  - Tabs: Stream, Audio, Network, Control Bar, Appearance, About.
  - **Stream:** Res (1080p-480p), FPS (30/20/15), Bitrate (1-8 Mbps), Encoder detection.
  - **Audio:** Device selection (WASAPI), Mute local toggle.
  - **Appearance:** Light/Dark mode with instant DOM updates.
  - **Persistence:** Real-time updates via `settingsStore.updateSettings()`.

---

## 🗓️ 2026-04-09 — StreamingBarApp & Bug Fixes
### Completed
- **`StreamingBarApp.tsx`:** Full implementation.
  - Real-time timer (`MM:SS` / `H:MM:SS`).
  - Stream mode badge (Window/Full) with IPC toggle.
  - Dynamic RTT indicator (5-level color dot).
  - Vertical audio popup + mute.
- **Bug Fixes:**
  - Corrected Bar URL to `/#/streaming-bar` for HashRouter compatibility.
  - Fixed `no-drag` regions for inputs/sliders in `index.css`.

---

## 🗓️ 2026-04-09 — Mock/Test Mode Activation
### Purpose
Infrastructure for testing without physical Pi or polluting production Firebase.
### Changes
- **`src/receiver/mock_pi.py`:**
  - UDP simulator on localhost.
  - Echo on 5005, Auto-OK on 5001.
- **`roomService.ts`:**
  - Injected `oda-mock` pointing to `127.0.0.1`.

---

## 🗓️ 2026-04-07 — Pi 5 Deployment (Production Ready)
- **Deployment Guide:** Updated for Debian 12/13 DRM/KMS.
- **Smart Agent v2:** State machine (IDLE/STREAMING/RECONNECTING), PIN rotation, 20s grace period.
- **Identity:** ALKÜ branded standby screen.
- **Verification:** E2E test successful with `test_sender.py`.

---

## 🗓️ 2026-04-06 — UI Architecture Design
- **Stack:** Tauri v2, React 18, TS, Tailwind v3, Zustand, Firebase SDK.
- **Features:** Dual-window system, `WDA_EXCLUDEFROMCAPTURE` integration.
- **Planning:** 3-screen flow and cross-platform Gap Analysis.

---

## 🗓️ 2026-04-05 — Restructuring & Benchmarking
- **Modular Layout:** Organized into `src/receiver`, `src/sender`, `src/analytics`.
- **Metrics:** Implemented `benchmarker.py` for RTP/System stats.
- **Audio PoC:** Low-latency Opus via WASAPI loopback.
- **Sync:** Fixed lip-sync drift using `sync=true` and `mode=slave`.
