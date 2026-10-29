"""신청자 화면 시안 찍기 + 간단 측정. 페이지 전체를 찍는다(공개 화면이라 앱 셸 없음, 2배율).
사용: python -X utf8 -W ignore tools/form-apply/shoot.py -v v1 [-s apply,done] [-d main,long] [-w 390] [--state busy] [--no-shot]
기본: 고른 variant마다 apply(main·free·long) + done(main·free·long·dayof) + closed(full·before·paused·ended·cancelled·moved)
      x 폭 390·1280 = 26장.
저장: notes/integration/review/screens/events/form-apply/<v>/<v>-<screen>-<data>-<폭>.png (--state가 idle이 아니면 -<state> 붙음)
측정(한 장마다 한 줄): 첫 칸 y(390에서 700 이하면 첫 화면 안), 가로 넘침, 44px 미만 누르는 대상 수와 앞 3개, 페이지 높이, 콘솔 경고."""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import FIRST_SCREEN, PHONE, launch, open_page, parse_args, shot_path

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")


def line(v, s, d, w, m, logs):
    first = m["first"]
    if first is None:
        first_text = "첫 칸 없음"
    elif w == PHONE:
        first_text = f"첫 칸 y={first}({'첫 화면 안' if first <= FIRST_SCREEN else '첫 화면 밖'})"
    else:
        first_text = f"첫 칸 y={first}"
    small = m["small"]
    parts = [
        f"{v}-{s}-{d}-{w}",
        first_text,
        f"가로 넘침 {'있음' if m['overflow'] else '없음'}",
        f"44px 미만 {len(small)}" + (f" {small[:3]}" if small else ""),
        f"높이 {m['height']}",
    ]
    if w == PHONE and not m["coarse"]:
        parts.append("pointer: coarse 아님(!)")
    if logs:
        parts.append(f"로그 {logs[:3]}")
    return "  ".join(parts)


def main():
    def extra(ap):
        ap.add_argument("--no-shot", action="store_true", help="찍지 않고 측정만")

    a = parse_args(__doc__, extra)
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            for s, d, w in a.cases:
                page, logs = open_page(b, v, s, d, w, a.state)
                m = page.evaluate(JS)
                if m.get("error"):
                    sys.exit(f"{v}-{s}-{d}-{w}: {m['error']}")
                if not a.no_shot:
                    path = shot_path(v, s, d, w)
                    if a.state != "idle":
                        path = path.with_name(f"{path.stem}-{a.state}.png")
                    path.parent.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(path), full_page=True)
                print(line(v, s, d, w, m, logs))
                page.close()
        b.close()


if __name__ == "__main__":
    main()
