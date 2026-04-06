---

# UniCast - Raspberry Pi DevOps ve Sistem Dağıtım (Deployment) Rehberi

Bu belge, UniCast projesinde kullanılacak Raspberry Pi cihazlarının **"Master İmaj" (Ana Kopya)** üzerinden çoğaltılması, sahadaki **"Klon Ordusu Sendromu"** problemlerinin çözülmesi ve cihazların sınıflara **klavye/monitör olmadan (Headless)**, **sıfır dokunuşla (Zero-Touch)** kurulması için gereken DevOps süreçlerini tanımlar.

**Not:** Firebase veritabanı bağlantısı, GStreamer alıcı scriptleri ve Idle ekranı detayları ilerleyen süreçte bu belgenin ilgili bölümlerine eklenecektir.

---

## 1. Sahadaki Klonlama Sorunları (Klon Ordusu Sendromu)

Aynı SD kart imajının birden fazla Raspberry Pi'ye kopyalanması durumunda aşağıdaki kritik problemler ortaya çıkar:

### Kimlik Çatışması

* Tüm cihazlar veritabanına aynı kimlikle (örn: `Sınıf 101`) bağlanmaya çalışır
* Sistem kararsız hale gelir veya tamamen çöker

### Wi-Fi / Eduroam Krizi

* Bireysel kullanıcı hesaplarıyla yapılan bağlantılar sürdürülebilir değildir
* Şifre değişimi veya mezuniyet sonrası tüm cihazlar bağlantıyı kaybeder
* Aynı hesapla çok sayıda MAC adresinden bağlantı denemesi yapılması, güvenlik sistemleri tarafından saldırı olarak algılanabilir

### Güvenlik İzi

* Log kayıtları, Wi-Fi geçmişi ve SSH anahtarları kopyalanır
* Bu durum ciddi güvenlik açıklarına yol açar

---

## 2. Çözüm Mimarisi ve Kurulum Stratejileri

### 2.1. Ağ ve Wi-Fi Stratejisi (IoT Servis Hesabı)

Eduroam bağlantı sorunlarını çözmek için üniversitenin IT departmanından:

* Süresiz şifreye sahip
* Eşzamanlı bağlantı limiti olmayan

bir **IoT servis hesabı** talep edilir.

**Örnek:**

```
unicast-proje@alanya.edu.tr
```

Tüm Raspberry Pi cihazları ağa yalnızca bu hesap üzerinden bağlanır.

---

### 2.2. Sıfır Dokunuş Kimlik Ataması (Boot Partition Yöntemi)

Cihazlara tek tek klavye bağlayarak manuel kurulum yapma ihtiyacını ortadan kaldırmak için **boot partition tabanlı konfigürasyon yöntemi** kullanılır.

#### Çalışma Mantığı

* Ana imaj içine bir script yerleştirilir
* Sistem açıldığında `/boot/firmware/unicast_config.txt` dosyası okunur
* Bu dosyadan cihaz kimliği belirlenir

#### Kurulum Adımları

1. SD kart Windows bilgisayara takılır
2. Boot bölümünde `unicast_config.txt` dosyası oluşturulur
3. İçine sadece sınıf numarası yazılır:

```
105
```

4. Kart Raspberry Pi'ye takılır ve cihaz açılır
5. Sistem otomatik olarak kendini aşağıdaki kimlikle kaydeder:

```
pi-105@unicast.local
```

---

## 3. "Master İmaj" (Ana Kopya) Hazırlama Süreci

Bu süreç laboratuvar ortamında tek bir Raspberry Pi üzerinde gerçekleştirilir.

### Adım 1: İzole Kurulum (Ethernet ile)

* Wi-Fi izi bırakmamak için yalnızca Ethernet kullanılır
* GStreamer, Python ve tüm bağımlılıklar kurulur

---

### Adım 2: Sterilizasyon (Temizlik)

Sistem hazır hale geldikten sonra aşağıdaki komutlar çalıştırılarak cihaz **factory fresh** durumuna getirilir:

```bash
# 1. Apt cache temizliği
sudo apt-get clean
sudo apt-get autoremove -y

# 2. Log temizliği
sudo journalctl --vacuum-time=1s
sudo rm -rf /var/log/*

# 3. SSH host key temizliği
sudo rm -f /etc/ssh/ssh_host_*

# 4. Bash geçmişi temizliği
cat /dev/null > ~/.bash_history
history -c
```

---

### Adım 3: SSH Kapatma ve Sistem Kapatma

Sistem dış erişime kapatılır ve güvenli şekilde kapatılır:

```bash
sudo systemctl disable ssh
sudo shutdown -h now
```

---

## 4. İmaj Alma, Küçültme ve Çoğaltma (DevOps Pipeline)

Sterilize edilmiş sistemden SD kart çıkarıldıktan sonra dağıtım süreci başlar.

---

### Aşama 1: Backup (Windows)

* SD kart Windows bilgisayara takılır
* **USB Image Tool** kullanılarak imaj alınır
* Büyük boyutlu bir `.img` dosyası oluşturulur (örn: 32 GB)

---

### Aşama 2: PiShrink ile İmaj Küçültme (Linux / WSL)

İmaj dosyasını optimize etmek için PiShrink kullanılır:

```bash
sudo pishrink.sh unicast_master.img
```

Sonuç:

* Dosya boyutu yalnızca kullanılan alan kadar olur (örn: 2–3 GB)
* İmaj, yeni kartta otomatik genişleme (auto-expand) yapacak şekilde hazırlanır

---

### Aşama 3: Seri Üretim (Flashing)

* Küçültülmüş imaj **BalenaEtcher** ile SD kartlara yazdırılır
* Her kart Windows'ta açılarak `unicast_config.txt` dosyası düzenlenir
* Cihazlar sahada doğrudan çalıştırılabilir

---

## Sonuç

Bu DevOps yaklaşımı sayesinde:

* Manuel kurulum ihtiyacı ortadan kalkar
* Güvenlik riskleri minimize edilir
* Tüm cihazlar standart ve ölçeklenebilir şekilde yönetilir
* Saha kurulumu hızlı ve hatasız şekilde tamamlanır

---
