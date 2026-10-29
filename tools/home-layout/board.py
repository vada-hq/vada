"""배치 시안 대표용 판. 안 3개(이름 가·나·다로 섞음) x (1280 평소 / 1280 신호 많은 날 / 390 평소 첫 화면).
사용: python -X utf8 -W ignore tools/home-layout/board.py [--seed 7] [--no-shoot]
- 낱장은 shoot.py --set board로 찍는다(--no-shoot가 없으면 먼저 찍는다).
- 판: screens/home/layout/layout-board.png, ⑤·사용 가능 안 b 한 장: layout-week-b.png(L1 1280 평소)
- 대응표: notes/integration/home/layout-board-mapping.md"""

import argparse
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import PLANS, SCALE, SCREENS, shot_path

MAPPING = Path("C:/Users/82108/vada-hq/notes/integration/home/layout-board-mapping.md")
NAMES = ["가", "나", "다"]
ROWS = [
    ("quiet", 1280, "1280 평소"),
    ("busy", 1280, "1280 신호 많은 날"),
    ("quiet", 390, "390 평소 · 첫 화면"),
]
M, GAP, HEAD, LABEL, ROW_GAP = 48, 64, 72, 30, 56
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"


def font(size, bold=False):
    return ImageFont.truetype(
        "C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf", size
    )


def half(path):
    img = Image.open(path).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def compose(order, out):
    cells = {
        (p, r): half(shot_path(p, d, w))
        for p in order
        for r, (d, w, _) in enumerate(ROWS)
    }
    cw = max(i.width for i in cells.values())
    rh = [max(cells[(p, r)].height for p in order) for r in range(len(ROWS))]
    W = 2 * M + len(order) * cw + (len(order) - 1) * GAP
    H = M + HEAD + sum(LABEL + h + ROW_GAP for h in rh) + M - ROW_GAP
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, p in enumerate(order):
        x = M + i * (cw + GAP)
        d.text((x, M), NAMES[i], font=font(44, True), fill=INK)
        y = M + HEAD
        for r, (_, _, label) in enumerate(ROWS):
            d.text((x, y), label, font=font(18), fill=SUB)
            cell = cells[(p, r)]
            img.paste(cell, (x, y + LABEL))
            d.rectangle(
                (x, y + LABEL, x + cell.width - 1, y + LABEL + cell.height - 1),
                outline=LINE,
            )
            y += LABEL + rh[r] + ROW_GAP
        if i:
            d.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    img.save(out, optimize=True)
    print(out, img.size)


def week_b(out):
    img = half(shot_path("L1", "quiet", 1280, "b"))
    img.save(out, optimize=True)
    print(out, img.size)


def write_mapping(order, seed):
    rows = "\n".join(f"| {NAMES[i]} | {p} |" for i, p in enumerate(order))
    MAPPING.write_text(
        "---\n독자: 진행 에이전트(대표에게는 보이지 않는다)\n---\n\n"
        f"# 배치 판 대응표\n\n판 `review/screens/home/layout/layout-board.png`(씨앗 {seed}).\n\n"
        f"| 판 이름 | 안 |\n|---|---|\n{rows}\n\n"
        "`layout-week-b.png`는 L1 1280 평소를 ⑤·사용 가능 안 b로 찍은 한 장이다(판의 같은 칸은 안 a).\n",
        encoding="utf8",
    )
    print(MAPPING)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--no-shoot", action="store_true")
    a = ap.parse_args()
    if not a.no_shoot:
        subprocess.run(
            [
                sys.executable,
                "-X",
                "utf8",
                "-W",
                "ignore",
                str(Path(__file__).with_name("shoot.py")),
            ],
            check=True,
        )
    order = PLANS[:]
    random.Random(a.seed).shuffle(order)
    compose(order, SCREENS / "layout-board.png")
    week_b(SCREENS / "layout-week-b.png")
    write_mapping(order, a.seed)


if __name__ == "__main__":
    main()
