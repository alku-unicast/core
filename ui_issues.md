# UniCast Kritik Sorunlar Takibi (2026-04-25)

## 🔴 Kritik Sorunlar (Bloklayanlar)

### 1. Windows GStreamer Başlatma Hatası (Fresh Install)
- **Belirti:** Uygulama açılıyor, PIN giriliyor, ancak "Akış başlatılamadı / Akış beklenmedik şekilde durdu" hatası alınıyor.
- **Teknik Detay:** 
    - `gst-launch-1.0` süreci başlıyor ancak 500ms - 2s aralığında kapanıyor.
    - `AppData/Local/UniCast/gst_debug.log` dosyası **oluşmuyor**.
    - Kayıt defteri (registry) silme mantığı kaldırılmasına rağmen sorun devam ediyor.
- **Şüpheliler:**
    - `GST_PLUGIN_SCANNER` yolu veya çalıştırılmasıyla ilgili izin sorunu.
    - Sanal yol (Junction) oluşturma adımında (`mklink /J`) sessiz başarısızlık.
    - GStreamer DLL'lerinin (özellikle `x264enc` veya `d3d11` eklentileri) eksik paketlenmiş olması.

## 🟡 İkincil Sorunlar (Kozmetik/Akış)

### 1. Streaming Bar Görünürlük Yarışı
- Yayın başladığında üstteki ince bar bazen görünmüyor veya geç geliyor. 
- *Not: Ana sorun çözülünce bu da stabil hale gelecektir.*

## ✅ Çözülenler
- [x] Windows MSI Extraction (Administrative install ile tam binary çıkarma).
- [x] macOS `objc2` derleme hataları.
- [x] CI/CD Cross-platform resource injection (Dinamik `override.json` ile).
- [x] GStreamer Registry sıfırlama kısırdöngüsü (Kaldırıldı).
