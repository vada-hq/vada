"""테마 비교판: 테마마다 스타일 타일(창 1280 전체)과 ① v3·v1을 찍고, 대표가 볼 비교판 한 장을 만든다.
사용: python -X utf8 -W ignore tools/home-c1r/theme_board.py [-t a,b,c] [--no-shoot] [--out 파일.png]
- 찍기(낱장): notes/integration/review/screens/visual/tiles/
    tile-{테마}.png              /home-s5.html?component=tile&theme=…  창 1280, 페이지 전체
    c1r-v{3|1}-{977|358}-{테마}.png  ① main, 컴포넌트 상자 + 둘레 8px(shoot.py와 같은 자르기)
- 비교판: notes/integration/review/screens/visual/tiles-compare.png
    열 = 고른 테마 차례(이름은 가·나·다…, 갈래 이름은 판에 쓰지 않는다), 행 = v3 977 / v1 977 / v3 390.
--no-shoot: 이미 찍은 낱장으로 판만 다시 만든다."""

import sys
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, THEMES, launch, open_page, root_box, theme_ready

VISUAL = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/visual")
TILES = VISUAL / "tiles"
TILE_URL = "http://127.0.0.1:5291/home-s5.html?component=tile&theme={}"
TILE_VIEW = 1280
PAD = 8  # shoot.py의 둘레 여백(CSS px)
ROWS = [("3", 977, "v3 977"), ("1", 977, "v1 977"), ("3", 358, "v3 390")]
LABEL = {
    "base": "기준",
    "a": "가",
    "b": "나",
    "c": "다",
}  # apps/web/src/home/c1r/themes/theme.ts THEME_LABEL과 같다
M, GAP, HEAD, ROW_GAP = 40, 48, 70, 36
F = lambda s, b=False: ImageFont.truetype(
    "C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s
)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"


def shoot_tile(browser, theme):
    page = browser.new_page(
        viewport={"width": TILE_VIEW, "height": 900}, device_scale_factor=SCALE
    )
    logs = []
    page.on(
        "console",
        lambda m: logs.append(m.text) if m.type in ("warning", "error") else None,
    )
    page.on("pageerror", lambda e: logs.append(str(e)))
    page.goto(TILE_URL.format(theme))
    page.wait_for_selector("[data-theme-tile]", timeout=20000)
    theme_ready(page)
    page.wait_for_timeout(300)
    out = TILES / f"tile-{theme}.png"
    page.screenshot(path=str(out), full_page=True)
    print(out.name + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def shoot_c1r(browser, theme, v, w):
    page, logs = open_page(browser, v, w, "main", theme)
    box = root_box(page)
    clip = {
        "x": max(0, box["x"] - PAD),
        "y": max(0, box["y"] - PAD),
        "width": box["w"] + 2 * PAD,
        "height": box["h"] + 2 * PAD,
    }
    out = TILES / f"c1r-v{v}-{w}-{theme}.png"
    page.screenshot(path=str(out), clip=clip, full_page=True)
    print(out.name + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def load(theme, v, w):
    img = Image.open(TILES / f"c1r-v{v}-{w}-{theme}.png").convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def compose(themes, out):
    cols = [[load(t, v, w) for v, w, _ in ROWS] for t in themes]
    cw = max(img.width for col in cols for img in col)
    heights = [max(col[r].height for col in cols) for r in range(len(ROWS))]
    W = 2 * M + len(cols) * cw + (len(cols) - 1) * GAP
    H = M + HEAD + sum(heights) + len(ROWS) * (ROW_GAP + 24) + M
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, (theme, col) in enumerate(zip(themes, cols)):
        x = M + i * (cw + GAP)
        d.text((x, M), LABEL[theme], font=F(34, True), fill=INK)
        y = M + HEAD
        for r, (_, _, name) in enumerate(ROWS):
            d.text((x, y), name, font=F(16), fill=SUB)
            img.paste(col[r], (x, y + 24))
            y += 24 + heights[r] + ROW_GAP
        if i:
            d.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    img.save(out)
    print(out, img.size)
    print("이름 대응:", ", ".join(f"{LABEL[t]}=theme {t}" for t in themes))


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--themes", "-t", default="a,b,c", help="쉼표로: base,a,b,c")
    ap.add_argument("--no-shoot", action="store_true")
    ap.add_argument("--out", default=str(VISUAL / "tiles-compare.png"))
    a = ap.parse_args()
    themes = [t for t in a.themes.split(",") if t in THEMES]
    TILES.mkdir(parents=True, exist_ok=True)
    if not a.no_shoot:
        with sync_playwright() as p:
            b = launch(p)
            for t in themes:
                shoot_tile(b, t)
                for v, w in sorted({(v, w) for v, w, _ in ROWS}):
                    shoot_c1r(b, t, v, w)
            b.close()
    compose(themes, Path(a.out))


if __name__ == "__main__":
    main()
