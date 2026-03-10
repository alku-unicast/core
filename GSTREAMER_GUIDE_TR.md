# GStreamer Kurulum ve Kullanım Rehberi

Bu belge, GStreamer'ın farklı işletim sistemlerine kurulumunu ve UniCast yayın oturumunu başlatmak için gereken temel komutları içerir.

## 1. Kurulum

Sistem mimarimiz Gönderici (Sender) ve Alıcı (Receiver) olmak üzere ikiye ayrılmaktadır. Cihazınızın rolüne göre aşağıdaki kurulum adımlarını izleyin.

### Gönderici (Sender) Bilgisayar Kurulumu

#### Windows

Resmi GStreamer web sitesinden **MSVC 64-bit** yükleyicisini indirin.

Kurulum sırasında **Complete** seçeneğini işaretleyin.

Ardından GStreamer `bin` klasörünü Windows ortam değişkenlerine ekleyin:

```
C:\gstreamer\1.0\msvc_x86_64\bin
```

#### Linux (Debian / Ubuntu)

```
sudo apt update
sudo apt install -y \
 gstreamer1.0-tools \
 gstreamer1.0-plugins-base \
 gstreamer1.0-plugins-good \
 gstreamer1.0-plugins-bad \
 gstreamer1.0-plugins-ugly \
 gstreamer1.0-libav
```

#### macOS

Homebrew kullanarak kurulumu gerçekleştirebilirsiniz:

```
brew install gstreamer
```

---

### Alıcı (Receiver) Cihaz Kurulumu

#### Raspberry Pi 5 (veya Raspberry Pi OS / Linux tabanlı diğer alıcılar)

```
sudo apt update
sudo apt install -y \
 gstreamer1.0-tools \
 gstreamer1.0-plugins-base \
 gstreamer1.0-plugins-good \
 gstreamer1.0-plugins-bad \
 gstreamer1.0-plugins-ugly \
 gstreamer1.0-libav
```

---

## 2. Sistemi Başlatma

Yayını başlatmak için önce **Alıcı (Receiver)** çalıştırılmalı, ardından **Gönderici (Sender)** başlatılmalıdır.

`<PI_IP_ADRESI>` kısmını Raspberry Pi cihazınızın yerel IP adresi ile değiştirin.

### Senaryo 1: Windows Sender → Raspberry Pi 5 Receiver

#### 1. Raspberry Pi 5 (Receiver)

```
gst-launch-1.0 -v udpsrc port=5000 \
 caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
 ! rtpjitterbuffer latency=200 \
 ! rtph264depay \
 ! avdec_h264 \
 ! autovideosink sync=false
```

#### 2. Windows (Sender)

```
gst-launch-1.0.exe \
 d3d11screencapturesrc \
 ! videoconvert \
 ! "video/x-raw,format=I420" \
 ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=60 \
 ! rtph264pay config-interval=1 pt=96 \
 ! queue \
 ! udpsink host=<PI_IP_ADRESI> port=5000
```

---

## 3. Test Notları ve Geliştirme Süreci

### Raspberry Pi 5 & Windows Testleri

Bu sistem mimarisi **Raspberry Pi 5 (Receiver)** ve **Windows (Sender)** üzerinde yoğun şekilde test edilmiştir.

* Düşük gecikme: **<150 ms**
* Stabil ve akıcı görüntü aktarımı

Projenin ana hedef donanımı şu anda bu kombinasyondur.

---

### Raspberry Pi 3B+ Testleri

Daha düşük donanımlı sistemlerde çalışabilirliği test etmek için **Raspberry Pi 3B+** üzerinde de denemeler yapılmıştır.

Donanım sınırlamaları nedeniyle:

* Çözünürlük: **720p**
* FPS: **15**
* Receiver tarafında **kmssink** kullanılmıştır.

#### Pi 3B+ Windows Sender Komutu

```
gst-launch-1.0.exe \
 d3d11screencapturesrc \
 ! videoconvert \
 ! "video/x-raw,format=I420" \
 ! videoscale \
 ! "video/x-raw,width=1280,height=720,framerate=15/1" \
 ! x264enc tune=zerolatency bitrate=2000 speed-preset=ultrafast key-int-max=30 intra-refresh=true \
 ! rtph264pay config-interval=1 pt=96 \
 ! queue \
 ! udpsink host=<PI_IP_ADRESI> port=5000
```

#### Pi 3B+ Receiver Komutu

```
DISPLAY= gst-launch-1.0 udpsrc port=5000 \
 caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
 ! rtpjitterbuffer latency=100 \
 ! rtph264depay \
 ! h264parse \
 ! avdec_h264 \
 ! videoconvert \
 ! kmssink sync=false
```

---

## Sonuç

Pi 3B+ üzerinde görüntü aktarımı sağlanabilmiştir ancak henüz istenilen stabilite seviyesine ulaşılamamıştır.

İleride yapılacak:

* Donanım hızlandırma testleri
* Ek optimizasyonlar

sonrasında bu rehber güncellenecektir.
