# Raspberry Pi 5 — UniCast Receiver Setup Guide

This guide contains all steps required to transform a Raspberry Pi 5 into a UniCast receiver from scratch.

For multi-device deployment workflows such as **Master Image creation**, **cloning**, and **zero-touch identity assignment**, see `pi_deployment.md`.

> **Target OS:** Raspberry Pi OS **Bookworm (Debian 12)** or **Trixie (Debian 13)** — 64-bit Lite  
> Both versions work correctly.  
> Raspberry Pi 5 does not include a hardware H.264 decoder, therefore the project uses software decoding through `avdec_h264`.  
> Hardware decoder regression reports in Trixie do **not** affect this project.

---

# Requirements

- Raspberry Pi 5 (any variant)
- MicroSD Card (minimum 16GB, Class 10)
- Raspberry Pi OS Lite **Bookworm or Trixie** (64-bit)
- Active Internet Connection (for setup)

---

# Step 1: OS Installation and Initial Configuration

1. Open **Raspberry Pi Imager**
2. Select:
   - **OS:** `Raspberry Pi OS Lite (64-bit)`  
     (Bookworm or Trixie)
3. Open **OS Customization** (`Ctrl + Shift + X`)
   - **Hostname:** `unicast-pi`
   - **Username / Password:** Set your credentials  
     (example: `pi` with a strong password)
   - **Wi-Fi:** Enter your school/office network  
     (for Eduroam see Step 7)
   - Enable **SSH**
4. Flash the SD card
5. Insert the card into the Pi and boot the device

---

# Step 2: System Update and Dependencies

Connect via SSH:

```bash
ssh pi@unicast-pi.local
````

---

## 2.1 System Update

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2.2 GStreamer and Media Tools

```bash
sudo apt install -y \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav \
  gstreamer1.0-alsa python3-gi python3-gst-1.0
```

---

## 2.3 Hardware Diagnostic Utilities

```bash
sudo apt install -y cec-utils alsa-utils v4l-utils python3-pil
```

---

## 2.4 User Permissions (DRM/KMS Access)

On Pi 5, display output is managed through DRM/KMS.
The `pi` user must have access to these devices:

```bash
sudo usermod -aG video,render pi
```

> After running this command, log out and back in again
> or run:
>
> ```bash
> newgrp video
> ```

---

# Step 3: Python Environment and Project Setup

```bash
# Create working directory
mkdir -p ~/core/src/receiver
cd ~/core

# Create virtual environment (with access to system packages)
python3 -m venv --system-site-packages venv
source venv/bin/activate

# Install required Python packages
pip install Pillow psutil pandas
```

> `psutil` and `pandas` are required for the test tool (`src/test/receiver/agent.py`)
> `Pillow` is used for idle screen PNG generation

---

# Step 4: Standby (Idle) Screen

When no stream is active, UniCast displays a minimalist information screen.

On Raspberry Pi 5, the legacy framebuffer (`/dev/fb0`) is replaced by **DRM/KMS**.
Therefore the project uses **GStreamer `kmssink`** instead of `fbi` or `fim`.

---

## Architecture Decision

The production `agent.py` manages all GStreamer pipelines using **Python GI bindings** inside a **single process**.

This is the same proven architecture already used by the test agent.

### Advantages

* ~200ms transitions
* No zombie process risk
* Easier error handling through GStreamer bus messages

---

## 4.1 PNG Generation with Pillow (White Theme)

```python
from PIL import Image, ImageDraw, ImageFont

def generate_idle_screen(pin, ip, temp):
    img = Image.new('RGB', (1920, 1080), color='black')
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
    
    draw.text((960, 350), f"PIN: {pin}", fill='white', font=font, anchor='mm')
    draw.text((960, 500), f"IP: {ip}", fill='white', font=font, anchor='mm')
    draw.text((960, 650), f"CPU: {temp}°C", fill='gray', font=font, anchor='mm')
    
    img.save('/tmp/idle.png')
```

---

## 4.2 Display Through DRM/KMS

```bash
# Manual test command — render PNG to display
gst-launch-1.0 filesrc location=/tmp/idle.png ! pngdec ! imagefreeze \
  ! videoconvert ! video/x-raw,width=1920,height=1080 \
  ! kmssink
```

> If you receive a `"Permission denied"` error:
>
> Make sure Step 2.4 (`usermod`) was applied correctly and the session was restarted.

---

## 4.3 Stream Transition Logic (Python GI — Single Process)

```text
IDLE:
  Generate PNG with Pillow
  → Gst.parse_launch("filesrc ! ... ! kmssink")
  → PLAYING

STREAM START:
  idle_pipeline.set_state(NULL)
  → 200ms delay
  → receiver_pipeline → PLAYING

STREAM END:
  receiver_pipeline.set_state(NULL)
  → recreate idle_pipeline
  → PLAYING
```

> All transitions are managed through the GStreamer state machine.
> No subprocesses are used.

---

# Step 5: Hardware Control (HDMI-CEC and Display Power)

Display control on Pi 5 differs from older Raspberry Pi models.
`vcgencmd display_power` no longer works.

---

## HDMI-CEC Initialization (First Time)

```bash
cec-ctl --playback
```

---

## Turn On Projector (When Stream Starts)

```bash
cec-ctl -d /dev/cec0 --to 0 --image-view-on
```

---

## Put Projector Into Standby (When Stream Ends)

```bash
cec-ctl -d /dev/cec0 --to 0 --standby
```

---

## HDMI Signal Blanking (Pi 5 Lite / DRM)

For displays that do not support CEC:

```bash
# Disable display signal
sudo sh -c 'echo "1" > /sys/class/graphics/fb0/blank'

# Enable display signal
sudo sh -c 'echo "0" > /sys/class/graphics/fb0/blank'
```

> CEC support depends on the projector or monitor.
> It should be verified during field testing.

---

# Step 6: Port Architecture and Firewall

---

## 6.1 UniCast Port Map

| Port | Protocol | Purpose                        |
| ---- | -------- | ------------------------------ |
| 5000 | UDP      | Video RTP Stream               |
| 5001 | UDP      | PIN Authentication + Heartbeat |
| 5002 | UDP      | Audio RTP Stream               |
| 5005 | UDP      | Latency Echo (RTT)             |
| 22   | TCP      | SSH Management                 |

---

## 6.2 Firewall Rules

```bash
sudo apt install -y ufw

sudo ufw allow 5000/udp comment "UniCast Video"
sudo ufw allow 5001/udp comment "UniCast Auth"
sudo ufw allow 5002/udp comment "UniCast Audio"
sudo ufw allow 5005/udp comment "UniCast RTT Echo"
sudo ufw allow 22/tcp comment "SSH"

sudo ufw enable
```

---

# Step 7: Eduroam / Wi-Fi Configuration (Optional)

For Eduroam or other 802.1X enterprise networks:

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

```ini
network={
    ssid="eduroam"
    key_mgmt=WPA-EAP
    eap=PEAP
    identity="unicast-proje@alanya.edu.tr"
    password="..."
    phase2="auth=MSCHAPV2"
}
```

> Request a dedicated IoT service account from the IT department with:
>
> * no password expiration
> * multi-device connection support
>
> See `pi_deployment.md` Section 2.1 for details.

---

# Step 8: Automatic Startup (Systemd)

Create the service file:

```bash
sudo nano /etc/systemd/system/unicast-agent.service
```

```ini
[Unit]
Description=UniCast Receiver Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
Group=video
WorkingDirectory=/home/pi/core/src/receiver
ExecStartPre=/bin/sleep 10
ExecStart=/home/pi/core/venv/bin/python3 /home/pi/core/src/receiver/agent.py
Environment=PYTHONUNBUFFERED=1
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now unicast-agent
```

---

## Important Notes

* `Group=video` provides DRM/KMS (`kmssink`) access
* `ExecStartPre=/bin/sleep 10` absorbs Eduroam DHCP delays
* `PYTHONUNBUFFERED=1` enables live log viewing through:

  ```bash
  journalctl -u unicast-agent -f
  ```

---

# Step 9: Pipeline Validation Test

Before testing the full UniCast system, validate the receiver pipeline independently.

---

## Receiver Test (Pi)

```bash
source ~/core/venv/bin/activate

gst-launch-1.0 -v \
  udpsrc port=5000 caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=200 \
  ! rtph264depay ! h264parse ! avdec_h264 \
  ! videoconvert ! videoscale ! video/x-raw,width=1920,height=1080 \
  ! kmssink sync=true
```

---

## Sender Test (Windows PC)

```powershell
gst-launch-1.0.exe `
  d3d11screencapturesrc ! videoconvert ! video/x-raw,format=I420,framerate=30/1 `
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 `
  ! rtph264pay config-interval=1 pt=96 `
  ! udpsink host=<PI_IP> port=5000
```

> Raspberry Pi 5 does not include a hardware H.264 decoder.
> `avdec_h264` (software decoding) is used instead.
>
> Pi 5 CPU performance is sufficient for `1080p@30fps` decoding
> (~40–60% CPU usage).

---

# Validation Checklist

* [ ] Was `sudo usermod -aG video,render pi` applied and the session restarted?
* [ ] Does `gst-launch-1.0 videotestsrc ! kmssink` display video correctly?
* [ ] Is `/tmp/idle.png` generated and displayed through `kmssink` at boot?
* [ ] Does the stream appear within seconds after starting transmission?
* [ ] Was `cec-ctl --playback` executed successfully?
* [ ] Does `cec-ctl -d /dev/cec0 --to 0 --image-view-on` power on the projector?
* [ ] Does `sudo ufw status` show all required ports (5000, 5001, 5002, 5005, 22)?
* [ ] Can service logs be monitored through `  journalctl -u unicast-agent -f`
* [ ] Does:`vcgencmd measure_temp` or `cat /sys/class/thermal/thermal_zone0/temp` return valid temperature data?

---

> **Firebase Note:**
> Firebase integration is not yet completed.
> This guide focuses only on setting up the Pi as a standalone GStreamer receiver.
>
> Once Firebase integration is added:
>
> * `pip install firebase-admin` will be required
> * `firebase-key.json` will be deployed
> * a Firebase presence module will be integrated into `agent.py`

---

> **Hardware Note:**
> Raspberry Pi 5 does not contain a hardware H.264 decoder.
> Software decoding through `avdec_h264` is used.
>
> No issues have been observed during passive cooling tests so far.
> If thermal throttling appears during long sessions, active cooling should be added.