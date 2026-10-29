"""c35 대표용 판 두 장. 먼저 shoot.py(-d main,normal -w 977,358)와 shoot.py --stack으로 찍어 둔다.
사용: python -X utf8 -W ignore tools/home-c35/board.py
  c35-board.png: 위 ③ 977·main | 390·main, 아래 ⑤ + 사용 가능 안 a | 안 b (977 main, 977 normal, 390 main)
  c35-stack.png: ① f8 → ② e3 → ③ → ⑤ → 사용 가능을 977로 쌓은 홈 미리 보기, 안 a 줄기 | 안 b 줄기
저장: notes/integration/review/screens/home/c35/"""

import sys
from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, SCREENS, shot_path

M, GAP, TAG = 40, 56, 30
F = lambda s, b=False: ImageFont.truetype(
    "C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s
)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"


def load(path):
    img = Image.open(path).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def vstack(items, gap=12):
    """items: [(글, 그림)] -> 글 줄 + 그림을 세로로 쌓은 한 그림"""
    w = max(img.width for _, img in items)
    h = sum(TAG + img.height + gap for _, img in items)
    out = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(out)
    y = 0
    for text, img in items:
        d.text((0, y), text, font=F(16), fill=SUB)
        out.paste(img, (0, y + TAG))
        y += TAG + img.height + gap
    return out


def columns(title, cols):
    """cols: [(머리, 그림)] -> 큰 제목 + 나란한 칸"""
    head = 56
    w = sum(img.width for _, img in cols) + GAP * (len(cols) - 1)
    h = head + 44 + max(img.height for _, img in cols)
    out = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(out)
    d.text((0, 0), title, font=F(28, True), fill=INK)
    x = 0
    for i, (name, img) in enumerate(cols):
        d.text((x, head), name, font=F(22, True), fill=INK)
        out.paste(img, (x, head + 44))
        if i:
            d.line((x - GAP // 2, head, x - GAP // 2, h), fill=LINE, width=2)
        x += img.width + GAP
    return out


def page(blocks):
    w = 2 * M + max(b.width for b in blocks)
    h = 2 * M + sum(b.height for b in blocks) + GAP * (len(blocks) - 1)
    out = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(out)
    y = M
    for i, b in enumerate(blocks):
        if i:
            d.line((M, y - GAP // 2, w - M, y - GAP // 2), fill=LINE, width=2)
        out.paste(b, (M, y))
        y += b.height + GAP
    return out


def need(path):
    if not path.exists():
        sys.exit(f"찍힌 그림이 없다: {path}")
    return load(path)


def board():
    todo = columns(
        "③ 내가 할 일",
        [
            ("977 · main", need(shot_path("todo", "a", 977, "main"))),
            ("390 · main", need(shot_path("todo", "a", 358, "main"))),
        ],
    )
    cols = []
    for v in ("a", "b"):
        items = []
        for w, d, tag in ((977, "main", "977 · main"), (977, "normal", "977 · normal"), (358, "main", "390 · main")):
            items.append((f"{tag} · ⑤ 이번 주", need(shot_path("week", v, w, d))))
            items.append((f"{tag} · 사용 가능", need(shot_path("available", v, w, d))))
        cols.append((f"안 {v}", vstack(items)))
    week = columns("⑤ 이번 주 · 사용 가능 한 줄", cols)
    return page([todo, week])


def stack():
    cols = [
        (f"안 {v} 줄기 (① f8 → ② e3 → ③ → ⑤ 안 {v} → 사용 가능 안 {v}, 977 · main)", need(SCREENS / "stack" / f"c35-stack-{v}-977.png"))
        for v in ("a", "b")
    ]
    return page([columns("회장단 홈 미리 보기(배치 전, 구역 사이 24px)", cols)])


def main():
    for name, img in (("c35-board.png", board()), ("c35-stack.png", stack())):
        out = SCREENS / name
        img.save(out)
        print(out, img.size)


if __name__ == "__main__":
    main()
