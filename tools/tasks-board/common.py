"""행사 업무 탭 보드 시안(tasks-board) 찍기·재기 공용: 주소, 폭, 저장 자리, 페이지 열기.
판 문서: notes/integration/tasks/board-board.md. 본보기: vada-proto-home/tools/home-c2."""

import argparse
import os
from pathlib import Path

PORT = os.environ.get("BOARD_PORT", "5294")
BASE = f"http://127.0.0.1:{PORT}/tasks-board.html"
SCREENS = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/tasks/board")
VIEW = {1920: (1920, 1032), 1280: (1280, 800), 390: (390, 844)}
VARIANTS = ["b1", "b2", "b3", "now"]
# 안마다 찍는 장: 세 폭 x main, 1280 x few·many·adding
CASES = [(1920, "main"), (1280, "main"), (390, "main"), (1280, "few"), (1280, "many"), (1280, "adding")]


def parse_args(desc):
    ap = argparse.ArgumentParser(description=desc)
    ap.add_argument("--variant", "-v", default="b1,b2,b3", help="쉼표로: b1,b2,b3")
    a, _ = ap.parse_known_args()
    a.variants = [v for v in a.variant.split(",") if v in VARIANTS]
    if not a.variants:
        ap.error(f"모르는 variant: {a.variant}")
    return a


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def open_page(browser, v, w, d):
    mobile = w == 390
    vw, vh = VIEW[w]
    page = browser.new_page(
        viewport={"width": vw, "height": vh},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=2 if mobile else 1,
    )
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(f"{BASE}?variant={v}&data={d}")
    page.wait_for_selector("[data-toolbar]", state="attached", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(250)
    return page, logs


def shot_path(v, w, d, suffix=""):
    """notes/integration/review/screens/tasks/board/b{N}/b{N}-{1920|1280|390}-{data}[-hover].png"""
    return SCREENS / v / f"{v}-{w}-{d}{suffix}.png"
