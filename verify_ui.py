import os
import sys

def verify():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is not installed in the current environment.")
        print("To run UI verification tests, install playwright via: pip install playwright && playwright install chromium")
        return

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "verification")
    os.makedirs(output_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1000, "height": 600})

        # 1. Main Menu Page
        page.goto("http://localhost:8000")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(output_dir, "main_menu.png"))

        # 2. Union Room Lobby
        page.click("#btn-mode-online")
        page.wait_for_timeout(1000)
        page.screenshot(path=os.path.join(output_dir, "union_room.png"))

        # 3. Fight Screen
        page.click("button:has-text('LEAVE UNION ROOM')")
        page.wait_for_timeout(500)
        page.click("#btn-mode-bot")
        page.wait_for_timeout(500)
        page.click("#btn-start-fight")
        page.wait_for_timeout(3000)
        page.screenshot(path=os.path.join(output_dir, "battle_screen.png"))

        browser.close()
        print(f"UI verification screenshots saved successfully to {output_dir}")

if __name__ == "__main__":
    verify()
