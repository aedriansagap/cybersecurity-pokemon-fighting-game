#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

if [ ! -f "static/assets/sprites/lucario_front.gif" ]; then
    echo "Downloading Pokémon sprites..."
    python3 download_sprites.py
fi

python3 start.py
