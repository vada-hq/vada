"""배치 시안 성공 기준 L1~L5(명세 layout-spec.md 5절)를 DOM으로 재서 md 표로 낸다.
사용: python -X utf8 -W ignore tools/home-layout/measure.py [-p L1,L2,L3] [--week a|b] [--out 파일.md]
안마다 3폭(1280·1024·390) x 3하루(busy·quiet·first) = 9번 연다(배율 1, 찍지 않음).

L1 390 신호 많은 날 ① 아래 끝 y <= 836 (아래 탭 위). 실제 아래 탭 위 끝 y도 같이 적는다(창 390x844에서 787)
L2 1280 평소 ② 아래 끝 y <= 900
L3 1024 세 하루 잘림(말줄임 외) = 0. 말줄임 수와 1280·390 잘림도 같이 적는다
L4 전 묶음 [data-layout-root] 안 보이는 글 대비 최저 >= 4.5
L5 1280 두 단이면 평소 날 |왼쪽 단 - 오른쪽 단| / 큰 쪽 <= 25%. 신호 많은 날·첫날 값도 같이 적는다"""

import argparse
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import DAYS, PLANS, VIEW, launch, open_page

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")
L1_MAX, L2_MAX, L4_MIN, L5_MAX = 836, 900, 4.5, 0.25


def ok(b):
    return "합격" if b else "불합격"


def col_gap(m):
    if not m["sideBySide"]:
        return None
    left, right = m["cols"]["left"]["h"], m["cols"]["right"]["h"]
    return abs(left - right) / max(left, right), round(left), round(right)


def run(plans, week):
    res = {}
    with sync_playwright() as pw:
        b = launch(pw)
        for p in plans:
            for d in DAYS:
                for w in VIEW:
                    page, logs = open_page(b, p, d, w, week, scale=1)
                    m = page.evaluate(JS)
                    m["logs"] = logs
                    res[(p, d, w)] = m
                    page.close()
        b.close()
    return res


def row(p, res):
    busy390 = res[(p, "busy", 390)]
    c1 = busy390["zones"].get("c1")
    l1 = round(c1["bottom"]) if c1 else None
    tab = busy390["tabTop"]
    c2 = res[(p, "quiet", 1280)]["zones"].get("c2")
    l2 = round(c2["bottom"]) if c2 else None
    clip1024 = sum(len(res[(p, d, 1024)]["clipped"]) for d in DAYS)
    ell1024 = sum(len(res[(p, d, 1024)]["ellipsis"]) for d in DAYS)
    clip_other = sum(len(res[(p, d, w)]["clipped"]) for d in DAYS for w in (1280, 390))
    low = min(
        (res[(p, d, w)] for d in DAYS for w in VIEW), key=lambda m: m["minContrast"]
    )
    gaps = {d: col_gap(res[(p, d, 1280)]) for d in DAYS}
    q = gaps["quiet"]
    l5 = (
        "- (한 단)"
        if q is None
        else f"{q[0] * 100:.0f}% (왼 {q[1]} / 오 {q[2]}) {ok(q[0] <= L5_MAX)}"
    )
    extra = ", ".join(
        f"{d} {g[0] * 100:.0f}% (왼 {g[1]} / 오 {g[2]})"
        for d, g in gaps.items()
        if g and d != "quiet"
    )
    return (
        f"| {p} | {l1} {ok(l1 is not None and l1 <= L1_MAX)} (탭 위 끝 {round(tab) if tab else '-'}) "
        f"| {l2} {ok(l2 is not None and l2 <= L2_MAX)} "
        f"| {clip1024} {ok(clip1024 == 0)} (말줄임 {ell1024}, 1280·390 잘림 {clip_other}) "
        f"| {low['minContrast']} {ok(low['minContrast'] >= L4_MIN)} ('{low['minContrastText']}') "
        f"| {l5}{' / 참고 ' + extra if extra else ''} |"
    )


def heights(p, res):
    out = []
    for d in DAYS:
        for w in VIEW:
            z = ", ".join(
                f"{k} {round(v['y'])}~{round(v['bottom'])}"
                for k, v in res[(p, d, w)]["zones"].items()
            )
            out.append(f"- {p} {d} {w}: {z}")
    return out


def issues(res):
    out = []
    for (p, d, w), m in res.items():
        out += [f"- 잘림 {p} {d} {w}: {c}" for c in m["clipped"]]
        out += [f"- 말줄임 {p} {d} {w}: '{e}'" for e in m["ellipsis"]]
        out += [f"- 로그 {p} {d} {w}: {log[:80]}" for log in m["logs"]]
    return out or ["- 없음"]


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--plans", "-p", default=",".join(PLANS))
    ap.add_argument("--week", default="a", choices=["a", "b"])
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    plans = [p for p in a.plans.split(",") if p in PLANS]
    res = run(plans, a.week)
    lines = [
        f"⑤·사용 가능 안 {a.week}",
        "",
        "| 안 | L1 390 busy ① 아래 끝 y≤836 | L2 1280 quiet ② 아래 끝 y≤900 | L3 1024 잘림(말줄임 외) | L4 최저 대비 | L5 1280 두 단 높이 차(quiet) |",
        "|---|---|---|---|---|---|",
        *[row(p, res) for p in plans],
        "",
        "구역 위~아래 끝 y(첫 화면 좌표):",
        "",
    ]
    for p in plans:
        lines += heights(p, res)
    lines += ["", "잘림·말줄임·로그:", "", *issues(res)]
    text = "\n".join(lines)
    print(text)
    if a.out:
        Path(a.out).write_text(text + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
