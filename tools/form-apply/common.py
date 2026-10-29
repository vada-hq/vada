"""신청자 화면 시안(form-apply) 찍기·측정·비교판 공용: 주소, 폭, 견본, 저장 자리, 페이지 열기.
판 문서: C:/Users/82108/vada-hq/notes/integration/events/form-apply-board.md"""

import argparse
from pathlib import Path

BASE = "http://127.0.0.1:5292/form-apply.html"
SCREENS = Path(
    "C:/Users/82108/vada-hq/notes/integration/review/screens/events/form-apply"
)
VARIANTS = ["v0", "v1", "v2", "v3"]
# 화면마다 쓰는 견본(기본으로 다 찍는 것). closed 화면의 견본은 받지 않는 까닭이다.
SCREEN_DATA = {
    "apply": ["main", "free", "long"],
    "done": ["main", "free", "long", "dayof"],
    "closed": ["full", "before", "paused", "ended", "cancelled", "moved"],
}
# 화면 폭 -> 창 높이. 390은 휴대폰(터치, pointer: coarse, hover 없음)으로 연다.
VIEW = {390: 844, 1280: 800}
PHONE = 390
SCALE = 2
FIRST_SCREEN = 700  # 내용 ①: 휴대폰 첫 화면(390 x ~700) 안에 첫 입력 칸


def parse_args(desc, extra=None):
    ap = argparse.ArgumentParser(
        description=desc, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--variant", "-v", default="v0", help="쉼표로: v0..v3")
    ap.add_argument(
        "--screen", "-s", default="apply,done,closed", help="쉼표로: apply,done,closed"
    )
    ap.add_argument(
        "--data",
        "-d",
        default="",
        help="쉼표로 견본(비우면 화면마다 기본 전부). 그 화면에 없는 견본은 건너뛴다",
    )
    ap.add_argument("--width", "-w", default="390,1280", help="쉼표로: 390,1280")
    ap.add_argument(
        "--state", default="idle", help="idle|busy|problem (apply 화면의 버튼 상태)"
    )
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


def url(v, s, d, state="idle"):
    extra = f"&state={state}" if state != "idle" else ""
    return f"{BASE}?variant={v}&screen={s}&data={d}{extra}"


def open_page(browser, v, s, d, w, state="idle"):
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
    page.goto(url(v, s, d, state))
    page.wait_for_selector("[data-form-root] > *", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return page, logs


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def shot_path(v, s, d, w):
    """notes/integration/review/screens/events/form-apply/<v>/<v>-<screen>-<data>-<폭>.png"""
    return SCREENS / v / f"{v}-{s}-{d}-{w}.png"
