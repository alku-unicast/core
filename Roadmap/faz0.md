# Faz 0: Karar, Hazırlık ve Altyapı Kurulumu

Bu aşama, projenin iki temel direğini oluşturmaya odaklanır:

* Eski cihazlarda bile yüksek performans ve düşük RAM tüketimi sunacak **Tauri (React + Tailwind CSS + Rust)** arayüzünün kurulması
* Eduroam gibi ağlardaki izolasyon sorunlarını aşmak için **Firebase tabanlı cihaz keşif altyapısının** tasarlanması

---

# 1. Geliştirme Ortamı (Tauri) Gereksinimleri ve Kurulumu

Tauri, web teknolojilerini (React) kullanarak **çok hafif masaüstü uygulamaları** geliştirmeyi sağlar.

* İşletim sisteminin kendi **WebView** bileşenini kullanır
* Uygulama boyutu genellikle **3–10 MB** civarındadır
* Çok hızlı açılır ve düşük RAM kullanır

---

## Sistem Bağımlılıkları (Bir kez kurulur)

### Rust

```
rustup
```

ile kurulmalıdır.

### Node.js

Sistemde kurulu olmalıdır. **LTS sürümü önerilir.**

### Windows

Visual Studio Installer üzerinden aşağıdaki bileşen kurulmalıdır:

```
Microsoft C++ Build Tools
```

### macOS

Terminalden aşağıdaki komut ile kurulmalıdır:

```
xcode-select --install
```

---

## Proje İskeletinin Oluşturulması

Aşağıdaki komut çalıştırılır ve **React + TypeScript** seçilir.

```
npm create tauri-app@latest
```

Proje oluşturulduktan sonra **Tailwind CSS** projeye eklenir.

---

## Klasör Yapısı

Oluşan proje dizini **frontend** ve **backend** olarak ikiye ayrılır.

```
proje/
├── src/          ← React ve Tailwind kodlarının bulunduğu frontend
├── src-tauri/    ← Rust backend klasörü
│   ├── src/
│   │   └── main.rs   ← GStreamer'ın işletim sisteminde çalıştırılacağı dosya
│   └── tauri.conf.json
└── package.json
```

---

## Rust Tarafındaki Temel Görev (GStreamer Yönetimi)

Rust'ı derinlemesine öğrenmeye gerek kalmadan, **GStreamer komutları bir alt süreç (subprocess)** olarak başlatılacaktır.

`main.rs` içerisinde örnek bir taslak fonksiyon:

```rust
#[tauri::command]
fn start_stream(encoder: String, target_ip: String) -> Result<String, String> {
    std::process::Command::new("gst-launch-1.0")
        .args([...])
        .spawn();
}
```

---

---

# 2. Cihaz Keşfi ve Ağ Mimarisi (Firebase)

Cihazların (Pi ve Windows) **Eduroam ağı üzerinde birbirini otomatik bulabilmesi** için iletişim katmanı **Firebase Realtime Database** üzerine kurulacaktır.

Maksimum **20–30 Raspberry Pi** cihazı olacağı için, **Realtime Database** bu proje için en uygun ve **ücretsiz Spark planı ile yeterli** bir çözümdür.

---

## Veritabanı Yapısı (JSON Taslağı)

Kat yapısındaki farklılıkları (örneğin `003`, `004`, `005` odalarının birleşik olması gibi) esnek şekilde yönetebilmek için sınıflar **manuel olarak girilecektir**.

Cihazların güvenlik şifreleri (PIN), siber güvenlik prensipleri gereği **asla bu veritabanında tutulmayacaktır**.

Pi cihazları **30 saniyede bir presence (varlık) güncellemesi** yapar.

### Zombi Cihaz Kontrolü (`onDisconnect`)

Pi cihazlarının aniden elektrik kesintisine uğraması durumunda veritabanında günlerce `"idle"` olarak kalmalarını önlemek için Firebase'in `onDisconnect()` metodu kullanılır.

Bağlantı koptuğu anda Firebase sunucusu ilgili cihazın `pi_status` değerini otomatik olarak `"offline"` yapar.

Windows uygulaması `rooms` koleksiyonunu dinler.

```json
{
  "rooms": {
    "003-005": {
      "label": "003/005",
      "floor": 0,
      "pi_ip": "192.168.1.45",
      "pi_status": "idle",
      "last_seen": 1710000000
    },
    "101": {
      "label": "101",
      "floor": 1,
      "pi_ip": "192.168.1.46",
      "pi_status": "offline",
      "last_seen": 0
    },
    "401": {
      "label": "401",
      "floor": 4,
      "pi_ip": "192.168.1.50",
      "pi_status": "streaming",
      "last_seen": 1710000050
    }
  }
}
```

**Not:** `pi_status` alanı aşağıdaki değerlerden birini alır:

* `offline`
* `idle`
* `streaming`

---

## Firebase Güvenlik Kuralları

Veritabanının dışarıdan manipüle edilmesini ve ağdaki IP adreslerinin herkes tarafından okunabilmesi ("Public Read" zafiyeti) riskini engellemek için güvenlik kuralları katılaştırılmıştır.

### Okuma (read)

Windows uygulaması arka planda **Anonim Kimlik Doğrulama (Anonymous Auth)** ile giriş yapar.

```json
".read": "auth != null"
```

Bu sayede yalnızca uygulama içinden gelen yetkili oturumların veri okumasına izin verilir.

### Yazma (write)

Yazma işlemleri yalnızca kimliği belirli cihazlara izin verecek şekilde sınırlandırılır:

```json
{
  "rules": {
    "rooms": {
      ".read": "auth != null",
      "$room_id": {
        ".write": "auth != null"
      }
    }
  }
}
```

---

## Kimlik Doğrulama (Auth) Stratejisi

İlerleyen aşamalarda her bir Pi cihazı için ayrı bir Firebase hesabı açılması planlanmaktadır.

**Örnek:**

```
pi-101@unicast.local
```

Bu yaklaşım sayesinde:

* Arızalanan bir cihazın erişimi ayrı ayrı kapatılabilir
* Sistem yönetimi kolaylaşır
* Gerçek bir e-posta hesabına ihtiyaç yoktur

### Gelişmiş Yazma Kuralı

```json
{
  "rules": {
    "rooms": {
      "$room_id": {
        ".write": "auth.token.email === 'pi-' + $room_id + '@unicast.local'"
      }
    }
  }
}
```

---

## Güvenlik PIN Kodu ve Doğrulama Mimarisi (UDP)

Bağlantı esnasında projeksiyona yansıtılan 4 haneli PIN kodunun doğrulanması işlemi, güvenlik nedeniyle Firebase üzerinden değil, doğrudan **yerel ağ (UDP/TCP)** üzerinden yapılacaktır.

### Güvenlik Akışı ve Gerekçeler

#### Şifrenin İzolasyonu

* PIN kodu hiçbir zaman internete (Firebase'e) çıkmaz
* Pi üzerinde yerel olarak üretilir
* Sadece projeksiyona yansıtılır

#### Meydan Okuma – Yanıt (Challenge-Response / HMAC)

* PIN düz metin olarak gönderilmez
* Pi'den gelen rastgele bir `nonce` ile birleştirilir
* Hash edilerek doğrudan Pi'nin yerel IP adresine gönderilir
* Alternatif olarak asimetrik şifreleme kullanılabilir

#### Kaba Kuvvet (Brute-Force) Koruması

* Doğrulama Pi cihazı üzerinde yapılır
* Rate limiting uygulanabilir
* 3 hatalı denemeden sonra IP geçici olarak engellenir

#### Eduroam Avantajı

Yerel ağda istemci izolasyonu olmadığı doğrulandığı için bu yapı:

* Peer-to-peer iletişimi mümkün kılar
* Minimum gecikme sağlar
* Maksimum performans ile çalışır

---


# 3. Faz 0 Aksiyon Listesi (To‑Do)

Bu fazdaki altyapı kurulumunu tamamlamak için yapılması gereken adımlar:

* [ ] Sistem gereksinimlerini kur (Rust, Node.js, Build Tools)
* [ ] `npm create tauri-app` ile React + TypeScript projesi oluştur
* [ ] Projeye Tailwind CSS entegre et
* [ ] Firebase projesi oluştur
* [ ] Realtime Database'i aktif et
* [ ] Veritabanı güvenlik kurallarını yapılandır
