"""c1r 찍기. 컴포넌트([data-c1r-root])만 잘라 저장한다.
사용: python -X utf8 -W ignore tools/home-c1r/shoot.py [-v 0,1 | -v f3] [-d main,many] [-w 977,358] [--hover] [-t a]
기본: 고른 variant마다 3폭 x (main, normal, empty) + many 977.
저장: notes/integration/review/screens/home/c1r/v{N}/c1r-v{N}-{977|716|358}-{data}[-hover][-t{테마}].png
      f 변형: notes/integration/review/screens/home/c1f/f{N}/c1f-f{N}-{977|716|358}-{data}[-hover][-t{테마}].png
(테마 base는 이름에 붙이지 않는다)"""
import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import launch, open_page, parse_args, root_box, shot_path

PAD = 8  # 그림자가 잘리지 않게 둘레 여백(CSS px)


def shoot(browser, v, w, d, hover=False, theme="base"):
    page, logs = open_page(browser, v, w, d, theme)
    if hover:
        # 첫 줄(li), 없으면 첫 단추, 그것도 없으면 컴포넌트 가운데에 마우스를 올린다
        for sel in ("[data-c1r-root] li", "[data-c1r-root] button", "[data-c1r-root] > *"):
            if page.locator(sel).count():
                page.locator(sel).first.hover(timeout=5000)
                break
        page.wait_for_timeout(250)
    box = root_box(page)
    path = shot_path(v, w, d, hover, theme)
    path.parent.mkdir(parents=True, exist_ok=True)
    name = path.name
    clip = {"x": max(0, box["x"] - PAD), "y": max(0, box["y"] - PAD), "width": box["w"] + 2 * PAD, "height": box["h"] + 2 * PAD}
    page.screenshot(path=str(path), clip=clip, full_page=True)
    print(f"{name}  높이 {box['h']:.0f}px" + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def main():
    a = parse_args(__doc__, lambda ap: ap.add_argument("--hover", action="store_true", help="977·main hover 한 장 더"))
    with sync_playwright() as p:
        b = launch(p)
        for v in a.variants:
            for w, d in a.cases:
                shoot(b, v, w, d, theme=a.theme)
            if a.hover:
                shoot(b, v, 977, "main", hover=True, theme=a.theme)
        b.close()


if __name__ == "__main__":
    main()
