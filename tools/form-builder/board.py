"""양식 만들기 화면 시안 비교판. 여러 안의 같은 화면을 나란히 놓고, 안마다 생김새 이름표를 그림 위에 크게 적는다.

사용: python -X utf8 -W ignore tools/form-builder/board.py v0=지금 v1="카드 묶음" v2="한 줄 목록" [--part card-active-1280,editor-filled-1280] [--out 파일.png]
  인자 하나 = <안>=<이름표>. 이름표를 비우면(v1=) 안 이름을 쓴다. 이름표는 생김새 이름(가·나·a·b 같은 기호 말고).
  --part: 한 칸에 세로로 쌓을 그림들 <screen>-<data>-<폭>, 쉼표로(기본 card-active-1280,editor-filled-1280).
          한 판에는 같은 폭만 둔다(390과 1280을 섞으면 칸 폭이 달라 비교가 어렵다).
  먼저 shoot.py로 그 그림을 찍어 둔다. 없으면 빠진 경로를 찍고 멈춘다.
  저장(기본): notes/integration/review/screens/events/form-builder/board-<part들>.png"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, SCREENS, VARIANTS, shot_path

M, GAP = 40, 56
BOLD = "C:/Windows/Fonts/malgunbd.ttf"
REGULAR = "C:/Windows/Fonts/malgun.ttf"
F = lambda size, bold=False: ImageFont.truetype(BOLD if bold else REGULAR, size)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"
LABEL_SIZE, TAG_SIZE = 44, 18


def parse():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("pairs", nargs="+", help="<안>=<이름표>")
    ap.add_argument("--part", default="card-active-1280,editor-filled-1280")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    a.cells = []
    for pair in a.pairs:
        v, _, label = pair.partition("=")
        if v not in VARIANTS:
            ap.error(f"모르는 안: {v}")
        a.cells.append((v, label.strip() or v))
    a.parts = []
    for part in a.part.split(","):
        bits = part.rsplit("-", 2)
        if len(bits) != 3 or not bits[2].isdigit():
            ap.error(f"part 꼴은 <screen>-<data>-<폭>: {part}")
        a.parts.append((bits[0], bits[1], int(bits[2])))
    return a


def load(v, s, d, w):
    img = Image.open(shot_path(v, s, d, w)).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def wrap(draw, text, font, width):
    """이름표가 칸 폭을 넘으면 글자 단위로 줄을 나눈다."""
    lines, cur = [], ""
    for ch in text:
        if draw.textlength(cur + ch, font=font) > width and cur:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    return lines + [cur] if cur else lines


def main():
    a = parse()
    missing = [
        str(shot_path(v, s, d, w))
        for v, _ in a.cells
        for s, d, w in a.parts
        if not shot_path(v, s, d, w).exists()
    ]
    if missing:
        sys.exit("찍힌 그림이 없다(shoot.py로 먼저 찍기):\n  " + "\n  ".join(missing))
    cols = [(label, [load(v, s, d, w) for s, d, w in a.parts]) for v, label in a.cells]
    cw = max(img.width for _, imgs in cols for img in imgs)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    label_lines = [wrap(probe, label, F(LABEL_SIZE, True), cw) for label, _ in cols]
    head = max(len(lines) for lines in label_lines) * (LABEL_SIZE + 12) + 16
    part_h = [max(imgs[k].height for _, imgs in cols) for k in range(len(a.parts))]
    tag = TAG_SIZE + 12
    W = 2 * M + len(cols) * cw + (len(cols) - 1) * GAP
    H = 2 * M + head + sum(tag + h + 32 for h in part_h)
    board = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(board)
    for i, ((label, imgs), lines) in enumerate(zip(cols, label_lines)):
        x, y = M + i * (cw + GAP), M
        for n, text in enumerate(lines):
            draw.text((x, y + n * (LABEL_SIZE + 12)), text, font=F(LABEL_SIZE, True), fill=INK)
        y += head
        for k, (img, (s, d, w)) in enumerate(zip(imgs, a.parts)):
            draw.text((x, y), f"{s} · {d} · {w}", font=F(TAG_SIZE), fill=SUB)
            board.paste(img, (x, y + tag))
            draw.rectangle((x - 1, y + tag - 1, x + img.width, y + tag + img.height), outline=LINE)
            y += tag + part_h[k] + 32
        if i:
            draw.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    name = "-".join(f"{s}-{d}-{w}" for s, d, w in a.parts)
    out = Path(a.out) if a.out else SCREENS / f"board-{name}.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    board.save(out)
    print(out, board.size)


if __name__ == "__main__":
    main()
