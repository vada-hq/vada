"""배치 시안 낱장 찍기. 판(board.py)에 필요한 것만 찍는다(디스크 절약).
사용: python -X utf8 -W ignore tools/home-layout/shoot.py [-p L1,L2,L3] [--set board|all]
  board: 안마다 1280 평소 · 1280 신호 많은 날 · 390 평소 첫 화면 + L1 1280 평소 week b
  all:   안마다 3폭 x 3하루(week a)
390은 첫 화면(아래 탭 포함)만, 1280·1024는 페이지 전체를 찍는다."""

import argparse
import sys

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import DAYS, PLANS, VIEW, launch, open_page, shot_path


def cases(plans, which):
    if which == "all":
        return [(p, d, w, "a") for p in plans for d in DAYS for w in VIEW]
    out = [(p, d, w, "a") for p in plans for d, w in (("quiet", 1280), ("busy", 1280), ("quiet", 390))]
    return out + [("L1", "quiet", 1280, "b")]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plans", "-p", default=",".join(PLANS))
    ap.add_argument("--set", default="board", choices=["board", "all"])
    a = ap.parse_args()
    plans = [p for p in a.plans.split(",") if p in PLANS]
    with sync_playwright() as pw:
        b = launch(pw)
        for plan, day, w, week in cases(plans, a.set):
            page, logs = open_page(b, plan, day, w, week)
            out = shot_path(plan, day, w, week)
            out.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(out), full_page=not VIEW[w][1])
            print(out.name + (f"  로그 {logs[:3]}" if logs else ""))
            page.close()
        b.close()


if __name__ == "__main__":
    main()
