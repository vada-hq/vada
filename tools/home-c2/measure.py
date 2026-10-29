"""c2 성공 기준 K1~K7(명세 c2-spec.md 8절)을 DOM·픽셀로 재서 md 표로 낸다.
사용: python -X utf8 -W ignore tools/home-c2/measure.py -v e1 [-d ...] [-w ...] [--out 파일.md]
기본: 3폭 x 5견본 = 15번 연다. K마다 필요한 폭·견본이 묶음에 없으면 '-'.

K1 358·main 상자 높이 <= 600
K2 716·main, 716·long 글이 상자 밖으로 나가거나 넘쳐 잘린 수 = 0 (text-overflow: ellipsis·line-clamp 안은 제외)
K3 전 묶음 보이는 글의 글자색 대 배경색 대비 최저 >= 4.5
K4 358 묶음의 누르는 것(button, a, role, tabindex) 짧은 변 >= 44, 투명해 안 보이는 행동은 불합격
K5 main 묶음 스크린샷의 빨강 픽셀(색상 345~360·0~12도, 채도 >= 0.15, 명도 >= 0.3) 가운데
   [data-c2-danger] 요소 상자(+2px) 밖의 수 = 0. [data-c2-danger] 글에 '지남'·'초과'가 없으면 그것도 불합격
K6 main의 '전체 n개'와 제목 옆 수(목록·[data-c2-event]가 없는 머리 상자 안의 수) = total
K7 977·quiet 신호 없는 행사([data-c2-event="<id>"]) 하나하나의 높이 <= 64 (표시가 없으면 불합격)"""

import sys
import colorsys
import io
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCALE, launch, open_page, parse_args, root_box

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")
DATA_JS = """async d => {
  const m = await import('/src/home/c2/c2-data.ts')
  return { ...m.C2_DATA[d], shown: m.C2_SHOWN }
}"""
K1_MAX, K3_MIN, K4_MIN, K7_MAX = 600, 4.5, 44, 64


def red_pixels(png, allowed):
    img = Image.open(io.BytesIO(png)).convert("RGB")
    boxes = [
        (
            a["x"] * SCALE,
            a["y"] * SCALE,
            (a["x"] + a["w"]) * SCALE,
            (a["y"] + a["h"]) * SCALE,
        )
        for a in allowed
    ]
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


def measure(browser, v, w, d):
    page, logs = open_page(browser, v, w, d)
    data = page.evaluate(DATA_JS, d)
    m = page.evaluate(
        JS, {"events": data["events"], "total": data["total"], "shown": data["shown"]}
    )
    if m.get("error"):
        sys.exit(f"{v} {w}·{d}: {m['error']}")
    if d == "main":
        box = root_box(page)
        png = page.screenshot(
            clip={"x": box["x"], "y": box["y"], "width": box["w"], "height": box["h"]},
            full_page=True,
        )
        m["red_out"], m["red_in"] = red_pixels(png, m["allowed"])
    m["data"] = data
    m["logs"] = logs
    page.close()
    return m


def mark(ok):
    return "합격" if ok else "**불합격**"


def k2(res, notes):
    ms = [(k, res[k]) for k in ((716, "main"), (716, "long")) if k in res]
    if not ms:
        return "-"
    n = sum(len(m["clipped"]) for _, m in ms)
    notes += [f"K2 {k[0]}·{k[1]}: {c}" for k, m in ms for c in m["clipped"]]
    notes += [
        f"(참고) 잘림 {k[0]}·{k[1]}: {c}"
        for k, m in res.items()
        if k[0] != 716 or k[1] not in ("main", "long")
        for c in m["clipped"]
    ]
    return f"{n} {mark(n == 0)}"


def k4(res, notes):
    small = [(k, t) for k, m in res.items() if k[0] == 358 for t in m["targets"]]
    if not small:
        return (
            "-"
            if not any(k[0] == 358 for k in res)
            else f"누르는 것 없음 {mark(False)}"
        )
    least = min(min(t["w"], t["h"]) for _, t in small)
    bad = [(k, t) for k, t in small if min(t["w"], t["h"]) < K4_MIN or t["hidden"]]
    notes += [
        f"K4 358·{k[1]}: '{t['name']}' {t['w']:.0f}x{t['h']:.0f}{' (숨김)' if t['hidden'] else ''}"
        for k, t in bad
    ]
    return f"{least:.0f}px {mark(not bad)}"


def k5(res, notes):
    mains = [(k, m) for k, m in res.items() if k[1] == "main"]
    if not mains:
        return "-"
    out = sum(m["red_out"] for _, m in mains)
    bad = [(k, t) for k, m in mains for t in m["badDanger"]]
    notes += [
        f"K5 {k[0]}·main: 밖 {m['red_out']}px (표시 안 {m['red_in']}px)"
        for k, m in mains
        if m["red_out"]
    ]
    notes += [
        f"K5 {k[0]}·main: data-c2-danger가 지남·초과가 아닌 글에 달림 '{t}'"
        for k, t in bad
    ]
    return f"{out}px {mark(out == 0 and not bad)}"


def k6(res, notes):
    m = res.get((977, "main")) or next(
        (m for k, m in res.items() if k[1] == "main"), None
    )
    if not m:
        return "-"
    total = m["data"]["total"]
    bad = [
        (k, x)
        for k, x in res.items()
        if k[1] == "main" and (not x["heads"] or any(h != total for h in x["heads"]))
    ]
    notes += [f"K6 {k[0]}·main: 머리 수 {x['heads']}, 데이터 {total}" for k, x in bad]
    return f"{m['heads']}/{total} {mark(not bad)}"


def k7(res, notes):
    m = res.get((977, "quiet"))
    if not m:
        return "-"
    quiet_ids = [
        e["id"] for e in m["data"]["events"][: m["data"]["shown"]] if not e["signals"]
    ]
    boxes = [b for b in m["eventBoxes"] if b["id"] in quiet_ids]
    if not boxes:
        notes.append(
            f"K7 977·quiet: 신호 없는 행사의 [data-c2-event] 표시가 없음({', '.join(quiet_ids)})"
        )
        return f"표시 없음 {mark(False)}"
    worst = max(b["h"] for b in boxes)
    notes += [
        f"K7 977·quiet: {b['id']} 높이 {b['h']:.0f}" for b in boxes if b["h"] > K7_MAX
    ]
    return f"{worst:.0f}px {mark(worst <= K7_MAX)}"


def extra_notes(res, notes):
    for (w, d), m in res.items():
        expect = min(m["data"]["total"], m["data"]["shown"])
        ids = [b["id"] for b in m["eventBoxes"]]
        if ids and len(ids) != expect:
            notes.append(f"상한: {w}·{d} 보이는 행사 표시 {len(ids)}, 기대 {expect}")
        if not ids and expect:
            notes.append(
                f"표시: {w}·{d} [data-c2-event] 없음(이름으로 본 행사 {m['shownByName']})"
            )
        if m["twiceIds"]:
            notes.append(f"두 번: {w}·{d} {m['twiceIds']}")
        if m["unknownIds"]:
            notes.append(f"모르는 id: {w}·{d} {m['unknownIds']}")
        if m["logs"]:
            notes.append(f"로그 {w}·{d}: {m['logs'][:2]}")


def judge(res):
    """res: {(w, d): m} -> (K별 칸 글, 덧 글 목록)"""
    cell, notes = {}, []
    m = res.get((358, "main"))
    cell["K1"] = f"{m['height']:.0f}px {mark(m['height'] <= K1_MAX)}" if m else "-"
    cell["K2"] = k2(res, notes)
    worst = min(res.items(), key=lambda kv: kv[1]["minContrast"])
    cell["K3"] = (
        f"{worst[1]['minContrast']:.2f} {mark(worst[1]['minContrast'] >= K3_MIN)}"
    )
    for k, x in res.items():
        notes += [f"K3 {k[0]}·{k[1]}: {c}" for c in x["lowContrast"]]
    cell["K4"] = k4(res, notes)
    cell["K5"] = k5(res, notes)
    cell["K6"] = k6(res, notes)
    cell["K7"] = k7(res, notes)
    extra_notes(res, notes)
    return cell, notes


HEAD = [
    "| 안 | K1 390·main 높이≤600 | K2 716·main·long 잘림 | K3 최저 대비 | K4 390 누르는 자리 | K5 위험 색 밖 | K6 수(머리/데이터) | K7 977·quiet 조용한 행사≤64 |",
    "|---|---|---|---|---|---|---|---|",
]


def main():
    a = parse_args(
        __doc__,
        lambda ap: ap.add_argument("--out", default=None, help="표를 이 파일에도 쓴다"),
    )
    lines, details, heights = list(HEAD), [], []
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            res = {(w, d): measure(b, v, w, d) for w, d in a.cases}
            cell, notes = judge(res)
            lines.append(
                f"| {v} | "
                + " | ".join(
                    cell[k] for k in ["K1", "K2", "K3", "K4", "K5", "K6", "K7"]
                )
                + " |"
            )
            details += [f"- {v} {n}" for n in notes]
            heights.append(
                f"- {v} 높이: "
                + ", ".join(
                    f"{w}·{d} {m['height']:.0f} (행사 {len(m['eventBoxes']) or m['shownByName']})"
                    for (w, d), m in res.items()
                )
            )
        b.close()
    text = "\n".join(lines + [""] + heights + ([""] + details if details else []))
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
