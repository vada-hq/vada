"""보드 시안 K1~K10 재기(명세 board-spec.md 6절). 안마다 찍는 여섯 장과 같은 경우를 열어 DOM으로 잰다.
사용: python -X utf8 -W ignore tools/tasks-board/measure.py -v b1[,b2,b3] [--json out.json]
K8은 1280·main에서 '⋯'의 평소 투명도와 첫 카드에 마우스를 올린 뒤 투명도를 잰다."""

import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
from common import CASES, launch, open_page, parse_args

JS = (Path(__file__).parent / "measure.js").read_text(encoding="utf-8")
EXPECT = {"main": (6, 4, 3), "adding": (6, 4, 3), "few": (2, 1, 0), "many": (14, 6, 8)}
STATUSES = ("todo", "doing", "done")


def k9_ok(m, d):
    exp = EXPECT[d]
    if m["counts"]:
        return all(
            m["counts"].get(s, {}).get("head") == str(n) and m["counts"][s]["cards"] == n
            for s, n in zip(STATUSES, exp)
        )
    want = [f"할 일 {exp[0]}", f"진행 중 {exp[1]}", f"끝남 {exp[2]}"]
    return m["tabs"] == want


def hover_opacity(page):
    card = page.locator("[data-board-root] [data-card]").first
    card.hover()
    page.wait_for_timeout(300)
    return card.locator("[data-card-menu]").evaluate(
        "el => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o }"
    )


def measure_variant(browser, v):
    rows = {}
    for w, d in CASES:
        page, logs = open_page(browser, v, w, d)
        m = page.evaluate(JS, {})
        if (w, d) == (1280, "main"):
            m["menuHover"] = hover_opacity(page)
        m["logs"] = logs[:3]
        rows[f"{w}-{d}"] = m
        page.close()
    return rows


def verdict(rows):
    m1280, m1920, m390, many = rows["1280-main"], rows["1920-main"], rows["390-main"], rows["1280-many"]
    min_c = min(r["minC"]["c"] for r in rows.values())
    bad = [x for r in rows.values() for x in r["dangerBad"]]
    k9 = {k: k9_ok(r, k.split("-")[1]) for k, r in rows.items()}
    return [
        ("K1", f"{m1280['firstTop']:.0f}", m1280["firstTop"] <= 380),
        ("K2", str(m1280["fully"]), m1280["fully"] >= 8),
        ("K3", f"{m1920['firstTop']:.0f}", m1920["firstTop"] <= 380),
        ("K4", f"{m390['firstTop']:.0f}", m390["firstTop"] <= 520),
        ("K5", f"{min_c:.2f} ('{min(rows.values(), key=lambda r: r['minC']['c'])['minC']['t']}')", min_c >= 4.5),
        ("K6", f"그 밖 {len(bad)}" + (f" {bad[:3]}" if bad else ""), not bad),
        ("K7", f"잘림 {len(many['clipped'])}, 넘침 {many['pageOverflow']}, 칩 칸 숨은 폭 {[c['hidden'] for c in many['chipScroll']]}px",
         not many["clipped"] and not many["pageOverflow"]),
        ("K8", f"평소 {m1280['menuOpacity']}, 올림 {m1280['menuHover']}", m1280["menuOpacity"] == 0 and m1280["menuHover"] == 1),
        ("K9", ", ".join(f"{k} {'같음' if ok else '다름'}" for k, ok in k9.items()), all(k9.values())),
        ("K10", f"44 미만 {m390['smallCount']}" + (f" {m390['small'][:4]}" if m390["small"] else ""), m390["smallCount"] == 0),
    ]


def main():
    a = parse_args(__doc__)
    out = {}
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            rows = measure_variant(b, v)
            out[v] = rows
            print(f"\n## {v}")
            print("| K | 값 | 판정 |\n|---|---|---|")
            for k, val, ok in verdict(rows):
                print(f"| {k} | {val} | {'합격' if ok else '불합격'} |")
            print(f"(1280 조작 줄 높이 main {rows['1280-main']['toolbarH']:.0f} / many {rows['1280-many']['toolbarH']:.0f}, 칩 칸 숨은 폭 main {[c['hidden'] for c in rows['1280-main']['chipScroll']]})")
            logs = {k: r["logs"] for k, r in rows.items() if r["logs"]}
            if logs:
                print("로그", logs)
        b.close()
    if "--json" in sys.argv:
        Path(sys.argv[sys.argv.index("--json") + 1]).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
