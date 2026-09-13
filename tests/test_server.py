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

    def test_index_page(self):
        res = self.client.get("/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("CyberMon: Tekken Protocol", res.text)

if __name__ == "__main__":
    unittest.main()
