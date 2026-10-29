"""c35(회장단 홈 ③ 내가 할 일, ⑤ 이번 주, 사용 가능 한 줄) 찍기·측정·판 공용: 주소, 폭, 저장 자리, 페이지 열기.
tools/home-c2를 본떴다. 갈래가 변형(e1..e6) 대신 부분(todo·week·available) × 안(a·b)이라 따로 둔다."""

import argparse
from pathlib import Path

BASE = "http://127.0.0.1:5291/home-s5.html?component=c35"
SCREENS = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home/c35")
# 컴포넌트 폭 -> 창 폭(바깥 여백 p-6 / 휴대폰 p-4). ①②와 같다.
VIEW = {977: 1025, 716: 764, 358: 390}
# 부분 -> 안. ③은 한 안(a).
PARTS = {"todo": ["a"], "week": ["a", "b"], "available": ["a", "b"]}
DATAS = ["main", "normal", "empty"]
SCALE = 2


def parse_args(desc, extra=None):
    ap = argparse.ArgumentParser(
        description=desc, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--part", "-p", default="todo,week,available", help="쉼표로: todo,week,available")
    ap.add_argument("--data", "-d", default=",".join(DATAS), help="쉼표로: main,normal,empty")
    ap.add_argument("--width", "-w", default="977,716,358", help="쉼표로: 977,716,358")
    if extra:
        extra(ap)
    a = ap.parse_args()
    parts = [p for p in a.part.split(",") if p in PARTS]
    a.widths = [int(w) for w in a.width.split(",") if int(w) in VIEW]
    datas = [d for d in a.data.split(",") if d in DATAS]
    if not parts or not a.widths or not datas:
        ap.error("부분·폭·데이터가 비었다")
    a.pvs = [(p, v) for p in parts for v in PARTS[p]]
    a.cases = [(w, d) for d in datas for w in a.widths]
    return a


def open_page(browser, query, w):
    mobile = w == 358
    page = browser.new_page(
        viewport={"width": VIEW[w], "height": 900},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=SCALE,
    )
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(f"{BASE}&{query}")
    page.wait_for_selector("[data-c35-root]", state="attached", timeout=20000)
    page.wait_for_selector("html[data-theme-font]", state="attached", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return page, logs


def root_box(page):
    return page.evaluate(
        "(() => { const r = document.querySelector('[data-c35-root]').getBoundingClientRect();"
        " return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } })()"
    )


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def query(part, v, d):
    return f"part={part}&variant={v}&data={d}"


def shot_path(part, v, w, d):
    """screens/home/c35/{part}/c35-{part}-{a|b}-{977|716|358}-{data}.png"""
    return SCREENS / part / f"c35-{part}-{v}-{w}-{d}.png"
