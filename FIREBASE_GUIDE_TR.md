# UniCast Firebase Kurulum Kılavuzu

Bu doküman, UniCast sisteminin oda keşfi (discovery) ve durum takibi mekanizmalarının çalışması için gerekli olan Firebase projesinin nasıl kurulacağını ve yapılandırılacağını adım adım açıklar.
Ayrıca bu dokümanı projenin genel mimarisine göre yapay zekaya oluşturttum. Bu yüzden bu dokümanı okuyarak projenin genel mimarisini de öğrenebilirsin. Daha detaylı kısımlar için Roadmap klasörüne bakabilirsin oralar da güncellendi.

## 1. Firebase Projesi Oluşturma

1. [Firebase Console](https://console.firebase.google.com/) adresine gidin.
2. **"Proje ekle"** (Add project) butonuna tıklayın.
3. Proje adını girin (Örn: `UniCast-System`).
4. Google Analytics isteğe bağlıdır, bu proje için devre dışı bırakabilirsiniz.
5. **"Proje oluştur"** butonuna tıklayarak işlemi tamamlayın.

## 2. Kimlik Doğrulama (Authentication) Yapılandırması

UniCast, cihazların ve kullanıcıların sisteme güvenli bir şekilde bağlanabilmesi için **Anonim Kimlik Doğrulama** kullanır.

1. Sol menüden **Build > Authentication** sekmesine gidin.
2. **"Get Started"** butonuna tıklayın.
3. **"Sign-in method"** sekmesinde **"Anonymous"** seçeneğini bulun ve **Etkinleştir** (Enable) konumuna getirin.
4. Kaydedin.

## 3. Realtime Database Kurulumu

Sistemdeki odaların (Raspberry Pi'lerin) IP adreslerini ve durumlarını anlık olarak paylaşması için Realtime Database kullanılır.

1. Sol menüden **Build > Realtime Database** sekmesine gidin.
2. **"Create Database"** butonuna tıklayın.
3. Veritabanı konumunu seçin (Belçika `europe-west1` tavsiye edilir).
4. **"Start in locked mode"** seçeneğini seçin.
5. Veritabanı oluşturulduktan sonra **Rules** sekmesine gidin ve aşağıdaki kuralları yapıştırın:

### Güvenlik Kuralları (Security Rules)

Aşağıdaki kurallar, sadece anonim olarak giriş yapmış cihazların kendi verilerini yazmasına ve tüm kullanıcıların oda listesini okumasına izin verir.

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

> [!TIP]
> Daha sıkı güvenlik için ileride her Raspberry Pi için özel `auth.token` kontrolleri eklenebilir. Şimdilik anonim erişim geliştirme ve test aşaması için yeterlidir.

## 4. Veri Yapısı (Schema)

Sistemin uyumlu çalışması için `rooms/` koleksiyonu altında aşağıdaki yapı kullanılmalıdır:

```json
{
  "rooms": {
    "oda-101": {
      "name": "Derslik 101",
      "floor": "1",
      "pi_ip": "10.50.21.183",
      "pi_status": "idle",
      "last_seen": 1712411551000
    },
    "oda-005": {
      "name": "Laboratuvar 005",
      "floor": "0",
      "pi_ip": "10.50.21.184",
      "pi_status": "streaming",
      "last_seen": 1712411580000
    }
  }
}
```

- **pi_status**: `idle` (boşta), `streaming` (yayında), `offline` (çevrimdışı).
- **last_seen**: Raspberry Pi tarafından her 30 saniyede bir güncellenen sunucu zaman damgası (Timestamp).

## 5. Uygulama Yapılandırmasını Alın (Config)

Tauri (PC) uygulaması ve Raspberry Pi ajanı için gerekli config bilgilerini almak için:

1. Proje Genel Bakış (Project Overview) sayfasına gidin.
2. Web ikonu (</>) tıklayarak yeni bir web uygulaması kaydedin.
3. Uygulama takma adını girin (Örn: `UniCast-App`).
4. Size verilen `firebaseConfig` nesnesini kopyalayın:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "unicast-system.firebaseapp.com",
  databaseURL: "https://unicast-system-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "unicast-system",
  storageBucket: "unicast-system.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

> [!IMPORTANT]
> Bu bilgiler projenin `app/src/services/firebase.ts` (oluşturulduğunda) ve `src/receiver/agent.py` dosyalarında kullanılacaktır.

---
