"""c35 찍기. 컴포넌트([data-c35-root])만 잘라 저장한다(둘레 8px, 2배율). 숨김(빈 상자)이면 높이 0으로 적고 찍지 않는다.
사용: python -X utf8 -W ignore tools/home-c35/shoot.py [-p todo,week] [-d main] [-w 977,358] [--stack]
기본: 부분·안마다 3폭 x 3견본. --stack은 쌓기 미리 보기(안 a·b, 977) 두 장만 찍는다.
저장: notes/integration/review/screens/home/c35/{part}/c35-{part}-{a|b}-{폭}-{data}.png, 쌓기는 stack/c35-stack-{a|b}-977.png"""

import sys
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True  # 작업 폴더에 __pycache__를 남기지 않는다
from common import SCREENS, launch, open_page, parse_args, query, root_box, shot_path

PAD = 8


def shoot(browser, q, w, path):
    page, logs = open_page(browser, q, w)
    box = root_box(page)
    if box["h"] < 1:
        print(f"{path.name}  숨김(높이 0)")
        if path.exists():
            path.unlink()
        page.close()
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    clip = {
        "x": max(0, box["x"] - PAD),
        "y": max(0, box["y"] - PAD),
        "width": box["w"] + 2 * PAD,
        "height": box["h"] + 2 * PAD,
    }
    page.screenshot(path=str(path), clip=clip, full_page=True)
    print(f"{path.name}  높이 {box['h']:.0f}px" + (f"  로그 {logs[:3]}" if logs else ""))
    page.close()


def main():
    a = parse_args(__doc__, lambda ap: ap.add_argument("--stack", action="store_true"))
    with sync_playwright() as p:
        b = launch(p)
        if a.stack:
            for v in ("a", "b"):
                shoot(b, f"part=stack&variant={v}", 977, SCREENS / "stack" / f"c35-stack-{v}-977.png")
        else:
            for part, v in a.pvs:
                for w, d in a.cases:
                    shoot(b, query(part, v, d), w, shot_path(part, v, w, d))
        b.close()


if __name__ == "__main__":
    main()
