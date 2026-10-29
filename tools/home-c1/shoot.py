"""C1 컴포넌트 찍기. 사용: python -X utf8 shoot.py [거르기]"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ONLY = sys.argv[1] if len(sys.argv) > 1 else None
BASE = "http://127.0.0.1:5291/home-s5.html?component=c1"
OUT = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home/c1")
OUT.mkdir(parents=True, exist_ok=True)
VIEW = {977: 1025, 716: 764, 390: 390}

def shoot(browser, v, w, d, hover=False):
    mobile = w == 390
    page = browser.new_page(viewport={"width": VIEW[w], "height": 600}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
    logs = []
    page.on("console", lambda m: logs.append(m.text) if m.type in ("warning", "error") else None)
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(f"{BASE}&variant={v}&data={d}")
    page.wait_for_selector("[data-c1-root] section", timeout=20000)
    page.wait_for_timeout(500)
    name = f"c1-{v}-{w}-{d}{'-hover' if hover else ''}"
    if hover:
        target = page.locator("[data-c1-root] li").first
        if v == "B":
            target = target.get_by_role("button", name="묻기")
        target.hover()
        page.wait_for_timeout(250)
    root = page.locator("main")
    h = page.evaluate("document.querySelector('[data-c1-root]').getBoundingClientRect().bottom")
    pad = 16 if mobile else 24
    page.screenshot(path=str(OUT / f"{name}.png"), clip={"x": 0, "y": 0, "width": VIEW[w], "height": h + pad}, full_page=True)
    print(name, "logs", logs[:3])
    page.close()

with sync_playwright() as p:
    b = p.chromium.launch(args=["--disable-lcd-text", "--force-color-profile=srgb"])
    for v in "AB":
        for w in (977, 716, 390):
            for d in ("main", "many", "normal", "assign"):
                if ONLY and ONLY not in f"{v}-{w}-{d}":
                    continue
                shoot(b, v, w, d)
        if not ONLY or ONLY in f"{v}-977-main-hover":
            shoot(b, v, 977, "main", hover=True)
    b.close()
