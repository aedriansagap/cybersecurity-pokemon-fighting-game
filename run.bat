@echo off
REM CyberMon: Tekken Protocol - Windows launcher (mirrors run.sh)
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\activate.bat" call ".venv\Scripts\activate.bat"

if not exist "static\assets\sprites\lucario_front.gif" (
    echo Downloading Pokemon and Mega Evolution sprites...
    python download_sprites.py
)

if not exist "static\assets\audio\lucario_cry.mp3" (
    echo Downloading Pokemon cries and BGMs...
    python download_audio.py
)

python start.py %*
