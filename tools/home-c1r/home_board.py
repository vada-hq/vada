"""실제 회장단 홈(작업 공간째)을 두 테마로 찍어 나란히 놓는다.
사용: python -X utf8 -W ignore tools/home-c1r/home_board.py [-t base,b] [--labels 지금,가] [--no-shoot]
- 주소: /home-s5.html?component=home&theme=…  (부품 갤러리 견본 데이터, 시안 덮개 없음)
- 낱장: notes/integration/review/screens/visual/home/home-{테마}-{1280|390}.png
    1280: 창 1280 페이지 전체 길이. 390: 휴대폰(터치) 첫 화면 390x844(아래 탭 포함)
- 판: notes/integration/review/screens/visual/home-now-vs-ga.png — 열 = 테마, 1280 위 / 390 아래."""

import sys
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, THEMES, launch, theme_ready

VISUAL = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/visual")
SHOTS = VISUAL / "home"
URL = "http://127.0.0.1:5291/home-s5.html?component=home&theme={}"
VIEWS = {1280: (1280, 900, False), 390: (390, 844, True)}
M, GAP, HEAD = 40, 56, 70
F = lambda s, b=False: ImageFont.truetype(
    "C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s
)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"


def shoot(browser, theme, w):
    vw, vh, mobile = VIEWS[w]
    page = browser.new_page(
        viewport={"width": vw, "height": vh},
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
    page.goto(URL.format(theme))
    page.wait_for_selector("h1, h2", timeout=20000)
    theme_ready(page)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)
    out = SHOTS / f"home-{theme}-{w}.png"
    page.screenshot(path=str(out), full_page=not mobile)
    print(out.name + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def half(path):
    img = Image.open(path).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def compose(themes, labels, out):
    big = [half(SHOTS / f"home-{t}-1280.png") for t in themes]
    small = [half(SHOTS / f"home-{t}-390.png") for t in themes]
    cw = max(i.width for i in big)
    top, bot = max(i.height for i in big), max(i.height for i in small)
    W = 2 * M + len(themes) * cw + (len(themes) - 1) * GAP
    H = M + HEAD + 24 + top + 48 + 24 + bot + M
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, label in enumerate(labels):
        x = M + i * (cw + GAP)
        d.text((x, M), label, font=F(40, True), fill=INK)
        y = M + HEAD
        d.text((x, y), "1280", font=F(16), fill=SUB)
        img.paste(big[i], (x, y + 24))
        y += 24 + top + 48
        d.text((x, y), "390", font=F(16), fill=SUB)
        img.paste(small[i], (x, y + 24))
        d.rectangle(
            (x, y + 24, x + small[i].width - 1, y + 24 + small[i].height - 1),
            outline=LINE,
        )
        if i:
            d.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    img.save(out)
    print(out, img.size)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--themes", "-t", default="base,b")
    ap.add_argument(
        "--labels", default="지금,가", help="판에 쓸 열 이름(테마 차례대로)"
    )
    ap.add_argument("--no-shoot", action="store_true")
    ap.add_argument("--out", default=str(VISUAL / "home-now-vs-ga.png"))
    a = ap.parse_args()
    themes = [t for t in a.themes.split(",") if t in THEMES]
    labels = a.labels.split(",")
    SHOTS.mkdir(parents=True, exist_ok=True)
    if not a.no_shoot:
        with sync_playwright() as p:
            b = launch(p)
            for t in themes:
                for w in VIEWS:
                    shoot(b, t, w)
            b.close()
    compose(themes, labels, Path(a.out))


if __name__ == "__main__":
    main()
