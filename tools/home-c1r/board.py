"""c1r 비교판. 이름은 가·나·다… (안 번호는 판에 쓰지 않는다).

안 비교(v0~v3): 고른 안들을 977·main으로 나란히, 그 아래 358·main.
  사용: python -X utf8 -W ignore tools/home-c1r/board.py 0 1 2 3 [--spec spec.json] [--shuffle 7] [--out 파일.png]
  먼저 shoot.py로 v{N}/c1r-v{N}-977-main.png, c1r-v{N}-358-main.png를 찍어 둔다.
  --shuffle N: 자리 순서를 씨앗 N으로 섞는다(위치 편향 줄이기). 이름↔안 대응은 터미널에 찍힌다.

f 변형(생김새 회차 c1f) 대표용 판: f 변형만 모은다(v와 섞지 않는다).
  사용: python -X utf8 -W ignore tools/home-c1r/board.py [f1 f2 ...] [--seed 3] [--cols 4] [-t a] [--spec spec.json] [--out 파일.png]
  변형을 안 주면 f1~f8 가운데 세 장이 다 찍혀 있는 것을 모두 모은다.
  한 칸 = 977·main / 390(358)·main / 977·normal을 세로로. 먼저 shoot.py -v fN -d main,normal -w 977,358 로 찍어 둔다.
  가·나·다… 는 --seed로 무작위 배정한다(없으면 새 씨앗을 골라 터미널과 대응표에 적는다). 판에는 안 이름이 없다.
  저장: notes/integration/review/screens/home/c1f/c1f-board.png, 대응표 notes/integration/home/c1f-board-mapping.md(--mapping으로 바꿈).

spec.json(선택):
  {"captions": {"0": "한 줄 캡션"},           # f 판이면 키는 "f3"처럼
   "marks":   {"0": [[x, y, "1"], ...]},      # 977·main 그림 위 부분 번호. x·y는 컴포넌트 왼쪽 위 기준 CSS px
   "marks358": {"0": [[x, y, "1"], ...]}}    # 358·main 그림 위"""

import sys
import argparse
import datetime
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import F_VARIANTS, SCALE, SCREENS, SCREENS_F, THEMES, is_f, label, shot_path

PAD = 8  # shoot.py의 둘레 여백(CSS px)
NAMES = "가나다라마바사아자차카타파하"
M, GAP = 40, 48
F = lambda s, b=False: ImageFont.truetype(
    "C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s
)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"
F_PARTS = [(977, "main", "977"), (358, "main", "390"), (977, "normal", "977 · 0건")]
F_MAPPING = Path("C:/Users/82108/vada-hq/notes/integration/home/c1f-board-mapping.md")


def load(v, w, d="main", theme="base"):
    img = Image.open(shot_path(v, w, d, theme=theme)).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def draw_marks(img, marks):
    d = ImageDraw.Draw(img)
    for x, y, label_ in marks:
        cx, cy, r = x + PAD, y + PAD, 13
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=INK, outline="white", width=2)
        d.text((cx, cy), str(label_), font=F(15, True), fill="white", anchor="mm")


def board_v(a, spec):
    order = list(a.variants)
    if a.shuffle is not None:
        random.Random(a.shuffle).shuffle(order)
    cols = []
    for i, v in enumerate(order):
        big, small = load(v, 977, theme=a.theme), load(v, 358, theme=a.theme)
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
        d.text(
            (x + 48, M + 6),
            caption or "(캡션)",
            font=F(20),
            fill=SUB if caption else LINE,
        )
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


def board_f(a, spec):
    """f 변형 대표용 판: 칸마다 977·main / 390·main / 977·normal, 칸은 --cols개씩 줄을 바꾼다."""
    variants = a.variants or [
        v
        for v in F_VARIANTS
        if all(shot_path(v, w, d, theme=a.theme).exists() for w, d, _ in F_PARTS)
    ]
    if not variants:
        sys.exit(
            "모을 f 변형이 없다(세 장 다 찍힌 f가 없음). 먼저 shoot.py -v fN -d main,normal -w 977,358"
        )
    missing = [
        str(shot_path(v, w, d, theme=a.theme))
        for v in variants
        for w, d, _ in F_PARTS
        if not shot_path(v, w, d, theme=a.theme).exists()
    ]
    if missing:
        sys.exit("찍힌 그림이 없다:\n  " + "\n  ".join(missing))
    seed = a.seed if a.seed is not None else random.randrange(1, 10000)
    order = list(variants)
    random.Random(seed).shuffle(order)
    cells = []
    for i, v in enumerate(order):
        parts = [load(v, w, d, a.theme) for w, d, _ in F_PARTS]
        draw_marks(parts[0], spec.get("marks", {}).get(v, []))
        draw_marks(parts[1], spec.get("marks358", {}).get(v, []))
        cells.append((NAMES[i], v, parts, spec.get("captions", {}).get(v, "")))
    ncols = max(1, min(a.cols, len(cells)))
    nrows = (len(cells) + ncols - 1) // ncols
    cw = max(p.width for c in cells for p in c[2])
    head, tag = 60, 28  # 이름 줄, 부분 이름 줄
    part_h = [max(c[2][k].height for c in cells) for k in range(len(F_PARTS))]
    cell_h = head + sum(tag + h + 24 for h in part_h)
    W = 2 * M + ncols * cw + (ncols - 1) * GAP
    H = 2 * M + nrows * cell_h + (nrows - 1) * GAP
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, (name, v, parts, caption) in enumerate(cells):
        r, c = divmod(i, ncols)
        x, y = M + c * (cw + GAP), M + r * (cell_h + GAP)
        d.text((x, y), name, font=F(30, True), fill=INK)
        if caption:
            d.text((x + 48, y + 6), caption, font=F(20), fill=SUB)
        y += head
        for k, (part, (_, _, tag_text)) in enumerate(zip(parts, F_PARTS)):
            d.text((x, y), tag_text, font=F(16), fill=SUB)
            img.paste(part, (x, y + tag))
            y += tag + part_h[k] + 24
        if c:
            top = M + r * (cell_h + GAP)
            d.line((x - GAP // 2, top, x - GAP // 2, top + cell_h), fill=LINE, width=2)
        if r:
            top = M + r * (cell_h + GAP) - GAP // 2
            d.line((x, top, x + cw, top), fill=LINE, width=2)
    out = Path(a.out) if a.out else SCREENS_F / "c1f-board.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    pairs = [(n, v) for n, v, *_ in cells]
    mapping = Path(a.mapping) if a.mapping else F_MAPPING
    when = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    theme = "" if a.theme == "base" else f", 테마 `{a.theme}`"
    lines = [
        "# c1f 대표용 비교판 이름 대응",
        "",
        f"- 판: `{out}`",
        f"- 만든 때: {when}, 씨앗 `{seed}`{theme}",
        f"- 다시 만들기: `python -X utf8 -W ignore tools/home-c1r/board.py {' '.join(variants)} --seed {seed}"
        + ("" if a.theme == "base" else f" -t {a.theme}")
        + "`",
        "- 판에는 안 이름이 없다. 대표가 고른 뒤에 이 표로 돌려 읽는다.",
        "",
        "| 판 이름 | 안 |",
        "|---|---|",
        *[f"| {n} | {label(v)} |" for n, v in pairs],
        "",
    ]
    mapping.parent.mkdir(parents=True, exist_ok=True)
    mapping.write_text("\n".join(lines), encoding="utf8", newline="\n")
    print(out, img.size)
    print(f"씨앗 {seed}. 이름 대응:", ", ".join(f"{n}={v}" for n, v in pairs))
    print("대응표:", mapping)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("variants", nargs="*")
    ap.add_argument("--spec", default=None)
    ap.add_argument(
        "--shuffle", type=int, default=None, help="안 비교판 자리 섞기 씨앗"
    )
    ap.add_argument(
        "--seed", type=int, default=None, help="f 판 이름 배정 씨앗(없으면 새로 고름)"
    )
    ap.add_argument("--cols", type=int, default=4, help="f 판 한 줄의 칸 수(기본 4)")
    ap.add_argument(
        "--theme",
        "-t",
        default="base",
        choices=THEMES,
        help="그 테마로 찍은 그림을 쓴다(기본 base)",
    )
    ap.add_argument("--mapping", default=None, help="f 판 대응표 md 자리")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf8")) if a.spec else {}
    fs = [v for v in a.variants if is_f(v)]
    if fs and len(fs) != len(a.variants):
        ap.error("f 변형과 v 안은 한 판에 섞지 않는다")
    if not a.variants or fs:
        board_f(a, spec)
    else:
        board_v(a, spec)


if __name__ == "__main__":
    main()
