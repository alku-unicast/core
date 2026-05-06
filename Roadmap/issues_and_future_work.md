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


## 6. İmzalama Mevzuları

### 1. Zaman veya Sayı Değil, "Sürüm" Önemlidir
SmartScreen'de itibar kazanmak için net bir zaman yoktur; **indirme ve sorunsuz çalışma sayısına** bakar (genellikle binlerce indirme gerekir). Okul projesi ölçeğinde (örneğin 100-200 kişi) bu eşiğe organik olarak ulaşmak neredeyse imkansızdır.

Daha da kötüsü: İtibar (reputation) dosyanın **Hash değerine (matematiksel izine)** verilir. Yani sen uygulamada ufak bir bug bulup sürümü `v1.0.1` yaptığında ve yeni bir `.exe` derlediğinde dosyanın hash'i değişir. **Bütün itibar sıfırlanır ve uyarı ekranı geri döner.** (Sadece ücretli sertifikalarda itibar sertifikaya tanımlanır, dosyaya değil).

### 2. Self-Signed (Öz-İmzalı) Sertifika Dağıtmak Riskli Olabilir
Kişisel bilgisayarlara öz-imzalı (self-signed) bir uygulama gönderdiğinde, Windows Defender bunu imzasız bir uygulamadan **daha şüpheli** bulabilir. Çünkü zararlı yazılım üretenler genellikle sahte/öz-imzalı sertifikalarla güvenlik duvarlarını kandırmaya çalışırlar.


### Peki Öğrenci/Açık Kaynak Projelerinde Gerçek Çözüm Nedir?

Github'daki binlerce bağımsız geliştiricinin (indie) ve öğrencinin yaptığı **en standart ve kabul gören yol şudur:**

#### A. Kurulum Kılavuzu (Kabul Edilmiş Standart)
Uygulamayı **hiç imzalamadan** (olduğu gibi) GitHub'a yüklersiniz. GitHub'daki Readme dosyasına veya indirme sayfasına büyük bir **"Kurulum Uyarısı"** eklersiniz. 

Kullanıcılara şunu netçe gösterirsiniz (mümkünse 3 saniyelik bir GIF ile):
1. *"Windows Kişisel Bilgisayarınızı Korudu"* uyarısı çıktığında **Ek Bilgi (More Info)** yazısına tıklayın.
2. Çıkan **Yine de Çalıştır (Run Anyway)** butonuna basın.
*Açıklama olarak da: "Uygulamamız açık kaynaklı bir üniversite projesi olduğu için ücretli ticari sertifikaya sahip değildir. Kaynak kodlarının tamamı GitHub'da açıktır ve güvenlidir."* yazmanız fazlasıyla yeterli ve profesyoneldir. Hocalar da, mühendislik öğrencileri de bu duruma çok aşıktır.

#### B. Microsoft'a "False Positive" (Yanlış Alarm) Bildirimi (Opsiyonel)
Projenin tamamen bittiği, artık kod değiştirmeyeceğiniz o **"Final Sürümünü" (v1.0.0)** derlediğinizde:
1. Microsoft'un [Security Intelligence Gönderim Portalı](https://www.microsoft.com/en-us/wdsi/filesubmission)'na gidin.
2. Geliştirici olarak `.msi` veya `.exe` dosyanızı "Yazılım Geliştiricisiyim, dosyam virüs değil ama SmartScreen engelliyor" seçeneğiyle yükleyin.
3. Microsoft'un otomatik analiz araçları dosyanızda zararlı bir kod olmadığını (sadece GStreamer vb. araçlar çağırdığını) görüp **o spesifik dosyayı** güvenli listesine (whitelist) alabilir. Bu işlem genelde 1-2 gün sürer. Eğer onaylanırsa, o dosya için uyarı kalıcı olarak kalkar.

**Özetle:** İmza işleriyle ve itibar kasmakla vakit kaybetmeyin. Uygulamayı imzasız bırakın, GitHub sayfanıza şık bir "Nasıl Kurulur" açıklaması ekleyin. Hedef kitleniz üniversite olduğu için herkes o uyarıyı nasıl geçeceğini anlayacaktır.

Harika bir soru! Haklısın, Bilgi İşlem (BİDB) kesinlikle kendi kurumsal sertifikasını (ve şifresini) uygulamanın içine gömmeniz için size **vermez**. Zaten süreç böyle işlemiyor.

Sertifikalama işlemi **kod yazarken veya build alırken değil, build (derleme) bittikten SONRA** yapılır. 

1. Seçenek (Üniversite IT'sinin imzalaması) tam olarak şu şekilde işler:

### 1. Siz Build Alırsınız (İmzasız)
Uygulamanızın geliştirmesini bitirirsiniz. Kendi bilgisayarınızda `npm run tauri build` komutunu çalıştırırsınız. Çıktı olarak oluşan `UniCast_1.0.0_x64.msi` veya `.exe` dosyasını (tamamen imzasız haliyle) bir flash belleğe atar veya buluta yüklersiniz.

### 2. IT Departmanına Gidersiniz
Dosyayı Bilgi İşlem yetkilisine teslim edersiniz ve *"Okul bilgisayarlarında sorunsuz çalışması için bunu okulun sertifikasıyla imzalamanızı rica ediyoruz"* dersiniz.

### 3. IT Departmanı Kendi Güvenli Ortamında İmzalar
Yetkili kişi, kendi güvenli bilgisayarında Windows'un sunduğu `signtool.exe` (İmza Aracı) programını açar. Sizin `.msi` veya `.exe` dosyanızı seçer ve **sadece onlarda bulunan** şifreli sertifikayı kullanarak dosyayı mühürler (imzalar).

Yaptıkları işlem terminalde şuna benzer:
`signtool sign /tr http://timestamp.digicert.com /td sha256 /fd sha256 /a "Sizin_Uygulama.exe"`

### 4. İmzalı Dosyayı Size Geri Verirler
Mühürleme işlemi saniyeler sürer. IT personeli, imzalanmış o dosyayı size geri verir. Siz de o dosyayı alıp GitHub Release sayfasına veya öğrencilerin/hocaların indireceği yere koyarsınız. 

İnsanlar o dosyayı indirdiğinde Windows, dosyanın üzerindeki "Alanya Üniversitesi Bilgi İşlem" (veya okulunuzun adı neyse) mührünü görür ve **"Bu kurum güvenilirdir"** diyerek hiçbir uyarı çıkarmadan programı açar.

### Tek Dezavantajı:
Uygulamada ufak bir bug buldunuz ve `v1.0.1` versiyonunu derlediniz diyelim. Bu yeni dosya yine imzasız olacaktır. Yeni güncellemeyi yayınlamadan önce o dosyayı alıp **tekrar** Bilgi İşlem'e götürmeniz ve imzalattırmanız gerekir. 

İşte tam da bu yüzden sertifikalama işlemi, projenin **tamamen bittiği, hocaya sunulacak final sürümünde (v1.0.0)** yapılır. Geliştirme aşamasındaki testler için sertifika ile uğraşılmaz.