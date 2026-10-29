"""양식 만들기 화면 시안(form-builder) 찍기·측정·비교판 공용: 주소, 폭, 견본, 저장 자리, 페이지 열기.
판 문서: C:/Users/82108/vada-hq/notes/integration/events/form-builder-board.md"""

import argparse
from pathlib import Path

BASE = "http://127.0.0.1:5292/form-builder.html"
SCREENS = Path(
    "C:/Users/82108/vada-hq/notes/integration/review/screens/events/form-builder"
)
VARIANTS = ["v0", "v1", "v2", "v3"]
# 화면마다 쓰는 견본(기본으로 다 찍는 것). 첫째가 그 화면의 기본값이다(builder-data.ts SCREEN_DATA와 같다).
SCREEN_DATA = {
    "card": ["active", "draft", "ready", "paused", "ended", "multi"],
    "editor": ["new", "filled", "locked", "error"],
    "empty": ["none"],
}
# 화면 폭 -> 창 높이. 운영진은 데스크탑이 주인공이라 1280이 먼저다. 390은 휴대폰(터치, pointer: coarse)으로 연다.
VIEW = {1280: 800, 390: 844}
PHONE = 390
DESK = 1280
SCALE = 2


def parse_args(desc, extra=None):
    ap = argparse.ArgumentParser(
        description=desc, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--variant", "-v", default="v0", help="쉼표로: v0..v3")
    ap.add_argument(
        "--screen", "-s", default="card,editor,empty", help="쉼표로: card,editor,empty"
    )
    ap.add_argument(
        "--data",
        "-d",
        default="",
        help="쉼표로 견본(비우면 화면마다 기본 전부). 그 화면에 없는 견본은 건너뛴다",
    )
    ap.add_argument("--width", "-w", default="1280,390", help="쉼표로: 1280,390")
    if extra:
        extra(ap)
    a = ap.parse_args()
    a.variants = [v for v in a.variant.split(",") if v in VARIANTS]
    if not a.variants:
        ap.error(f"모르는 variant: {a.variant}")
    screens = [s for s in a.screen.split(",") if s in SCREEN_DATA]
    a.widths = [int(w) for w in a.width.split(",") if w.strip().isdigit() and int(w) in VIEW]
    wanted = [d for d in a.data.split(",") if d]
    a.cases = [
        (s, d, w)
        for s in screens
        for d in SCREEN_DATA[s]
        if not wanted or d in wanted
        for w in a.widths
    ]
    if not a.cases:
        ap.error("찍을 묶음이 없다(화면·견본·폭을 확인)")
    return a


def url(v, s, d):
    return f"{BASE}?variant={v}&screen={s}&data={d}"


def open_page(browser, v, s, d, w):
    phone = w == PHONE
    page = browser.new_page(
        viewport={"width": w, "height": VIEW[w]},
        is_mobile=phone,
        has_touch=phone,
        device_scale_factor=SCALE,
    )
    logs = []
    page.on(
        "console",
        lambda m: logs.append(m.text) if m.type in ("warning", "error") else None,
    )
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(url(v, s, d))
    page.wait_for_selector("[data-form-content] > *", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return page, logs


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def shot_path(v, s, d, w):
    """notes/integration/review/screens/events/form-builder/<v>/<v>-<screen>-<data>-<폭>.png"""
    return SCREENS / v / f"{v}-{s}-{d}-{w}.png"
