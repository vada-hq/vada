"""B2 캡처를 산출물 이름으로 notes에 복사하고 비교판을 만든다. 사용: python -X utf8 deliver.py <회차>"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = Path(f"C:/tmp/home-s7/r{sys.argv[1]}")
DST = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home")
FONT = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 28)
blur = lambda im: im.convert("L").filter(ImageFilter.GaussianBlur(6))  # noqa: E731

names = json.loads((SRC / "measure.json").read_text(encoding="utf8")).keys()
for name in names:
    width = name.split("-")[0]
    out = f"s7r-{name}"
    # 390 전체 길이는 떠 있는 아래 메뉴를 숨긴 판, 첫 화면 판은 아래 메뉴가 있는 900px
    im = Image.open(SRC / (f"{name}-bodyonly.png" if width == "390" else f"{name}.png"))
    im.save(DST / f"{out}.png")
    blur(im).save(DST / f"{out}-blur.png")
    if width == "390":
        Image.open(SRC / f"{name}-first.png").save(DST / f"{out}-firstscreen.png")
for extra in ["1280-main-line-ask", "1280-main-line-ask-new"]:
    Image.open(SRC / f"{extra}.png").save(DST / f"s7r-{extra}.png")

items = [
    ("와이어프레임 HOME-01C", Image.open(DST / "wf-HOME-01C-1280.png")),
    ("지금 구현(S1)", Image.open(DST / "s1-1280.png")),
    ("옛 B(S5)", Image.open(DST / "s5r-B-1280.png")),
    ("새 시안 B2(main, line)", Image.open(SRC / "1280-main-line.png")),
]
gap, head = 40, 56
h = max(im.height for _, im in items) + head
board = Image.new(
    "RGB", (sum(im.width for _, im in items) + gap * (len(items) - 1), h), "white"
)
draw = ImageDraw.Draw(board)
x = 0
for label, im in items:
    draw.text((x + 8, 12), label, fill="black", font=FONT)
    board.paste(im.convert("RGB"), (x, head))
    x += im.width + gap
board.save(DST / "s7r-compare-1280.png")
print("ok", len(list(names)))
