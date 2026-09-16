import os
import urllib.request
import ssl

TARGET_DIR = os.path.join(os.path.dirname(__file__), "static", "assets", "sprites")
TRAINERS_DIR = os.path.join(TARGET_DIR, "trainers")
ITEMS_DIR = os.path.join(TARGET_DIR, "items")
os.makedirs(TARGET_DIR, exist_ok=True)
os.makedirs(TRAINERS_DIR, exist_ok=True)
os.makedirs(ITEMS_DIR, exist_ok=True)

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def download_file(url, target_path, label):
    if os.path.exists(target_path) and os.path.getsize(target_path) > 300:
        print(f"  ✓ {label} already cached ({os.path.getsize(target_path)} bytes)")
        return True
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
            data = resp.read()
            if len(data) > 100:
                with open(target_path, "wb") as f:
                    f.write(data)
                print(f"  ✓ Downloaded {label} ({len(data)} bytes)")
                return True
            else:
                print(f"  ✗ {label} file too small ({len(data)} bytes)")
                return False
    except Exception as e:
        print(f"  ✗ Failed to download {label} from {url}: {e}")
        return False

# 1. Base Pokémon Sprites
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

print("1. Checking Base Pokémon Sprites...")
for p in POKEMON_LIST:
    download_file(f"https://play.pokemonshowdown.com/sprites/ani/{p}.gif", os.path.join(TARGET_DIR, f"{p}_front.gif"), f"{p} (Front)")
    download_file(f"https://play.pokemonshowdown.com/sprites/ani-back/{p}.gif", os.path.join(TARGET_DIR, f"{p}_back.gif"), f"{p} (Back)")
    download_file(f"https://play.pokemonshowdown.com/sprites/gen5/{p}.png", os.path.join(TARGET_DIR, f"{p}_icon.png"), f"{p} (Icon)")

# 2. Shiny & Alternate Sprites for combat variations
print("\n2. Checking Shiny Sprites for combat variations...")
for p in POKEMON_LIST:
    download_file(f"https://play.pokemonshowdown.com/sprites/ani-shiny/{p}.gif", os.path.join(TARGET_DIR, f"{p}_shiny_front.gif"), f"{p} Shiny (Front)")
    download_file(f"https://play.pokemonshowdown.com/sprites/ani-back-shiny/{p}.gif", os.path.join(TARGET_DIR, f"{p}_shiny_back.gif"), f"{p} Shiny (Back)")

# 3. Mega Evolution & Super Form Sprites
MEGA_FORMS = [
    ("lucario", "lucario-mega"),
    ("gengar", "gengar-mega"),
    ("scizor", "scizor-mega"),
    ("blaziken", "blaziken-mega"),
    ("mewtwo", "mewtwo-megax"),
    ("greninja", "greninja-ash"),
    ("pikachu", "pikachu-starter"),
    ("porygonz", "porygonz-shiny")
]

print("\n3. Checking Mega Evolution & Super Form Sprites...")
for p, mega_id in MEGA_FORMS:
    front_url = f"https://play.pokemonshowdown.com/sprites/ani/{mega_id}.gif"
    back_url = f"https://play.pokemonshowdown.com/sprites/ani-back/{mega_id}.gif"
    if mega_id == "porygonz-shiny":
        front_url = f"https://play.pokemonshowdown.com/sprites/ani-shiny/porygonz.gif"
        back_url = f"https://play.pokemonshowdown.com/sprites/ani-back-shiny/porygonz.gif"

    download_file(front_url, os.path.join(TARGET_DIR, f"{p}_mega_front.gif"), f"{p} Mega (Front)")
    download_file(back_url, os.path.join(TARGET_DIR, f"{p}_mega_back.gif"), f"{p} Mega (Back)")

# 3. Trainer Avatars for Union Room Lobby
TRAINERS = ["red", "cynthia", "steven", "blue", "lance", "n"]
print("\n3. Checking Trainer Avatars...")
for t in TRAINERS:
    url = f"https://play.pokemonshowdown.com/sprites/trainers/{t}.png"
    download_file(url, os.path.join(TRAINERS_DIR, f"{t}.png"), f"Trainer {t.title()}")

# 4. Items & Pokéball Badges
ITEMS = [
    ("poke-ball", "https://play.pokemonshowdown.com/sprites/itemicons/poke-ball.png"),
    ("ultra-ball", "https://play.pokemonshowdown.com/sprites/itemicons/ultra-ball.png"),
    ("master-ball", "https://play.pokemonshowdown.com/sprites/itemicons/master-ball.png"),
    ("mega-ring", "https://play.pokemonshowdown.com/sprites/itemicons/mega-ring.png")
]
print("\n4. Checking Item & Ball Icons...")
for item_name, url in ITEMS:
    download_file(url, os.path.join(ITEMS_DIR, f"{item_name}.png"), f"Item {item_name}")

print("\nSprite asset verification complete!")
