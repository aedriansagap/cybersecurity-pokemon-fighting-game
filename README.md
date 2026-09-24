# ⚡ CYBERMON: TEKKEN PROTOCOL ⚡
### *Internal Company Cybersecurity Tournament 2026*

**CyberMon: Tekken Protocol** is a high-octane, Tekken-inspired 2.5D fighting game featuring an authoritative **Python backend (FastAPI + WebSockets)** and a high-performance **HTML5 Canvas 60 FPS fighting engine**. 

Tailored specifically for an internal company cybersecurity event, it pairs official Pokémon battle sprites with cybersecurity mechanics: **Firewall meters**, **Security Breaches**, **DDoS juggle combos**, and devastating **Zero-Day Exploit Rage Arts**.

---

## 🎮 Game Features

- **Tekken Combat Engine**:
  - **4-Limb Attack System**: `1` (Left Punch), `2` (Right Punch), `3` (Left Kick), `4` (Right Kick).
  - **Launchers & Air Juggles**: Classic Tekken `df+2` electric uppercuts launch opponents airborne for juggle combos before they hit the ground.
  - **2.5D 3D Sidestepping**: Tap Up or Down to dodge into foreground or background lanes, evading linear attacks.
  - **High / Mid / Low Guard Hierarchy**: Low attacks beat standing guards; mid attacks beat crouching guards.
  - **Firewall Guard Gauge**: Sustained blocking drains Firewall integrity. Breaking it causes a **Security Breach** (Guard Crush stun)!
  - **Zero-Day Rage Art**: When HP drops below 35%, fighters enter **Rage Mode** and start charging their **Zero-Day meter** by landing hits. At 100% charge, press the Super key to face a **cybersecurity challenge** — answer correctly to authenticate and unleash the cinematic super move (a wrong answer drains the meter to 50%).
- **Multiple Game Modes**:
  1. **1v1 vs Cyber Bot**: 4 Threat Levels: *Script Kiddie (Easy)*, *White Hat Sentinel (Medium)*, *APT Infiltrator (Hard)*, *Zero-Day Overlord (Nightmare)*.
  2. **1v1 Local PvP**: 2 players on a single keyboard or gamepads.
  3. **1v1 LAN / Online PvP**: Real-time WebSocket matchmaking with room codes (`CYBER-404`) across company laptops or network browsers.
  4. **SOC Sandbox / Training**: Frame data and practice against an AI dummy.
- **Cybersecurity Incident Response Cards**:
  - Integrated trivia mode with 15+ real-world cybersecurity scenarios (phishing, MFA bypass, ransomware containment, SQL injection, zero-days).
  - Correct answers reward tactical in-game buffs (*Firewall Reinforcement*, *Threat Overclock*, *Attack Boost*).
- **Official Pokémon Roster**:
  - **Lucario**: *The Aura Firewall* (Mishima Martial Artist / Electric Uppercut)
  - **Gengar**: *The Phantom Phisher* (Mixup / Invisibility Sidestep / Ransomware Stun)
  - **Porygon-Z**: *The Glitch Protocol* (Zoner / Buffer Overflow Launcher / Tri-Attack DDoS)
  - **Scizor**: *The Hardened Firewall* (Heavy Armored Brawler / Iron Defense Parry)
  - **Blaziken**: *The Flame Striker* (Hwoarang Kick Master / Blaze Kick Wall Splat)
  - **Mewtwo**: *The Root Admin* (Boss / Sudo Privilege Escalation)
  - **Pikachu**: *The Overvoltage Daemon* (Rushdown Speedster / Volt Tackle)
  - **Greninja**: *The Zero-Day Ninja* (Stealth Infiltrator / Water Shuriken)

---

## 🚀 Quick Start Guide

### 1. Requirements
- Python 3.10+ (Tested on Python 3.14)
- Modern web browser (Chrome, Firefox, Edge, Safari)

### 2. Launch the Game
Run the startup script:
```bash
./run.sh
```
Or directly with Python:
```bash
python3 start.py
```

The terminal will display both the local URL and your machine's LAN IP:
- **Local Arcade URL**: `http://localhost:8000`
- **Company LAN URL**: `http://192.168.x.x:8000` *(share with colleagues for multiplayer!)*

---

## 🕹️ Controls Guide

### Player 1 (Keyboard)
| Input | Action | Tekken Equivalent |
|---|---|---|
| **A / D** | Walk Left / Right | Directional Spacing |
| **S** | Crouch / Low Block | Crouch Guard (db) |
| **W** | Jump | Hop |
| **Tap W,W or S,S** | 3D Sidestep (Background / Foreground) | Tekken Sidestep (u / d) |
| **Tap D,D or A,A** | Forward Dash / Backdash | Korean Backdash / Dash |
| **J** | Button 1 (Left Punch) | Quick 10f High Jab |
| **I** | Button 2 (Right Punch) | Mid Straight Check |
| **K** | Button 3 (Left Kick) | Low Shin Sweep |
| **O / L** | Button 4 (Right Kick) | High Launcher Kick |
| **S + D + I** | Down-Forward 2 (`df+2`) | **Electric Uppercut Launcher** ⚡ |
| **D, D + I** | Forward-Forward 2 (`f,f+2`) | Dashing Surge Strike |
| **U** | Cyber Special Move | Projectile / Rush Attack |
| **SPACE** | **Zero-Day Rage Art** | Cinematic Super (HP < 35%, full meter + quiz auth) |

### Player 2 (Local PvP on Same Keyboard)
| Input | Action |
|---|---|
| **Arrow Keys** | Movement, Crouch, Jump, Sidestep |
| **Numpad 1 / 7** | Button 1 (Left Punch) |
| **Numpad 2 / 8** | Button 2 (Right Punch) |
| **Numpad 4 / 9** | Button 3 (Left Kick) |
| **Numpad 5 / 0** | Button 4 (Right Kick) |
| **↓ + → + Numpad 2** | `df+2` Uppercut Launcher |
| **Numpad 6 / -** | Cyber Special Move |
| **ENTER** | Zero-Day Rage Art | Cinematic Super (HP < 35%, full meter + quiz auth) |

---

## 📖 Fighter Move Lists & Combos

### 🔵 Lucario (*The Aura Firewall*)
- **1, 1, 2** (*Flash Punch Combo*): `J` → `J` → `I`
- **df+2 Launcher Juggle**: `S+D+I` (Launch!) → `J` → `I` → `O` (Juggle sequence)
- **Special**: `U` (*Packet Storm Sphere*)
- **Rage Art**: `SPACE` (*Quantum Aura Burst*)

### 🟣 Gengar (*The Phantom Phisher*)
- **1, 2, 4** (*Phish-and-Check*): `J` → `I` → `O`
- **df+2 Kernel Hijack**: `S+D+I` (Launch!) → `I` → `D,D+I`
- **Special**: `U` (*Phish Warp & Shadow Ball*)
- **Rage Art**: `SPACE` (*Zero-Day Exploit Overwrite*)

### 🔴 Porygon-Z (*The Glitch Protocol*)
- **1, 2, ff2** (*Memory Leak Cascade*): `J` → `I` → `D,D+I`
- **df+2 Infinite Recursion**: `S+D+I` (Launch!) → `O` → `U`
- **Special**: `U` (*Tri-Attack Binary Blast*)
- **Rage Art**: `SPACE` (*Kernel Panic Blue Screen*)

### 🛡️ Scizor (*The Hardened Firewall*)
- **1, 2, 2** (*Titanium Check*): `J` → `I` → `I`
- **df+2 Firewall Breaker**: `S+D+I` (Launch!) → `J` → `D,D+I`
- **Special**: `U` (*Bullet Punch Overdrive*)
- **Rage Art**: `SPACE` (*Brute Force Decryption Crush*)

---

## 🧪 Running Automated Tests

Run the backend unit and integration test suite:
```bash
./.venv/bin/python3 -m unittest discover -s tests
```

---

## 🏆 Tournament Event Guidelines

1. **Format**: Best of 3 Rounds (60s timer per round).
2. **Offline Ready**: All animated sprites, icons, sound effects, and CSS/JS are bundled locally in the repository. No active internet is required during the event!
3. **SOC Quick Hack Toggle**: Before the match or between rounds, contestants can click the **🛡️ SOC INCIDENT HACK** button to answer a 10-second security dilemma and earn a Firewall or Attack buff!
