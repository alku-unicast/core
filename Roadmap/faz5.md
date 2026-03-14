# Faz 5: Entegrasyon, Saha Testleri ve Hata Yönetimi

Bu son aşama, geliştirilen sistemin laboratuvar ortamından çıkarılıp gerçek okul ağına (Eduroam) ve donanımlarına entegre edilmesini kapsar. Odak noktası; olası "sinsi" hataların (hata vermeden siyah ekran döndüren sorunlar) yakalanması, ağ kısıtlamalarının aşılması ve son kullanıcı (öğretmen) deneyiminin doğrulanmasıdır.

## 1. Eduroam ve Ağ İzolasyonu Testleri (En Kritik Aşama)

Diğer tüm sistemler masaüstünde test edilebilirken, Eduroam testleri doğrudan sahada yapılmalıdır.
*   **Firebase Bağlantısı:** Eduroam genellikle HTTPS (443) portuna izin verdiği için cihaz keşfi sorunsuz çalışacaktır.
*   **UDP İstemci İzolasyonu Testi:** Kurumsal ağlarda iki cihazın yerel ağ üzerinden birbirine doğrudan UDP paketi göndermesi engellenmiş olabilir. Bunu test etmek için Eduroam'a bağlı gönderici bilgisayardan Pi'nin IP adresine ping atılır (`ping <PI_IP>`). 
    *   *Cevap geliyorsa:* İzolasyon yoktur, UDP yayını sorunsuz çalışır.
    *   *Cevap gelmiyorsa:* Bilgi İşlem (IT) departmanından Pi'lerin MAC adresleri için izolasyon istisnası/VLAN istenmeli veya Pi üzerinde bir TURN/Relay sunucusu yapılandırılmalıdır.

## 2. Çoklu Platform Kontrol Listesi

Farklı işletim sistemlerinde uygulamanın kararlılığı şu adımlarla doğrulanmalıdır:
*   **Windows:** Taşınabilir (portable) ZIP dosyasının sorunsuz açıldığı, GStreamer PATH ayarının dinamik yapıldığı ve donanımsal kodlayıcı (GPU Encoder) taramasının doğru çalıştığı doğrulanmalıdır.
*   **macOS:** Apple Silicon ve Intel işlemcilerde derlemenin çalıştığı kontrol edilmelidir. Güvenlik (Gatekeeper) için "Yine de aç" uyarılarının yönergelerde yer aldığı ve özellikle ekran kaydı için gereken `avfvideosrc` izin pop-up'ının test edildiği onaylanmalıdır. İzin verilmezse GStreamer hata fırlatmaz, sadece sessizce siyah ekran üretir.
*   **Linux (AppImage):** Ubuntu LTS ve Arch tabanlı dağıtımlarda `chmod +x` sonrası çalışıp çalışmadığı denenmelidir. Yeni nesil dağıtımlarda ses için `pulsesrc` yerine `pipewiresrc` gerekebileceği unutulmamalıdır.

## 3. "Sinsi" Hatalar (Silent Errors) ve Koruma Stratejileri

Uygulama çökmeden arka planda sorun yaratan durumları engellemek için şu önlemler alınmalıdır:
*   **Arka Planda Kalan GStreamer (Zombi Süreçler):** Tauri uygulaması kapatıldığında GStreamer süreçleri açık kalabilir ve portları meşgul edebilir. Tauri'nin `on_window_event` kancası (hook) kullanılarak kapanışta süreçler zorla temizlenmelidir.
*   **DRM ve Siyah Ekran Sorunları:** Windows'ta `d3d11screencapturesrc` bazı oyunlar veya DRM korumalı uygulamalar tarafından engellenebilir (hata vermez, siyah kare gönderir). Sisteme belirli bir süre "frame" (kare) gelmediğinde arayüzde uyarı verecek bir sayaç konulmalıdır.
*   **Pi Ağ Gecikmesi (DHCP):** Pi fişe takıldığında Eduroam'dan IP alma süresi uzayabilir. Pi üzerindeki Python servisinin hemen çökmemesi için başlangıca 10-15 saniyelik bir tekrar deneme (retry loop) eklenmelidir.
*   **Port Çakışması:** İki öğretmen aynı Pi'ye bağlanmaya çalışırsa ses ve video portları (5000, 5002) çakışır. Firebase'deki `pi_status` "streaming" ise diğer kullanıcıların "Bağlan" butonu devre dışı bırakılmalıdır.
*   **Arayüz Donması:** Uygulama açılışında yapılan donanım kodlayıcı testi (encoder probe) asenkron (async) yapılmazsa, arayüz 10-15 saniye donuk kalabilir. Bu işlem arka planda çalıştırılmalıdır.

## 4. Gecikme (Latency) ve Kalite Optimizasyonu

Ağdaki veri trafiğine ve bilgisayar donanımına bağlı olarak gecikme metrikleri test edilmeli ve optimize edilmelidir.
*   **Donanımsal Kodlama:** NVIDIA GPU ile 1080p @ 30fps'de ölçülen ~74ms gecikmenin korunduğu doğrulanmalıdır.
*   **Yazılımsal Fallback (x264):** Eski cihazlarda zorunlu olarak yazılımsal kodlamaya geçildiğinde, 1080p yayın 150ms gecikmeyi aşıyorsa sistemin otomatik olarak 720p çözünürlüğe düşmesi sağlanmalıdır. (Not: Pi 3 gibi eski nesil alıcılarda zaten 720p @ 15-20fps sınırları görülmüştür).
*   **Bitrate ve Jitter:** Okul ağındaki yoğunluğa bağlı UDP paket kayıplarında görüntüde yırtılmalar oluşabilir. Bunu önlemek için arayüzdeki "Ayarlar" menüsünden bitrate değerini (örn. varsayılan 3000 kbps) düşürme esnekliği sunulmalı ve Pi alıcısındaki Jitter buffer süresi optimize edilmelidir.

## 5. Genel Test Sırası ve Kullanıcı (Öğretmen) Testi

Adımların birbiri üzerine inşa edilebilmesi için şu test sırası izlenmelidir:
1.  **Lokal Ağ Testi:** Masaüstünde Pi ile bilgisayar doğrudan aynı ağdayken bağlantı doğrulanır.
2.  **Firebase Testi:** Cihazların Firebase üzerinden birbirini keşfettiği onaylanır.
3.  **Eduroam İzolasyon Testi:** Sahada UDP paket aktarımı (Ping/SSH) kontrol edilir.
4.  **Gecikme Ölçümleri:** Farklı kodlayıcılarla senkronizasyon ve gecikme testi yapılır.
5.  **Kullanıcı Testi:** Gerçek bir öğretmenin sınıfı bulma, PIN girme, dil seçimi yapma (TR/EN) ve yayını durdurma akışını rahatça yapabildiği gözlemlenir.

---

## 6. Faz 5 Aksiyon Listesi (To-Do)

- [ ] Eduroam ağı üzerinde gönderici cihazdan alıcıya (Pi) UDP paketi ve Ping testlerinin yapılması.
- [ ] Tauri `on_window_event` içerisine kapanışta GStreamer süreçlerini (process) temizleyecek kodun eklenmesi.
- [ ] Görüntü gitmediğinde (siyah frame) veya macOS'ta izin verilmediğinde kullanıcıyı uyaracak "watchdog" sayacının yazılması.
- [ ] Pi arka plan servisine ağ gecikmeleri için 10-15 saniyelik "retry loop" (tekrar deneme) mekanizmasının eklenmesi.
- [ ] Farklı donanımlar (Intel QSV, x264) kullanılarak gecikme matrisinin (150ms altı hedefiyle) çıkarılması.


