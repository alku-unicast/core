# Faz 4: Raspberry Pi (Alıcı) Ajanı ve Donanım Kontrolü

Bu aşama, projeksiyon cihazına bağlı olan Raspberry Pi üzerinde çalışacak merkezi Python servisinin (`pi_agent.py`) geliştirilmesini kapsar [1]. Bu servis; Firebase'i dinleme, HDMI donanım kontrolü, PIN üretimi ve GStreamer yayınlarını başlatıp durdurma gibi tüm alıcı işlemlerini tek bir merkezden yönetecektir.

## 1. Firebase Dinleyicisi (Listener) ve Varlık Yönetimi

Pi cihazı, yerel ağdaki kısıtlamaları aşmak için sürekli olarak Firebase ile iletişimde kalacaktır.
*   **Varlık (Presence) Güncellemesi:** Pi cihazı, ağa bağlandığında IP adresini alır ve her 30 saniyede bir Firebase'deki `rooms/` koleksiyonuna kendi durumunu (`pi_ip`, `pi_status: idle`, `last_seen`) yazar.
*   **UDP Doğrulama Dinleyicisi:** Pi üzerinde Python ile `0.0.0.0:5001` portu sürekli dinlenir. Göndericiden gelen mesaj lokaldeki `current_pin` ile eşleşirse (örn: "PIN:4821"), karşı tarafa doğrudan `b"OK"` byte verisi döndürülür ve hemen ardından `start_pipeline()` fonksiyonu tetiklenerek görüntü/ses portları dinlenmeye başlanır. Eşleşmezse `b"FAIL"` döner. (Port Mimarisi: 5000 Video, 5001 Auth, 5002 Ses).

## 2. HDMI Yönetimi ve CEC Kontrolü

Projeksiyon cihazlarının "otomatik kaynak bulma" özelliğinin bozulmaması ve enerji tasarrufu için HDMI çıkışı dinamik olarak yönetilecektir.
*   **HDMI Güç Kontrolü:** Yayın yokken Pi'nin HDMI çıkışı tamamen kapalı tutulur. Yayın komutu geldiğinde Python üzerinden `vcgencmd display_power 1` komutu ile HDMI açılır, yayın bitince `vcgencmd display_power 0` ile kapatılır.
*   **HDMI-CEC ile Kaynak Değiştirme (Opsiyonel):** Pi, `cec-client` aracını kullanarak projeksiyona doğrudan "Aktif kaynağa (HDMI 2 gibi) geç" komutu gönderebilir. (Not: Bu özelliğin projeksiyon donanımı tarafından desteklenip desteklenmediği saha testinde doğrulanacaktır).

## 3. Bekleme (Idle) Ekranı ve Güvenlik (PIN)

Pi üzerinde X11 masaüstü ortamını (GUI) hiç açmamak ve maksimum performans elde etmek için `Pillow (PIL)` kütüphanesi ile görüntü üretilip, `fbi (Frame Buffer Image viewer)` ile doğrudan framebuffer'a basılacaktır.
*   **Zamanlayıcılı (Saatlik) PIN Değişimi:** PIN kodunun güvenliği için kod, Pi arka planında çalışan bir timer (zamanlayıcı) vasıtasıyla her 1 saatte bir (eğer o an `streaming` işlemi yoksa) rastgele yenilenir. PIN sadece cihaz lokalinde tutulur, dışarı aktarılmaz.
*  ** PNG Üretimi ve Yansıtma:** PIN her değiştiğinde veya bağlantı koptuğunda Python `Pillow` kütüphanesi kullanılarak; ortasında Sınıf Adı, yeni PIN ve Pi IP'si yazan siyah bir `/tmp/idle.png` oluşturulur. Ardından `subprocess.Popen` üzerinden `fbi -T 1 -noverbose -a /tmp/idle.png` komutuyla doğrudan projeksiyona yansıtılır.

## 4. GStreamer Alıcı (Receiver) Pipeline'ı

Öğretmen PIN'i doğru girdiğinde, yayın aktarımı başlar. Python scripti `subprocess` kütüphanesini kullanarak arka planda GStreamer süreçlerini başlatır.
*   **Paralel GStreamer Süreçleri:** Görüntü 5000 portundan, ses ise 5002 portundan alınır. Her iki akış da ayrı bir işlem (process) olarak başlatılır.
*   **Senkronizasyon:** Ses ve görüntü senkronizasyonunu sağlamak için hem video hem de ses pipeline'ında `queue max-size-time=74000000` (74ms) gecikme tamponu kullanılır.
*   **Sonlandırma:** Yayın kesildiğinde veya durdur komutu geldiğinde, `terminate()` fonksiyonu ile GStreamer süreçleri öldürülür ve sistem tekrar idle durumuna döner.

## 5. Otomatik Başlatma (systemd) ve Hata Toleransı

Servisin Pi fişe takıldığı an (headless) çalışabilmesi ve çökme durumlarında kurtarılabilmesi için `systemd` servisi (örneğin `sinifyayini.service`) olarak yapılandırılır.
*   **Yeniden Başlatma (Restart):** `Restart=always` ve `RestartSec=5` parametreleri ile servis çökerse 5 saniye içinde otomatik olarak yeniden başlatılır.
*   **Ağ Gecikmesi (Retry Loop):** Eduroam gibi kurumsal ağlarda IP alma süreci (DHCP) uzayabildiğinden, Pi açılır açılmaz script hata vermesin diye başlangıca 10-15 saniyelik bir tekrar deneme (retry loop) mekanizması eklenir.

---

## 6. Faz 4 Aksiyon Listesi (To-Do)

- [ ] Raspberry Pi üzerinde donanım kontrolleri için `fbi`, `vcgencmd` ve `cec-client` paketlerinin kurulması.
- [ ] `Pillow (PIL)` kütüphanesi kullanılarak her saat başı (time.sleep(3600)) yeni PIN üretecek, PNG oluşturacak ve `fbi` komutunu tetikleyecek arka plan thread'inin `(pin_rotator)` yazılması.
- [ ] Python `socket` kütüphanesi ile 5001 portundan "Handshake" yapacak ve `OK/FAIL` durumuna göre yayını başlatacak yetkilendirme (auth) dinleyicisinin kodlanması.
- [ ] Görüntü ve Ses GStreamer komutlarını (`udpsrc`, `avdec_h264`, `opusdec`) `subprocess.Popen` ile yönetecek akışın oluşturulması.
- [ ] Tüm bu scripti sistem başlangıcında çalıştıracak `systemd` servis dosyasının (`.service`) oluşturulması ve ağ hazır olana kadar bekleyecek "retry" mekanizmasının koda eklenmesi.
