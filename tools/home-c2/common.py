"""c2(회장단 홈 ② 행사 구역) 찍기·측정·비교판 공용: 주소, 폭, 저장 자리, 페이지 열기.
c1r 도구(tools/home-c1r)와 따로 둔 까닭: 견본·K 기준·이름 규칙이 달라 한 도구에 모드를 더하면 갈래가 늘고,
c1r 도구는 ① 회차가 아직 쓰고 있다."""

import argparse
from pathlib import Path

BASE = "http://127.0.0.1:5291/home-s5.html?component=c2"
SCREENS = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home/c2")
# 컴포넌트 폭 -> 창 폭(바깥 여백 p-6 / 휴대폰 p-4). ①과 같다.
VIEW = {977: 1025, 716: 764, 358: 390}
VARIANTS = [f"e{n}" for n in range(1, 7)]
DATAS = ["main", "quiet", "one", "empty", "long"]
SCALE = 2


def parse_args(desc, extra=None):
    ap = argparse.ArgumentParser(
        description=desc, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument(
        "--variant", "-v", default="e1", help="쉼표로: e1..e6 (예: -v e1,e2)"
    )
    ap.add_argument(
        "--data",
        "-d",
        default=",".join(DATAS),
        help=f"쉼표로: {','.join(DATAS)} (기본 다섯 다)",
    )
    ap.add_argument(
        "--width", "-w", default="977,716,358", help="쉼표로: 977,716,358 (기본 셋 다)"
    )
    if extra:
        extra(ap)
    a = ap.parse_args()
    a.variants = [v for v in a.variant.split(",") if v in VARIANTS]
    if not a.variants:
        ap.error(f"모르는 variant: {a.variant}")
    a.widths = [int(w) for w in a.width.split(",") if int(w) in VIEW]
    datas = [d for d in a.data.split(",") if d in DATAS]
    if not a.widths or not datas:
        ap.error("폭이나 데이터가 비었다")
    a.cases = [(w, d) for d in datas for w in a.widths]
    return a


def open_page(browser, v, w, d):
    mobile = w == 358
    page = browser.new_page(
        viewport={"width": VIEW[w], "height": 900},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=SCALE,
    )
    logs = []
    page.on(
        "console",
        lambda m: logs.append(m.text) if m.type in ("warning", "error") else None,
    )
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(f"{BASE}&variant={v}&data={d}")
    page.wait_for_selector("[data-c2-root] > *", timeout=20000)
    # 진입 파일이 테마(base)를 건 뒤 html[data-theme-font]를 둔다. 글꼴까지 받은 뒤 찍는다.
    page.wait_for_selector("html[data-theme-font]", state="attached", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(300)
    return page, logs


def root_box(page):
    return page.evaluate(
        "(() => { const r = document.querySelector('[data-c2-root]').getBoundingClientRect();"
        " return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height } })()"
    )


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def shot_path(v, w, d, hover=False):
    """notes/integration/review/screens/home/c2/e{N}/c2-e{N}-{977|716|358}-{data}[-hover].png"""
    return SCREENS / v / f"c2-{v}-{w}-{d}{'-hover' if hover else ''}.png"
