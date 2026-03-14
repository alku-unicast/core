# Faz 2: Kullanıcı Arayüzü (Tauri + React/Tailwind) Tasarımı ve Akışı

Bu aşama, öğretmenlerin sistemle etkileşime gireceği, kullanımı kolay ve modern arayüzün (Frontend) geliştirilmesini kapsar. Tauri ve React/Tailwind CSS kullanılarak, eski bilgisayarlarda bile anında açılabilen, düşük RAM tüketen, şık bir masaüstü uygulaması hedeflenmektedir. Uygulama Türkçe ve İngilizce dil seçeneklerini destekleyecektir.

## 1. Ekran Akışı ve Tasarım Mimarisi

Kullanıcı deneyimi karmaşıklıktan uzak tutulmuş ve üç ana ekran üzerinden kurgulanmıştır: 
**Ana Ekran (Sınıf Listesi) → Bağlantı/Parametre Ekranı → Yayın Ekranı (Minimal)**.

### Ekran 1: Ana Ekran (Sınıf Keşfi ve Favoriler)
Uygulama açıldığında öğretmeni karşılayan ilk ekrandır.
*   **Favoriler Bölümü:** Öğretmenlerin sık kullandığı sınıflar yatay kaydırılabilir (scroll) veya grid şeklinde en üstte yer alır. Bu veriler Firebase'den değil, yerel olarak `settings.json` dosyasından çekilir.
*   **Sınıf Listesi (Katlara Göre):** Firebase'den gerçek zamanlı gelen sınıf verileri katlara göre (Zemin Kat, 1. Kat, vb.) sekmelere ayrılır. 
*   **Durum Göstergeleri:** Her sınıf kartında Pi'nin o anki durumu renkli noktalarla (Örn: Yeşil = Boşta/Idle, Gri = Çevrimdışı, Turuncu = Yayında) gösterilir.
*   **Hızlı Aksiyonlar:** Her sınıf kartında favorilere ekleme/çıkarma (yıldız ikonu) ve "Ayarlar" çarkı ile "Dil Seçeneği (TR/EN)" bulunur.

### Ekran 2: Bağlantı ve Parametre Ayarları
Öğretmen bir sınıfa tıkladığında, arka planda Pi'ye "uyan ve projeksiyonu aç" komutu gider ve bu ekran belirir [6]. Kullanıcı PIN girmeden önce yayın ayarlarını yapar:
*   **Mod Seçimi (Tam Ekran vs Pencere):**
    *   *Tam Ekran* seçilirse alt seçenekler (Video, Slayt, Özel) belirir.
    *   *Pencere* seçilirse, işletim sistemindeki açık uygulamaların listesi (örn. PowerPoint, Chrome) bir açılır menü (dropdown) ile öğretmene sunulur.
*   **Ses Ayarı:** Açık/Kapalı anahtarı (Switch) bulunur.
*   **PIN Girişi ve Bağlan:** Ayarlar yapıldıktan sonra en altta veya yeni bir ekranda PIN kodu giriş alanı bulunur. Projeksiyonda beliren 4 haneli şifre girilir ve "Bağlan" butonuna basılarak yayın başlatılır.

### Ekran 3: Yayın Ekranı (Minimal Kayan Çubuk)
Yayın başladığında devasa bir arayüz yerine, ekranın bir köşesinde duran ve her zaman üstte kalan (always on top) minimal bir kontrol çubuğu (Floating Bar) kalır.
*   **İçerik:** Yayın süresi, "Sesi Kapat/Aç" butonu ve kırmızı "Yayını Durdur" butonu yer alır.
*   **Gelecek Planı (Widget):** İlerleyen aşamalarda bu çubuğa, Raspberry Pi'den anlık bağlantı kalitesi veya ağ durumunu gösteren küçük bilgi widget'ları eklenecektir.

---

## 2. Gelişmiş Ayarlar (Çark Menüsü)

Ana ekrandaki çark simgesine (⚙) tıklandığında açılan, daha teknik parametrelerin değiştirilebildiği bölümdür. Yapılan değişiklikler `settings.json` dosyasına kaydedilir.
*   **Çözünürlük ve FPS:** Standart 1080p@30fps veya 720p gibi seçenekler.
*   **Bitrate (Bant Genişliği):** Ağın yoğun olduğu durumlarda görüntü yırtılmalarını önlemek için bitrate düşürme ayarı (örn. varsayılan 3000 kbps).
*   **Encoder Seçimi ve Tarama:** Uygulamanın Faz 1'de otomatik bulduğu GPU kodlayıcısı (örn. NVIDIA) görünür. Kullanıcı isterse "Tekrar Tara" diyerek donanım taramasını manuel tetikleyebilir.
*   **Gecikme Tamponu (Delay Buffer):** Ses ve görüntü senkronizasyonu için belirlenen (örn. 74ms) gecikme süresinin manuel ayarlanabildiği alan.

---

## 3. Faz 2 Aksiyon Listesi (To-Do)

- [ ] React ve Tailwind CSS kullanılarak Ana Ekran (kat/sınıf sekmeleri) tasarımının kodlanması.
- [ ] Dil desteği (TR/EN) için `i18n` veya benzeri bir kütüphanenin projeye entegre edilmesi.
- [ ] Bağlantı ekranındaki "Açık Pencereler" dropdown menüsünün, Rust tabanından (Faz 1'de yazılan) gelen verilerle birbirine bağlanması.
- [ ] Yayın ekranı için Tauri'de pencerenin boyutunu küçültecek ve `always_on_top` (her zaman üstte) yapacak fonksiyonların eklenmesi.
- [ ] Gelişmiş ayarlar menüsünün tasarlanması ve `settings.json` okuma/yazma işlemlerinin React tarafına bağlanması.
