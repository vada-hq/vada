import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont
SRC = Path('r3')
DST = Path('C:/Users/82108/vada-hq/notes/integration/review/screens/home')
FONT = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 28)
CASES = [('main', 1280), ('main', 1024), ('main', 390), ('normal', 1280), ('normal', 390), ('empty', 1280), ('empty', 390)]
blur = lambda im: im.convert('L').filter(ImageFilter.GaussianBlur(6))
for v in 'ABC':
    for data, w in CASES:
        src = f'{v}-{w}' + ('' if data == 'main' else f'-{data}')
        out = f's5r-{v}-{w}' + ('' if data == 'main' else f'-{data}')
        # 390 전체 길이는 떠 있는 아래 메뉴를 숨긴 판(첫 화면 판은 따로)
        im = Image.open(SRC / (f'{src}-bodyonly.png' if w == 390 else f'{src}.png'))
        im.save(DST / f'{out}.png')
        blur(im).save(DST / f'{out}-blur.png')
    Image.open(SRC / f'{v}-390-first.png').save(DST / f's5r-{v}-390-firstscreen.png')

def board(items, path, gap=40, head=56):
    h = max(im.height for _, im in items) + head
    wsum = sum(im.width for _, im in items) + gap * (len(items) - 1)
    out = Image.new('RGB', (wsum, h), 'white')
    d = ImageDraw.Draw(out)
    x = 0
    for label, im in items:
        d.text((x + 8, 12), label, fill='black', font=FONT)
        out.paste(im.convert('RGB'), (x, head))
        x += im.width + gap
    out.save(path)
    return out

items = [('와이어프레임 HOME-01C', Image.open(DST / 'wf-HOME-01C-1280.png')), ('지금 구현(S1)', Image.open(DST / 's1-1280.png'))]
items += [(f'시안 {v}', Image.open(SRC / f'{v}-1280.png')) for v in 'ABC']
board(items, DST / 's5r-compare-1280.png')
board([(l, blur(im)) for l, im in items], DST / 's5r-compare-1280-blur.png')
board([(f'시안 {v} (390 첫 화면)', Image.open(SRC / f'{v}-390-first.png')) for v in 'ABC'], DST / 's5r-compare-390-firstscreen.png')
print('ok')
