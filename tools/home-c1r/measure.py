"""c1r 성공 기준 K1~K7(명세 c1-spec.md 8절)을 DOM·픽셀로 재서 md 표로 낸다.
사용: python -X utf8 -W ignore tools/home-c1r/measure.py [-v 0,1] [-d ...] [-w ...] [-t a] [--out 파일.md]
--theme(-t): 그 테마(apps/web/src/home/c1r/themes)로 열어 잰다. K3 대비를 테마마다 다시 잴 때 쓴다(기본 base).
기본 묶음은 shoot.py와 같다(3폭 x main·normal·empty + many 977). K마다 필요한 폭·데이터가 묶음에 없으면 '-'.
K5 위험 색 픽셀: 빨강 색상(345~360도, 0~12도), 채도 0.15 이상, 명도 0.3 이상인 픽셀 가운데
지남·오늘 줄의 사실 글 상자(+2px) 밖에 있는 것의 수."""
import sys
import colorsys
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, launch, open_page, parse_args, root_box

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")
DATA_JS = "async d => (await import('/src/home/c1r/c1r-data.ts')).C1R_DATA[d]"


def red_pixels(png, allowed):
    img = Image.open(io.BytesIO(png)).convert("RGB")
    boxes = [(a["x"] * SCALE, a["y"] * SCALE, (a["x"] + a["w"]) * SCALE, (a["y"] + a["h"]) * SCALE) for a in allowed]
    out = inside = 0
    w, h = img.size
    px = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if r < 77 or r <= g or r <= b:
                continue
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            deg = hh * 360
            if s < 0.15 or v < 0.3 or not (deg >= 345 or deg <= 12):
                continue
            if any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in boxes):
                inside += 1
            else:
                out += 1
    return out, inside


def measure(browser, v, w, d, theme="base"):
    page, logs = open_page(browser, v, w, d, theme)
    data = page.evaluate(DATA_JS, d)
    m = page.evaluate(JS, {"rows": data["rows"], "total": data["total"]})
    box = root_box(page)
    png = page.screenshot(clip={"x": box["x"], "y": box["y"], "width": box["w"], "height": box["h"]}, full_page=True)
    m["red_out"], m["red_in"] = red_pixels(png, m["allowed"])
    m["total"] = data["total"]
    m["logs"] = logs
    page.close()
    return m


def mark(ok):
    return "합격" if ok else "**불합격**"


def judge(res):
    """res: {(w, d): m} -> (K별 칸 글, 덧 글 목록)"""
    cell, notes = {}, []
    get = res.get
    m = get((358, "main"))
    cell["K1"] = f"{m['height']:.0f}px {mark(m['height'] <= 700)}" if m else "-"
    m = get((716, "main"))
    if m:
        cell["K2"] = f"{len(m['clipped'])} {mark(not m['clipped'])}"
        notes += [f"K2 716·main: {c}" for c in m["clipped"]]
    else:
        cell["K2"] = "-"
    other_clip = [(k, c) for k, m in res.items() if k != (716, "main") for c in m["clipped"]]
    notes += [f"(참고) 잘림 {k[0]}·{k[1]}: {c}" for k, c in other_clip]
    worst = min(res.items(), key=lambda kv: kv[1]["minContrast"])
    cell["K3"] = f"{worst[1]['minContrast']:.2f} {mark(worst[1]['minContrast'] >= 4.5)}"
    for k, m in res.items():
        notes += [f"K3 {k[0]}·{k[1]}: {c}" for c in m["lowContrast"]]
    small = [(k, t) for k, m in res.items() if k[0] == 358 for t in m["targets"]]
    if small:
        least = min(min(t["w"], t["h"]) for _, t in small)
        bad = [(k, t) for k, t in small if min(t["w"], t["h"]) < 44 or t["hidden"]]
        cell["K4"] = f"{least:.0f}px {mark(not bad)}"
        notes += [
            f"K4 358·{k[1]}: '{t['name']}' {t['w']:.0f}x{t['h']:.0f}{' (숨김)' if t['hidden'] else ''}" for k, t in bad
        ]
    else:
        cell["K4"] = "-"
    mains = [(k, m) for k, m in res.items() if k[1] == "main"]
    if mains:
        out = sum(m["red_out"] for _, m in mains)
        cell["K5"] = f"{out}px {mark(out == 0)}"
        notes += [f"K5 {k[0]}·main: 밖 {m['red_out']}px (사실 자리 안 {m['red_in']}px)" for k, m in mains if m["red_out"]]
    else:
        cell["K5"] = "-"
    counts = [(k, m) for k, m in res.items() if k[1] in ("main", "many")]
    if counts:
        bad = [(k, m) for k, m in counts if not m["heads"] or any(h != m["total"] for h in m["heads"])]
        shown = ", ".join(f"{k[1]} {m['heads']}/{m['total']}" for k, m in counts if k[0] == 977) or "-"
        cell["K6"] = f"{shown} {mark(not bad)}"
        notes += [f"K6 {k[0]}·{k[1]}: 머리 수 {m['heads']}, 데이터 {m['total']}" for k, m in bad]
    else:
        cell["K6"] = "-"
    m = get((977, "normal"))
    cell["K7"] = f"{m['height']:.0f}px {mark(m['height'] <= 64)}" if m else "-"
    over = [(k, m["shown"]) for k, m in res.items() if m["shown"] > 5]
    notes += [f"상한: {k[0]}·{k[1]} 보이는 줄 {n}" for k, n in over]
    notes += [f"두 번: {k[0]}·{k[1]} {m['twice']}" for k, m in res.items() if m["twice"]]
    notes += [f"로그 {k[0]}·{k[1]}: {m['logs'][:2]}" for k, m in res.items() if m["logs"]]
    return cell, notes


def main():
    a = parse_args(__doc__, lambda ap: ap.add_argument("--out", default=None, help="표를 이 파일에도 쓴다"))
    lines = ["| 안 | K1 390 높이≤700 | K2 716 잘림 | K3 최저 대비 | K4 390 누르는 자리 | K5 위험 색 밖 | K6 건수(머리/데이터) | K7 977 정상 높이≤64 |",
             "|---|---|---|---|---|---|---|---|"]
    details, heights = [], []
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            res = {(w, d): measure(b, v, w, d, a.theme) for w, d in a.cases}
            cell, notes = judge(res)
            name = f"v{v}" if a.theme == "base" else f"v{v} (테마 {a.theme})"
            lines.append(f"| {name} | " + " | ".join(cell[k] for k in ["K1", "K2", "K3", "K4", "K5", "K6", "K7"]) + " |")
            details += [f"- v{v} {n}" for n in notes]
            heights.append(f"- v{v} 높이: " + ", ".join(f"{w}·{d} {m['height']:.0f} (줄 {m['shown']})" for (w, d), m in res.items()))
        b.close()
    text = "\n".join(lines + [""] + heights + ([""] + details if details else []))
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
