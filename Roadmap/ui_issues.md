Eski sorunların bazıları çözüldü bazıları devam ediyor bu belge devam eden sornları listelemektedir.
en önemli şey:
  uygulama mimarisi hem mac hem linux hem de windows için uygun olmalı. Mac'de ses sorunu vardı sanırım şimdilik mac'in ses yayınlamaısnı kapatacağız.
  sanırım uygulamanın portable olmasını tartışmıştık öyle olmaya devam dececekse mimari ona uygun olmalı. 
ana ekranda:
    Önemli ki dil seçeneği çalışmıyor ingilizce de seçsem türkçe de seçsem uygulama türkçe kalıyor.
    
ayarlar:
    hakında kımsında sürüm {{version}} yazıyor {{version}} yazısı sanırım dil sorunundan kaynaklı diye tahmin ediyorum orada türkçedeyken 'Sürüm' ingilizcedeylen 'Version' yazmalı. Üniversite adı iyi ama altında alkü yazmasın. bunun da altında ola github repo linki butonunda Saedce 'GitHub' yazması yeterli.

oda görünümü:
    sayfaya girer girmez pin yazmak için belirlenen alana tıklanmış gibi olacak. kullanıcı fare ile tıklamak zorunda kalmadan direkt klavyeden pini girmeye başlayabilecek (bu sorun hala çözülmedi)
    pencere yakalama çalışmıyor (önemli bu sorun da hala çözülmedi), 'Açık bir pencere bulunamadı diyor' 
    final sürümünde uygulaanın herhangi bir yerine sağ tıklanması güvenlik için engellenmeli şuan kalabilir. (demiştim şimdi kapandı daha sonra kapanacaktı şu an bugfix için kullanıyorum bu da önemli)
    Mock ile deneme yaparken bağlanıyor ve ekran paylaşımı için minik ada geliyor ama 2-3 saniye sonra geri kapanıyor bu sistemsel bir hata mı yoksa böyle mi tasarladık bilmiyorum.
    termianlde şu çıktı var:
    "WARNING: erroneous pipeline: could not set property "tune" in element "nvh264enc" to "zerolatency"
[2026-04-10T16:57:59Z ERROR unicast_lib::commands::stream] [stream] GStreamer exited with error: exit code: 
1
"

Küçük ada görünümü:
    Ayarlardan temasını değiştirmeme rağmen küçük ada görünümü her zaman koyu tema ile açılıyor.
    Süre sayacı yanlış, sanıırım 'npm run tauri dev' scriptini çalıştırdığımdan beri geçen süreyi sayıyor.
    Ses butonuna basınca çok küçük bir bölme çıkıyor ama bu bölmede ui_architecture.md dosyasında istediğim bileşenler gözükmüyor çünkü çok küçük ince ve yassı bir şey çıkıyor.
    
---
## 🧠 Beyin Fırtınası ve Çözüm Planları (2026-04-10)

### 1. Ana Ekran - Dil Seçeneği
- **Sorun:** TR/EN seçimi çalışmıyor. (Bu hata `App.tsx` içerisindeki i18n senkronizasyon kodunun düzeltilmesiyle az önce *çözüldü*! Artık dil değişecek.)

### 2. Ayarlar - Hakkında Kısmı
- **Sorun:** `{{version}}` yazısı ve ALKÜ/GitHub metinleri.
- **Çözüm:** `i18n` dosyalarında (`tr.json` ve `en.json`) `"version": "Sürüm {{version}}"` gibi bir tanımlama var ama React componentinden `{ version: "0.1.0" }` objesi parametre olarak gönderilmemiş. `t("settings.about.version", { version: "0.1.0" })` olarak düzeltilmeli. Ayrıca ALKÜ logoları altındaki "GitHub Reposu" çevirisi veya HTML butonu basitleştirilip sadece "GitHub" yapılmalıdır.

### 3. Oda Görünümü - PIN & Yayın
- **Sorun (PIN Focus):** PIN ekranına girilince input'un otomatik aktifleşmemesi.
- **Çözüm:** Tauri Webview'ı React render olduğunda OS (işletim sistemi) tarafında focuslanmadığı için `focus()` metodu çalışmıyor olabilir. Rust backend'ten veya Tauri API kullanarak `getCurrentWindow().setFocus()` çağrılabilir veya timeout süresi biraz daha arttırılabilir (örn. 300ms).

- **Sorun (Pencere Yakalama):** "Açık bir pencere bulunamadı".
- **Çözüm:** Rust backend'deki `get_open_windows` fonksiyonu Windows OS API'lerini kullanıyor. Eğer bir hata dönüyorsa ya da eksik yetki varsa pencereleri boş liste döner. Ayrıca Rust kodunda UI process/thread erişiminde GUI olmayan bir modda çalışıyor olabiliriz. Logları inceleyip (`console.error`'a düşen mesajları) bu API'nin neden boş veya hata döndüğüne bakılmalı.

- **Sorun (Sağ Tık Engeli):** Sağ tık bağlam menüsü çıkmıyor.
- **Çözüm:** `App.tsx` dosyasında yazdığımız "P10 - Disable right-click globally" `useEffect` bloğundaki yorumlu kod (`e.preventDefault()`) aktifleştirilip her yerde sağ tık yasaklanabilir. şu anda yasaklı olması lazım zaten bunun bir sonraki implementasyonda bugfix için açılıp final sürümünden önce yasaklanması gerekiyor.

- **Sorun (Ada Kapanıyor / nvh264enc tuner hatası):** GStreamer "tune=zerolatency" değerini bulamıyor.
- **Çözüm:** BAZI NVidia (nvh264enc) plugin sürümleri Windows'ta `tune=zerolatency` property'sini almaz. `src-tauri/src/gstreamer/pipeline.rs` içindeki `tune=zerolatency` parametresini kaldırmak ya da encodere göre dinamik ayarlamak sorunu kökünden çözecektir. Minik ada, arkaplanda GStreamer pipeline crash verip yayın durduğu için ("stream-stopped" event'i) bir kaç saniye sonra kayboluyor; yani mimari tasarımı doğru çalışıp "hata olunca kendini kapatıyor", asıl sorun stream'in crash olması.

### 4. Küçük Ada Görünümü (StreamingBarApp)
- **Sorun (Tema):** Ada hep dark(koyu) açılıyor.
- **Çözüm:** `tauri.conf.json`'da bu pencere şeffaf (`transparent: true`) açılıyor. Arka plan rengini `appearance.barTheme` parametresine bağlamalıyız ve bu pencere ayrı bir süreç olduğu için kendi state'inde `settingsStore`'dan güncel bar temasını okuyarak uygulamalı.
- **Sorun (Süre Sayacı):** Yanlış süre (`npm run dev`'den beri vs. sayıyor gibi).
- **Çözüm:** `StreamingBarApp.tsx` timer arka plan pencereleri HMR sırasında kapatılmadığı için bozuluyor olabilir. En doğru çözüm; Rust backend stream başladığında bir Timestamp (başlangıç ms) göndermeli ve Frontend süreyi `Date.now() - startTime` formülüyle hesaplamalıdır.
- **Sorun (Ses Butonu Küçük Bölme):** İnce/yassı bir pop-up.
- **Çözüm:** Tauri pencere sistemiyle alakalı. `streaming-bar` penceresinin boyutu `tauri.conf.json` dosyasında `height: 56` olarak sınırlandırılmıştır. Pop-up bu pencerenin *içinde* çizildiği için 56 px yüksekliğin dışına taşan yerler "clip" (kesilir) edilir. Çözüm olarak; `streaming-bar` penceresinin yüksekliği (örneğin 200px) ayarlanarak üst kısmı tamamen transparent (fare tıklaması geçiren) bırakılmalıdır, böylece pop-up'ın gözükeceği bir şeffaf alan elde edilir.
