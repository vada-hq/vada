"""보드 시안 찍기. 첫 화면(창 크기 그대로)을 저장한다. 1280·many는 보드 전체가 보이게 창을 늘려 찍는다.
더해 1280·main에서 첫 카드에 마우스를 올린 장(-hover, 카드 '⋯' 보임)을 찍는다.
사용: python -X utf8 -W ignore tools/tasks-board/shoot.py -v b1[,b2,b3]
저장: notes/integration/review/screens/tasks/board/b{N}/b{N}-{1920|1280|390}-{data}[-hover].png"""

import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
from common import CASES, launch, open_page, parse_args, shot_path

TALL = "(() => { const m = document.querySelector('[data-board-scroll]'); return m.offsetTop + m.scrollHeight })()"


def shoot(browser, v, w, d, hover=False):
    page, logs = open_page(browser, v, w, d)
    if d == "many":
        page.set_viewport_size({"width": w, "height": page.evaluate(TALL)})
        page.wait_for_timeout(200)
    if hover:
        page.locator("[data-board-root] [data-card]").first.hover()
        page.wait_for_timeout(250)
    path = shot_path(v, w, d, "-hover" if hover else "")
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path))
    print(path.name + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def main():
    a = parse_args(__doc__)
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            for w, d in CASES:
                shoot(b, v, w, d)
            shoot(b, v, 1280, "main", hover=True)
        b.close()


if __name__ == "__main__":
    main()
