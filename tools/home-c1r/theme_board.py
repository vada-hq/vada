"""테마 비교판: 테마마다 스타일 타일(창 1280 전체)과 ① v3·v1을 찍고, 대표가 볼 판 두 장을 만든다.
사용: python -X utf8 -W ignore tools/home-c1r/theme_board.py [-t a,b,c] [--seed 1] [--no-shoot]
- 찍기(낱장): notes/integration/review/screens/visual/tiles/
    tile-{테마}.png                 /home-s5.html?component=tile&theme=…  창 1280, 페이지 전체
    c1r-v{3|1}-{977|358}-{테마}.png  ① main, 컴포넌트 상자 + 둘레 8px(shoot.py와 같은 자르기)
- 판(열 = 테마를 씨앗으로 섞은 차례, 이름은 가·나·다만. 테마·갈래 이름은 판에 쓰지 않는다):
    tiles-compare.png  ① 판: 행 = v3 977 / v1 977 / v3 390
    tiles-board.png    타일 판: 세 타일 나란히
- 가·나·다 ↔ 테마 대응은 터미널과 notes/visual-language/tiles-mapping.md에만 적는다.
--no-shoot: 이미 찍은 낱장으로 판만 다시 만든다."""

import sys
import argparse
import random
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, THEMES, launch, open_page, root_box, theme_ready

VISUAL = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/visual")
TILES = VISUAL / "tiles"
MAPPING = Path("C:/Users/82108/vada-hq/notes/visual-language/tiles-mapping.md")
TILE_URL = "http://127.0.0.1:5291/home-s5.html?component=tile&theme={}"
TILE_VIEW = 1280
PAD = 8  # shoot.py의 둘레 여백(CSS px)
ROWS = [("3", 977, "v3 977"), ("1", 977, "v1 977"), ("3", 358, "v3 390")]
NAMES = "가나다라"
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


def half(path):
    img = Image.open(path).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def canvas(cols, cw, body_h):
    W = 2 * M + len(cols) * cw + (len(cols) - 1) * GAP
    H = M + HEAD + body_h + M
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i in range(len(cols)):
        x = M + i * (cw + GAP)
        d.text((x, M), NAMES[i], font=F(34, True), fill=INK)
        if i:
            d.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    return img, d


def compose_c1r(order, out):
    cols = [[half(TILES / f"c1r-v{v}-{w}-{t}.png") for v, w, _ in ROWS] for t in order]
    cw = max(img.width for col in cols for img in col)
    heights = [max(col[r].height for col in cols) for r in range(len(ROWS))]
    img, d = canvas(cols, cw, sum(heights) + len(ROWS) * (ROW_GAP + 24))
    for i, col in enumerate(cols):
        x, y = M + i * (cw + GAP), M + HEAD
        for r, (_, _, name) in enumerate(ROWS):
            d.text((x, y), name, font=F(16), fill=SUB)
            img.paste(col[r], (x, y + 24))
            y += 24 + heights[r] + ROW_GAP
    img.save(out)
    print(out, img.size)


def compose_tiles(order, out):
    cols = [half(TILES / f"tile-{t}.png") for t in order]
    cw = max(c.width for c in cols)
    img, _ = canvas(cols, cw, max(c.height for c in cols))
    for i, c in enumerate(cols):
        img.paste(c, (M + i * (cw + GAP), M + HEAD))
    img.save(out)
    print(out, img.size)


def write_mapping(order, seed):
    rows = "\n".join(f"| {NAMES[i]} | `{t}` |" for i, t in enumerate(order))
    MAPPING.write_text(
        f"""---
독자: 에이전트(진행 에이전트). 대표에게 보이지 않는다.
작성: {date.today().isoformat()}, tools/home-c1r/theme_board.py가 만듦(씨앗 {seed})
---

# 테마 비교판 이름 대응

판(`notes/integration/review/screens/visual/tiles-compare.png`, `tiles-board.png`)의 열 이름과 테마. 갈래는
theme `a` = 갈래 A 정돈된 도구, `b` = 갈래 B 밝은 면, `c` = 갈래 C 먹색과 색 신호(`benchmarks.md`).

| 판 이름 | 테마 |
|---|---|
{rows}
""",
        encoding="utf8",
    )
    print(
        "이름 대응:",
        ", ".join(f"{NAMES[i]}=theme {t}" for i, t in enumerate(order)),
        "→",
        MAPPING,
    )


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--themes", "-t", default="a,b,c", help="쉼표로: base,a,b,c")
    ap.add_argument(
        "--seed", type=int, default=1, help="열 차례를 섞는 씨앗(1 = 가 b, 나 c, 다 a)"
    )
    ap.add_argument("--no-shoot", action="store_true")
    a = ap.parse_args()
    themes = [t for t in a.themes.split(",") if t in THEMES]
    order = list(themes)
    random.Random(a.seed).shuffle(order)
    TILES.mkdir(parents=True, exist_ok=True)
    if not a.no_shoot:
        with sync_playwright() as p:
            b = launch(p)
            for t in themes:
                shoot_tile(b, t)
                for v, w in sorted({(v, w) for v, w, _ in ROWS}):
                    shoot_c1r(b, t, v, w)
            b.close()
    compose_c1r(order, VISUAL / "tiles-compare.png")
    compose_tiles(order, VISUAL / "tiles-board.png")
    write_mapping(order, a.seed)


if __name__ == "__main__":
    main()
