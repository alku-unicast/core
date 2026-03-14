# Faz 4: Raspberry Pi (Alıcı) Ajanı ve Donanım Kontrolü

Bu aşama, projeksiyon cihazına bağlı olan Raspberry Pi üzerinde çalışacak merkezi Python servisinin (`pi_agent.py`) geliştirilmesini kapsar [1]. Bu servis; Firebase'i dinleme, HDMI donanım kontrolü, PIN üretimi ve GStreamer yayınlarını başlatıp durdurma gibi tüm alıcı işlemlerini tek bir merkezden yönetecektir.

## 1. Firebase Dinleyicisi (Listener) ve Varlık Yönetimi

Pi cihazı, yerel ağdaki kısıtlamaları aşmak için sürekli olarak Firebase ile iletişimde kalacaktır.
*   **Varlık (Presence) Güncellemesi:** Pi cihazı, ağa bağlandığında IP adresini alır ve her 30 saniyede bir Firebase'deki `rooms/` koleksiyonuna kendi durumunu (`pi_ip`, `pi_status: idle`, `last_seen`) yazar.
*   **Komut Dinleme:** Servis, Firebase'deki `command` alanını gerçek zamanlı (real-time) dinler [3]. Gönderici uygulamadan "Başlat" veya "Durdur" komutu geldiğinde ilgili donanım ve yazılım fonksiyonlarını tetikler.

## 2. HDMI Yönetimi ve CEC Kontrolü

Projeksiyon cihazlarının "otomatik kaynak bulma" özelliğinin bozulmaması ve enerji tasarrufu için HDMI çıkışı dinamik olarak yönetilecektir.
*   **HDMI Güç Kontrolü:** Yayın yokken Pi'nin HDMI çıkışı tamamen kapalı tutulur. Yayın komutu geldiğinde Python üzerinden `vcgencmd display_power 1` komutu ile HDMI açılır, yayın bitince `vcgencmd display_power 0` ile kapatılır.
*   **HDMI-CEC ile Kaynak Değiştirme (Opsiyonel):** Pi, `cec-client` aracını kullanarak projeksiyona doğrudan "Aktif kaynağa (HDMI 2 gibi) geç" komutu gönderebilir. (Not: Bu özelliğin projeksiyon donanımı tarafından desteklenip desteklenmediği saha testinde doğrulanacaktır).

## 3. Bekleme (Idle) Ekranı ve Güvenlik (PIN)

Öğretmen bağlantı isteği gönderdiğinde, Pi HDMI'yi açar ve ekrana bir bekleme (idle) arayüzü yansıtır.
*   **PIN Üretimi:** Python servisi, her bağlantı isteğinde rastgele 4 haneli bir PIN (örn. 4821) üretir ve bu PIN'i Firebase'e yazar.
*   **Arayüz (Pygame):** Bekleme ekranı, kaynak tüketimi çok düşük olan `pygame` (veya `tkinter`) kütüphanesi kullanılarak tam ekran siyah bir pencere üzerinde sadece PIN kodunu ve IP adresini gösterecek şekilde tasarlanır. PIN kodu sınıftaki projeksiyona yansır, böylece sadece sınıfta olan öğretmen bu şifreyi görebilir.

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

- [ ] Raspberry Pi üzerinde donanım kontrolleri için `vcgencmd` ve `cec-client` paketlerinin kurulması.
- [ ] Firebase SDK'sının kurularak varlık güncelleme (`update_presence`) ve komut dinleme işlemlerinin Python ile yazılması.
- [ ] Rastgele 4 haneli PIN üretecek ve tam ekran gösterecek `pygame` tabanlı arayüzün kodlanması.
- [ ] Görüntü ve Ses GStreamer komutlarını (`udpsrc`, `avdec_h264`, `opusdec`) `subprocess.Popen` ile yönetecek akışın oluşturulması.
- [ ] Tüm bu scripti sistem başlangıcında çalıştıracak `systemd` servis dosyasının (`.service`) oluşturulması ve ağ hazır olana kadar bekleyecek "retry" mekanizmasının koda eklenmesi.
