import os
import re
from datetime import datetime

# Get today's date in a nice format
today_date = datetime.now().strftime("%B %d, %Y")

CSS_BLOCK = """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono&display=swap');
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background-color: #f8f9fa; }
        .config-dashboard {
            background: #ffffff;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 40px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid #e2e8f0;
            position: relative;
        }
        .dashboard-header { margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1a202c; padding-bottom: 16px; }
        .dashboard-header h1 { margin: 0; font-size: 20px; color: #000000; font-weight: 700; }
        .grid-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
        .config-card { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .config-card h3 { margin-top: 0; color: #000000; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; margin-bottom: 16px; border-bottom: 1px solid #edf2f7; padding-bottom: 8px; }
        .param-list { list-style: none; padding: 0; margin: 0; }
        .param-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f7fafc; font-size: 13px; align-items: center; }
        .param-item:last-child { border-bottom: none; }
        .label { color: #4a5568; font-weight: 500; }
        .value { color: #1a202c; font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .highlight { color: #000000; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
        .gst-pipeline { margin-top: 15px; background: #f8f9fa; color: #4a5568; padding: 14px; border-radius: 4px; font-size: 11px; font-family: 'JetBrains Mono', monospace; line-height: 1.5; border: 1px solid #e2e8f0; }
    </style>
"""

DASHBOARD_HTML_WITH_AUDIO = f"""
    <div class="config-dashboard">
        <div class="dashboard-header">
            <h1>UniCast Streaming Configuration</h1>
            <div style="font-size: 12px; color: #718096; font-weight: 600;">Report Date: {today_date}</div>
        </div>
        <div class="grid-container">
            <div class="config-card">
                <h3>Video Pipeline</h3>
                <div class="param-list">
                    <div class="param-item"><span class="label">Source Engine:</span> <span class="value">Direct3D11 Capture</span></div>
                    <div class="param-item"><span class="label">Resolution:</span> <span class="value">Native Desktop</span></div>
                    <div class="param-item"><span class="label">Target FPS:</span> <span class="value highlight">30 FPS</span></div>
                    <div class="param-item"><span class="label">Codec:</span> <span class="value highlight">H.264 (x264enc)</span></div>
                    <div class="param-item"><span class="label">Bitrate:</span> <span class="value highlight">3000 kbps</span></div>
                    <div class="param-item"><span class="label">Tuning:</span> <span class="value">Zerolatency</span></div>
                    <div class="param-item"><span class="label">Speed Preset:</span> <span class="value">Superfast</span></div>
                    <div class="param-item"><span class="label">Keyframe (GOP):</span> <span class="value highlight">Max 30</span></div>
                    <div class="param-item"><span class="label">Format:</span> <span class="value">I420 (YUV 4:2:0)</span></div>
                </div>
                <div class="gst-pipeline">
                    d3d11screencapturesrc ! videoconvert ! video/x-raw,format=I420,framerate=30/1 ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 ! rtph264pay config-interval=1 pt=96 ! udpsink host=&lt;IP&gt; port=5000
                </div>
            </div>
            <div class="config-card">
                <h3>Audio Pipeline</h3>
                <div class="param-list">
                    <div class="param-item"><span class="label">Source Engine:</span> <span class="value">WASAPI2 Loopback</span></div>
                    <div class="param-item"><span class="label">Codec:</span> <span class="value highlight">Opus (opusenc)</span></div>
                    <div class="param-item"><span class="label">Bitrate:</span> <span class="value">128 kbps</span></div>
                    <div class="param-item"><span class="label">Sampling Rate:</span> <span class="value">48,000 Hz</span></div>
                    <div class="param-item"><span class="label">Channels:</span> <span class="value">Stereo (2)</span></div>
                    <div class="param-item"><span class="label">Payload Format:</span> <span class="value">RTP (pt=96)</span></div>
                </div>
                <div class="gst-pipeline">
                    wasapi2src loopback=true ! audioconvert ! opusenc bitrate=128000 ! rtpopuspay pt=96 ! udpsink host=&lt;IP&gt; port=5002
                </div>
            </div>
            <div class="config-card">
                <h3>Transport Details</h3>
                <div class="param-list">
                    <div class="param-item"><span class="label">Network Protocol:</span> <span class="value">UDP / RTP</span></div>
                    <div class="param-item"><span class="label">Video Port:</span> <span class="value">5000</span></div>
                    <div class="param-item"><span class="label">Audio Port:</span> <span class="value">5002</span></div>
                    <div class="param-item"><span class="label">Baseline Latency:</span> <span class="value highlight">&lt; 150ms</span></div>
                    <div class="param-item"><span class="label">Receiver:</span> <span class="value">Raspberry Pi</span></div>
                </div>
            </div>
        </div>
    </div>
"""

DASHBOARD_HTML_WITHOUT_AUDIO = f"""
    <div class="config-dashboard">
        <div class="dashboard-header">
            <h1>UniCast Streaming Configuration (Video Only)</h1>
            <div style="font-size: 12px; color: #718096; font-weight: 600;">Report Date: {today_date}</div>
        </div>
        <div class="grid-container">
            <div class="config-card">
                <h3>Video Pipeline</h3>
                <div class="param-list">
                    <div class="param-item"><span class="label">Source Engine:</span> <span class="value">Direct3D11 Capture</span></div>
                    <div class="param-item"><span class="label">Resolution:</span> <span class="value">Native Desktop</span></div>
                    <div class="param-item"><span class="label">Target FPS:</span> <span class="value highlight">30 FPS</span></div>
                    <div class="param-item"><span class="label">Codec:</span> <span class="value highlight">H.264 (x264enc)</span></div>
                    <div class="param-item"><span class="label">Bitrate:</span> <span class="value highlight">3000 kbps</span></div>
                    <div class="param-item"><span class="label">Tuning:</span> <span class="value">Zerolatency</span></div>
                    <div class="param-item"><span class="label">Speed Preset:</span> <span class="value">Superfast</span></div>
                    <div class="param-item"><span class="label">Keyframe (GOP):</span> <span class="value highlight">Max 30</span></div>
                    <div class="param-item"><span class="label">Format:</span> <span class="value">I420 (YUV 4:2:0)</span></div>
                </div>
                <div class="gst-pipeline">
                    d3d11screencapturesrc ! videoconvert ! video/x-raw,format=I420,framerate=30/1 ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 ! rtph264pay config-interval=1 pt=96 ! udpsink host=&lt;IP&gt; port=5000
                </div>
            </div>
            <div class="config-card">
                <h3>Transport Details</h3>
                <div class="param-list">
                    <div class="param-item"><span class="label">Network Protocol:</span> <span class="value">UDP / RTP</span></div>
                    <div class="param-item"><span class="label">Video Port:</span> <span class="value">5000</span></div>
                    <div class="param-item"><span class="label">Audio Source:</span> <span class="value">Disabled</span></div>
                </div>
            </div>
        </div>
    </div>
"""

def clean_and_inject(filename, dashboard_html):
    if not os.path.exists(filename):
        print(f"Error: {filename} not found.")
        return

    with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    plotly_start = content.find("<div>")
    if plotly_start != -1:
        original_body_content = content[plotly_start:]
    else:
        original_body_content = "<!-- Content not found -->"

    new_content = f"""<html>
<head>
    <meta charset="utf-8" />
    <title>UniCast Performance Report</title>
    {CSS_BLOCK}
</head>
<body>
    {dashboard_html}
    {original_body_content}
</body>
</html>"""

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Successfully updated dashboard to 30 FPS in {filename}")

if __name__ == "__main__":
    inject_list = [
        ("unicast_performance_report.html", DASHBOARD_HTML_WITH_AUDIO),
        ("unicast_performance_report_without_audio.html", DASHBOARD_HTML_WITHOUT_AUDIO)
    ]
    
    for filename, html in inject_list:
        clean_and_inject(filename, html)
