ana ekranda:
    ekranın sol üstündeki logo beyaz zemin üzerinde değil belki de hafızada eskisi kaldığı içindir emin olamadım.
    ekranın sol üstünde UniCast altında Wireless Screen yazıyor Wireless Screen yazısı olmasın kalksın.
    favorilerde yıldız emojisi kalksın sadece Favoriler yazısı yeterli.
    favorilerin tasarımı çok güzel gözüküyor ama aynı odalardan favorilere eklerkenki gibi küçük bir yıldız sembolü koyabiliriz (favorilerden kaldırmak için) veya favoriler kısmına bir çöp kutsu butonu ekleriz o butona tıklayınca istediği odayı favorilerden silmek için tıklaması yeterli olur.
    sağ üst kısımda TR TR ve GB EN yazmak yerine sadece TR ve EN olması yeterli. Ayrıca burası önemli ki dil seçeneği çalışmıyor ingilizce de seçsem türkçe de seçsem uygulama türkçe kalıyor.
    uygulamanın sistemin temasını tespit edip (mac linux ve windows için uyumlu olacak şekilde)  uygulamayı o temaya göre açması gerekiyor fakat benim bilgisayarım koyu tema kullanmasına rağmen ilk açılışta açık tema geldi.
    Ayarlardan Tema değiştirme butonunu kaldırıp ana ekranda sağ üstte çark ile dil seçeneğinin oraya bir yere eklenmeli.

ayarlar:
    encoder çalışmıyor algılanmadı diyor ve tara diyince de algılamıyor. Ayrıca Encoder, Algılanmadı yazısı ve altındaki bilgi metni sığmıyor birbirine giriyor orada bir boyut hatası var.
    yayın sırasında hoparlörü kapat switch'inin de boyut sorunu var switch'in beyaz yuvarlağı mavi şeridin sağına taşıyor, off yapınca aslında on olması gereken yere geliyor.
    üstte bahsedilen switch sorunu diğer switchlerde de bulunmakta
    hakında kımsında üniversite adı sağa yaslı değil sola yaslı duruyor, ayrıca en alta okulun ve uygulamanın logosunu eklemek istiyorum. bizim logomuz 'app\UniCast.png' okulun logosu ise 'app\alku-yatay-logo-rgb.png'
    hakkında kısmındaki platform mevzusunu kaldıralım gerek yok
    ayrıca çoğu ayar gelişmiş kısmına alınmalı mesela basit ayarlar çözünürlük ve fps başta olmalı diğer bit hızı ve enoder gelişmişte olmalı. gelişmişe erişmek için farklı bir yerde ekstra bir buton olmasına gerek yok aynı alanda sadece gizlenmeli. Gelişmiş ayarlar için buraya tıklayın yazısı ile açılıp kapanmalı. ağ kısmındaki senkronizasyon tamponu da bu yayın kısmındaki gelişmişe taşınmalı 

oda görünümü:
    sayfaya girer girmez pin yazmak için belirlenen alana tıklanmış gibi olacak. kullanıcı fare ile tıklamak zorunda kalmadan direkt klavyeden pini girmeye başlayabilecek 
    pencere yakalama çalışmıyor (önemli)
    sistem sesi kısmındaki switch yukarıda bahsettiğim aynı soruna sahip
    pin girme ekranında otomatik şifre önermesini kapatmamız gerekiyor
    mock ile deneme yaparken yayın ekranına geçmiyor bağlanıyor'da kalıyor bununla alakalı şunlar var:
    "
deprecations.ts:9 
⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates in `React.startTransition` in v7. You can use the `v7_startTransition` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_starttransition.
warnOnce@deprecations.ts:9
deprecations.ts:9 
⚠️ React Router Future Flag Warning: Relative route resolution within Splat routes is changing in v7. You can use the `v7_relativeSplatPath` future flag to opt-in early. For more information, see https://reactrouter.com/v6/upgrading/future#v7_relativesplatpath.
warnOnce@deprecations.ts:9
:5173/favicon.ico:1  
Failed to load resource: the server responded with a status of 404 (Not Found)
2
systemStore.ts:56 
[systemStore] refreshMonitors failed: lock error
refreshMonitors@systemStore.ts:56
2
systemStore.ts:44 
[systemStore] refreshWindows failed: lock error
refreshWindows@systemStore.ts:44
2
:5173/#/connect:1 
Uncaught (in promise) event.listen not allowed. Permissions associated with this command: core:event:allow-listen, core:event:default
2
systemStore.ts:79 
[systemStore] detectEncoder failed: No suitable encoder found
detectEncoder@systemStore.ts:79
connectionStore.ts:112 
[connectionStore] Could not show streaming bar: window.get_all_windows not allowed. Permissions associated with this command: core:window:allow-get-all-windows, core:window:default
startStream@connectionStore.ts:112
connectionStore.ts:120 
[connectionStore] Could not hide main window: window.hide not allowed. Permissions associated with this command: core:window:allow-hide
startStream@connectionStore.ts:120",
yapay zeka şunu önerdi:
"Furkan, işte bu! **Hatanın tam kalbini (smoking gun) bulduk.** 🎯

Bilgisayar mühendisi olarak bu durum senin için harika bir "Tauri v2 Güvenlik Mimarisi" dersi olacak. Sorun ne Rust kodunda ne de GStreamer'da; sorun tamamen **Tauri'nin yeni izin sisteminde (Capabilities).**

Tauri v2, v1'den çok daha katı bir güvenlik politikasına sahip. Sen frontend'den (React) şu üç şeyi yapmaya çalışıyorsun ama Tauri "Hoppala, senin buna yetkin yok!" diyor:
1.  `event.listen`: Rust'tan gelen `"stream-started"` sinyalini duyamıyorsun.
2.  `window.get_all_windows`: Streaming bar penceresini bulamıyorsun.
3.  `window.hide` / `window.show`: Ana pencereyi gizleyip barı gösteremiyorsun.

### Kesin Çözüm: İzinleri Tanımlamak

Lütfen şu dosyayı aç: **`src-tauri/capabilities/default.json`** (Eğer adı farklıysa `capabilities` klasörü içindeki `.json` dosyasıdır).

Orada `permissions` dizisinin içine şu eksik olan izinleri eklememiz gerekiyor. Dosyayı şu hale getir (mevcut izinleri bozmadan bunları ekle):

```json
{
  "$schema": "../gen/schemas/desktop-capability.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main", "streaming-bar"],
  "permissions": [
    "core:default",
    "core:event:allow-listen",
    "core:event:allow-emit",
    "core:window:allow-get-all-windows",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-set-focus",
    "core:window:allow-close"
  ]
}
```

### Neden "Lock Error" ve Diğerleri Oluyor?

* **Lock Error:** `systemStore.ts` aynı anda hem monitörleri hem pencereleri yenilemeye (refresh) çalışıyor. Arka planda Rust tarafındaki Mutex (kilit) bir işlem bitmeden diğeri gelince hata veriyor. Bunu şimdilik boşver, yayını engellemez.
* **Permissions associated with this command:** Bu mesaj az önce eklediğimiz izinlerle tamamen yok olacak.

---

### Şimdi Ne Yapmalısın?

1.  `capabilities/default.json` dosyasını yukarıdaki gibi güncelle ve kaydet.
2.  Tauri'yi tamamen kapat ve terminalden tekrar `npm run tauri dev` diyerek **yeniden başlat** (İzin değişiklikleri bazen hot-reload ile gelmez).
3.  Odaya bağlanmayı dene.

**Tahminim:** Bu sefer Rust "Yayın başladı" dediği an, React tarafı o sinyali "duyacak" (listen yetkisi geldiği için), ana pencereyi gizleyecek (hide yetkisi geldiği için) ve Streaming Bar penceresini çat diye karşına getirecek!
"