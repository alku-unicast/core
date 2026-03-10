[TR]
# UniCast - Kablosuz Ekran Yayınlama Sistemi

## Proje Özeti

UniCast, düşük gecikmeli kablosuz bir ekran yansıtma sistemidir. Masaüstü ekranını yakalar ve UDP protokolleri ile yerel ağ (Wi-Fi/LAN) üzerinden yayınlar. Ticari kablosuz görüntü aktarım cihazlarına hafif ve hızlı bir alternatif olmak üzere tasarlanmıştır.

---

## Sistem Mimarisi

Sistem, basit bir Gönderici-Alıcı (Sender-Receiver) mimarisi kullanır:

- **Gönderici (Windows):** Ekranı yakalar, H.264 formatında kodlar ve UDP paketleri olarak gönderir.  
- **Alıcı (Raspberry Pi / PC):** UDP paketlerini alır, ağ dalgalanmalarını (jitter) düzenler, akışı çözer ve doğrudan ekrana yansıtır.



*![Sistem Mimarisi Diagramı](https://github.com/user-attachments/assets/a8b13dbe-5bd1-43ce-a997-d73fd6b47110)*

---

## Kurulum ve Hızlı Başlangıç

UniCast, temel multimedya işleme süreçleri için GStreamer altyapısını kullanır.  
Farklı işletim sistemleri (Windows, Linux, macOS, Raspberry Pi) için kurulum talimatlarına ve sistemi anında test edebileceğiniz örnek komutlara aşağıdaki rehberden ulaşabilirsiniz.

**[GStreamer Kurulum ve Kullanım Rehberi](GSTREAMER_GUIDE_TR.md)**

---

## Önyüz Geliştirmesi

Önyüz (Frontend), arka plandaki GStreamer komutlarını tetiklemek için bir kontrol paneli olarak görev yapacaktır.  
Projenin ilerleyen kısımlarında bu bölüm detaylandırılacaktır.

---

[EN]
# UniCast - Wireless Screen Streaming System

## Project Overview

UniCast is a low-latency wireless screen mirroring system. It captures a desktop screen and streams it over a local network (Wi-Fi/LAN) using UDP protocols. It is designed to be a lightweight and fast alternative to commercial wireless display hardware.

---

## System Architecture

The system uses a straightforward Sender-Receiver architecture:

- **Sender (Windows):** Captures the screen, encodes it into H.264, and sends it as UDP packets.  
- **Receiver (Raspberry Pi / PC):** Receives the UDP packets, handles network jitter, decodes the stream, and displays it directly on the screen.



*![System Architecture Diagram](https://github.com/user-attachments/assets/a8b13dbe-5bd1-43ce-a997-d73fd6b47110)*

---

## Installation and Quick Start

UniCast relies on GStreamer for its core multimedia pipeline.  
For installation instructions across different operating systems (Windows, Linux, macOS, Raspberry Pi) and sample commands to run the system immediately, please check the guide below.

**[GStreamer Installation and Usage Guide](GSTREAMER_GUIDE_EN.md)**

---

## Frontend Development

The frontend will serve as a control panel to trigger the underlying GStreamer commands.  
In the future steps of the project, this section will be detailed.
