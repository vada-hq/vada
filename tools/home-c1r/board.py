"""c1r 비교판: 고른 안들을 977·main으로 나란히, 그 아래 358·main. 이름은 가·나·다… (안 번호는 판에 쓰지 않는다).
사용: python -X utf8 tools/home-c1r/board.py 0 1 2 3 [--spec spec.json] [--shuffle 7] [--out 파일.png]
먼저 shoot.py로 v{N}/c1r-v{N}-977-main.png, c1r-v{N}-358-main.png를 찍어 둔다.
spec.json(선택):
  {"captions": {"0": "한 줄 캡션"},
   "marks":   {"0": [[x, y, "1"], ...]},      # 977 그림 위 부분 번호. x·y는 컴포넌트 왼쪽 위 기준 CSS px
   "marks358": {"0": [[x, y, "1"], ...]}}    # 358 그림 위
--shuffle N: 자리 순서를 씨앗 N으로 섞는다(위치 편향 줄이기). 이름↔안 대응은 터미널에 찍힌다(판에는 쓰지 않는다)."""
import sys
import argparse
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, SCREENS

PAD = 8  # shoot.py의 둘레 여백(CSS px)
NAMES = "가나다라마바사아"
M, GAP = 40, 48
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"


def load(v, w):
    path = SCREENS / f"v{v}" / f"c1r-v{v}-{w}-main.png"
    img = Image.open(path).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def draw_marks(img, marks):
    d = ImageDraw.Draw(img)
    for x, y, label in marks:
        cx, cy, r = x + PAD, y + PAD, 13
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=INK, outline="white", width=2)
        d.text((cx, cy), str(label), font=F(15, True), fill="white", anchor="mm")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("variants", nargs="+")
    ap.add_argument("--spec", default=None)
    ap.add_argument("--shuffle", type=int, default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf8")) if a.spec else {}
    order = list(a.variants)
    if a.shuffle is not None:
        random.Random(a.shuffle).shuffle(order)
    cols = []
    for i, v in enumerate(order):
        big, small = load(v, 977), load(v, 358)
        draw_marks(big, spec.get("marks", {}).get(v, []))
        draw_marks(small, spec.get("marks358", {}).get(v, []))
        cols.append((NAMES[i], v, big, small, spec.get("captions", {}).get(v, "")))
    cw = max(c[2].width for c in cols)
    top_h = max(c[2].height for c in cols)
    bot_h = max(c[3].height for c in cols)
    head = 90
    W = 2 * M + len(cols) * cw + (len(cols) - 1) * GAP
    H = M + head + top_h + 40 + 30 + bot_h + M
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, (name, v, big, small, caption) in enumerate(cols):
        x = M + i * (cw + GAP)
        d.text((x, M), name, font=F(30, True), fill=INK)
        d.text((x + 48, M + 6), caption or "(캡션)", font=F(20), fill=SUB if caption else LINE)
        y = M + head
        img.paste(big, (x, y))
        y += top_h + 40
        d.text((x, y - 8), "390", font=F(16), fill=SUB)
        img.paste(small, (x, y + 22))
        if i:
            d.line((x - GAP // 2, M, x - GAP // 2, H - M), fill=LINE, width=2)
    out = Path(a.out) if a.out else SCREENS / f"c1r-board-{''.join(a.variants)}.png"
    img.save(out)
    print(out, img.size)
    print("이름 대응:", ", ".join(f"{n}=v{v}" for n, v, *_ in cols))


if __name__ == "__main__":
    main()
