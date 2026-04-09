#!/bin/bash
# UniCast Pi Benchmark Runner
# Bu script pi_orchestrator.py'yi her tur sonrasi kapatip tertemiz yeniden baslatir.

while true; do
  # Orkestratörü çalıştır
  python3 pi_orchestrator.py
  
  # Durumu kontrol et
  if [ -f "benchmark_state.json" ]; then
    FINISHED=$(python3 -c "import json; print(json.load(open('benchmark_state.json'))['is_finished'])")
    if [ "$FINISHED" = "True" ]; then
      echo -e "\033[0;32mTEBRİKLER: Tüm testler başarıyla tamamlandı!\033[0m"
      break
    fi
  else
    echo -e "\033[0;31mHATA: benchmark_state.json bulunamadı!\033[0m"
    break
  fi
  
  # Bekleme süresini yapılandırmadan oku
  REST_S=$(python3 -c "import json; print(json.load(open('benchmark_config.json'))['rest_s'])")
  
  echo -e "\033[0;33m$REST_S saniye bekleniyor (Sistem temizliği)...\033[0m"
  sleep $REST_S
done
