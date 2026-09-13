#!/usr/bin/env python3
"""
CyberMon: Download Official Pokémon Cries and Pokémon Battle BGMs
Saves audio assets directly to static/assets/audio/ for offline tournament play.
"""

import os
import urllib.request
import ssl

TARGET_DIR = os.path.join(os.path.dirname(__file__), "static", "assets", "audio")
os.makedirs(TARGET_DIR, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Pokémon Cries (Showdown audio CDN)
CRIES = [
    "lucario",
    "gengar",
    "porygonz",
    "scizor",
    "blaziken",
    "mewtwo",
    "pikachu",
    "greninja"
]

print(f"Downloading Pokémon cries to {TARGET_DIR}...")
for p in CRIES:
    target_file = os.path.join(TARGET_DIR, f"{p}_cry.mp3")
    if os.path.exists(target_file) and os.path.getsize(target_file) > 1000:
        print(f"  ✓ {p}_cry.mp3 already cached ({os.path.getsize(target_file)} bytes)")
        continue
    url = f"https://play.pokemonshowdown.com/audio/cries/{p}.mp3"
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp, open(target_file, "wb") as f:
            f.write(resp.read())
        print(f"  ✓ Downloaded {p}_cry.mp3 ({os.path.getsize(target_file)} bytes)")
    except Exception as e:
        print(f"  ✗ Failed to download {p}_cry.mp3 from {url}: {e}")

# 2. Pokémon Battle BGM Tracks
BGMS = [
    ("bw-trainer.mp3", "https://play.pokemonshowdown.com/audio/bw-trainer.mp3"),
    ("bw2-kanto-gym-leader.mp3", "https://play.pokemonshowdown.com/audio/bw2-kanto-gym-leader.mp3"),
    ("xy-trainer.mp3", "https://play.pokemonshowdown.com/audio/xy-trainer.mp3")
]

print(f"Downloading Pokémon battle BGMs to {TARGET_DIR}...")
for filename, url in BGMS:
    target_file = os.path.join(TARGET_DIR, filename)
    if os.path.exists(target_file) and os.path.getsize(target_file) > 50000:
        print(f"  ✓ {filename} already cached ({os.path.getsize(target_file)} bytes)")
        continue
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp, open(target_file, "wb") as f:
            f.write(resp.read())
        print(f"  ✓ Downloaded {filename} ({os.path.getsize(target_file)} bytes)")
    except Exception as e:
        print(f"  ✗ Failed to download {filename} from {url}: {e}")

print("Audio asset sync completed.")
