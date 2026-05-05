#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_latency_scenarios.py
----------------------------------------------------------------------
latency_log.csv dosyasındaki yanlış senaryo isimlerini, cikti.txt'deki
gerçek senaryo başlangıç zamanlarına göre düzeltir.

Mantık (interval bazlı, en yakın değil):
  1) cikti.txt'ten "[HH:MM:SS] === TUR x/5 - SENARYO: xxx (n/40) ==="
     satırları parse edilerek 40 (timestamp, senaryo) çifti çıkarılır.
  2) Bunlar kronolojik sıraya dizilir; gece yarısı geçişi (21:xx -> 04:xx)
     handle edilir (+24 saat ofseti).
  3) Her senaryo, kendi başlangıcından bir sonraki senaryonun başlangıcına
     kadar olan ZAMAN ARALIĞINA sahiptir. Son senaryo, CSV'nin sonuna
     kadar geçerli sayılır.
  4) latency_log.csv satır satır okunur. Her satırın timestamp'i hangi
     aralığa düşüyorsa, 2. kolondaki senaryo ismi o aralığın senaryosuyla
     değiştirilir. Mevcut yanlış isim ne olursa olsun üzerine yazılır.
  5) İlk senaryo başlangıcından önceki satırlar (warm-up TIMEOUT'lar)
     çıktıdan tamamen atılır.
  6) Orijinal dosya değiştirilmez. Sonuç latency_log_fixed.csv olarak
     yazılır.

NOT: Bu yaklaşımla "iterasyonlar arasında alakasız satır" durumu zaten
oluşmaz; her satır timestamp'ına göre tam olarak bir aralığa düşer ve
o aralığın senaryosunu alır. Rastgele atama gerekmez.
----------------------------------------------------------------------
"""

import re
import sys
import bisect
from pathlib import Path

# === DOSYA YOLLARI =====================================================
# Kendi makinendeki yollar zaten bunlar; gerekirse aşağıyı düzenle.
BASE_DIR   = Path(r"D:\Okul Belgeleri\4. Sınıf\Bitirme\yeni\core\src\test")
CIKTI_TXT  = BASE_DIR / "cikti.txt"
INPUT_CSV  = BASE_DIR / "latency_log.csv"
OUTPUT_CSV = BASE_DIR / "latency_log_fixed.csv"

EXPECTED_SCENARIOS = [
    "1080p_slayt_sessiz", "1080p_slayt_sesli",
    "1080p_video_sessiz", "1080p_video_sesli",
    "720p_slayt_sessiz",  "720p_slayt_sesli",
    "720p_video_sessiz",  "720p_video_sesli",
]
# =======================================================================

SCENARIO_LINE_RE = re.compile(
    r"\[(\d{2}):(\d{2}):(\d{2})\]\s*===\s*TUR\s+(\d+)/\d+\s*-\s*SENARYO:\s*([A-Za-z0-9_]+)"
)
TS_RE = re.compile(r"^(\d{2}):(\d{2}):(\d{2})$")

# Bir timestamp bir öncekinden 12 saatten fazla geriye giderse
# gece yarısı geçişi varsay. (Küçük sıra bozukluklarına karşı koruma.)
ROLLOVER_THRESHOLD = 12 * 3600


def hms_to_seconds(h: int, m: int, s: int) -> int:
    return h * 3600 + m * 60 + s


def parse_cikti(path: Path):
    """cikti.txt'ten kronolojik (abs_seconds, scenario_name, iteration) listesi döndürür."""
    pairs = []
    prev_abs = None
    day_offset = 0
    with path.open("r", encoding="utf-8-sig", errors="replace") as f:
        for line in f:
            m = SCENARIO_LINE_RE.search(line)
            if not m:
                continue
            h, mi, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
            iteration = int(m.group(4))
            name = m.group(5)
            secs = hms_to_seconds(h, mi, s)
            cand = secs + day_offset
            if prev_abs is not None and cand < prev_abs - ROLLOVER_THRESHOLD:
                day_offset += 24 * 3600
                cand = secs + day_offset
            pairs.append((cand, name, iteration))
            prev_abs = cand
    return pairs


def main():
    # --- Girdi kontrolü ---
    if not CIKTI_TXT.exists():
        print(f"HATA: {CIKTI_TXT} bulunamadı")
        sys.exit(1)
    if not INPUT_CSV.exists():
        print(f"HATA: {INPUT_CSV} bulunamadı")
        sys.exit(1)

    pairs = parse_cikti(CIKTI_TXT)
    if not pairs:
        print("HATA: cikti.txt içinde senaryo satırı bulunamadı.")
        sys.exit(1)

    print(f"cikti.txt'ten {len(pairs)} senaryo başlangıcı okundu")
    print(f"  İlk : {pairs[0][1]:22s} @ {pairs[0][0]:>7d}s")
    print(f"  Son : {pairs[-1][1]:22s} @ {pairs[-1][0]:>7d}s")
    print()

    starts = [p[0] for p in pairs]
    names  = [p[1] for p in pairs]
    iters  = [p[2] for p in pairs]
    first_start = starts[0]

    # --- CSV işle ---
    total          = 0
    dropped_before = 0
    malformed      = 0
    changed        = 0
    unchanged      = 0
    per_scenario   = {}
    day_offset     = 0
    prev_abs       = None
    prev_ts_mode   = None  # Çift satır deduplikasyonu için
    first_line     = True

    with INPUT_CSV.open("r", encoding="utf-8-sig", errors="replace", newline="") as fin, \
         OUTPUT_CSV.open("w", encoding="utf-8", newline="") as fout:

        for raw in fin:
            line = raw.rstrip("\r\n")
            if not line.strip():
                first_line = False
                continue

            total += 1
            parts = line.split(",")
            if len(parts) < 2:
                malformed += 1
                first_line = False
                continue

            ts_str = parts[0].strip()
            tm = TS_RE.match(ts_str)

            if not tm:
                # İlk satır timestamp formatında değilse muhtemelen header.
                # Onu olduğu gibi yaz, sayaçtan da düş.
                if first_line:
                    fout.write(line + "\n")
                    total -= 1
                else:
                    malformed += 1
                first_line = False
                continue
            first_line = False

            h, mi, s = int(tm.group(1)), int(tm.group(2)), int(tm.group(3))
            secs = hms_to_seconds(h, mi, s)
            cand = secs + day_offset
            if prev_abs is not None and cand < prev_abs - ROLLOVER_THRESHOLD:
                day_offset += 24 * 3600
                cand = secs + day_offset
            abs_secs = cand
            prev_abs = abs_secs

            # İlk senaryo başlamadan önceki satırları at.
            if abs_secs < first_start:
                dropped_before += 1
                continue

            # Aralığı bul: starts[i] <= abs_secs < starts[i+1]
            idx = bisect.bisect_right(starts, abs_secs) - 1
            scen = names[idx]
            iteration = iters[idx]

            old = parts[1].strip()
            if scen != old:
                changed += 1
            else:
                unchanged += 1

            # Çift satır deduplikasyonu (eski RTT job'ların artığı)
            curr_key = (ts_str, scen)
            if curr_key == prev_ts_mode:
                continue  # Aynı saniyede aynı mod → duplicate, atla
            prev_ts_mode = curr_key

            parts[1] = scen
            # Iteration sütununu düzelt (3. kolon, index=2)
            if len(parts) >= 3:
                parts[2] = str(iteration)
            per_scenario[scen] = per_scenario.get(scen, 0) + 1
            fout.write(",".join(parts) + "\n")

    # --- Özet ---
    print("=== ÖZET ===")
    print(f"Toplam veri satırı okundu     : {total}")
    print(f"  İlk senaryo öncesi atılan   : {dropped_before}")
    print(f"  Bozuk / atlanan             : {malformed}")
    print(f"  Yazılan                     : {changed + unchanged}")
    print(f"    Senaryo ismi düzeltilen   : {changed}")
    print(f"    Zaten doğruydu            : {unchanged}")
    print()
    print("Senaryo başına satır sayısı:")
    for name in EXPECTED_SCENARIOS:
        print(f"  {name:22s} : {per_scenario.get(name, 0)}")
    extras = {k: v for k, v in per_scenario.items() if k not in EXPECTED_SCENARIOS}
    if extras:
        print("Beklenmedik senaryo isimleri (kontrol et):")
        for k, v in extras.items():
            print(f"  {k}: {v}")
    print()
    print(f"Çıktı dosyası : {OUTPUT_CSV}")


if __name__ == "__main__":
    main()