# Faz 1: GStreamer Pipeline ve Çekirdek İletişim Mimarisi

Bu aşama, uygulamanın farklı işletim sistemlerinde ve eski/yeni donanımlarda sorunsuz çalışmasını sağlayan arka plan işlemlerini kapsar.

Odak noktaları:

* Öğretmen bilgisayarlarında **kurulumsuz (portable) çalışabilme**
* **Ekran kartına göre otomatik optimizasyon**
* **Ses ve görüntü senkronizasyonu**

---

# 1. Taşınabilir (Portable) GStreamer Dağıtımı

Kullanıcıları kurulum sihirbazlarıyla uğraştırmamak ve **yönetici (admin) izni sorunlarını aşmak** için GStreamer uygulamanın içine gömülecektir.

---

## Klasör Yapısı

Windows için dağıtılacak ZIP dosyasının dizin yapısı:

```text
SinifYayini/
├── SinifYayini.exe        ← Tauri arayüz uygulaması
├── gstreamer/
│   ├── bin/               ← gst-launch-1.0.exe ve diğer araçlar
│   ├── lib/
│   │   └── gstreamer-1.0/ ← gstx264.dll, gstnvcodec.dll vb. eklentiler
│   └── (diğer dll'ler)
└── vcredist_check.exe     ← GStreamer'ın ihtiyaç duyduğu C++ runtime kontrolü
```

---

## Rust ile Dinamik PATH Ayarı

Uygulama çalıştığı anda sistem PATH değişkenine **kalıcı ekleme yapmak yerine** yalnızca o oturum için GStreamer dizini PATH'e eklenir.

`main.rs` içerisinde başlangıçta çalışacak örnek fonksiyon:

```rust
fn setup_gstreamer_path() {
    let exe_dir = std::env::current_exe().unwrap().parent().unwrap().to_path_buf();
    let gst_bin = exe_dir.join("gstreamer").join("bin");
    let gst_plugins = exe_dir.join("gstreamer").join("lib").join("gstreamer-1.0");

    let current_path = std::env::var("PATH").unwrap_or_default();

    std::env::set_var(
        "PATH",
        format!("{};{};{}", gst_bin.display(), gst_plugins.display(), current_path)
    );

    std::env::set_var("GST_PLUGIN_PATH", gst_plugins.display().to_string());
}
```

**Not:**

GStreamer'ın ihtiyaç duyduğu **Visual C++ Runtime (vcredist)** sistemde yoksa:

* Sessiz kurulum yapılabilir
* Ya da kullanıcıya uyarı gösterilebilir

---

# 2. Akıllı GPU Fallback Zinciri

Eski bilgisayarlarda yüksek CPU kullanımını önlemek için önce **donanımsal kodlama (hardware encoding)** denenir.

Desteklenmez veya hata verirse sırasıyla diğer yöntemlere geçilir.

---

## Test Edilecek Encoder Sırası

1. `nvh264enc` → NVIDIA GPU
2. `qsvh264enc` → Intel HD / Iris (QuickSync)
3. `amfh264enc` → AMD / ATI
4. `x264enc` → Yazılımsal (CPU fallback)

---

## Rust Üzerinde Gerçek Zamanlı Encoder Testi

Sadece encoder elementinin var olması yeterli değildir.

Driver sorunları nedeniyle çalışmayabilir. Bu yüzden uygulama açıldığında **1 saniyelik sahte bir pipeline testi** yapılır.

```rust
fn test_encoder(encoder: &str) -> bool {

    let pipeline = format!(
        "d3d11screencapturesrc num-buffers=10 ! videoconvert ! video/x-raw,format=I420 ! {} ! fakesink",
        encoder_with_params(encoder)
    );

    let output = std::process::Command::new("gst-launch-1.0")
        .args(["-q", &pipeline])
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}
```

Bulunan en iyi encoder **settings.json** dosyasına kaydedilir:

```
detected_encoder
```

Böylece uygulama her açıldığında tekrar tarama yapılmaz.

Kullanıcı isterse **Ayarlar menüsünden manuel tarama** başlatabilir.

---

# 3. Ses ve Görüntü Senkronizasyonu (Lip‑Sync)

Görüntü aktarılırken bilgisayarın sesi de eşzamanlı olarak **Raspberry Pi'ye gönderilir**.

Paralel pipeline yapısı:

* Video portu → `5000`
* Audio portu → `5002`

---

## Platforma Göre Kaynak Seçimi

Rust `#[cfg(target_os)]` makroları kullanılarak işletim sistemine göre uygun kaynak seçilir.

### Görüntü Kaynakları

* Windows → `d3d11screencapturesrc`
* macOS → `avfvideosrc`
* Linux → `ximagesrc`

### Ses Kaynakları

* Windows → `wasapisrc`
* macOS → `osxaudiosrc`
* Linux → `pulsesrc` veya `pipewiresrc`

---

## Senkronizasyon (Buffer) Yönetimi

Laboratuvar testlerinde yaklaşık **74ms video gecikmesi** ölçülmüştür.

Sesin de bu gecikmeye uyum sağlayabilmesi için hem gönderici hem alıcı tarafında aşağıdaki parametre kullanılır:

```
queue max-size-time=74000000
```

Bu değer nanosaniye cinsindendir ve **sabit senkronizasyon tamponu** oluşturur.

---

# 4. Pencere Yakalama ve "Extend" Modu Alternatifi

Kullanıcıların ikinci bir sanal monitör sürücüsü kurmak yerine (ki bu çoklu platform desteğinde çok sıkıntılı bir süreç olur) **Extend modu yerine pencere yakalama** kullanılacaktır.

Öğretmenler yalnızca sunum yaptıkları pencereyi seçebilir.

Örnek kullanım:

* PowerPoint
* PDF viewer
* Browser

---

## Native API ile Pencere Listesi

Rust tarafında işletim sisteminin **native API'leri** kullanılarak açık pencereler listelenir.

* Windows → `EnumWindows`
* macOS → `CGWindowList`

Elde edilen pencere ID'leri arayüze (**React**) gönderilir.

GStreamer pipeline daha sonra **bu pencereye kilitlenir**.

---

# 5. Faz 1 Aksiyon Listesi (To‑Do)

Bu fazın tamamlanması için yapılması gerekenler:

* [ ] Windows için GStreamer dosyalarının portable klasör yapısına getirilmesi
* [ ] Rust `main.rs` içinde GStreamer PATH değişkenlerinin dinamik ayarlanması
* [ ] Uygulama açılışında çalışan `detect_encoder()` mekanizmasının yazılması
* [ ] Video (H.264) ve ses (Opus) pipeline'larının Rust subprocess olarak başlatılması
* [ ] İşletim sistemine özel ses ve ekran yakalama modüllerinin entegrasyonu
* [ ] Açık pencere listesini arayüze gönderecek native API entegrasyonlarının yapılması
