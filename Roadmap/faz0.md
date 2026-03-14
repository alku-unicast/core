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

# 2. Cihaz Keşfi ve Ağ Mimarisi (Firebase)

Cihazların (Pi ve Windows) **Eduroam ağı üzerinde birbirini otomatik bulabilmesi** için iletişim katmanı **Firebase Realtime Database** üzerine kurulacaktır.

* Maksimum **20–30 Raspberry Pi** cihazı olacağı için
* **Realtime Database**, bu proje için en uygun ve ücretsiz **Spark planı** ile yeterli bir çözümdür.

---

## Veritabanı Yapısı (JSON Taslağı)

Kat yapısındaki farklılıkları (örneğin `003, 004, 005` odalarının birleşik olması gibi) esnek şekilde yönetebilmek için sınıflar manuel olarak girilecektir.

* Pi cihazları **30 saniyede bir presence güncellemesi** yapar
* Windows uygulaması **rooms koleksiyonunu dinler**

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

Veritabanının dışarıdan manipüle edilmesini engellemek için güvenlik kuralları belirlenmelidir.

* **Okuma (read)** işlemi anonim olabilir
* **Yazma (write)** işlemi yalnızca kimliği doğrulanmış cihazlara izin verir

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      "$room_id": {
        ".write": "auth != null"
      }
    }
  }
}
```

---

## Kimlik Doğrulama (Auth) Stratejisi

İlerleyen aşamalarda her bir Pi cihazı için **ayrı Firebase hesabı** açılması planlanmaktadır.
Güvenlik için böyle bir yöntem seçilmişyir

Örnek:

```
pi-101@unicast.local
```

Bu yaklaşım sayesinde:

* Bir cihaz arızalandığında yalnızca **o hesabın erişimi kapatılabilir**
* Sistem yönetimi daha kolay olur
* Gerçek bir email hesabı olmasına gerek yoktur sadece güvenlik yeterlidir

Örnek Json

```
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

# 3. Faz 0 Aksiyon Listesi (To‑Do)

Bu fazdaki altyapı kurulumunu tamamlamak için yapılması gereken adımlar:

* [ ] Sistem gereksinimlerini kur (Rust, Node.js, Build Tools)
* [ ] `npm create tauri-app` ile React + TypeScript projesi oluştur
* [ ] Projeye Tailwind CSS entegre et
* [ ] Firebase projesi oluştur
* [ ] Realtime Database'i aktif et
* [ ] Veritabanı güvenlik kurallarını yapılandır
