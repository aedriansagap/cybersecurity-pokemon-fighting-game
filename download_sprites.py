import os
import urllib.request
import ssl

POKEMON_LIST = [
    "lucario",
    "gengar",
    "porygonz",
    "scizor",
    "blaziken",
    "mewtwo",
    "pikachu",
    "greninja"
]

SHOWDOWN_BASE_ANI = "https://play.pokemonshowdown.com/sprites/ani/"
SHOWDOWN_BASE_ANI_BACK = "https://play.pokemonshowdown.com/sprites/ani-back/"
SHOWDOWN_DEX = "https://play.pokemonshowdown.com/sprites/gen5/"

TARGET_DIR = os.path.join(os.path.dirname(__file__), "static", "assets", "sprites")
os.makedirs(TARGET_DIR, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

print(f"Downloading official Pokémon sprites to {TARGET_DIR}...")

for p in POKEMON_LIST:
    # Front animated sprite
    front_url = f"{SHOWDOWN_BASE_ANI}{p}.gif"
    front_target = os.path.join(TARGET_DIR, f"{p}_front.gif")
    
    # Back animated sprite
    back_url = f"{SHOWDOWN_BASE_ANI_BACK}{p}.gif"
    back_target = os.path.join(TARGET_DIR, f"{p}_back.gif")

    # Static gen5 portrait/icon
    icon_url = f"{SHOWDOWN_DEX}{p}.png"
    icon_target = os.path.join(TARGET_DIR, f"{p}_icon.png")

    for url, path, label in [
        (front_url, front_target, "Front"),
        (back_url, back_target, "Back"),
        (icon_url, icon_target, "Icon")
    ]:
        if os.path.exists(path) and os.path.getsize(path) > 500:
            print(f"  [Exists] {p} ({label})")
            continue
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
                data = resp.read()
                if len(data) > 200:
                    with open(path, "wb") as f:
                        f.write(data)
                    print(f"  [Downloaded] {p} ({label}) - {len(data)} bytes")
                else:
                    print(f"  [Warning] {p} ({label}) file too small ({len(data)} bytes)")
        except Exception as e:
            print(f"  [Failed] {p} ({label}) from {url}: {e}")

print("Sprite download complete!")
