# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.49"]
# ///
"""Smoke the lab URL contract against localhost:3000."""

from __future__ import annotations

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000/lab/tien-gow"


def main() -> None:
    errors: list[str] = []
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(headless=True)
        except Exception:
            browser = playwright.chromium.launch(headless=True, channel="chrome")
        page = browser.new_page(viewport={"width": 1280, "height": 800})

        page.goto(f"{BASE}?god=1&seed=uat-3&banker=0", wait_until="networkidle")
        harness = page.locator(".tgw-harness").first
        harness.wait_for()
        if harness.get_attribute("data-lab-seed") != "uat-3":
            errors.append(f"seed chrome before deal: {harness.get_attribute('data-lab-seed')}")
        if harness.get_attribute("data-lab-play") != "live":
            errors.append("default play is not live")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        if page.locator(".tgw-seat.south .tgw-bone").count() != 8:
            errors.append(f"uat-3 south count {page.locator('.tgw-seat.south .tgw-bone').count()}")
        labels1 = page.locator(".tgw-seat.south .tgw-bone").all_inner_texts()
        page.reload(wait_until="networkidle")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        labels2 = page.locator(".tgw-seat.south .tgw-bone").all_inner_texts()
        if labels1 != labels2:
            errors.append(f"seed replay mismatch {labels1!r} vs {labels2!r}")

        page.goto(f"{BASE}?god=1&fixture=he-supreme&cpu=dump", wait_until="networkidle")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        harness = page.locator(".tgw-harness").first
        if harness.get_attribute("data-lab-fixture") != "he-supreme":
            errors.append("fixture chrome missing")
        if harness.get_attribute("data-lab-cpu") != "dump":
            errors.append("cpu=dump chrome missing")
        south = " ".join(page.locator(".tgw-seat.south .tgw-bone").all_inner_texts())
        if "么三" not in south or "大頭六" not in south:
            errors.append(f"he-supreme south {south!r}")
        if page.locator(".tgw-harness").nth(1).inner_text().find("例牌") != -1:
            errors.append("he-supreme Table should have 例牌 off")

        page.goto(f"{BASE}?god=1&fixture=example-yi-dian-hong", wait_until="networkidle")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        if not page.get_by_role("button", name="例牌開").is_visible():
            errors.append("例牌開 missing on example-yi-dian-hong")
        page.get_by_role("button", name="例牌開").click()
        page.wait_for_timeout(400)
        recap = page.locator(".tgw-recap").inner_text()
        if "一點紅" not in recap:
            errors.append(f"recap missing 一點紅: {recap!r}")

        page.goto(f"{BASE}?god=1&play=all&fixture=he-supreme", wait_until="networkidle")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        if page.locator("[data-lab-play=all]").count() == 0:
            errors.append("play=all chrome missing")

        page.goto(BASE, wait_until="networkidle")
        page.get_by_role("button", name="開牌").click()
        page.wait_for_timeout(400)
        if page.locator(".tgw-seat.east .tgw-bone.is-back").count() != 8:
            errors.append("default deal should hide 東 faces")
        if page.locator(".tgw-harness").first.get_attribute("data-lab-seed") != "lab":
            errors.append(f"unpinned first seed {page.locator('.tgw-harness').first.get_attribute('data-lab-seed')}")

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(f"{BASE}?god=1&seed=uat-3&banker=0", wait_until="networkidle")
        if not page.get_by_role("button", name="開牌").is_visible():
            errors.append("開牌 not visible on mobile")

        browser.close()

    if errors:
        print("FAIL")
        for error in errors:
            print("-", error)
        raise SystemExit(1)
    print("PASS lab URL contract")


if __name__ == "__main__":
    main()
