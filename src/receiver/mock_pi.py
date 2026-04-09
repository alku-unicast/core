import socket
import threading
import time

# Config
AUTH_PORT = 5001
ECHO_PORT = 5005

def start_echo_service():
    """UDP Port 5005 - Echoes back data for RTT/Latency testing."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    # Using '0.0.0.0' to listen on all interfaces
    sock.bind(('0.0.0.0', ECHO_PORT))
    print(f"[MOCK] Echo service listening on port {ECHO_PORT}")
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            sock.sendto(data, addr)
        except Exception as e:
            print(f"[MOCK] Echo error: {e}")

def start_auth_service():
    """UDP Port 5001 - Simulates PIN verification and WAKE command."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('0.0.0.0', AUTH_PORT))
    print(f"[MOCK] Auth service listening on port {AUTH_PORT}")
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            msg = data.decode('utf-8', errors='ignore').strip()
            print(f"[MOCK] Received from {addr}: {msg}")
            
            if msg == "WAKE":
                sock.sendto(b"READY", addr)
                print(f"[MOCK] Sent to {addr}: READY")
            elif msg.startswith("PIN:"):
                # Always return OK for any PIN in mock mode
                sock.sendto(b"OK", addr)
                print(f"[MOCK] Sent to {addr}: OK")
            elif msg == "HEARTBEAT":
                # Heartbeats are usually just to keep the connection alive on the receiver
                pass
            elif msg == "STOP":
                print(f"[MOCK] Stop command received from {addr}")
            else:
                print(f"[MOCK] Unknown command: {msg}")
        except Exception as e:
            print(f"[MOCK] Auth error: {e}")

if __name__ == "__main__":
    print("=========================================")
    print("   UniCast Mock Pi Simulator (Local)     ")
    print("=========================================")
    print(f"Auth/Wake Port: {AUTH_PORT}")
    print(f"Echo/RTT Port:  {ECHO_PORT}")
    print("Listening on all interfaces (127.0.0.1, etc.)")
    print("Press Ctrl+C to exit.")
    print("-----------------------------------------")
    
    t1 = threading.Thread(target=start_echo_service, daemon=True)
    t2 = threading.Thread(target=start_auth_service, daemon=True)
    
    t1.start()
    t2.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[MOCK] Stopping simulator...")
