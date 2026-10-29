"""회장단 홈 배치 시안(layout) 찍기·측정·판 공용: 주소, 창, 저장 자리, 페이지 열기.
주소: /home-s5.html?component=layout&variant=L1|L2|L3&day=busy|quiet|first&week=a|b[&greet=line|date|merge]
실제 앱 셸(옆 메뉴·머리·휴대폰 아래 탭)째 띄운다. 창 1280·1024는 높이 900, 390은 휴대폰(터치) 390x844."""

from pathlib import Path

BASE = "http://127.0.0.1:5291/home-s5.html?component=layout"
SCREENS = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home/layout")
PLANS = ["L1", "L2", "L3"]
DAYS = ["busy", "quiet", "first"]
DAY_NAME = {"busy": "신호 많은 날", "quiet": "평소", "first": "첫날"}
# 창 폭 -> (높이, 휴대폰)
VIEW = {1280: (900, False), 1024: (900, False), 390: (844, True)}
SCALE = 2


def launch(p):
    return p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])


def url(plan, day, week="a", greet=None):
    return f"{BASE}&variant={plan}&day={day}&week={week}" + (f"&greet={greet}" if greet else "")


def open_page(browser, plan, day, w, week="a", greet=None, scale=SCALE):
    h, mobile = VIEW[w]
    page = browser.new_page(
        viewport={"width": w, "height": h},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=scale,
    )
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(url(plan, day, week, greet))
    page.wait_for_selector("[data-layout-root]", timeout=20000)
    page.wait_for_selector("html[data-theme-font]", state="attached", timeout=20000)
    page.evaluate("document.fonts.ready")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)
    return page, logs


def shot_path(plan, day, w, week="a"):
    """screens/home/layout/shots/layout-{L1}-{day}-{w}[-wb].png (390은 첫 화면, 넓은 창은 페이지 전체)"""
    tail = "-wb" if week == "b" else ""
    return SCREENS / "shots" / f"layout-{plan}-{day}-{w}{tail}.png"
