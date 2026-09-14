#!/usr/bin/env python3
"""
CyberMon: Tekken Protocol - Launcher
Starts the FastAPI + WebSocket game server and opens the browser.
"""

import sys
import os
import socket
import webbrowser

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def main():
    print("=" * 60)
    print("⚡ CYBERMON: TEKKEN PROTOCOL - CYBERSECURITY TOURNAMENT ⚡")
    print("=" * 60)

    lan_ip = get_lan_ip()
    port = 8000
    local_url = f"http://localhost:{port}"
    lan_url = f"http://{lan_ip}:{port}"

    print(f"\n[+] Local Arcade URL: {local_url}")
    print(f"[+] LAN / Event URL:  {lan_url}")
    print("\n[+] Tournament Controls:")
    print("    Player 1: WASD (Move), J (1/LP), I (2/RP), K (3/LK), O (4/RK)")
    print("              S+D+I (df+2 Launcher), U (Special), SPACE (Zero-Day Rage Art)")
    print("    Player 2: Arrow Keys, Numpad 1/2/4/5 (1/2/3/4), Numpad 6 (Special), Enter (Rage)")
    print("\nStarting server...")

    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__":
    main()
