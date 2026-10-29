"""c1r 찍기·측정 공용: 주소, 폭, 저장 자리, 페이지 열기."""
import argparse
from pathlib import Path

BASE = "http://127.0.0.1:5291/home-s5.html?component=c1r"
SCREENS = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home/c1r")
# 컴포넌트 폭 -> 창 폭(바깥 여백 p-6 / 휴대폰 p-4)
VIEW = {977: 1025, 716: 764, 358: 390}
VARIANTS = ["0", "1", "2", "3"]
DATAS = ["main", "many", "assign", "normal", "empty"]
# 기본 묶음: 3폭 x (main, normal, empty) + many 977 (명세·절차 8.4)
DEFAULT_DATA = ["main", "normal", "empty"]
SCALE = 2


def parse_args(desc, extra=None):
    ap = argparse.ArgumentParser(description=desc)
    ap.add_argument("--variant", "-v", default=",".join(VARIANTS), help="쉼표로: 0,1,2,3")
    ap.add_argument("--data", "-d", default=None, help=f"쉼표로: {','.join(DATAS)} (없으면 기본 묶음)")
    ap.add_argument("--width", "-w", default="977,716,358", help="쉼표로: 977,716,358")
    if extra:
        extra(ap)
    a = ap.parse_args()
    a.variants = [v for v in a.variant.split(",") if v in VARIANTS]
    a.widths = [int(w) for w in a.width.split(",") if int(w) in VIEW]
    if a.data:
        datas = [d for d in a.data.split(",") if d in DATAS]
        a.cases = [(w, d) for d in datas for w in a.widths]
    else:
        a.cases = [(w, d) for d in DEFAULT_DATA for w in a.widths]
        if 977 in a.widths:
            a.cases.append((977, "many"))
    return a


def open_page(browser, v, w, d):
    mobile = w == 358
    page = browser.new_page(
        viewport={"width": VIEW[w], "height": 900}, is_mobile=mobile, has_touch=mobile, device_scale_factor=SCALE
    )
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(f"{BASE}&variant={v}&data={d}")
    page.wait_for_selector("[data-c1r-root] > *", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return page, logs


def root_box(page):
    return page.evaluate(
        "(() => { const r = document.querySelector('[data-c1r-root]').getBoundingClientRect();"
        " return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } })()"
    )


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])
