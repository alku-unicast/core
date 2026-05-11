# UniCast — Firebase Kurulum Rehberi

Bu rehber, UniCast sisteminin yeni bir Firebase projesiyle nasıl yapılandırılacağını adım adım açıklar. Mevcut `unicast-8a705` projesini klonlamak yerine kendi Firebase projenizi oluşturmak isteyenler için yazılmıştır.

---

## Firebase'in Projedeki Rolü

UniCast, Firebase Realtime Database'i yalnızca **oda listesi yönetimi** için kullanır:

| Taraf | Ne Yapar |
|-------|---------|
| Raspberry Pi | `pi_status`, `pi_ip`, `last_seen` bilgilerini Firebase'e yazar |
| UniCast Uygulaması (Rust) | Oda listesini Firebase'den okur (anonymous auth) |
| Kullanıcı | Okuma yapabilir, yazma yapamaz (Firebase kurallarıyla korunur) |

**Kritik Nokta:** Uygulama (Rust backend) Firebase'e **anonymous kimlik doğrulamasıyla** bağlanır — herhangi bir API anahtarı veya servis hesabı gerekmez. Yalnızca Pi tarafı servis hesabı kullanır.

```
                    Firebase Realtime DB
                    ┌────────────────────┐
Pi ──(service key)──▶  /rooms/{id}       │
                    │    pi_ip: "10.x"   │
                    │    pi_status: "idle"│
                    │    last_seen: 1234  │
App ──(anon auth)──▶                     │
                    └────────────────────┘
```

---

## 1. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com/)'a git
2. **"Proje Ekle"** → Proje adı gir (örn: `unicast-okulum`)
3. Google Analytics: isteğe bağlı, kapatabilirsin
4. **"Proje oluştur"**'a tıkla

---

## 2. Realtime Database Kur

1. Sol menüden **"Realtime Database"** → **"Veritabanı oluştur"**
2. Konum seç: `europe-west1` (Avrupa) veya `us-central1`
3. Güvenlik kuralları: **"Kilitli modda başlat"** seç (kuralları sonra değiştireceğiz)

---

## 3. Veritabanı Kurallarını Ayarla

**"Kurallar"** sekmesine geç ve aşağıdaki kuralları yapıştır:

```json
{
  "rules": {
    "rooms": {
      ".read": "auth != null",
      ".write": "auth != null && auth.token.firebase.sign_in_provider == 'anonymous' == false"
    }
  }
}
```

**Bu kurallar şu anlama gelir:**
- `rooms` koleksiyonunu **kimlik doğrulanmış** (anonymous dahil) herkes okuyabilir
- Yazmak için **servis hesabı** gerekir (Pi'deki `firebase-key.json`)
- Anonim kullanıcılar (uygulama) okuyabilir, yazamaz

**"Yayımla"** tıkla.

---

## 4. Anonymous Authentication Aç

Uygulamanın (Rust backend) veritabanını okuyabilmesi için:

1. Sol menüden **"Authentication"** → **"Oturum açma yöntemi"**
2. **"Anonim"** sağına tıkla → Etkinleştir → Kaydet

---

## 5. Servis Hesabı Anahtarı Al (Pi için)

1. Firebase Console → Sol üstte proje adına tıkla → **"Proje ayarları"**
2. **"Hizmet hesapları"** sekmesi
3. **"Yeni özel anahtar oluştur"** → **"Anahtar oluştur"**
4. İndirilen JSON dosyasını `firebase-key.json` olarak yeniden adlandır

> Bu dosya **gizlidir**. Git'e commit etme, herkesle paylaşma.  
> Proje `.gitignore` dosyasında `firebase-key.json` zaten engelli.

---

## 6. Pi'yi Yapılandır

İndirilen `firebase-key.json` dosyasını Pi'ye kopyala:

```bash
# Bilgisayardan Pi'ye kopyala
scp firebase-key.json pi@<PI_IP>:~/unicast/src/receiver/firebase-key.json
```

Veya doğrudan Pi'de oluştur:
```bash
nano ~/unicast/src/receiver/firebase-key.json
# İçeriği yapıştır, Ctrl+X ile kaydet
```

---

## 7. Uygulama Kaynak Kodunu Güncelle

Uygulama (Rust backend) Firebase URL'ini `firebase.rs` içinde hardcode olarak tutar. Kendi projeniz için değiştirin:

**`app/src-tauri/src/commands/firebase.rs`** — üstteki sabitler:

```rust
let api_key = "AIzaSy...";           // Firebase Console → Proje Ayarları → Web API Anahtarı
let db_url = "https://<proje-id>-default-rtdb.europe-west1.firebasedatabase.app/rooms.json";
```

**Firebase Console'dan değerleri al:**
1. **Proje Ayarları** → **"Genel"** sekmesi → **"Web API anahtarı"** → `api_key`
2. **Realtime Database** → **"Veri"** sekmesi → URL çubuğundaki adres → `db_url`

---

## 8. Pi Agent'ı Çalıştır

Pi'de gerekli Python bağımlılıklarını kur:

```bash
pip3 install firebase-admin
```

Agent'ı başlat:

```bash
cd ~/unicast
python3 src/receiver/agent.py
```

Pi agent başarıyla bağlandığında terminalde şunu görmelisin:

```
[agent] Firebase bağlantısı kuruldu.
[agent] IP: 10.x.x.x | Durum: idle
[agent] PIN: 4821
[agent] UDP:5001 dinleniyor...
```

---

## 9. Oda Listesi Yapısı

Firebase'de odaları manuel eklemek için **Realtime Database → Veri → "+" tıkla**:

```json
{
  "rooms": {
    "101": {
      "name": "101",
      "floor": "1",
      "pi_ip": "",
      "pi_status": "offline",
      "last_seen": 0
    },
    "B203": {
      "name": "B203",
      "floor": "2",
      "pi_ip": "",
      "pi_status": "offline",
      "last_seen": 0
    }
  }
}
```

| Alan | Açıklama | Kimin Yazdığı |
|------|---------|--------------|
| `name` | Görüntülenen oda adı | Manuel (bir kez) |
| `floor` | Kat numarası (string) | Manuel (bir kez) |
| `pi_ip` | Pi'nin ağ IP adresi | Pi agent (otomatik) |
| `pi_status` | `idle`, `streaming`, `offline` | Pi agent (otomatik) |
| `last_seen` | Unix timestamp (saniye) | Pi agent (30s'de bir) |

Pi agent çalışınca `pi_ip`, `pi_status` ve `last_seen` alanlarını otomatik doldurur.

---

## 10. Doğrulama

Kurulum doğru yapıldıysa:

1. Pi çalışıyor → Firebase'de `pi_ip` ve `last_seen` güncelleniyor
2. UniCast uygulaması açılıyor → Oda listesi yükleniyor, Pi `idle` (yeşil) görünüyor
3. "Bağlan"a tıklanıyor → PIN giriş ekranı açılıyor

**Uygulama oda listesi yükleyemiyorsa:**
- Firebase Console → Authentication → Anonim açık mı?
- Firebase Console → Kurallar → `.read: "auth != null"` var mı?
- `firebase.rs`'deki `api_key` ve `db_url` doğru mu?

**Pi Firebase'e yazamıyorsa:**
- `firebase-key.json` doğru konumda mı? (`src/receiver/firebase-key.json`)
- `firebase-admin` kurulu mu? (`pip3 install firebase-admin`)
- `firebase-key.json` içindeki `project_id` Firebase projesindekiyle eşleşiyor mu?

---

## Güvenlik Notları

- `firebase-key.json` repo'ya **asla** commit edilmez — `.gitignore`'da engelli
- Web API anahtarı (`api_key`) kaynak kodda görünür; bu normaldir — Firebase kuralları yazma iznini kısıtlar
- Okuma erişimi anonymous auth gerektiriyor — doğrudan URL ile sorgu yapılamaz (auth token olmadan 401 döner)
