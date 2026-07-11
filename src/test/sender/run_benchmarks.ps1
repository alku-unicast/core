# UniCast Autonomous Benchmarking - TCP Handshake Orchestrator
# Windows (Master) - Pi (Slave) senkronize test sistemi
# Pi'deki TCP sunucuya PREPARE/STOP/FINISH komutları gönderir.

# --- CONFIGURATION ---
$PI_IP = "10.50.21.183"
$VIDEO_PORT = 5000
$AUDIO_PORT = 5002
$ECHO_PORT = 5005
$CONTROL_PORT = 5010
$ITERATIONS = 2       # Gerçek maraton: 5
$DURATION = 70         # Gerçek maraton: 600 (10 dakika)
$REST_TIME = 5         # Tur arası soğuma süresi (gerçek maraton: 30)
$CONNECT_TIMEOUT = 30  # TCP bağlantı zaman aşımı (saniye)
$READY_TIMEOUT = 60    # READY yanıtı bekleme (saniye)
$DONE_TIMEOUT = 30     # DONE yanıtı bekleme (saniye)
$MAX_RETRY = 3         # Bağlantı hatası retry sayısı

# GStreamer yolu
$GST_BIN = ".\gst-launch-1.0.exe"
if (!(Test-Path $GST_BIN)) { $GST_BIN = "gst-launch-1.0" }

$LATENCY_LOG = Join-Path $PSScriptRoot "latency_log.csv"

# --- SCENARIOS ---
$SCENARIOS = @(
    "1080p_slayt_sessiz", "1080p_slayt_sesli",
    "1080p_video_sessiz", "1080p_video_sesli",
    "720p_slayt_sessiz", "720p_slayt_sesli",
    "720p_video_sessiz", "720p_video_sesli"
)

# --- HARDWARE DETECTION ---
function Get-GstSource {
    Write-Host "Hardware detection running..." -ForegroundColor Gray
    if (& $GST_BIN d3d11screencapturesrc ! fakesink num-buffers=1 | Out-String -ErrorAction SilentlyContinue) { return "d3d11screencapturesrc" }
    if (& $GST_BIN dx9screencapsrc ! fakesink num-buffers=1 | Out-String -ErrorAction SilentlyContinue) { return "dx9screencapsrc" }
    return "gdiscreencapsrc"
}

# --- TCP HELPER FUNCTIONS ---
function Send-TcpCommand {
    param([System.IO.StreamWriter]$Writer, [string]$Command)
    $Writer.WriteLine($Command)
    $Writer.Flush()
}

function Receive-TcpResponse {
    param([System.IO.StreamReader]$Reader, [int]$TimeoutMs)
    $task = $Reader.ReadLineAsync()
    if ($task.Wait($TimeoutMs)) {
        return $task.Result
    }
    return $null
}

function Connect-ToPi {
    param([int]$MaxRetry = 3)
    for ($attempt = 1; $attempt -le $MaxRetry; $attempt++) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $connectTask = $tcp.ConnectAsync($PI_IP, $CONTROL_PORT)
            if ($connectTask.Wait($CONNECT_TIMEOUT * 1000)) {
                $stream = $tcp.GetStream()
                $writer = New-Object System.IO.StreamWriter($stream)
                $writer.AutoFlush = $false
                $reader = New-Object System.IO.StreamReader($stream)
                Write-Host "  TCP baglanti basarili (deneme $attempt)" -ForegroundColor Green
                return @{ Tcp = $tcp; Writer = $writer; Reader = $reader; Stream = $stream }
            }
            else {
                Write-Host "  TCP baglanti zaman asimi (deneme $attempt/$MaxRetry)" -ForegroundColor Yellow
                $tcp.Close()
            }
        }
        catch {
            Write-Host "  TCP baglanti hatasi (deneme $attempt/$MaxRetry): $_" -ForegroundColor Red
            if ($tcp) { $tcp.Close() }
        }
        if ($attempt -lt $MaxRetry) { Start-Sleep -Seconds 5 }
    }
    return $null
}

function Disconnect-FromPi {
    param($Connection)
    try {
        if ($Connection.Writer) { $Connection.Writer.Close() }
        if ($Connection.Reader) { $Connection.Reader.Close() }
        if ($Connection.Stream) { $Connection.Stream.Close() }
        if ($Connection.Tcp) { $Connection.Tcp.Close() }
    }
    catch {}
}

# --- MAIN ---
$SRC = Get-GstSource
Write-Host "`n=== UniCast Otonom Test Sistemi (TCP Handshake) ===" -ForegroundColor Cyan
Write-Host "Tespit Edilen Kaynak: $SRC" -ForegroundColor Green
Write-Host "Pi IP: $PI_IP | Kontrol Port: $CONTROL_PORT" -ForegroundColor Green
Write-Host "Toplam: $($SCENARIOS.Count) senaryo x $ITERATIONS iterasyon = $($SCENARIOS.Count * $ITERATIONS) tur" -ForegroundColor Green
Write-Host ""

# Latency Log Hazirla (eski veriyi yedekle, temiz başla)
if (Test-Path $LATENCY_LOG) {
    $backupName = "latency_log_$(Get-Date -Format 'yyyyMMdd_HHmmss').csv"
    Copy-Item $LATENCY_LOG (Join-Path $PSScriptRoot $backupName)
    Write-Host "Eski latency log yedeklendi: $backupName" -ForegroundColor DarkGray
}
"Timestamp,Mode,Iteration,RTT_ms" | Out-File -FilePath $LATENCY_LOG -Encoding utf8

# Pi'ye baglan
Write-Host "Pi'ye baglaniliyor ($PI_IP`:$CONTROL_PORT)..." -ForegroundColor Yellow
$conn = Connect-ToPi -MaxRetry $MAX_RETRY
if (-not $conn) {
    Write-Host "HATA: Pi'ye baglanilamadi! Pi'de orchestrator calistigini kontrol edin." -ForegroundColor Red
    exit 1
}

$totalTests = $SCENARIOS.Count * $ITERATIONS
$testNum = 0
$skipped = 0

try {
    for ($iter = 1; $iter -le $ITERATIONS; $iter++) {
        foreach ($scenario in $SCENARIOS) {
            $testNum++
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "`n[$ts] === TUR $iter/$ITERATIONS - SENARYO: $scenario ($testNum/$totalTests) ===" -ForegroundColor Yellow

            # 1. PREPARE komutu gönder
            Write-Host "[$ts] Pi'ye PREPARE komutu gonderiliyor..." -ForegroundColor DarkGray
            try {
                Send-TcpCommand -Writer $conn.Writer -Command "PREPARE:${scenario}:${iter}"
            }
            catch {
                Write-Host "[$ts] HATA: PREPARE gonderilemedi, yeniden baglaniliyor..." -ForegroundColor Red
                Disconnect-FromPi $conn
                $conn = Connect-ToPi -MaxRetry $MAX_RETRY
                if (-not $conn) {
                    Write-Host "KRITIK HATA: Pi baglantisi kayboldu!" -ForegroundColor Red
                    exit 1
                }
                Send-TcpCommand -Writer $conn.Writer -Command "PREPARE:${scenario}:${iter}"
            }

            # 2. READY yanıtı bekle
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[$ts] READY yaniti bekleniyor (${READY_TIMEOUT}s)..." -ForegroundColor DarkGray
            $response = Receive-TcpResponse -Reader $conn.Reader -TimeoutMs ($READY_TIMEOUT * 1000)

            if ($response -eq "READY") {
                $ts = Get-Date -Format "HH:mm:ss"
                Write-Host "[$ts] Pi READY! Yayin baslatiliyor..." -ForegroundColor Green
            }
            elseif ($response -and $response.StartsWith("ERROR")) {
                $ts = Get-Date -Format "HH:mm:ss"
                Write-Host "[$ts] Pi HATA: $response - Senaryo atlaniyor" -ForegroundColor Red
                $skipped++
                continue
            }
            else {
                $ts = Get-Date -Format "HH:mm:ss"
                Write-Host "[$ts] READY zaman asimi - Senaryo atlaniyor" -ForegroundColor Red
                $skipped++
                continue
            }

            # 3. Pipeline Parametreleri
            $res = if ($scenario -like "*1080p*") { @("1920", "1080") } else { @("1280", "720") }
            $is_audio = $scenario -like "*sesli*"
            # Slayt: 15fps, 5000kbps | Video: 30fps, 4000kbps
            $is_slayt = $scenario -like "*slayt*"
            $fps = if ($is_slayt) { 15 } else { 30 }
            $bitrate = if ($is_slayt) { 5000 } else { 4000 }

            $pipeline = "$SRC ! queue max-size-buffers=2 ! videoconvert ! videoscale ! video/x-raw,width=$($res[0]),height=$($res[1]),format=I420,framerate=$fps/1 ! x264enc tune=zerolatency bitrate=$bitrate speed-preset=superfast key-int-max=$fps threads=4 ! rtph264pay config-interval=1 pt=96 ! udpsink host=$PI_IP port=$VIDEO_PORT sync=false async=false"

            if ($is_audio) {
                $pipeline += " wasapisrc loopback=true ! queue ! audioconvert ! opusenc bitrate=128000 ! rtpopuspay pt=96 ! udpsink host=$PI_IP port=$AUDIO_PORT sync=false async=false"
            }

            # 4. RTT Ölçer (arka plan job — her senaryoda temiz port ile)
            $rtt_script = {
                param($ip, $port, $log, $mode, $iter_num)
                $culture = [System.Globalization.CultureInfo]::InvariantCulture
                $udp = $null
                try {
                    $udp = New-Object System.Net.Sockets.UdpClient
                    $udp.Connect($ip, $port)
                    $remoteEP = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Any, 0)

                    while ($true) {
                        $t0 = [DateTime]::Now
                        $bytes = [System.Text.Encoding]::ASCII.GetBytes("PING")
                        try {
                            $udp.Send($bytes, $bytes.Length) | Out-Null
                            $udp.Client.ReceiveTimeout = 1000
                            $recv = $udp.Receive([ref]$remoteEP)
                            $rtt = ([DateTime]::Now - $t0).TotalMilliseconds
                            "$((Get-Date).ToString('HH:mm:ss')),$mode,$iter_num,$($rtt.ToString('F2', $culture))" | Out-File -FilePath $log -Append -Encoding utf8
                        }
                        catch {
                            "$((Get-Date).ToString('HH:mm:ss')),$mode,$iter_num,TIMEOUT" | Out-File -FilePath $log -Append -Encoding utf8
                        }
                        Start-Sleep -Seconds 1
                    }
                }
                finally {
                    if ($udp) { $udp.Close(); $udp.Dispose() }
                }
            }
            $rtt_job = Start-Job -ScriptBlock $rtt_script -ArgumentList $PI_IP, $ECHO_PORT, $LATENCY_LOG, $scenario, $iter

            # 5. GStreamer Başlat
            $process = Start-Process -FilePath $GST_BIN -ArgumentList $pipeline -PassThru -NoNewWindow
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[$ts] YAYIN BASLADI ($DURATION saniye)" -ForegroundColor Green

            # 6. DURATION kadar bekle
            Start-Sleep -Seconds $DURATION

            # 7. GStreamer + RTT durdur (güvenli temizlik)
            try { Stop-Job $rtt_job -ErrorAction SilentlyContinue } catch {}
            try { Remove-Job $rtt_job -Force -ErrorAction SilentlyContinue } catch {}
            try { taskkill /F /T /PID $process.Id 2>$null | Out-Null } catch {}
            Start-Sleep -Milliseconds 500  # Port serbest kalması için kısa bekleme

            # 8. STOP komutu gönder
            $ts = Get-Date -Format "HH:mm:ss"
            Write-Host "[$ts] STOP komutu gonderiliyor..." -ForegroundColor DarkGray
            try {
                Send-TcpCommand -Writer $conn.Writer -Command "STOP"
            }
            catch {
                Write-Host "[$ts] STOP gonderme hatasi, yeniden baglaniliyor..." -ForegroundColor Red
                Disconnect-FromPi $conn
                $conn = Connect-ToPi -MaxRetry $MAX_RETRY
                if ($conn) {
                    Send-TcpCommand -Writer $conn.Writer -Command "STOP"
                }
            }

            # 9. DONE yanıtı bekle
            $response = Receive-TcpResponse -Reader $conn.Reader -TimeoutMs ($DONE_TIMEOUT * 1000)
            $ts = Get-Date -Format "HH:mm:ss"
            if ($response -eq "DONE") {
                Write-Host "[$ts] Pi DONE. Tur basariyla tamamlandi." -ForegroundColor Green
            }
            else {
                Write-Host "[$ts] DONE yaniti alinamadi (yanit: $response)" -ForegroundColor Yellow
            }

            # 10. Soğuma
            Write-Host "[$ts] Soguma suresi ($REST_TIME saniye)..." -ForegroundColor DarkGray
            Start-Sleep -Seconds $REST_TIME
        }
    }

    # FINISH komutu gönder
    Write-Host "`n--- Tum turlar tamamlandi, FINISH gonderiliyor ---" -ForegroundColor Cyan
    try {
        Send-TcpCommand -Writer $conn.Writer -Command "FINISH"
        $response = Receive-TcpResponse -Reader $conn.Reader -TimeoutMs 10000
        Write-Host "Pi yaniti: $response" -ForegroundColor Green
    }
    catch {
        Write-Host "FINISH gonderme hatasi (Pi zaten kapanmis olabilir)" -ForegroundColor Yellow
    }

}
catch {
    Write-Host "`nBeklenmeyen hata: $_" -ForegroundColor Red
}
finally {
    Disconnect-FromPi $conn
}

# Özet
Write-Host "`n=== TEBRİKLER: Test Maratonu Tamamlandı! ===" -ForegroundColor Cyan
Write-Host "Toplam: $testNum tur | Basarili: $($testNum - $skipped) | Atlanan: $skipped" -ForegroundColor Green
Write-Host "Latency log: $LATENCY_LOG" -ForegroundColor Gray
