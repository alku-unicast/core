# Faz 3: Çoklu Platform (macOS & Linux) Derleme ve CI/CD Süreçleri

Bu aşama, Windows için geliştirilen uygulamanın diğer işletim sistemlerinde de sorunsuz, taşınabilir (**portable**) ve **"tıkla‑çalıştır"** mantığıyla çalışmasını sağlama adımlarını kapsar.

Ayrıca geliştirme sürecini hızlandırmak için **GitHub Actions ile otomatik derleme (CI/CD)** altyapısı kurulacaktır.

---

# 1. macOS Derleme ve Güvenlik (Gatekeeper) Süreçleri

macOS tarafında hem **Intel** hem de **Apple Silicon (M1, M2 vb.)** işlemciler için uygulamanın derlenmesi ve Apple'ın güvenlik prosedürlerinin yönetilmesi gerekmektedir.

---

## Universal Binary (Evrensel Uygulama)

İki farklı işlemci mimarisi için ayrı uygulamalar dağıtmak yerine **tek bir evrensel uygulama** üretilecektir.

Tauri'nin universal build komutu kullanılacaktır:

```bash
tauri build --target universal-apple-darwin
```

Bu komut sonucunda **tek bir `.app` paketi** hem Intel hem Apple Silicon cihazlarda çalışacaktır.

---

## GStreamer Entegrasyonu

macOS'ta GStreamer'ı uygulamanın içine gömmek için:

* Homebrew ile kurulan GStreamer **.dylib** kütüphaneleri alınacaktır
* Bu kütüphaneler uygulamanın aşağıdaki dizinine kopyalanacaktır

```text
SinifYayini.app/
└── Contents/
    └── Frameworks/
```

Daha sonra `install_name_tool` kullanılarak **kütüphane yolları (rpath)** düzeltilir.

Bu işlem sayesinde uygulama **sistemden bağımsız şekilde çalışabilir**.

---

## Gatekeeper (Apple Güvenlik Mekanizması)

Apple Developer hesabı olmadan **Notarization** işlemi yapılamaz.

Bu nedenle kullanıcılar uygulamayı ilk açtıklarında bir **güvenlik uyarısı** görecektir.

Bunu aşmak için README içinde iki yöntem anlatılacaktır.

### Yöntem 1 — Sistem Ayarlarından Açma

```
Sistem Ayarları → Gizlilik ve Güvenlik → "Yine de Aç"
```

### Yöntem 2 — Terminal Üzerinden Karantina Bayrağını Kaldırma

```bash
xattr -cr /Applications/SinifYayini.app
```

---

# 2. Linux Dağıtımı (AppImage)

Linux dünyasında çok sayıda dağıtım bulunduğu için uygulama **AppImage formatında** dağıtılacaktır.

Bu sayede kullanıcılar:

* Kurulum yapmadan
* Bağımlılık sorunları yaşamadan

uygulamayı çalıştırabilir.

---

## Derleme Ortamı

Derleme işlemi **Ubuntu 20.04** üzerinde yapılacaktır.

Sebep:

* Ubuntu 20.04 `glibc 2.31` kullanır
* Daha eski glibc ile derlenen uygulamalar
* Arch / Fedora / Ubuntu 22+ gibi yeni sistemlerde de çalışabilir

Bu yaklaşım **maksimum Linux uyumluluğu** sağlar.

---

## GStreamer'ı AppImage İçine Gömme

Tauri AppImage derlemesi:

```bash
tauri build --bundles appimage
```

GStreamer eklentilerini otomatik paketlemek için şu araç kullanılacaktır:

```
linuxdeploy-plugin-gstreamer
```

---

## Kullanıcı Tarafında Çalıştırma

Kullanıcıların yapması gereken tek şey dosyaya çalıştırma izni vermektir.

```bash
chmod +x SinifYayini.AppImage
./SinifYayini.AppImage
```

---

# 3. GitHub Actions ile Otomatik Derleme (CI/CD)

Geliştirme sürecini hızlandırmak için **GitHub Actions** kullanılacaktır.

Her yeni **push** işleminde proje otomatik olarak üç farklı işletim sistemi için derlenecektir.

Amaç:

* Platform uyumluluğunu sürekli test etmek
* Manuel derleme süresini azaltmak

---

## Örnek GitHub Actions Workflow Taslağı

```yaml
jobs:

  build-windows:
    runs-on: windows-latest

  build-macos:
    runs-on: macos-14

  build-linux:
    runs-on: ubuntu-20.04
```

Derleme başarıyla tamamlandığında çıktılar otomatik olarak:

```
GitHub Releases
```

bölümüne yüklenir.

Oluşacak dosyalar:

* `.exe` → Windows
* `.app` → macOS
* `.AppImage` → Linux

---

# 4. Faz 3 Aksiyon Listesi (To-Do)

Bu fazın tamamlanması için yapılması gerekenler:

* [ ] `.github/workflows/build.yml` dosyasının oluşturulması
* [ ] Windows, macOS ve Linux için CI/CD süreçlerinin yazılması
* [ ] macOS için `install_name_tool` kullanan dylib paketleme script'inin hazırlanması
* [ ] Linux için `linuxdeploy-plugin-gstreamer` entegrasyonunun yapılması
* [ ] Platformlara özel kurulum ve güvenlik yönergelerini içeren `README.md` hazırlanması
