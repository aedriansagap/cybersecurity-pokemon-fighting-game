#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

if [ ! -f "static/assets/sprites/lucario_front.gif" ] || [ ! -f "static/assets/sprites/lucario_mega_front.gif" ]; then
    echo "Downloading Pokémon and Mega Evolution sprites..."
    python3 download_sprites.py
fi

if [ ! -f "static/assets/audio/lucario_cry.mp3" ]; then
    echo "Downloading Pokémon cries and BGMs..."
    python3 download_audio.py
fi

python3 start.py
