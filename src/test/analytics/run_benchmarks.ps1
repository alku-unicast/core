# UniCast Windows Benchmark Runner
# Bu script win_orchestrator.py'yi her tur sonunda kapatip tertemiz yeniden baslatir.

while ($true) {
    # Orkestratörü çalıştır
    python win_orchestrator.py
    
    # Durumu kontrol et
    if (Test-Path "benchmark_state.json") {
        $state = Get-Content "benchmark_state.json" | ConvertFrom-Json
        if ($state.is_finished -eq $true) {
            Write-Host "TEBRİKLER: Tüm testler başarıyla tamamlandı!" -ForegroundColor Green
            break
        }
    } else {
        Write-Host "HATA: benchmark_state.json bulunamadı!" -ForegroundColor Red
        break
    }
    
    # Bekleme süresini yapılandırmadan oku
    $config = Get-Content "benchmark_config.json" | ConvertFrom-Json
    $rest = $config.rest_s
    
    Write-Host "$rest saniye bekleniyor (Sistem temizliği)..." -ForegroundColor Yellow
    Start-Sleep -Seconds $rest
}
