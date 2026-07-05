import os
import sys
import time
import json
import socket
import argparse

# ── Dependency Check ─────────────────────────────────────────────────────────
try:
    import pyautogui
except ImportError:
    print("\n[ERROR] 'pyautogui' is required for this UI automation script.")
    print("Please install it on your PC by running: pip install pyautogui")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION FILE
# ─────────────────────────────────────────────────────────────────────────────
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qoe_config.json")
RESULTS_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), f"qoe_ui_results_{sys.platform}.csv")

# ─────────────────────────────────────────────────────────────────────────────
# CALIBRATION MODE
# ─────────────────────────────────────────────────────────────────────────────
def run_calibration():
    """Interactive calibration script to record coordinates and active pixel colors."""
    print("=" * 70)
    print("                 UNICAST QoE TEST SUITE - CALIBRATION")
    print("=" * 70)
    print("This utility will record coordinates and active button colors on your screen.")
    print("1. Open the UniCast Tauri desktop application.")
    print("2. Position the window so it is clearly visible and do NOT move it afterwards.")
    print("3. Ensure the room you want to test is listed on the home screen.")
    print("-" * 70)

    # Step 1: Target Room Connect Button
    input("\nHover your mouse over the target room's CONNECT button (ensure it is IDLE and blue/turquoise) and press Enter...")
    room_pos = list(pyautogui.position())
    # Move mouse away to avoid hover state and cursor overlay
    pyautogui.moveTo(room_pos[0] - 100, room_pos[1] - 100, duration=0.2)
    time.sleep(0.5)
    room_color = list(pyautogui.pixel(room_pos[0], room_pos[1]))
    print(f"Recorded Room Button (Normal State): Position {room_pos}, Color {room_color}")

    # Step 2: Navigate and get PIN entry + Presentation Button
    print("\nClick the Room Connect button to go to the PIN entry screen.")
    print("Type a dummy 4-character PIN (e.g. '1234') so that the 'Presentation' (Sunumu Başlat) button becomes active.")
    input("\nHover your mouse over the active 'Presentation' button and press Enter...")
    start_pos = list(pyautogui.position())
    # Move mouse away to avoid hover state and cursor overlay
    pyautogui.moveTo(start_pos[0] - 100, start_pos[1] - 100, duration=0.2)
    time.sleep(0.5)
    start_color = list(pyautogui.pixel(start_pos[0], start_pos[1]))
    print(f"Recorded Start Button (Normal State): Position {start_pos}, Color {start_color}")

    # Step 3: Stop Button
    print("\nClick the 'Presentation' button to let the streaming interface open.")
    input("\nHover your mouse over the red 'Stop Stream' (Yayını Durdur) button and press Enter...")
    stop_pos = list(pyautogui.position())
    print(f"Recorded Stop Button: Position {stop_pos}")

    # Click stop to reset
    pyautogui.moveTo(stop_pos[0], stop_pos[1], duration=0.2)
    time.sleep(0.1)
    pyautogui.click()
    print("Clicked Stop. App should return to Room Discovery.")

    # Save Config
    config_data = {
        "room_btn_pos": room_pos,
        "room_active_color": room_color,
        "start_btn_pos": start_pos,
        "start_active_color": start_color,
        "stop_btn_pos": stop_pos
    }

    with open(CONFIG_FILE, "w") as f:
        json.dump(config_data, f, indent=4)

    print("\n" + "=" * 70)
    print(f"Calibration successful! Configuration saved to:\n  {CONFIG_FILE}")
    print("You can now run the test suite using: python qoe_ui_test.py --pi-ip <PI_IP>")
    print("=" * 70)


# ─────────────────────────────────────────────────────────────────────────────
# STATISTICS CALCULATOR
# ─────────────────────────────────────────────────────────────────────────────
def calculate_stats(times):
    n = len(times)
    if n == 0:
        return 0.0, 0.0
    mean = sum(times) / n
    variance = sum((x - mean) ** 2 for x in times) / n
    std_dev = variance ** 0.5
    return mean, std_dev


def wait_for_stable_color(pos, target_color, tolerance=20, timeout=15):
    """Waits for the pixel color at `pos` to match `target_color` and remain stable for 200ms."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        if pyautogui.pixelMatchesColor(pos[0], pos[1], target_color, tolerance=tolerance):
            # Found a match, wait 200ms to ensure it's stable and not a temporary blink or layout shift
            time.sleep(0.2)
            if pyautogui.pixelMatchesColor(pos[0], pos[1], target_color, tolerance=tolerance):
                return True
        time.sleep(0.1)
    return False


def clear_socket_buffer(sock):
    """Flushes all queued/unconsumed packets from a UDP socket buffer."""
    sock.setblocking(False)
    try:
        while True:
            _, _ = sock.recvfrom(1024)
    except Exception:
        pass
    sock.setblocking(True)


# ─────────────────────────────────────────────────────────────────────────────
# TEST SEQUENCE
# ─────────────────────────────────────────────────────────────────────────────
def run_tests(pi_ip, room_name, num_trials, cooldown):
    # Enable FailSafe — moving mouse to top-left corner aborts script
    pyautogui.FAILSAFE = True

    if not os.path.exists(CONFIG_FILE):
        print(f"[ERROR] Configuration file not found at {CONFIG_FILE}.")
        print("Please run calibration first: python qoe_ui_test.py --calibrate")
        sys.exit(1)

    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)

    room_btn = config["room_btn_pos"]
    room_color = tuple(config["room_active_color"])
    start_btn = config["start_btn_pos"]
    start_color = tuple(config["start_active_color"])
    stop_btn = config["stop_btn_pos"]

    print("=" * 70)
    print("            UNICAST QoE AUTOMATED PERFORMANCE BENCHMARK")
    print("=" * 70)
    print(f"Target Pi IP:       {pi_ip}")
    if room_name:
        print(f"Target Room Name:   {room_name}")
    print(f"Number of Trials:   {num_trials}")
    print(f"Cooldown Period:    {cooldown} seconds")
    print("Move your mouse to the TOP-LEFT corner of the screen to ABORT at any time.")
    print("=" * 70)

    # Focus/Activate the UniCast Window before starting
    try:
        import pygetwindow as gw
        win = gw.getWindowsWithTitle("UniCast")
        if win:
            win[0].activate()
            time.sleep(1.0) # Wait for focus and layout render to stabilize
            print("[UI] UniCast window focused successfully.")
        else:
            print("[WARN] UniCast window not found. Make sure the app is open and visible.")
    except Exception as e:
        print(f"[WARN] Failed to focus window: {e}")

    # Initialize CSV header
    with open(RESULTS_CSV, "w") as f:
        f.write("Trial,Success,Duration_Sec,Frames_Rendered,Status\n")

    results = []
    times = []

    for trial in range(1, num_trials + 1):
        print(f"\n--- TRIAL {trial}/{num_trials} ---")
        
        # 1. Fetch current PIN via UDP
        print(f"[UDP] Querying PIN from Pi ({pi_ip}:5001)...")
        pin = None
        udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        udp_sock.settimeout(3.0)
        try:
            udp_sock.sendto(b"GET_PIN", (pi_ip, 5001))
            data, _ = udp_sock.recvfrom(64)
            pin = data.decode().strip()
            print(f"[UDP] Received current active PIN: {pin}")
        except socket.timeout:
            print("[ERROR] UDP PIN query timed out! Ensure qoe_agent.py is running on the Pi.")
            results.append((trial, False, 0.0, 0, "PIN Query Timeout"))
            continue
        except Exception as e:
            print(f"[ERROR] UDP error: {e}")
            results.append((trial, False, 0.0, 0, f"UDP Error: {e}"))
            continue
        finally:
            udp_sock.close()

        # 2. Wait until Room Button is active (stable color match)
        print("[UI] Waiting until Room is IDLE (checking button color stability)...")
        is_idle = wait_for_stable_color(room_btn, room_color, tolerance=20, timeout=15)

        if not is_idle:
            print("[ERROR] Room did not become IDLE in time. Skipping trial.")
            results.append((trial, False, 0.0, 0, "Room Not Idle Timeout"))
            continue

        # 3. Click Room Button (with smooth hover and safe delay)
        print(f"[UI] Clicking room button at {room_btn}...")
        pyautogui.moveTo(room_btn[0], room_btn[1], duration=0.2)
        time.sleep(0.1)
        pyautogui.click()
        time.sleep(1.2) # Wait for page load / animation

        # 4. Type PIN
        print(f"[UI] Typing PIN {pin}...")
        pyautogui.write(pin, interval=0.1)

        # 5. Wait for start button to become active
        print("[UI] Waiting for 'Presentation' button to become active...")
        is_start_active = wait_for_stable_color(start_btn, start_color, tolerance=20, timeout=5)

        if not is_start_active:
            print("[ERROR] 'Presentation' button did not activate. Backing out.")
            pyautogui.press("escape")
            results.append((trial, False, 0.0, 0, "Button Activation Timeout"))
            continue

        # 6. Click Presentation Button & Start Timer
        print("[UI] Starting presentation stream...")
        pyautogui.moveTo(start_btn[0], start_btn[1], duration=0.2)
        time.sleep(0.1)
        pyautogui.click()
        t0 = time.perf_counter()

        # 7. Poll Pi for the first frame (State.STREAMING and frame_count >= 1)
        t1 = None
        duration = 0.0
        success = False
        status = "Timeout waiting for streaming state"
        frames = 0
        
        poll_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        poll_sock.settimeout(0.5)
        clear_socket_buffer(poll_sock)

        # Wait up to 10 seconds for the first frame
        while time.perf_counter() - t0 < 10.0:
            try:
                poll_sock.sendto(b"GET_STATUS", (pi_ip, 5001))
                data, _ = poll_sock.recvfrom(64)
                status_msg = data.decode().strip()
                if status_msg.startswith("STATUS:"):
                    parts = status_msg.split(":")
                    state_str = parts[1].lower()
                    frame_cnt = int(parts[2])
                    
                    if "streaming" in state_str and frame_cnt >= 1:
                        t1 = time.perf_counter()
                        duration = t1 - t0
                        print(f"[QoE] First frame rendered! Connection ready in {duration:.4f} seconds.")
                        success = True
                        break
            except socket.timeout:
                pass
            except Exception as e:
                print(f"[QoE] Polling error: {e}")
            time.sleep(0.01) # 10ms poll interval

        if success:
            # Let it stream for 5 seconds to verify stability
            print("[QoE] Streaming for 5 seconds to verify stability...")
            time.sleep(5.0)

            # Clear socket buffer to flush all old status messages
            clear_socket_buffer(poll_sock)

            # Get final frame count before stopping
            try:
                poll_sock.sendto(b"GET_STATUS", (pi_ip, 5001))
                data, _ = poll_sock.recvfrom(64)
                status_msg = data.decode().strip()
                if status_msg.startswith("STATUS:"):
                    frames = int(status_msg.split(":")[2])
            except Exception:
                pass

            # Stop Stream
            print("[UI] Clicking Stop Stream button...")
            pyautogui.moveTo(stop_btn[0], stop_btn[1], duration=0.2)
            time.sleep(0.1)
            pyautogui.click()
            
            print(f"[QoE] Received frame stats: {frames} frames rendered.")
            if frames >= 50:
                status = "Stable Success"
                success = True
                times.append(duration)
            else:
                status = f"Quality Failure (Only {frames} frames)"
                success = False
        else:
            print("[ERROR] Timeout waiting for first frame from Pi!")
            # Make sure to try and click Stop to clean up Tauri UI state
            pyautogui.moveTo(stop_btn[0], stop_btn[1], duration=0.2)
            time.sleep(0.1)
            pyautogui.click()
            status = "Connection Timeout"

        poll_sock.close()
        results.append((trial, success, duration, frames, status))

        # Log to CSV
        trial_data = results[-1]
        with open(RESULTS_CSV, "a") as f:
            f.write(f"{trial_data[0]},{trial_data[1]},{trial_data[2]:.4f},{trial_data[3]},{trial_data[4]}\n")

        # Cooldown sleep
        if trial < num_trials:
            print(f"[Cooldown] Sleeping for {cooldown} seconds...")
            time.sleep(cooldown)

    # ── Calculate Final Stats ───────────────────────────────────────────────
    mean_val, std_dev = calculate_stats(times)
    total_successful = len(times)
    success_rate = (total_successful / num_trials) * 100

    print("\n" + "=" * 70)
    print("                         FINAL BENCHMARK REPORT")
    print("=" * 70)
    print(f"Platform:                    {sys.platform}")
    print(f"Total Connection Trials:     {num_trials}")
    print(f"Successful Connections:      {total_successful}")
    print(f"Reliability (Success Rate):  {success_rate:.2f}%")
    if total_successful > 0:
        print(f"Average Ready Time (Mean):   {mean_val:.4f} seconds")
        print(f"Standard Deviation (σ):      {std_dev:.4f} seconds")
    print("-" * 70)
    print(f"Detailed logs saved to:\n  {RESULTS_CSV}")
    print("=" * 70)

    # Output Thesis-ready Markdown Table
    print("\n### Thesis-Ready Performance Table:")
    print("| Platform | Trials | Successes | Success Rate (%) | Average Ready Time (s) | Std Dev (s) |")
    print("|---|---|---|---|---|---|")
    if total_successful > 0:
        print(f"| {sys.platform.capitalize()} | {num_trials} | {total_successful} | {success_rate:.1f}% | {mean_val:.3f} | {std_dev:.3f} |")
    else:
        print(f"| {sys.platform.capitalize()} | {num_trials} | 0 | 0.0% | N/A | N/A |")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UniCast QoE UI Automation Benchmarking Suite")
    parser.add_argument("--calibrate", action="store_true", help="Run mouse calibration wizard")
    parser.add_argument("--pi-ip", type=str, help="IP address of the Raspberry Pi receiver")
    parser.add_argument("--room-name", type=str, help="Name of the room to display in logs")
    parser.add_argument("--trials", type=int, default=30, help="Number of connection trials (default: 30)")
    parser.add_argument("--cooldown", type=int, default=10, help="Cooldown sleep time in seconds (default: 10)")
    args = parser.parse_args()

    if args.calibrate:
        run_calibration()
    elif args.pi_ip:
        run_tests(args.pi_ip, args.room_name, args.trials, args.cooldown)
    else:
        parser.print_help()
        print("\nTo start, run calibration: python qoe_ui_test.py --calibrate")
        print("Then run benchmarks:    python qoe_ui_test.py --pi-ip <PI_IP>")
