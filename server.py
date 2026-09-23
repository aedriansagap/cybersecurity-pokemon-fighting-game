"""
CyberMon: Tekken Protocol - Game Server
FastAPI + WebSockets Backend for 1v1 PvP & Bot Matchmaking
"""

import os
import json
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import cyber_trivia

try:
    from sql_gateway import SqlGateway
except ImportError:
    SqlGateway = None


def _load_dotenv() -> None:
    """Minimal .env loader (stdlib only): KEY=VALUE lines, ignores # comments."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        pass


_load_dotenv()

app = FastAPI(title="CyberMon: Tekken Protocol", version="1.0.0")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
RESULTS_FILE = os.path.join(DATA_DIR, "fighting_results.json")
PORT = int(os.environ.get("PORT", "8000"))

if SqlGateway is not None:
    try:
        sql_gateway = SqlGateway()
    except RuntimeError as _sql_err:
        print(f"[SQL] Disabled ({_sql_err})")
        sql_gateway = None
else:
    sql_gateway = None


def _load_local_results() -> dict:
    try:
        with open(RESULTS_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except (OSError, ValueError):
        pass
    return {"matches": [], "totalMatches": 0}


def _append_local_result(entry: dict) -> dict:
    os.makedirs(DATA_DIR, exist_ok=True)
    data = _load_local_results()
    data.setdefault("matches", []).append(entry)
    data["totalMatches"] = len(data["matches"])
    tmp = RESULTS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
    os.replace(tmp, RESULTS_FILE)
    return data

# Character Roster
ROSTER = [
    {
        "id": "lucario",
        "name": "Lucario",
        "title": "The Aura Firewall",
        "archetype": "Mishima Martial Artist",
        "element": "Steel / Fighting",
        "icon": "/static/assets/sprites/lucario_icon.png",
        "sprite_front": "/static/assets/sprites/lucario_front.gif",
        "sprite_back": "/static/assets/sprites/lucario_back.gif",
        "stats": {"power": 85, "speed": 90, "defense": 80, "reach": 75},
        "rage_art": "Quantum Aura Burst",
        "description": "Fast frame data, Mishima-style electric uppercut launcher, devastating counter-hits."
    },
    {
        "id": "gengar",
        "name": "Gengar",
        "title": "The Phantom Phisher",
        "archetype": "Mixup / Infiltrator",
        "element": "Ghost / Poison",
        "icon": "/static/assets/sprites/gengar_icon.png",
        "sprite_front": "/static/assets/sprites/gengar_front.gif",
        "sprite_back": "/static/assets/sprites/gengar_back.gif",
        "stats": {"power": 80, "speed": 95, "defense": 70, "reach": 70},
        "rage_art": "Zero-Day Exploit Overwrite",
        "description": "Elusive 3D sidestep teleports, ransomware stuns, tricky high/low mixups."
    },
    {
        "id": "porygonz",
        "name": "Porygon-Z",
        "title": "The Glitch Protocol",
        "archetype": "Zoner / Rogue Code",
        "element": "Normal / Cyber",
        "icon": "/static/assets/sprites/porygonz_icon.png",
        "sprite_front": "/static/assets/sprites/porygonz_front.gif",
        "sprite_back": "/static/assets/sprites/porygonz_back.gif",
        "stats": {"power": 90, "speed": 85, "defense": 65, "reach": 95},
        "rage_art": "Kernel Panic Blue Screen",
        "description": "Erratic glitch movement, Tri-Attack DDoS beam pokes, buffer overflow launchers."
    },
    {
        "id": "scizor",
        "name": "Scizor",
        "title": "The Hardened Firewall",
        "archetype": "Heavy Armored Brawler",
        "element": "Bug / Steel",
        "icon": "/static/assets/sprites/scizor_icon.png",
        "sprite_front": "/static/assets/sprites/scizor_front.gif",
        "sprite_back": "/static/assets/sprites/scizor_back.gif",
        "stats": {"power": 95, "speed": 75, "defense": 95, "reach": 80},
        "rage_art": "Brute Force Decryption Crush",
        "description": "Iron Defense parry counters, crushing Bullet Punch pressure, massive juggle damage."
    },
    {
        "id": "blaziken",
        "name": "Blaziken",
        "title": "The Flame Striker",
        "archetype": "Hwoarang Kick Master",
        "element": "Fire / Fighting",
        "icon": "/static/assets/sprites/blaziken_icon.png",
        "sprite_front": "/static/assets/sprites/blaziken_front.gif",
        "sprite_back": "/static/assets/sprites/blaziken_back.gif",
        "stats": {"power": 90, "speed": 90, "defense": 75, "reach": 85},
        "rage_art": "Solar Thermal Breach",
        "description": "Stance transitions, multi-hit kick combos, Blaze Kick wall splats."
    },
    {
        "id": "mewtwo",
        "name": "Mewtwo",
        "title": "The Root Admin",
        "archetype": "Boss / Privilege Escalation",
        "element": "Psychic / System Admin",
        "icon": "/static/assets/sprites/mewtwo_icon.png",
        "sprite_front": "/static/assets/sprites/mewtwo_front.gif",
        "sprite_back": "/static/assets/sprites/mewtwo_back.gif",
        "stats": {"power": 95, "speed": 85, "defense": 85, "reach": 90},
        "rage_art": "Total Privilege Escalation",
        "description": "Telekinetic air juggles, Psystrike packet blasts, imposing super armor."
    },
    {
        "id": "pikachu",
        "name": "Pikachu",
        "title": "The Overvoltage Daemon",
        "archetype": "Speed / Rushdown",
        "element": "Electric / Hardware Surge",
        "icon": "/static/assets/sprites/pikachu_icon.png",
        "sprite_front": "/static/assets/sprites/pikachu_front.gif",
        "sprite_back": "/static/assets/sprites/pikachu_back.gif",
        "stats": {"power": 75, "speed": 100, "defense": 70, "reach": 65},
        "rage_art": "Grid Overload EMP",
        "description": "Ultra fast quick attacks, low hitboxes, electric stun traps."
    },
    {
        "id": "greninja",
        "name": "Greninja",
        "title": "The Zero-Day Ninja",
        "archetype": "Stealth Infiltrator",
        "element": "Water / Dark",
        "icon": "/static/assets/sprites/greninja_icon.png",
        "sprite_front": "/static/assets/sprites/greninja_front.gif",
        "sprite_back": "/static/assets/sprites/greninja_back.gif",
        "stats": {"power": 85, "speed": 95, "defense": 75, "reach": 85},
        "rage_art": "Water Shuriken Exploit Chain",
        "description": "Shadow sneak mixups, aerial combo juggles, high mobility."
    }
]

# Room & Match Management
class Room:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.p1_ws: Optional[WebSocket] = None
        self.p2_ws: Optional[WebSocket] = None
        self.spectators: List[WebSocket] = []
        self.p1_character: Optional[str] = "lucario"
        self.p2_character: Optional[str] = "gengar"
        self.p1_ready: bool = False
        self.p2_ready: bool = False
        self.stage: str = "server_room"
        self.state: str = "lobby"  # lobby, playing, finished

rooms: Dict[str, Room] = {}

class TriviaAnswerRequest(BaseModel):
    question_id: int
    selected_option: int


class FighterProfile(BaseModel):
    empId: Optional[str] = None
    name: str = "Anonymous"
    dept: str = "General"
    character: Optional[str] = None


class MatchRecordRequest(BaseModel):
    match_id: str
    winner: FighterProfile
    loser: FighterProfile
    winner_points: int = 100
    loser_points: int = 25
    is_pvp: bool = True

ROSTER_IDS = {c["id"] for c in ROSTER}

@app.get("/")
async def get_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@app.get("/scoreboard")
async def get_scoreboard_page():
    return FileResponse(os.path.join(STATIC_DIR, "scoreboard.html"))

@app.get("/api/health")
async def health_check():
    payload = {"status": "ok", "game": "CyberMon: Tekken Protocol", "version": "1.0.0"}
    if sql_gateway is not None:
        payload["sql"] = sql_gateway.diagnostics()
    else:
        payload["sql"] = {"enabled": False}
    return payload

@app.get("/api/roster")
async def get_roster():
    return {"roster": ROSTER}

@app.get("/api/trivia/random")
async def get_random_trivia_endpoint():
    t = cyber_trivia.get_random_trivia()
    # Don't leak the correct answer directly to the client if they use it for quiz
    return {
        "id": t["id"],
        "category": t["category"],
        "question": t["question"],
        "options": t["options"],
        "buff": t["buff"]
    }

@app.get("/api/trivia/all")
async def get_all_trivia():
    # Never leak correct answers / explanations — clients must use /verify.
    return {"trivia": [
        {
            "id": t["id"],
            "category": t["category"],
            "question": t["question"],
            "options": t["options"],
            "buff": t["buff"],
        }
        for t in cyber_trivia.CYBER_TRIVIA
    ]}

@app.post("/api/trivia/verify")
async def verify_trivia_answer(req: TriviaAnswerRequest):
    for item in cyber_trivia.CYBER_TRIVIA:
        if item["id"] == req.question_id:
            is_correct = (item["correct"] == req.selected_option)
            return {
                "correct": is_correct,
                "correct_option": item["correct"],
                "explanation": item["explanation"],
                "buff": item["buff"] if is_correct else None
            }
    raise HTTPException(status_code=404, detail="Question not found")

@app.post("/api/matches/record")
async def record_match(req: MatchRecordRequest):
    """Persist a finished fight to the shared database (SQL) or local JSON fallback."""
    winner = req.winner.model_dump()
    loser = req.loser.model_dump()
    # The shared arena procs store monster names; map fighter character ids through.
    winner.setdefault("monster", {"name": winner.get("character") or "Tekken Fighter"})
    loser.setdefault("monster", {"name": loser.get("character") or "Tekken Fighter"})
    if sql_gateway is not None and sql_gateway.enabled:
        try:
            sql_gateway.record_arena_battle(
                match_id=req.match_id,
                winner=winner,
                loser=loser,
                winner_points=req.winner_points,
                loser_points=req.loser_points,
                is_pvp=req.is_pvp,
            )
            return {"persisted": "sql", "match_id": req.match_id}
        except RuntimeError as err:
            print(f"[SQL] Match record fell back to local JSON: {err}")
    entry = {
        "matchId": req.match_id,
        "winner": winner,
        "loser": loser,
        "winnerPoints": req.winner_points,
        "loserPoints": req.loser_points,
        "isPvp": req.is_pvp,
    }
    data = _append_local_result(entry)
    return {"persisted": "local", "match_id": req.match_id, "totalMatches": data["totalMatches"]}


@app.get("/api/scoreboard")
async def get_scoreboard(top: int = 10):
    """Shared leaderboard: SQL when configured, otherwise local fighting results."""
    if sql_gateway is not None and sql_gateway.enabled:
        players = sql_gateway.get_arena_leaderboard(top=top)
        if players is not None:
            return {
                "source": "sql",
                "players": players,
                "departments": sql_gateway.get_arena_departments() or [],
            }
    data = _load_local_results()
    return {
        "source": "local",
        "players": [],
        "departments": [],
        "matches": data.get("matches", [])[-top:],
        "totalMatches": data.get("totalMatches", 0),
    }


@app.get("/api/rooms")
async def list_rooms():
    active = []
    for rid, r in rooms.items():
        active.append({
            "room_id": rid,
            "players": (1 if r.p1_ws else 0) + (1 if r.p2_ws else 0),
            "state": r.state,
            "p1_char": r.p1_character,
            "p2_char": r.p2_character
        })
    return {"rooms": active}

# WebSocket for 1v1 PvP
@app.websocket("/ws/fight/{room_id}")
async def websocket_fight(websocket: WebSocket, room_id: str):
    await websocket.accept()
    if room_id not in rooms:
        rooms[room_id] = Room(room_id)
    room = rooms[room_id]

    role = "spectator"
    if room.p1_ws is None:
        room.p1_ws = websocket
        role = "p1"
    elif room.p2_ws is None:
        room.p2_ws = websocket
        role = "p2"
    else:
        room.spectators.append(websocket)
        role = "spectator"

    # Send Welcome Init Message
    await websocket.send_text(json.dumps({
        "type": "welcome",
        "role": role,
        "room_id": room_id,
        "p1_char": room.p1_character,
        "p2_char": room.p2_character,
        "stage": room.stage,
        "p1_connected": room.p1_ws is not None,
        "p2_connected": room.p2_ws is not None
    }))

    # Broadcast player joined
    await broadcast_room(room, {
        "type": "player_status",
        "p1_connected": room.p1_ws is not None,
        "p2_connected": room.p2_ws is not None
    })

    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "time": data.get("time")}))
                continue

            if msg_type == "select_character":
                char_id = data.get("character")
                if char_id not in ROSTER_IDS:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Unknown character: {char_id}",
                    }))
                    continue
                if role == "p1":
                    room.p1_character = char_id
                elif role == "p2":
                    room.p2_character = char_id
                await broadcast_room(room, {
                    "type": "character_updated",
                    "p1_char": room.p1_character,
                    "p2_char": room.p2_character
                })

            elif msg_type == "player_ready":
                is_ready = data.get("ready", True)
                if role == "p1":
                    room.p1_ready = is_ready
                elif role == "p2":
                    room.p2_ready = is_ready
                
                await broadcast_room(room, {
                    "type": "ready_state",
                    "p1_ready": room.p1_ready,
                    "p2_ready": room.p2_ready
                })

                if room.p1_ready and room.p2_ready:
                    room.state = "playing"
                    await broadcast_room(room, {
                        "type": "start_match",
                        "p1_char": room.p1_character,
                        "p2_char": room.p2_character,
                        "stage": room.stage
                    })

            elif msg_type in ("input", "state_update", "combat_event", "trivia_buff", "round_over", "match_over"):
                # Forward with sender role
                data["sender"] = role
                await broadcast_room(room, data, exclude=websocket)

            elif msg_type == "rematch":
                room.p1_ready = False
                room.p2_ready = False
                room.state = "lobby"
                await broadcast_room(room, {"type": "rematch_requested"})

    except WebSocketDisconnect:
        if websocket == room.p1_ws:
            room.p1_ws = None
            room.p1_ready = False
        elif websocket == room.p2_ws:
            room.p2_ws = None
            room.p2_ready = False
        elif websocket in room.spectators:
            room.spectators.remove(websocket)

        await broadcast_room(room, {
            "type": "player_status",
            "p1_connected": room.p1_ws is not None,
            "p2_connected": room.p2_ws is not None
        })
        
        # Clean up empty rooms
        if room.p1_ws is None and room.p2_ws is None and not room.spectators:
            rooms.pop(room_id, None)

async def broadcast_room(room: Room, message: dict, exclude: Optional[WebSocket] = None):
    targets = []
    if room.p1_ws and room.p1_ws != exclude:
        targets.append(room.p1_ws)
    if room.p2_ws and room.p2_ws != exclude:
        targets.append(room.p2_ws)
    for s in room.spectators:
        if s != exclude:
            targets.append(s)

    payload = json.dumps(message)
    for ws in targets:
        try:
            await ws.send_text(payload)
        except Exception:
            pass

# Mount static folder
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, reload=False)
