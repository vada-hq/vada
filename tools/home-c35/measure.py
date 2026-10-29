"""c35 성공 기준 K1~K7(명세 c35-spec.md 5절)을 DOM·픽셀로 재서 md 표로 낸다. tools/home-c2/measure.py를 본떴다.
사용: python -X utf8 -W ignore tools/home-c35/measure.py [-p todo,week,available] [--out 파일.md]
기본: 부분·안(todo a, week a·b, available a·b)마다 3폭 x 3견본 = 9번 연다. 숨김(빈 상자)은 높이 0으로 센다.

K1 358·main ③ 상자 높이 <= 700
K2 716·main 글이 상자 밖으로 나가거나 넘쳐 잘린 수 = 0 (text-overflow: ellipsis·line-clamp 안은 제외)
K3 전 묶음 보이는 글의 글자색 대 배경색 대비 최저 >= 4.5
K4 358 묶음의 누르는 것 짧은 변 >= 44 (줄 덮개 ::after는 덮는 상자로 잼)
K5 main 스크린샷의 빨강 픽셀 가운데 [data-c35-danger] 상자(+2px) 밖의 수 = 0, 그 글에 지남·오늘·음수 금액이 없으면 불합격
K6 ③ main의 '전체 n건'과 제목 옆 수 = total
K7 977·normal ⑤ 높이 <= 160, 사용 가능 높이 <= 56"""

import sys
import colorsys
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, launch, open_page, parse_args, query, root_box

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")
DATA_JS = """async d => (await import('/src/home/c35/c35-data.ts')).C35_DATA[d].todo.total"""
K1_MAX, K3_MIN, K4_MIN = 700, 4.5, 44
K7_MAX = {"week": 160, "available": 56}


def red_pixels(png, allowed):
    img = Image.open(io.BytesIO(png)).convert("RGB")
    boxes = [
        (a["x"] * SCALE, a["y"] * SCALE, (a["x"] + a["w"]) * SCALE, (a["y"] + a["h"]) * SCALE)
        for a in allowed
    ]
    out = 0
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
            if not any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in boxes):
                out += 1
    return out


def measure(browser, part, v, w, d):
    page, logs = open_page(browser, query(part, v, d), w)
    m = page.evaluate(JS)
    m["total"] = page.evaluate(DATA_JS, d)
    m["red_out"] = 0
    if d == "main" and m["height"] >= 1:
        box = root_box(page)
        png = page.screenshot(
            clip={"x": box["x"], "y": box["y"], "width": box["w"], "height": box["h"]},
            full_page=True,
        )
        m["red_out"] = red_pixels(png, m["allowed"])
    m["logs"] = logs
    page.close()
    return m


def mark(ok):
    return "합격" if ok else "**불합격**"


def judge(part, res):
    cell, notes = {}, []
    m = res.get((358, "main"))
    cell["K1"] = f"{m['height']:.0f}px {mark(m['height'] <= K1_MAX)}" if part == "todo" and m else "-"
    m = res.get((716, "main"))
    if m:
        cell["K2"] = f"{len(m['clipped'])} {mark(not m['clipped'])}"
        notes += [f"K2 716·main: {c}" for c in m["clipped"]]
    seen = [x for x in res.values() if x["height"] >= 1]
    if seen:
        least = min(x["minContrast"] for x in seen)
        cell["K3"] = f"{least:.2f} {mark(least >= K3_MIN)}"
    for k, x in res.items():
        notes += [f"K3 {k[0]}·{k[1]}: {c}" for c in x["lowContrast"]]
    small = [(k, t) for k, x in res.items() if k[0] == 358 for t in x["targets"]]
    if small:
        least = min(min(t["w"], t["h"]) for _, t in small)
        bad = [(k, t) for k, t in small if min(t["w"], t["h"]) < K4_MIN or t["hidden"]]
        cell["K4"] = f"{least:.0f}px {mark(not bad)}"
        notes += [f"K4 358·{k[1]}: '{t['name']}' {t['w']:.0f}x{t['h']:.0f}" for k, t in bad]
    mains = [(k, x) for k, x in res.items() if k[1] == "main"]
    if mains:
        out = sum(x["red_out"] for _, x in mains)
        bad = [t for _, x in mains for t in x["badDanger"]]
        cell["K5"] = f"{out}px {mark(out == 0 and not bad)}"
        notes += [f"K5 {k[0]}·main: 밖 {x['red_out']}px" for k, x in mains if x["red_out"]]
        notes += [f"K5 잘못 단 위험 표시 '{t}'" for t in bad]
    if part == "todo" and (977, "main") in res:
        total = res[(977, "main")]["total"]
        bad = [(k, x["heads"]) for k, x in mains if not x["heads"] or any(h != total for h in x["heads"])]
        cell["K6"] = f"{res[(977, 'main')]['heads']}/{total} {mark(not bad)}"
        notes += [f"K6 {k[0]}·main: 머리 수 {h}, 데이터 {total}" for k, h in bad]
    m = res.get((977, "normal"))
    if part in K7_MAX and m:
        cell["K7"] = f"{m['height']:.0f}px {mark(m['height'] <= K7_MAX[part])}"
    for (w, d), x in res.items():
        if x["logs"]:
            notes.append(f"로그 {w}·{d}: {x['logs'][:2]}")
    return cell, notes


HEAD = [
    "| 부분·안 | K1 390·main ③ 높이≤700 | K2 716·main 잘림 | K3 최저 대비 | K4 390 누르는 자리 | K5 위험 색 밖 | K6 ③ 수(머리/데이터) | K7 977·normal 높이(⑤≤160, 사용 가능≤56) |",
    "|---|---|---|---|---|---|---|---|",
]


def main():
    a = parse_args(__doc__, lambda ap: ap.add_argument("--out", default=None))
    lines, details, heights = list(HEAD), [], []
    with sync_playwright() as p:
        b = launch(p)
        for part, v in a.pvs:
            res = {(w, d): measure(b, part, v, w, d) for w, d in a.cases}
            cell, notes = judge(part, res)
            name = part if part == "todo" else f"{part} {v}"
            lines.append(
                f"| {name} | " + " | ".join(cell.get(k, "-") for k in ["K1", "K2", "K3", "K4", "K5", "K6", "K7"]) + " |"
            )
            details += [f"- {name} {n}" for n in notes]
            heights.append(
                f"- {name} 높이: "
                + ", ".join(f"{w}·{d} {x['height']:.0f}" + ("(숨김)" if x["height"] < 1 else "") for (w, d), x in res.items())
            )
        b.close()
    text = "\n".join(lines + [""] + heights + ([""] + details if details else []))
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
