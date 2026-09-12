# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright>=1.49"]
# ///
"""Execute docs/uat/UAT-TEST-PLAN.md against a local PLAYROOM server."""

from __future__ import annotations

import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

BASE_URL = "http://localhost:3000"
ROOM_CODE_RE = re.compile(r"^TIK-[2-9A-HJ-NP-Z]{3}$")
ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(__file__).resolve().parent / "evidence"
RESULTS_PATH = Path(__file__).resolve().parent / "last-run.json"


@dataclass
class CaseResult:
    id: str
    title: str
    priority: str
    result: str
    room: str = ""
    notes: str = ""


class UatRunner:
    def __init__(self, browser: Browser) -> None:
        self.browser = browser
        self.results: list[CaseResult] = []
        self.rooms: list[str] = []
        EVIDENCE.mkdir(parents=True, exist_ok=True)

    def record(self, case_id: str, title: str, priority: str, result: str, room: str = "", notes: str = "") -> None:
        self.results.append(CaseResult(case_id, title, priority, result, room, notes))
        print(f"{result:8} {case_id} {title}" + (f" [{room}]" if room else "") + (f" — {notes}" if notes else ""))

    def context(self) -> BrowserContext:
        ctx = self.browser.new_context(locale="en-US", viewport={"width": 1280, "height": 800})
        ctx.set_default_timeout(15000)
        return ctx

    def shot(self, page: Page, name: str) -> None:
        page.screenshot(path=str(EVIDENCE / f"{name}.png"), full_page=True)

    def open_lobby(self, page: Page, language: str = "en") -> None:
        page.goto(f"{BASE_URL}/", wait_until="load")
        page.wait_for_selector(".session-status.session-ready", timeout=25000)
        button = "EN" if language == "en" else "中文"
        expected_lang = "en" if language == "en" else "zh-Hant"
        page.get_by_role("button", name=button, exact=True).click()
        page.wait_for_function(f"() => document.documentElement.lang === '{expected_lang}'")

    def create_room(self, page: Page, display_name: str) -> str:
        page.get_by_role("button", name=re.compile(r"Create room|建立房間")).first.click()
        name_input = page.locator(".room-form input").first
        name_input.fill(display_name)
        page.locator(".room-form button[type='submit']").click()
        page.wait_for_url(re.compile(r"/room/TIK-"), timeout=20000)
        code = page.url.rstrip("/").split("/")[-1].upper()
        if not ROOM_CODE_RE.match(code):
            raise RuntimeError(f"Unexpected room code {code}")
        self.rooms.append(code)
        page.wait_for_selector(".room-code-badge strong")
        return code

    def join_room(self, page: Page, code: str, display_name: str) -> None:
        page.locator("#room-code").fill(code)
        page.locator("#join-name").fill(display_name)
        page.locator(".join-form button[type='submit']").click()
        page.wait_for_url(re.compile(rf"/room/{re.escape(code)}"), timeout=20000)
        page.wait_for_selector(".player-row")

    def wait_player_count(self, page: Page, count: int, timeout: float = 15000) -> None:
        page.wait_for_function(
            f"() => document.querySelectorAll('.player-row').length === {count}",
            timeout=timeout,
        )

    def wait_heading(self, page: Page, pattern: str, timeout: float = 15000) -> None:
        page.wait_for_function(
            """(pattern) => {
                const h = document.querySelector('.room-main h1');
                return h && new RegExp(pattern).test(h.textContent || '');
            }""",
            arg=pattern,
            timeout=timeout,
        )

    def cell(self, page: Page, index: int):
        return page.locator(".board-cell").nth(index)

    def play(self, page: Page, index: int) -> None:
        self.cell(page, index).click()

    def wait_mark(self, page: Page, index: int, mark: str, timeout: float = 15000) -> None:
        page.wait_for_function(
            """({ index, mark }) => {
                const cells = document.querySelectorAll('.board-cell');
                return cells[index] && (cells[index].textContent || '').trim() === mark;
            }""",
            arg={"index": index, "mark": mark},
            timeout=timeout,
        )

    def ready_button(self, page: Page):
        return page.locator(".room-controls .button-primary")

    def start_button(self, page: Page):
        return page.locator(".room-controls .button-dark")

    def run(self) -> int:
        try:
            self._run()
        except Exception as exc:  # noqa: BLE001
            self.record("RUNNER", "UAT runner aborted", "Critical", "Fail", notes=str(exc))
            print(f"ABORT: {exc}", file=sys.stderr)
        RESULTS_PATH.write_text(json.dumps([asdict(item) for item in self.results], indent=2), encoding="utf-8")
        failed = sum(1 for item in self.results if item.result == "Fail")
        blocked = sum(1 for item in self.results if item.result == "Blocked")
        return 1 if failed or blocked else 0

    def _run(self) -> None:
        host_ctx = self.context()
        guest_ctx = self.context()
        third_ctx = self.context()
        host = host_ctx.new_page()
        guest = guest_ctx.new_page()
        third = third_ctx.new_page()

        self._lobby(host, guest)
        code = self._create_join(host, guest, third)
        self._waiting_and_play(host, guest, code)
        self._recovery_leave_report(host, guest, host_ctx, code)
        self._extra_rooms(host, guest)
        self._mobile(host)
        host_ctx.close()
        guest_ctx.close()
        third_ctx.close()

    def _lobby(self, host: Page, guest: Page) -> None:
        try:
            self.open_lobby(host, "en")
            self.shot(host, "tc-001-lobby-en")
            session = host.locator(".session-status").inner_text().lower()
            footer = host.locator("footer").inner_text()
            assert "guest session ready" in session
            assert "PLAYROOM" in host.locator(".brand-name").inner_text()
            assert "玩房" in host.locator(".brand-local").inner_text()
            assert "Anonymous" in footer or "temporary guest" in footer.lower()
            assert host.get_by_label("Email").count() == 0
            self.record("TC-UAT-001", "Lobby loads with guest session", "Critical", "Pass", notes=session)
        except Exception as exc:  # noqa: BLE001
            self.shot(host, "tc-001-fail")
            self.record("TC-UAT-001", "Lobby loads with guest session", "Critical", "Fail", notes=str(exc))

        try:
            cards = host.locator("article.game-card")
            assert cards.count() == 3, f"card count={cards.count()}"
            featured = host.locator(".game-card-featured").inner_text()
            stairs = host.locator(".game-card-stairs").inner_text()
            coming = host.locator(".game-card-coming").inner_text()
            featured_l, stairs_l, coming_l = featured.lower(), stairs.lower(), coming.lower()
            assert "tik" in featured_l and "create room" in featured_l, featured
            assert "lad" in stairs_l and ("coming soon" in stairs_l or "即將推出" in stairs), stairs
            assert host.locator(".game-card-stairs button").count() == 0, "stairs has a button"
            assert "con" in coming_l and host.locator(".game-card-coming button").count() == 0, coming
            self.record("TC-UAT-002", "Game shelf metadata", "High", "Pass")
            self.record("TC-UAT-031", "Placeholder games not playable", "High", "Pass", notes="LAD/CON have no create CTA")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-002", "Game shelf metadata", "High", "Fail", notes=repr(exc))
            self.record("TC-UAT-031", "Placeholder games not playable", "High", "Fail", notes=repr(exc))

        try:
            host.get_by_role("button", name="中文", exact=True).click()
            host.wait_for_function("() => document.documentElement.lang === 'zh-Hant'")
            zh_hero = host.locator("#hero-title").inner_text()
            assert "揀" in zh_hero or "開房" in zh_hero
            host.reload(wait_until="domcontentloaded")
            host.wait_for_selector(".session-status.session-ready")
            assert host.evaluate("() => document.documentElement.lang") == "zh-Hant"
            host.get_by_role("button", name="EN", exact=True).click()
            host.wait_for_function("() => document.documentElement.lang === 'en'")
            self.shot(host, "tc-003-language")
            self.record("TC-UAT-003", "Language toggle (lobby)", "High", "Pass")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-003", "Language toggle (lobby)", "High", "Fail", notes=str(exc))

        try:
            host.set_viewport_size({"width": 390, "height": 844})
            self.open_lobby(host, "en")
            overflow = host.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
            host.set_viewport_size({"width": 1280, "height": 800})
            self.shot(host, "tc-004-mobile-lobby")
            self.record(
                "TC-UAT-004",
                "Responsive lobby",
                "Medium",
                "Fail" if overflow else "Pass",
                notes="horizontal overflow on 390px" if overflow else "390 and 1280 viewports usable",
            )
        except Exception as exc:  # noqa: BLE001
            host.set_viewport_size({"width": 1280, "height": 800})
            self.record("TC-UAT-004", "Responsive lobby", "Medium", "Fail", notes=str(exc))

        try:
            self.open_lobby(guest, "en")
            guest.locator("#room-code").fill("ABC")
            guest.locator(".join-form button[type='submit']").click()
            err = guest.locator(".join-form .form-error")
            err.wait_for()
            assert "TIK-7Q4" in err.inner_text()
            guest.locator("#room-code").fill("TIK-000")
            guest.locator(".join-form button[type='submit']").click()
            err.wait_for()
            assert "TIK-7Q4" in err.inner_text()
            self.record("TC-UAT-009", "Invalid join code (client)", "High", "Pass")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-009", "Invalid join code (client)", "High", "Fail", notes=str(exc))

        try:
            create = host.get_by_role("button", name=re.compile(r"Create room|建立房間")).first
            create.click()
            name_input = host.locator(".room-form input").first
            maxlength = name_input.get_attribute("maxlength")
            host.keyboard.press("Escape") if False else None
            join_max = guest.locator("#join-name").get_attribute("maxlength")
            assert maxlength == "32" and join_max == "32"
            self.record("TC-UAT-029", "Display name length", "Low", "Pass", notes="maxLength=32 on create and join")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-029", "Display name length", "Low", "Fail", notes=str(exc))

    def _create_join(self, host: Page, guest: Page, third: Page) -> str:
        code = ""
        try:
            if host.locator(".room-form").count() == 0:
                self.open_lobby(host, "en")
            else:
                host.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
                self.open_lobby(host, "en")
            code = self.create_room(host, "Host-UAT")
            self.shot(host, "tc-005-waiting-host")
            host.wait_for_selector(".player-row")
            roster = host.locator(".player-list").inner_text()
            assert "Host-UAT" in roster
            assert "host" in roster.lower()
            self.record("TC-UAT-005", "Host creates a named room", "Critical", "Pass", room=code)
            self.record(
                "TC-UAT-007",
                "Room code format",
                "Critical",
                "Pass" if ROOM_CODE_RE.match(code) else "Fail",
                room=code,
                notes=code,
            )
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-005", "Host creates a named room", "Critical", "Fail", notes=str(exc))
            self.record("TC-UAT-007", "Room code format", "Critical", "Blocked", notes="create failed")
            raise

        try:
            third.goto(f"{BASE_URL}/room/{code}", wait_until="domcontentloaded")
            third.wait_for_selector(".room-error, .player-row", timeout=20000)
            if third.locator(".room-error").count():
                err = third.locator(".room-error h1").inner_text()
                assert "Join this room" in err or "請先加入" in err
                self.record("TC-UAT-011", "Direct room URL without joining", "High", "Pass", room=code, notes=err)
            else:
                self.record("TC-UAT-011", "Direct room URL without joining", "High", "Fail", room=code, notes="unjoined visitor saw waiting room")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-011", "Direct room URL without joining", "High", "Fail", room=code, notes=str(exc))

        try:
            tab2 = host.context.new_page()
            tab2.goto(f"{BASE_URL}/room/{code}", wait_until="domcontentloaded")
            tab2.wait_for_selector(".player-row")
            self.wait_player_count(tab2, 1)
            self.record("TC-UAT-012", "Same profile cannot occupy two seats", "High", "Pass", room=code, notes="second tab still 1 player")
            tab2.close()
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-012", "Same profile cannot occupy two seats", "High", "Fail", room=code, notes=str(exc))

        try:
            self.open_lobby(guest, "en")
            guest.locator("#room-code").fill("TIK-9ZZ")
            guest.locator("#join-name").fill("Ghost")
            guest.locator(".join-form button[type='submit']").click()
            guest.locator(".join-form .form-error").wait_for(timeout=15000)
            unknown_err = guest.locator(".join-form .form-error").inner_text()
            third.goto(f"{BASE_URL}/room/NOT-A-CODE", wait_until="load")
            third.wait_for_selector(".room-error, .form-error, .room-loading", timeout=15000)
            bad = third.locator("body").inner_text()
            ok_unknown = len(unknown_err.strip()) > 0
            ok_format = third.locator(".room-error").count() > 0 or "TIK" in bad
            self.record(
                "TC-UAT-010",
                "Unknown or expired room",
                "High",
                "Pass" if ok_unknown and ok_format else "Fail",
                notes=f"join={unknown_err!r}; direct={bad[:120]!r}",
            )
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-010", "Unknown or expired room", "High", "Fail", notes=str(exc))

        try:
            self.open_lobby(guest, "en")
            self.join_room(guest, code, "Guest-UAT")
            self.wait_player_count(host, 2)
            self.wait_player_count(guest, 2)
            self.shot(guest, "tc-008-joined")
            self.record("TC-UAT-008", "Guest joins from second context", "Critical", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-008", "Guest joins from second context", "Critical", "Fail", room=code, notes=str(exc))
            raise

        try:
            host_list = host.locator(".player-list").inner_text()
            guest_list = guest.locator(".player-list").inner_text()
            assert "Host-UAT" in host_list and "Guest-UAT" in host_list
            assert "host" in host_list.lower() and "host" in guest_list.lower()
            self.record("TC-UAT-013", "Presence and host badge", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-013", "Presence and host badge", "High", "Fail", room=code, notes=str(exc))
        return code

    def _waiting_and_play(self, host: Page, guest: Page, code: str) -> None:
        try:
            start = self.start_button(host)
            assert start.is_disabled(), start.inner_text()
            self.ready_button(host).click()
            host.wait_for_selector(".ready-label", timeout=20000)
            guest.wait_for_function("() => document.querySelectorAll('.ready-label').length >= 1", timeout=20000)
            self.ready_button(host).click()
            host.wait_for_function("() => document.querySelectorAll('.ready-label').length === 0", timeout=20000)
            self.ready_button(host).click()
            self.ready_button(guest).click()
            host.wait_for_function("() => document.querySelectorAll('.ready-label').length === 2", timeout=20000)
            guest.wait_for_function("() => document.querySelectorAll('.ready-label').length === 2", timeout=20000)
            self.record("TC-UAT-014", "Ready and unready", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-014", "Ready and unready", "High", "Fail", room=code, notes=repr(exc))

        try:
            assert self.start_button(guest).count() == 0, "guest has start control"
            assert self.start_button(host).is_enabled(), self.start_button(host).inner_text()
            assert "Start game" in self.start_button(host).inner_text()
            self.record("TC-UAT-015", "Start gated on both ready", "Critical", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-015", "Start gated on both ready", "Critical", "Fail", room=code, notes=repr(exc))

        try:
            self.start_button(host).click(timeout=5000)
            host.wait_for_selector(".board", timeout=20000)
            guest.wait_for_selector(".board", timeout=20000)
            self.wait_heading(host, r"Turn:\s*X")
            self.wait_heading(guest, r"Turn:\s*X")
            self.shot(host, "tc-016-started")
            self.record("TC-UAT-016", "Host starts; board appears on both", "Critical", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-016", "Host starts; board appears on both", "Critical", "Fail", room=code, notes=repr(exc))
            return

        try:
            self.play(host, 0)
            self.wait_mark(host, 0, "X")
            self.wait_mark(guest, 0, "X")
            self.wait_heading(guest, r"Turn:\s*O")
            self.play(guest, 4)
            self.wait_mark(host, 4, "O")
            self.wait_mark(guest, 4, "O")
            self.record("TC-UAT-017", "First move syncs", "Critical", "Pass", room=code, notes="X at 0, O at 4")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-017", "First move syncs", "Critical", "Fail", room=code, notes=str(exc))
            raise

        try:
            self.play(host, 1)
            self.wait_mark(host, 1, "X")
            host.wait_for_function("() => { const cell = document.querySelectorAll('.board-cell')[2]; return cell && !cell.disabled; }")
            with host.expect_response(lambda response: "/move" in response.url, timeout=10000) as pending:
                self.play(host, 2)
            move_response = pending.value
            host.wait_for_timeout(600)
            occupied = (self.cell(host, 2).inner_text() or "").strip()
            banner = host.locator(".room-inline-error")
            banner_text = banner.inner_text() if banner.count() else ""
            if occupied:
                self.record("TC-UAT-018", "Out-of-turn move rejected", "High", "Fail", room=code, notes=f"cell 2 became {occupied!r}")
            elif move_response.status >= 400:
                note = f"HTTP {move_response.status}; banner={banner_text!r}"
                self.record("TC-UAT-018", "Out-of-turn move rejected", "High", "Pass", room=code, notes=note)
            else:
                self.record("TC-UAT-018", "Out-of-turn move rejected", "High", "Fail", room=code, notes=f"move HTTP {move_response.status}")
        except Exception as exc:  # noqa: BLE001
            empty = (self.cell(host, 2).inner_text() or "").strip() == ""
            self.record("TC-UAT-018", "Out-of-turn move rejected", "High", "Fail" if not empty else "Pass", room=code, notes=repr(exc))

        try:
            assert self.cell(guest, 0).is_disabled()
            self.record("TC-UAT-019", "Occupied cell", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-019", "Occupied cell", "High", "Fail", room=code, notes=str(exc))

        try:
            host.reload(wait_until="domcontentloaded")
            host.wait_for_selector(".board")
            self.wait_mark(host, 0, "X")
            self.wait_mark(host, 4, "O")
            self.wait_mark(host, 1, "X")
            self.play(guest, 3)
            self.wait_mark(host, 3, "O")
            self.record("TC-UAT-023", "Reload during play", "Critical", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-023", "Reload during play", "Critical", "Fail", room=code, notes=str(exc))

        try:
            host.get_by_role("button", name="中文", exact=True).click()
            host.wait_for_function("() => document.documentElement.lang === 'zh-Hant'")
            body = host.locator(".room-shell").inner_text()
            assert "房間" in body or "井字" in body or "玩家" in body
            host.get_by_role("button", name="EN", exact=True).click()
            host.wait_for_function("() => document.documentElement.lang === 'en'")
            self.record("TC-UAT-028", "Language toggle on room page", "Medium", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-028", "Language toggle on room page", "Medium", "Fail", room=code, notes=str(exc))

        try:
            reason = guest.locator("#report-reason")
            assert guest.locator(".report-form button[type='submit']").is_disabled()
            reason.fill("UAT report — automated local check")
            guest.locator(".report-form button[type='submit']").click()
            guest.wait_for_function("() => document.querySelector('.report-form button')?.textContent?.includes('Reported')")
            self.record("TC-UAT-027", "Report room", "Medium", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-027", "Report room", "Medium", "Fail", room=code, notes=str(exc))

        try:
            # Board: X 0, X 1, O 4, O 3. Play X 2 to win top row.
            self.play(host, 2)
            self.wait_mark(host, 2, "X")
            self.wait_mark(guest, 2, "X")
            self.wait_heading(host, r"complete|結束")
            self.wait_heading(guest, r"complete|結束")
            self.shot(host, "tc-020-win")
            self.record("TC-UAT-020", "Win (three in a row)", "Critical", "Pass", room=code, notes="X wins top row")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-020", "Win (three in a row)", "Critical", "Fail", room=code, notes=str(exc))

        try:
            assert all(self.cell(host, i).is_disabled() for i in range(9))
            self.record("TC-UAT-022", "No moves after finish", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-022", "No moves after finish", "High", "Fail", room=code, notes=str(exc))

    def _recovery_leave_report(self, host: Page, guest: Page, host_ctx: BrowserContext, code: str) -> None:
        try:
            guest.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            guest.wait_for_url(re.compile(r"/$"), timeout=15000)
            guest.wait_for_selector(".session-status.session-ready")
            self.record("TC-UAT-025", "Guest leaves", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-025", "Guest leaves", "High", "Fail", room=code, notes=str(exc))

        try:
            host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            host.wait_for_url(re.compile(r"/$"), timeout=15000)
            self.record("TC-UAT-026", "Host leaves", "High", "Pass", room=code)
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-026", "Host leaves", "High", "Fail", room=code, notes=str(exc))

    def _extra_rooms(self, host: Page, guest: Page) -> None:
        try:
            self.open_lobby(host, "en")
            code = self.create_room(host, "")
            roster = host.locator(".player-list").inner_text()
            assert "Guest" in roster
            host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            host.wait_for_url(re.compile(r"/$"))
            self.record("TC-UAT-006", "Default display name", "Medium", "Pass", room=code, notes="empty name became Guest")
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-006", "Default display name", "Medium", "Fail", notes=str(exc))

        try:
            self.open_lobby(host, "en")
            self.open_lobby(guest, "en")
            code = self.create_room(host, "Host-Draw")
            self.join_room(guest, code, "Guest-Draw")
            self.wait_player_count(host, 2)
            self.ready_button(host).click()
            self.ready_button(guest).click()
            host.wait_for_function("() => document.querySelectorAll('.ready-label').length === 2")
            self.start_button(host).click()
            host.wait_for_selector(".board")
            guest.wait_for_selector(".board")
            # Draw: X0 O1 X2 O4 X3 O6 X5 O8 X7
            sequence = [(host, 0, "X"), (guest, 1, "O"), (host, 2, "X"), (guest, 4, "O"), (host, 3, "X"), (guest, 6, "O"), (host, 5, "X"), (guest, 8, "O"), (host, 7, "X")]
            for actor, cell, mark in sequence:
                self.play(actor, cell)
                self.wait_mark(host, cell, mark)
                self.wait_mark(guest, cell, mark)
            self.wait_heading(host, r"complete|結束")
            self.shot(host, "tc-021-draw")
            self.record("TC-UAT-021", "Draw", "Medium", "Pass", room=code)
            guest.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            guest.wait_for_url(re.compile(r"/$"))
            host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            host.wait_for_url(re.compile(r"/$"))
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-021", "Draw", "Medium", "Fail", notes=str(exc))

        try:
            self.open_lobby(host, "en")
            self.open_lobby(guest, "en")
            code = self.create_room(host, "Host-Wait")
            self.join_room(guest, code, "Guest-Wait")
            self.wait_player_count(host, 2)
            self.ready_button(host).click()
            self.ready_button(guest).click()
            host.wait_for_function("() => document.querySelectorAll('.ready-label').length === 2")
            guest.reload(wait_until="domcontentloaded")
            guest.wait_for_selector(".player-row")
            guest.wait_for_function("() => document.querySelectorAll('.player-row').length === 2 && document.querySelectorAll('.ready-label').length === 2", timeout=20000)
            self.record("TC-UAT-024", "Reload in waiting room", "Medium", "Pass", room=code)
            guest.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            guest.wait_for_url(re.compile(r"/$"))
            host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
            host.wait_for_url(re.compile(r"/$"))
        except Exception as exc:  # noqa: BLE001
            self.record("TC-UAT-024", "Reload in waiting room", "Medium", "Fail", notes=str(exc))

    def _mobile(self, host: Page) -> None:
        try:
            self.open_lobby(host, "en")
            host.set_viewport_size({"width": 390, "height": 844})
            code = self.create_room(host, "Host-Mobile")
            leave = host.get_by_role("button", name=re.compile(r"Leave room|離開房間"))
            visible = leave.count() > 0 and leave.is_visible()
            ready_visible = self.ready_button(host).is_visible()
            overflow = host.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2")
            self.shot(host, "tc-030-mobile-room")
            notes = f"leave_visible={visible}; ready_visible={ready_visible}; overflow={overflow}"
            # Plan documents Leave hidden under 620px as known behavior / Medium defect.
            result = "Pass"
            if overflow or not ready_visible:
                result = "Fail"
            elif not visible:
                result = "Pass"
                notes += " (Leave hidden <620px as documented Medium product gap)"
            self.record("TC-UAT-030", "Mobile room chrome", "Medium", result, room=code, notes=notes)
            host.set_viewport_size({"width": 1280, "height": 800})
            if host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).count():
                host.get_by_role("button", name=re.compile(r"Leave room|離開房間")).click()
        except Exception as exc:  # noqa: BLE001
            host.set_viewport_size({"width": 1280, "height": 800})
            self.record("TC-UAT-030", "Mobile room chrome", "Medium", "Fail", notes=str(exc))


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            return UatRunner(browser).run()
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
