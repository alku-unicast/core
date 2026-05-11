# UniCast — Performans Testi Rehberi

Bu dizin, UniCast sisteminin ağ gecikmesi (RTT) ve video iletim kararlılığını ölçen otonom benchmark altyapısını içerir.

---

## Dizin Yapısı

```
src/test/
├── sender/
│   ├── run_benchmarks.ps1          ← Windows master: Pi'yi koordine eder, GStreamer pipeline başlatır
│   ├── fix_latency_scenarios.py    ← CSV veri temizleme scripti (Türkçe ondalık virgülü düzeltir)
│   └── latency_log_partly_fixes.csv ← Örnek kısmen düzeltilmiş latency verisi
├── receiver/
│   ├── pi_orchestrator.py          ← Pi slave: TCP sunucu, komutlara göre GStreamer alıcı başlatır
│   ├── run_benchmarks.sh           ← Pi'de orchestrator'ı başlatır
│   └── benchmark_log.csv           ← Pi'de toplanan RTT verileri (her turdan sonra güncellenir)
└── analytics/
    ├── report_generator.py         ← CSV verilerinden bilimsel HTML rapor üretir
    └── unicast_final_report.html   ← Önceki testten üretilmiş rapor örneği
```

---

## Sistem Nasıl Çalışır?

Test sistemi **Master-Slave** mimarisi kullanır:

```
Windows (Master)                     Raspberry Pi (Slave)
─────────────────                    ────────────────────
run_benchmarks.ps1
    │
    │  TCP:5010  PREPARE:<senaryo>
    ├─────────────────────────────→  pi_orchestrator.py
    │                                    └─ GStreamer alıcı başlatır
    │  TCP:5010  READY
    ←─────────────────────────────┤
    │
    ├─ GStreamer gönderici başlatır
    ├─ UDP RTT ölçümü yapar (port 5005)
    ├─ Latency'yi CSV'ye yazar
    │
    │  TCP:5010  STOP
    ├─────────────────────────────→  GStreamer alıcıyı durdurur
    │  TCP:5010  DONE
    ←─────────────────────────────┤
    │
    └─ Sonraki senaryo...
```

Her senaryo tamamlandıktan sonra Windows tarafı RTT ölçümlerini `latency_log.csv`'ye yazar. Pi tarafı kendi istatistiklerini `benchmark_log.csv`'ye yazar.

---

## Ön Koşullar

### Windows (Gönderici)

- PowerShell 7+ (Windows 10/11 ile geliyor)
- GStreamer yüklü ve PATH'te: `gst-launch-1.0.exe` erişilebilir olmalı
  - Ya da `run_benchmarks.ps1` ile aynı dizinde `gst-launch-1.0.exe` bulunmalı

### Raspberry Pi (Alıcı)

```bash
sudo apt install -y python3 gstreamer1.0-tools gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly
```

---

## Çalıştırma

### Adım 1 — Pi'de Orchestrator Başlat

Pi'de test dizinine git ve orchestrator'ı başlat:

```bash
cd src/test/receiver
bash run_benchmarks.sh
```

Çıktı:
```
=== UniCast Pi Benchmark Orchestrator ===
TCP Server modunda başlatılıyor...
Durdurmak için Ctrl+C
[12:00:00] TCP sunucu başladı, port 5010 dinleniyor...
```

### Adım 2 — Windows'ta Benchmark Başlat

`run_benchmarks.ps1` dosyasını açıp Pi IP adresini düzenle:

```powershell
$PI_IP = "10.50.21.183"   # Pi'nin gerçek IP adresiyle değiştir
```

Ardından PowerShell'de çalıştır:

```powershell
cd src\test\sender
.\run_benchmarks.ps1
```

Çıktı:
```
=== UniCast Otonom Test Sistemi (TCP Handshake) ===
Tespit Edilen Kaynak: d3d11screencapturesrc
Pi IP: 10.50.21.183 | Kontrol Port: 5010
Toplam: 8 senaryo x 2 iterasyon = 16 tur

[12:00:05] === TUR 1/2 - SENARYO: 1080p_slayt_sessiz (1/16) ===
...
```

---

## Test Senaryoları

Varsayılan olarak 8 senaryo x 2 iterasyon = **16 tur** çalışır:

| Senaryo | Çözünürlük | FPS | Ses |
|---------|-----------|-----|-----|
| `1080p_slayt_sessiz` | 1920×1080 | 15 | Hayır |
| `1080p_slayt_sesli` | 1920×1080 | 15 | Evet |
| `1080p_video_sessiz` | 1920×1080 | 30 | Hayır |
| `1080p_video_sesli` | 1920×1080 | 30 | Evet |
| `720p_slayt_sessiz` | 1280×720 | 15 | Hayır |
| `720p_slayt_sesli` | 1280×720 | 15 | Evet |
| `720p_video_sessiz` | 1280×720 | 30 | Hayır |
| `720p_video_sesli` | 1280×720 | 30 | Evet |

Her tur `$DURATION` saniye (varsayılan: 70s) boyunca yayın yapar. Turlar arası `$REST_TIME` saniye (varsayılan: 5s) beklenir.

**Uzun süreli maraton test için** `run_benchmarks.ps1` içindeki parametreleri değiştir:

```powershell
$ITERATIONS = 5     # Tekrar sayısı
$DURATION = 600     # 10 dakika
$REST_TIME = 30     # Tur arası 30s soğuma
```

---

## Çıktı Dosyaları

### `latency_log.csv` (Windows tarafında oluşur)

```
Timestamp,Mode,Iteration,RTT_ms
12:00:35,1080p_slayt_sessiz,1,4.2
12:00:37,1080p_slayt_sessiz,1,3.8
...
```

Her kayıt: UDP port 5005 üzerinden ölçülen tek yönlü RTT değeri.

### `benchmark_log.csv` (Pi tarafında oluşur)

Pi'nin kendi perspektifinden paket kayıpları ve timing verileri.

> **Not:** Test bittikten sonra eski `latency_log.csv` otomatik olarak `latency_log_YYYYMMDD_HHMMSS.csv` adıyla yedeklenir.

---

## Rapor Üretme

Test bittikten sonra `analytics/report_generator.py` ile HTML rapor üret:

```bash
cd src/test/analytics

# Bağımlılıkları kur (ilk seferinde)
pip install pandas numpy plotly scipy

# Raporu üret (varsayılan: benchmark_log.csv + latency_log.csv okur)
python report_generator.py
```

Üretilen `unicast_final_report.html` dosyasını tarayıcıda açarak sonuçları incele. Rapor şunları içerir:

- Senaryo bazlı RTT ortalaması ± standart sapma
- Gecikme dağılım grafikleri (histogram + box plot)
- İstatistiksel karşılaştırma (senaryo arası)
- Ham akış grafiği (zaman serisine göre RTT)

---

## Sorun Giderme

| Sorun | Neden | Çözüm |
|-------|-------|-------|
| `HATA: Pi'ye bağlanılamadı` | Pi orchestrator çalışmıyor veya IP yanlış | Pi'de `run_benchmarks.sh` çalıştığını kontrol et, `$PI_IP` doğru mu? |
| `gst-launch-1.0 bulunamadı` | GStreamer PATH'te değil | `gst-launch-1.0.exe`'yi `sender/` dizinine koy ya da PATH'e ekle |
| `READY yanıtı gelmedi (timeout)` | Pi'de GStreamer başlatılamadı | Pi'de `gstreamer1.0-plugins-ugly` kurulu mu? (`x264enc` için gerekli) |
| Rapor `KeyError` veriyor | CSV kolon isimleri uyuşmuyor | `fix_latency_scenarios.py` ile CSV'yi düzelt, sonra tekrar çalıştır |
| RTT değerleri çok yüksek | Ağ tıkanıklığı veya GStreamer buffer | `$DURATION` düşür, tek senaryo test et |
