import os
from playwright.sync_api import sync_playwright

def verify():
    os.makedirs("/home/jules/verification", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1000, "height": 600})

        # 1. Main Menu Page
        page.goto("http://localhost:8000")
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/main_menu.png")

        # 2. Union Room Lobby
        page.click("#btn-mode-online")
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/union_room.png")

        # 3. Fight Screen
        page.click("button:has-text('LEAVE UNION ROOM')")
        page.wait_for_timeout(500)
        page.click("#btn-mode-bot")
        page.wait_for_timeout(500)
        page.click("#btn-start-fight")
        page.wait_for_timeout(3000)
        page.screenshot(path="/home/jules/verification/battle_screen.png")

        browser.close()

if __name__ == "__main__":
    verify()
