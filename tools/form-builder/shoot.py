"""양식 만들기 화면 시안 찍기 + 간단 측정. 페이지 전체(셸 자리 상자 포함, 2배율)를 찍는다.
사용: python -X utf8 -W ignore tools/form-builder/shoot.py -v v1 [-s card,editor] [-d active,filled] [-w 1280] [--no-shot]
기본: 고른 variant마다 card(active·draft·ready·paused·ended·multi) + editor(new·filled·locked·error) + empty(none)
      x 폭 1280·390 = 22장.
저장: notes/integration/review/screens/events/form-builder/<v>/<v>-<screen>-<data>-<폭>.png
측정(한 장마다 한 줄): card는 [링크 복사]·QR 아랫변 y(1280은 첫 화면 800 안인지), editor는 [만들기]·[저장] 아랫변 y,
      가로 넘침, 44px 미만 누르는 대상 수와 앞 3개(390이 기준, 1280은 참고), 페이지 높이, 콘솔 경고."""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import DESK, PHONE, VIEW, launch, open_page, parse_args, shot_path

JS = Path(__file__).with_name("measure.js").read_text(encoding="utf8")


def at(label, y, w):
    if y is None:
        return f"{label} 없음"
    if w == DESK:
        return f"{label} y={y}({'첫 화면 안' if y <= VIEW[DESK] else '첫 화면 밖'})"
    return f"{label} y={y}"


def line(v, s, d, w, m, logs):
    parts = [f"{v}-{s}-{d}-{w}"]
    if s == "card" and d != "draft" and d != "ready":
        parts += [at("링크 복사", m["copy"], w), at("QR 아래", m["qr"], w)]
    if s == "editor":
        parts.append(f"버튼 아래 y={m['submit']}" if m["submit"] is not None else "버튼 없음")
    small = m["small"]
    parts += [
        f"가로 넘침 {'있음' if m['overflow'] else '없음'}",
        f"44px 미만 {len(small)}" + (f" {small[:3]}" if small else ""),
        f"높이 {m['height']}",
    ]
    if w == PHONE and not m["coarse"]:
        parts.append("pointer: coarse 아님(!)")
    if logs:
        parts.append(f"로그 {[log[:120] for log in logs[:3]]}")
    return "  ".join(parts)


def main():
    def extra(ap):
        ap.add_argument("--no-shot", action="store_true", help="찍지 않고 측정만")

    a = parse_args(__doc__, extra)
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            for s, d, w in a.cases:
                page, logs = open_page(b, v, s, d, w)
                m = page.evaluate(JS)
                if m.get("error"):
                    sys.exit(f"{v}-{s}-{d}-{w}: {m['error']}")
                if not a.no_shot:
                    path = shot_path(v, s, d, w)
                    path.parent.mkdir(parents=True, exist_ok=True)
                    page.screenshot(path=str(path), full_page=True)
                print(line(v, s, d, w, m, logs))
                page.close()
        b.close()


if __name__ == "__main__":
    main()
