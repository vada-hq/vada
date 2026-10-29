"""c2 대표용 비교판. 칸 이름은 가·나·다…(판에 안 이름을 쓰지 않는다), 대응표 md는 따로 둔다.

사용: python -X utf8 -W ignore tools/home-c2/board.py [e1 e2 ...] [--seed 3] [--cols 3] [--spec spec.json] [--out 파일.png] [--mapping 파일.md]
  변형을 안 주면 e1~e6 가운데 세 장이 다 찍힌 것을 모두 모은다. 준 변형에 그림이 없으면 빠진 경로를 찍고 멈춘다.
  한 칸 = 977·main / 390(358)·main / 977·quiet 를 세로로. 먼저 shoot.py로 찍어 둔다
  (세 장만: shoot.py -v eN -d main,quiet -w 977,358 --no-hover).
  가·나·다…는 --seed로 무작위 배정한다(없으면 새 씨앗을 골라 터미널과 대응표에 적는다).
  저장: 판 notes/integration/review/screens/home/c2/c2-board.png,
        대응표 notes/integration/home/c2-board-mapping.md(판 폴더 밖, 판만 보여 줄 때 섞이지 않게).

spec.json(선택):
  {"captions": {"e3": "한 줄 캡션"},
   "marks":    {"e3": [[x, y, "1"], ...]},    # 977·main 그림 위 부분 번호. x·y는 컴포넌트 왼쪽 위 기준 CSS px
   "marks358": {"e3": [[x, y, "1"], ...]}}   # 358·main 그림 위"""

import sys
import argparse
import datetime
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, SCREENS, VARIANTS, shot_path

PAD = 8  # shoot.py의 둘레 여백(CSS px)
NAMES = "가나다라마바사아자차카타파하"
M, GAP = 40, 48
F = lambda s, b=False: ImageFont.truetype(
    "C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s
)
INK, SUB, LINE = "#101828", "#4a5565", "#e5e7eb"
PARTS = [(977, "main", "977"), (358, "main", "390"), (977, "quiet", "977 · 평소")]
OUT = SCREENS / "c2-board.png"
MAPPING = Path("C:/Users/82108/vada-hq/notes/integration/home/c2-board-mapping.md")


def load(v, w, d):
    img = Image.open(shot_path(v, w, d)).convert("RGB")
    return img.resize((img.width // SCALE, img.height // SCALE), Image.LANCZOS)


def draw_marks(img, marks):
    d = ImageDraw.Draw(img)
    for x, y, label_ in marks:
        cx, cy, r = x + PAD, y + PAD, 13
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=INK, outline="white", width=2)
        d.text((cx, cy), str(label_), font=F(15, True), fill="white", anchor="mm")


def pick(a):
    variants = [v for v in a.variants if v in VARIANTS]
    if a.variants and len(variants) != len(a.variants):
        sys.exit(f"모르는 변형: {[v for v in a.variants if v not in VARIANTS]}")
    if not variants:
        variants = [
            v for v in VARIANTS if all(shot_path(v, w, d).exists() for w, d, _ in PARTS)
        ]
    if not variants:
        sys.exit(
            "모을 변형이 없다(세 장 다 찍힌 e가 없음). 먼저 shoot.py -v eN -d main,quiet -w 977,358 --no-hover"
        )
    missing = [
        str(shot_path(v, w, d))
        for v in variants
        for w, d, _ in PARTS
        if not shot_path(v, w, d).exists()
    ]
    if missing:
        sys.exit("찍힌 그림이 없다:\n  " + "\n  ".join(missing))
    return variants


def render(cells, cols):
    ncols = max(1, min(cols, len(cells)))
    nrows = (len(cells) + ncols - 1) // ncols
    cw = max(p.width for c in cells for p in c[2])
    head, tag = 60, 28  # 이름 줄, 부분 이름 줄
    part_h = [max(c[2][k].height for c in cells) for k in range(len(PARTS))]
    cell_h = head + sum(tag + h + 24 for h in part_h)
    W = 2 * M + ncols * cw + (ncols - 1) * GAP
    H = 2 * M + nrows * cell_h + (nrows - 1) * GAP
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    for i, (name, _v, parts, caption) in enumerate(cells):
        r, c = divmod(i, ncols)
        x, y = M + c * (cw + GAP), M + r * (cell_h + GAP)
        d.text((x, y), name, font=F(30, True), fill=INK)
        if caption:
            d.text((x + 48, y + 6), caption, font=F(20), fill=SUB)
        y += head
        for k, (part, (_, _, tag_text)) in enumerate(zip(parts, PARTS)):
            d.text((x, y), tag_text, font=F(16), fill=SUB)
            img.paste(part, (x, y + tag))
            y += tag + part_h[k] + 24
        if c:
            top = M + r * (cell_h + GAP)
            d.line((x - GAP // 2, top, x - GAP // 2, top + cell_h), fill=LINE, width=2)
        if r:
            top = M + r * (cell_h + GAP) - GAP // 2
            d.line((x, top, x + cw, top), fill=LINE, width=2)
    return img


def write_mapping(path, out, seed, variants, pairs):
    when = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = [
        "---",
        "독자: 에이전트(진행 에이전트, 검토)",
        f"작성: {when}, tools/home-c2/board.py가 만듦",
        "---",
        "",
        "# c2 대표용 비교판 이름 대응",
        "",
        f"- 판: `{out}`",
        f"- 씨앗 `{seed}`",
        f"- 다시 만들기: `python -X utf8 -W ignore tools/home-c2/board.py {' '.join(variants)} --seed {seed}`",
        "- 판에는 안 이름이 없다. 대표가 고른 뒤에 이 표로 돌려 읽는다.",
        "",
        "| 판 이름 | 안 |",
        "|---|---|",
        *[f"| {n} | {v} |" for n, v in pairs],
        "",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf8", newline="\n")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("variants", nargs="*")
    ap.add_argument(
        "--seed", type=int, default=None, help="이름 배정 씨앗(없으면 새로 고름)"
    )
    ap.add_argument("--cols", type=int, default=3, help="한 줄의 칸 수(기본 3)")
    ap.add_argument("--spec", default=None)
    ap.add_argument("--mapping", default=None, help="대응표 md 자리")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf8")) if a.spec else {}
    variants = pick(a)
    seed = a.seed if a.seed is not None else random.randrange(1, 10000)
    order = list(variants)
    random.Random(seed).shuffle(order)
    cells = []
    for i, v in enumerate(order):
        parts = [load(v, w, d) for w, d, _ in PARTS]
        draw_marks(parts[0], spec.get("marks", {}).get(v, []))
        draw_marks(parts[1], spec.get("marks358", {}).get(v, []))
        cells.append((NAMES[i], v, parts, spec.get("captions", {}).get(v, "")))
    img = render(cells, a.cols)
    out = Path(a.out) if a.out else OUT
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    pairs = [(n, v) for n, v, *_ in cells]
    mapping = Path(a.mapping) if a.mapping else MAPPING
    write_mapping(mapping, out, seed, variants, pairs)
    print(out, img.size)
    print(f"씨앗 {seed}. 이름 대응:", ", ".join(f"{n}={v}" for n, v in pairs))
    print("대응표:", mapping)


if __name__ == "__main__":
    main()
