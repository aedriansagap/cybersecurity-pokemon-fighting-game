import json
import unittest
from fastapi.testclient import TestClient
from server import app, ROSTER
import cyber_trivia

class TestCyberMonServer(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("CyberMon", data["game"])

    def test_roster_endpoint(self):
        res = self.client.get("/api/roster")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("roster", data)
        self.assertGreaterEqual(len(data["roster"]), 6)
        
        char_ids = [c["id"] for c in data["roster"]]
        self.assertIn("lucario", char_ids)
        self.assertIn("gengar", char_ids)
        self.assertIn("scizor", char_ids)
        self.assertIn("mewtwo", char_ids)

    def test_trivia_random(self):
        res = self.client.get("/api/trivia/random")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("question", data)
        self.assertIn("options", data)
        self.assertEqual(len(data["options"]), 4)
        self.assertIn("buff", data)

    def test_trivia_verification(self):
        correct_opt = cyber_trivia.CYBER_TRIVIA[0]["correct"]
        
        # Test correct answer
        res_correct = self.client.post("/api/trivia/verify", json={
            "question_id": 1,
            "selected_option": correct_opt
        })
        self.assertEqual(res_correct.status_code, 200)
        self.assertTrue(res_correct.json()["correct"])
        self.assertIsNotNone(res_correct.json()["buff"])

        # Test incorrect answer
        wrong_opt = (correct_opt + 1) % 4
        res_wrong = self.client.post("/api/trivia/verify", json={
            "question_id": 1,
            "selected_option": wrong_opt
        })
        self.assertEqual(res_wrong.status_code, 200)
        self.assertFalse(res_wrong.json()["correct"])

    def test_websocket_fight_room(self):
        room_id = "test-room-999"
        with self.client.websocket_connect(f"/ws/fight/{room_id}") as ws1:
            welcome1 = ws1.receive_json()
            self.assertEqual(welcome1["type"], "welcome")
            self.assertEqual(welcome1["role"], "p1")
            status1 = ws1.receive_json()
            self.assertEqual(status1["type"], "player_status")

            with self.client.websocket_connect(f"/ws/fight/{room_id}") as ws2:
                welcome2 = ws2.receive_json()
                self.assertEqual(welcome2["type"], "welcome")
                self.assertEqual(welcome2["role"], "p2")
                status2 = ws2.receive_json()
                self.assertEqual(status2["type"], "player_status")

                # Test input exchange
                ws1.send_json({"type": "input", "inputs": {"attack": "1"}})
                received_by_ws2 = ws2.receive_json()
                self.assertEqual(received_by_ws2["type"], "input")
                self.assertEqual(received_by_ws2["sender"], "p1")

    def test_trivia_all_hides_answers(self):
        res = self.client.get("/api/trivia/all")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("trivia", data)
        self.assertGreater(len(data["trivia"]), 0)
        for item in data["trivia"]:
            self.assertNotIn("correct", item)
            self.assertIn("question", item)
            self.assertIn("options", item)

    def test_health_reports_sql_status(self):
        res = self.client.get("/api/health")
        data = res.json()
        self.assertIn("sql", data)
        self.assertIn("enabled", data["sql"])
        # Diagnostics must never expose credentials
        self.assertNotIn("password", json.dumps(data["sql"]).lower().replace("passwordconfigured", ""))

    def test_scoreboard_local_fallback(self):
        res = self.client.get("/api/scoreboard")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("source", data)
        self.assertIn(data["source"], ("sql", "local"))

    def test_record_match_local_fallback(self):
        res = self.client.post("/api/matches/record", json={
            "match_id": "test-match-1",
            "winner": {"name": "Alice", "dept": "HR", "character": "lucario"},
            "loser": {"name": "Bob", "dept": "Sales", "character": "gengar"},
            "winner_points": 100,
            "loser_points": 25,
            "is_pvp": True,
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn(data["persisted"], ("sql", "local"))
        self.assertEqual(data["match_id"], "test-match-1")

    def test_select_unknown_character_rejected(self):
        room_id = "test-room-badchar"
        with self.client.websocket_connect(f"/ws/fight/{room_id}") as ws:
            ws.receive_json()  # welcome
            ws.receive_json()  # player_status
            ws.send_json({"type": "select_character", "character": "missingno"})
            err = ws.receive_json()
            self.assertEqual(err["type"], "error")

    def test_profile_verify_local_fallback(self):
        # No DB configured in this environment -> local profile echo.
        res = self.client.post("/api/profile/verify", json={
            "emp_id": "10234",
            "name": "Alice",
            "dept": "HR",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["empId"], "10234")
        self.assertEqual(data["name"], "Alice")
        self.assertEqual(data["dept"], "HR")
        self.assertFalse(data["validated"])
        self.assertEqual(data["source"], "local")

    def test_scoreboard_page(self):
        res = self.client.get("/scoreboard")
        self.assertEqual(res.status_code, 200)
        self.assertIn("SCOREBOARD", res.text)

    def test_index_page(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("CYBER", res.text)
        self.assertIn("MON", res.text)
        self.assertIn("menu-trainer-record", res.text)
        self.assertIn("pause-modal", res.text)
        # Arena-style lobby
        self.assertIn("CHOOSE YOUR BATTLE", res.text)
        self.assertIn("lobby-recent-list", res.text)
        self.assertIn("Hall of Fame", res.text)
        self.assertIn("HOW A MATCH WORKS", res.text)

    def test_audio_assets(self):
        # Verify cries and BGM files are served
        res_cry = self.client.get("/static/assets/audio/lucario_cry.mp3")
        self.assertEqual(res_cry.status_code, 200)
        self.assertGreater(len(res_cry.content), 1000)

        res_bgm = self.client.get("/static/assets/audio/bw2-kanto-gym-leader.mp3")
        self.assertEqual(res_bgm.status_code, 200)
        self.assertGreater(len(res_bgm.content), 50000)

if __name__ == "__main__":
    unittest.main()
