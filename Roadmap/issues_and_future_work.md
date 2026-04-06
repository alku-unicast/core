# Olası Sorunlar, Çözümler ve Gelecek Planlar

## 1. İkinci Ekran (Extend) Modu

**Sorun:**  
Windows ve macOS gibi sistemlerde görüntüyü “Uzat” modunda kullanmak için ikinci bir monitör tanıtmak gerekiyor.  
Bu genelde admin izni ve sertifika isteyen sanal sürücüler kurmayı gerektiriyor.  
Üstelik bu sürücüler çöktüğünde sistemde “hayalet ekran” kalma riski var.  

**Çözüm:**  
Sanal ekran kurmaya çalışmak yerine, sadece öğretmenin seçtiği uygulamanın (örneğin PowerPoint) penceresi yakalanıyor.  
Böylece öğretmen ana ekranda başka şeyler yaparken, sadece sunum Pi’ye aktarılıyor.  
Ne sürücü kurulumu ne de admin izni gerekiyor.  

---

## 2. Projeksiyon ve Ağ Sorunları

**Sorun:**  
- Pi sürekli “Bekleme Ekranı” gösterdiğinde projeksiyon cihazlarının otomatik kaynak değiştirme özelliği bozuluyor.  
- Ekran tamamen kapatıldığında ise IP ve PIN görünmediği için kullanıcı bağlanamıyor.  
- Eduroam gibi kurumsal ağlarda “istemci izolasyonu” yüzünden cihazlar birbirini bulamıyor.  

### Çözüm A: Bulut Üzerinden İletişim
- Yerel ağda cihazlar birbirini göremediği için iletişim katmanı Firebase gibi bir bulut veritabanına taşınıyor.  
- Hem Pi hem Windows uygulaması HTTPS üzerinden buluta bağlanıyor, cihaz keşfi saniyeler içinde çözülüyor.  

**HDMI Yönetimi:**  
- Pi’nin HDMI çıkışı yayın yokken tamamen kapalı tutuluyor.  
- Öğretmen “Bağlan” dediğinde Pi açılıyor, projeksiyona PIN kodu yansıtıyor.  
- Böylece sadece sınıfta olan kişi şifreyi görebiliyor.  

**HDMI-CEC ile Donanımsal Kontrol:**  
- Pi, projeksiyona doğrudan “HDMI 2’ye geç” komutu gönderebiliyor.
- Kumanda taşıma ihtiyacı ortadan kalkıyor.
- Fakat bu bir varsayım, gerçekte projeksiyon bunu destekleyecek mi denememiz gerekiyor.

---

## 3. Akıllı Ses Aygıtı Keşfi ve Yönetimi

**Sorun:**  
Farklı bilgisayarlarda çok sayıda ses giriş/çıkış aygıtı (mikrofonlar, sanal ses kartları, HDMI monitörler) bulunmaktadır. GStreamer'ın varsayılan "loopback" (sistem sesini yakalama) ayarı her zaman doğru aygıtı bulamayabilir veya karmaşık `device.id` bilgileri gerektirebilir.

**Çözüm (Faz 2 - Arayüz Entegrasyonu):**  
Uygulama, öğretmenlerin bu teknik detaylarla uğraşmaması için sistem bağımsız bir "Akıllı Aygıt Keşfi" motoruna sahip olacaktır.

**Sorun:**  
Hem gönderici hem de alıcı cihazda ses yayını yapıldığı için arada da gecikme olduğu için hoş olmayan bir karışıklık ortaya çıkıyor.

**Çözüm (Faz 2 - Arayüz Entegrasyonu):**  
- Programatik Mutelama (Mute Native): Uygulama yayına başladığında, Windows API'lerini kullanarak laptopun hoparlör çıkışını (Master Volume) %0'a çekecek veya "mute" komutu gönderecek. Ancak GStreamer "loopback" (döngüsel yakalama) işlemini Windows'un ses mikserinden (Mixer) yaptığı için, sistem sesi %0 olsa bile dijital veriyi yakalamaya devam edebiliriz.
- Sanal Ses Kartı (Virtual Audio Driver): Daha profesyonel uygulamalarda (Örn: OBS) sisteme "UniCast Virtual Audio" adında hayali bir hoparlör kurulur. Windows sesi oraya gönderir; hoca laptoptan hiçbir şey duymaz ama biz o sanal cihazdan sesi tertemiz yakalayıp Pi'ye göndeririz.
- Bu seçeneklerden birisini seçebiiliriz veya daha iyi bir seçenek bulabiliriz.

### İşletim Sistemi Stratejileri:
*   **Windows:** 
    *   `wasapi2src` sürücüsü üzerinden `device.api=wasapi2` ve `loopback=true` olan aygıtlar taranacaktır.
    *   `device.default=true` olan aygıt otomatik olarak seçilecek, ancak arayüzde bir "Ses Kaynağı" menüsü sunulacaktır.
*   **macOS:**
    *   `osxaudiosrc` kullanılacaktır. 
    *   Ses yakalama için sistemde Loopback (BlackHole vb.) veya macOS'in yeni `avfvideosrc` tabanlı yerel ses yakalama kancaları (hook) kontrol edilecektir.
*   **Linux:**
    *   `pulsesrc` veya `pipewiresrc` üzerinden "monitor of output" (çıkışın monitörü) aygıtı otomatik tespit edilecektir.

### Kullanıcı Deneyimi (UX):
*   **Otomatik Mod:** Uygulama açıldığında o an sesin çıktığı hoparlörün "loopback" kanalına otomatik bağlanır.
*   **Manuel Seçim:** Hocalar, "Ayarlar" menüsünden basit isimlerle (Örn: "Realtek High Definition Audio") ses kaynağını değiştirebilecektir. Arka planda bu seçimler GStreamer'ın anladığı `device.id` (GUID) yapılarına dönüştürülecektir. 

---

## 4. macOS Ses Yakalama Sorunu (Future Work)

**Sorun:**
macOS, uygulamaların sistem sesini yakalamasına izin vermez. Windows'taki `wasapi2src loopback=true` gibi yerleşik bir mekanizma yoktur. Bu nedenle **macOS'ta ses yayını MVP'de devre dışı bırakılacaktır.**

**Gelecek Çözüm Seçenekleri:**

| Çözüm | Nasıl | Avantajlar | Dezavantajlar |
|-------|-------|------------|---------------|
| **A) BlackHole** (sanal ses sürücüsü) | BlackHole 2ch kurulur, ses buraya yönlendirilir | Temiz yakalama, gecikme yok | Kurulum gerektirir (portable prensibine aykırı), admin izni |
| **B) ScreenCaptureKit** (macOS 13+) | macOS 13 Ventura'daki `SCStreamConfiguration` ile ses yakalama | Native, sürücü gereksiz | Yalnızca macOS 13+, GStreamer entegrasyonu yok — özel plugin veya subprocess gerekir |

**Karar:** MVP'de macOS'ta ses kapalı. İhtiyaç doğarsa önce Seçenek A (BlackHole), uzun vadede Seçenek B.

---

## 5. Pi Agent Evolution (Faz 4 — Notlar)

Mevcut `agent.py` bir benchmarking prototipdir. Üretime geçiş için şu eklentiler gerekecek (detaylar `faz4.md`'de):

- **Firebase Presence:** Her 30 saniyede varlık güncellemesi (`pi_ip`, `pi_status`, `last_seen`)
- **PIN Üretimi ve Görüntüleme:** Saatlik PIN rotasyonu (`time.monotonic()` ile), framebuffer'a Pillow+fbi ile yansıtma
- **Heartbeat Listener:** Sender'dan 3 saniyede bir gelen ALIVE paketlerini dinleme, 10 saniye gelmezse disconnect
- **HDMI-CEC:** `cec-client` ile projeksiyon kontrolü (opsiyonel, donanıma bağlı)
- **BUSY Yanıtı:** Yayın devam ederken yeni bağlantı isteklerini reddetme (`b"BUSY"`)
- **Session Token:** Çökme sonrası PIN'siz reconnect desteği (5 dakika penceresi)

