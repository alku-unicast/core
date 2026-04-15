# GStreamer Cross-Platform Kurulum Rehberi
# Tarih: 2026-04-15
# Durum: UYGULANACAK

---

## 1. Genel Bakış

### Hedef
Her platform için doğru GStreamer build'ini indirmek ve projeye eklemek.

### Yeni Klasör Yapısı
```
app/src-tauri/gstreamer/
├── windows/          ← Mevcut MinGW (değiştirilecek veya MSVC'ye geçilecek)
├── linux/            ← Linux glibc build (eklenecek)
└── macos/           ← macOS Mach-O build (eklenecek)
```

### Ön Koşullar
- GStreamer 1.0 (sürüm 1.26 veya 1.24 — stable)
- ~500MB boş disk alanı (tüm platformlar)
- Admin yetkisi (bazı adımlarda gerekebilir)

---

## 2. Windows GStreamer İndirme

### Seçenek A: MSVC Build (Önerilen — Visual Studio ile uyumlu)
**Download:** https://gstreamer.freedesktop.org/data/pkg/windows/

```
gstreamer-1.26.0-msvc-x86_64-1-setup.exe
```
veya
```
gstreamer-1.26.0-msvc-x86_64-1.msi
```

### Seçenek B: MinGW Build (Mevcut — Aynı kullanılabilir)
```
gstreamer-1.26.0-mingw-x86_64-1-setup.exe
```

### İndirme Adımları
1. Tarayıcıda aç: https://gstreamer.freedesktop.org/data/pkg/windows/
2. "1.26.0" sürümünü seç (stable)
3. **MSVC x86_64** olanı indir (Visual Studio 2022 ile uyumlu)
4. İndirilen `.exe` veya `.msi` çalıştır
5. **Custom Install** seç, kurulum yolunu not et:
   ```
   C:\gstreamer-1.26.0-msvc-x86_64\
   ```

### Mevcut MinGW'yi Dönüştürme
Mevcut `app/src-tauri/gstreamer/` zaten MinGW build içeriyor. İki seçenek:

**Seçenek A:** Mevcut klasörü `windows/` olarak kullanmaya devam et (sorun yok)
**Seçenek B:** Yeni MSVC build indir, `windows/` klasörünü değiştir

---

## 3. Linux GStreamer İndirme

### Download
https://gstreamer.freedesktop.org/data/pkg/linux/

```
gstreamer-1.26.0-linux-x86_64.tar.xz
gstreamer-1.26.0-devel-linux-x86_64.tar.xz
```

### İndirme Adımları

#### Linux'ta (veya WSL'de):
```bash
# Ana paket
wget https://gstreamer.freedesktop.org/data/pkg/linux/gstreamer-1.26.0-linux-x86_64.tar.xz

# Geliştirici paketi (opcional ama gerekli)
wget https://gstreamer.freedesktop.org/data/pkg/linux/gstreamer-1.26.0-devel-linux-x86_64.tar.xz

# Ayıkla
tar -xf gstreamer-1.26.0-linux-x86_64.tar.xz
tar -xf gstreamer-1.26.0-devel-linux-x86_64.tar.xz

# İçeriği kontrol et
ls gstreamer-1.26.0/
```

#### Windows'ta (PowerShell veya WSL):
```powershell
# WSL kullanıyorsan
wsl --install # (WSL yoksa önce kur)

# WSL içinde
wget https://gstreamer.freedesktop.org/data/pkg/linux/gstreamer-1.26.0-linux-x86_64.tar.xz
tar -xf gstreamer-1.26.0-linux-x86_64.tar.xz
```

### Önemli: .tar.xz Dosyasını Windows'ta Açmak

Windows'ta 7-Zip veya PowerShell kullan:

**PowerShell (Windows 10/11):**
```powershell
# PowerShell 5.1+ .xz destekliyor
tar -xf gstreamer-1.26.0-linux-x86_64.tar.xz
```

**7-Zip:**
1. 7-Zip'i kur (https://7-zip.org)
2. .xz dosyasına sağ tık → 7-Zip → Buraya aç
3. .tar dosyasına sağ tık → Buraya aç

---

## 4. macOS GStreamer İndirme

### Download
https://gstreamer.freedesktop.org/data/pkg/macos/

```
gstreamer-1.26.0-universal-x86_64.pkg
```
veya
```
gstreamer-1.26.0-arm64-x86_64.pkg (Apple Silicon)
```

### İndirme Adımları
1. Tarayıcıda aç: https://gstreamer.freedesktop.org/data/pkg/macos/
2. "1.26.0" sürümünü seç
3. `.pkg` veya `.tar.xz` indir

**pkg kurulumu:**
```bash
sudo installer -pkg gstreamer-1.26.0-universal-x86_64.pkg -target /
```

**Kurulum yolu:**
```
/Library/Frameworks/GStreamer.framework/
```

**tar.xz kullanımı:**
```bash
tar -xf gstreamer-1.26.0-x86_64.tar.xz
ls gstreamer-1.26.0/
```

---

## 5. Klasörlere Kopyalama

### Hedef Klasör Yapısı
```
app/src-tauri/gstreamer/
├── windows/          ← Windows build (mevcut)
├── linux/            ← Linux build (eklenecek)
└── macos/            ← macOS build (eklenecek)
```

### Windows (Mevcut Build Zaten Var)
```
app/src-tauri/gstreamer/windows/
├── bin/
├── lib/
├── etc/
└── share/
```
Bu zaten mevcut — kontrol et ve doğrula.

### Linux Oluşturma
```powershell
# Yeni klasör oluştur
mkdir "D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\app\src-tauri\gstreamer\linux"

# Ayıklanan Linux build'i kopyala
# (WSL veya 7-Zip ile açtığın klasörden)
# Klasör yapısı:
#   gstreamer-1.26.0-linux-x86_64/
#   ├── bin/
#   ├── lib/
#   └── libexec/
# Bunları \linux\ içine kopyala
```

### macOS Oluşturma
```powershell
# Yeni klasör oluştur
mkdir "D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\app\src-tauri\gstreamer\macos"

# Kurulum veya açılan klasörden kopyala
# Klasör yapısı:
#   gstreamer-1.26.0-osx-x86_64/
#   ├── bin/
#   ├── lib/
#   └── libexec/
# Bunları \macos\ içine kopyala
```

---

## 6. Klasör Yapısı Kontrol Listesi

Her platform için şu klasör yapısı olmalı:

### Windows (`windows/`)
```
windows/
├── bin/                    ← gst-launch-1.0.exe, *.dll
├── lib/                    ← plugin'ler (*.dll)
│   └── gstreamer-1.0/      ← *.dll
├── libexec/                ← gst-plugin-scanner.exe
├── etc/                    ← fontconfig, ssl
└── share/                  ← locale, schemas
```

### Linux (`linux/`)
```
linux/
├── bin/                    ← gst-launch-1.0, *.so
├── lib/                    ← plugin'ler (*.so)
│   └── gstreamer-1.0/      ← *.so
├── libexec/                ← plugin scanner
├── etc/                    ← fontconfig, ssl
└── share/                 ← locale, schemas
```

### macOS (`macos/`)
```
macos/
├── bin/                    ← gst-launch-1.0, *.dylib
├── lib/                    ← plugin'ler (*.so, *.dylib)
│   └── gstreamer-1.0/      ← *.so, *.dylib
├── libexec/                ← plugin scanner
├── etc/                    ← fontconfig, ssl
└── share/                  ← locale, schemas
```

---

## 7. path_setup.rs Güncelleme (Otomatik — Değişiklik Gerekmiyor)

Mevcut `path_setup.rs` zaten `#[cfg(target_os)]` kullanıyor:

```rust
#[cfg(target_os = "windows")]
fn get_gst_launch(app: &AppHandle) -> String {
    let gst_root = app.path().resource_dir().join("gstreamer/windows");
    // ...
}

#[cfg(target_os = "linux")]
fn get_gst_launch(app: &AppHandle) -> String {
    let gst_root = app.path().resource_dir().join("gstreamer/linux");
    // ...
}

#[cfg(target_os = "macos")]
fn get_gst_launch(app: &AppHandle) -> String {
    let gst_root = app.path().resource_dir().join("gstreamer/macos");
    // ...
}
```

**Şu anda Linux ve macOS path'leri tanımlı değil** — eklenecek.

### Güncellenecek Dosya: `app/src-tauri/src/gstreamer/path_setup.rs`

Linux ve macOS için path fonksiyonları eklenmeli.

---

## 8. CI/CD için Önemli Not

Tauri build'de resource dizini:

```json
// tauri.conf.json
"resources": [
    "gstreamer/windows/**",
    "gstreamer/linux/**",
    "gstreamer/macos/**"
]
```

Veya platform bazlı:

```json
"resources": {
    "windows": ["gstreamer/windows/**"],
    "linux": ["gstreamer/linux/**"],
    "macos": ["gstreamer/macos/**"]
}
```

---

## 9. Sonraki Adımlar

### Adım 1: Windows Build Doğrula (5 dk)
```powershell
# Mevcut build'i kontrol et
dir "D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\app\src-tauri\gstreamer\windows\bin\gst-launch-1.0.exe"

# Sürüm kontrol et (çalışıyorsa)
# .\gst-launch-1.0.exe --version
```

### Adım 2: Linux Build İndir (10 dk)
1. https://gstreamer.freedesktop.org/data/pkg/linux/ aç
2. `gstreamer-1.26.0-linux-x86_64.tar.xz` indir
3. 7-Zip ile aç
4. `linux/` klasörüne kopyala

### Adım 3: macOS Build İndir (10 dk)
1. https://gstreamer.freedesktop.org/data/pkg/macos/ aç
2. `.tar.xz` indir
3. Aç ve `macos/` klasörüne kopyala

### Adım 4: path_setup.rs Güncelle (5 dk)
Linux ve macOS path'leri ekle.

### Adım 5: Test Et (Sonra)
- Windows'ta test et
- Linux'ta test et
- macOS'ta test et

---

## 10. Özet Tablo

| Platform | İndirilecek | Konum | Klasör |
|----------|------------|-------|--------|
| Windows | `gstreamer-1.26.0-msvc-x86_64-setup.exe` | C:\gstreamer\ veya mevcut | `windows/` |
| Linux | `gstreamer-1.26.0-linux-x86_64.tar.xz` | ~/gstreamer veya WSL | `linux/` |
| macOS | `gstreamer-1.26.0-universal-x86_64.pkg` | /Library/Frameworks/ | `macos/` |

---

## 11. Sorun Giderme

### "VCRUNTIME140.dll bulunamadı" (Windows)
VC++ Redistributable yüklü değil:
1. https://aka.ms/vs/17/release/vc_redist.x64.exe indir
2. Çalıştır, kur
3. Uygulamayı yeniden başlat

### "libgcc_s_seh-1.dll bulunamadı" (Windows)
MinGW runtime eksik — MSVC build'e geç veya MinGW runtime'ı yükle.

### Linux'ta "libgstreamer-1.0-0.so.0: cannot open shared object file"
```bash
export LD_LIBRARY_PATH=/path/to/gstreamer/linux/lib:$LD_LIBRARY_PATH
```

### macOS'ta "Library not loaded"
```bash
export GST_PLUGIN_PATH=/path/to/gstreamer/macos/lib/gstreamer-1.0
```

---

## 12. Kaynaklar

- GStreamer Official: https://gstreamer.freedesktop.org/
- Windows Builds: https://gstreamer.freedesktop.org/data/pkg/windows/
- Linux Builds: https://gstreamer.freedesktop.org/data/pkg/linux/
- macOS Builds: https://gstreamer.freedesktop.org/data/pkg/macos/
- Tauri Resources: https://tauri.app/docs/distribute/resource/
