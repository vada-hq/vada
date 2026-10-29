"""c2 찍기. 컴포넌트([data-c2-root])만 잘라 저장한다(둘레 8px, 2배율).
사용: python -X utf8 -W ignore tools/home-c2/shoot.py -v e1 [-d main,quiet] [-w 977,358] [--no-hover]
기본: 고른 variant마다 3폭 x 5견본(main·quiet·one·empty·long) = 15장 + 977·main hover 1장.
저장: notes/integration/review/screens/home/c2/e{N}/c2-e{N}-{977|716|358}-{data}[-hover].png"""

import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import launch, open_page, parse_args, root_box, shot_path

PAD = 8  # 그림자가 잘리지 않게 둘레 여백(CSS px)


def shoot(browser, v, w, d, hover=False):
    page, logs = open_page(browser, v, w, d)
    if hover:
        # 첫 행사([data-c2-event]), 없으면 첫 줄(li)·첫 단추, 그것도 없으면 컴포넌트에 마우스를 올린다
        for sel in (
            "[data-c2-root] [data-c2-event]",
            "[data-c2-root] li",
            "[data-c2-root] button",
            "[data-c2-root] > *",
        ):
            if page.locator(sel).count():
                page.locator(sel).first.hover(timeout=5000)
                break
        page.wait_for_timeout(250)
    box = root_box(page)
    path = shot_path(v, w, d, hover)
    path.parent.mkdir(parents=True, exist_ok=True)
    clip = {
        "x": max(0, box["x"] - PAD),
        "y": max(0, box["y"] - PAD),
        "width": box["w"] + 2 * PAD,
        "height": box["h"] + 2 * PAD,
    }
    page.screenshot(path=str(path), clip=clip, full_page=True)
    print(
        f"{path.name}  높이 {box['h']:.0f}px" + (f"  로그 {logs[:3]}" if logs else "")
    )
    page.close()


def main():
    a = parse_args(
        __doc__,
        lambda ap: ap.add_argument(
            "--no-hover", action="store_true", help="977·main hover 장을 빼기"
        ),
    )
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            for w, d in a.cases:
                shoot(b, v, w, d)
            if not a.no_hover:
                shoot(b, v, 977, "main", hover=True)
        b.close()


if __name__ == "__main__":
    main()
