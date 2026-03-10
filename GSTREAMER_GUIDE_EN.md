# GStreamer Installation and Usage Guide

This document contains the installation steps for GStreamer on different operating systems and the basic commands required to start a UniCast streaming session.

## 1. Installation

Our system architecture is divided into two roles: **Sender** and **Receiver**. Follow the installation steps below according to the role of your device.

### Sender Computer Setup

#### Windows

Download the **MSVC 64-bit** installer from the official GStreamer website.

During installation, select the **Complete** option.

Then add the GStreamer `bin` directory to your Windows environment variables:

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

You can install GStreamer using Homebrew:

```
brew install gstreamer
```

---

### Receiver Device Setup

#### Raspberry Pi 5 (or other Raspberry Pi OS / Linux-based receivers)

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

## 2. Starting the System

To start the stream, first run the **Receiver**, then start the **Sender**.

Replace `<PI_IP_ADRESS>` with the local IP address of your Raspberry Pi device.

### Scenario 1: Windows Sender → Raspberry Pi 5 Receiver

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
 ! udpsink host=<PI_IP_ADRESS> port=5000
```

---

## 3. Test Notes and Development Process

### Raspberry Pi 5 & Windows Tests

This system architecture has been extensively tested on **Raspberry Pi 5 (Receiver)** and **Windows (Sender)**.

* Low latency: **<150 ms**
* Stable and smooth video transmission

Currently, this combination is the primary target hardware for the project.

---

### Raspberry Pi 3B+ Tests

Additional tests were conducted on **Raspberry Pi 3B+** to evaluate compatibility with lower‑powered hardware.

Due to hardware limitations:

* Resolution: **720p**
* FPS: **15**
* **kmssink** was used on the receiver side.

#### Pi 3B+ Windows Sender Command

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
 ! udpsink host=<PI_IP_ADRESS> port=5000
```

#### Pi 3B+ Receiver Command

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

## Conclusion

Video transmission on Pi 3B+ was successful, but it has not yet reached the desired level of stability.

Future improvements will include:

* Hardware acceleration tests
* Additional optimizations

This guide will be updated as further improvements are made.
