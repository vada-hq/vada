"""B2 시안(10/29 내용 확정판) 찍기와 K1~K14 측정. 사용: python -X utf8 -W ignore run.py <회차> [이름 거르기]
결과: C:/tmp/home-s7/r<회차>/ (원본 캡처, 흐림판, measure.json)"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROUND = sys.argv[1]
ONLY = sys.argv[2] if len(sys.argv) > 2 else None
BASE = "http://127.0.0.1:5291/home-s5.html?variant=B2"
OUT = Path(f"C:/tmp/home-s7/r{ROUND}")
OUT.mkdir(parents=True, exist_ok=True)
MEASURE = Path(__file__).with_name("measure.js").read_text(encoding="utf8")
# (데이터, 폭, 인사)
CASES = [
    (d, w, g) for d in ["main"] for w in [1280, 1024, 390] for g in ["line", "date"]
]
CASES += [
    (d, w, g)
    for d in ["normal"]
    for w in [1280, 390]
    for g in ["line", "date", "merge"]
]
CASES += [(d, w, g) for d in ["empty"] for w in [1280, 390] for g in ["line", "date"]]
FIRST = 836
SECTIONS = {
    "s7-greeting": "머리",
    "s7-attention": "①",
    "s7-events": "②",
    "s7-todo": "③",
    "s7-week": "⑤",
    "s7-available": "사용 가능",
}
HIDE_FIXED = """() => {
  const root = document.querySelector('[data-s5-variant]')
  for (const el of document.querySelectorAll('body *')) {
    const p = getComputedStyle(el).position
    if ((p === 'fixed' || p === 'sticky') && !root.contains(el)) el.style.visibility = 'hidden'
  }
}"""


def blur_of(img):
    return img.convert("L").filter(ImageFilter.GaussianBlur(6))


def region_mean(blur, r, ymax=None):
    x0, y0 = int(r["x"]), int(r["y"])
    x1, y1 = int(r["x"] + r["w"]), int(r["y"] + r["h"])
    if ymax is not None:
        y1 = min(y1, ymax)
    if y1 - y0 < 4 or x1 - x0 < 4:
        return None
    data = list(blur.crop((x0, y0, x1, y1)).getdata())
    return round(sum(data) / len(data), 1)


def k1(blur, m, ymax=None):
    """흑백에서는 값만 기록(규칙 5절 K1, 10/29). 구역 평균 밝기와 본문 최저점 위치."""
    means = {}
    for key, label in SECTIONS.items():
        rect = m["rects"].get(key)
        if not rect:
            continue
        r = rect["box"] if key in ("s7-greeting", "s7-available") else rect["content"]
        got = region_mean(blur, r, ymax)
        if got is not None:
            means[label] = got
    root = m["root"]
    y1 = (
        int(root["y"] + root["h"])
        if not ymax
        else min(int(root["y"] + root["h"]), ymax)
    )
    body = blur.crop((int(root["x"]), int(root["y"]), int(root["x"] + root["w"]), y1))
    pixels = list(body.getdata())
    lo = min(pixels)
    idx = pixels.index(lo)
    w = body.size[0]
    px, py = int(root["x"]) + idx % w, int(root["y"]) + idx // w
    box = m["rects"].get("s7-attention", {}).get("box")
    inside = bool(
        box
        and box["x"] <= px <= box["x"] + box["w"]
        and box["y"] <= py <= box["y"] + box["h"]
    )
    order = sorted(means.items(), key=lambda kv: kv[1])
    gap = round(order[1][1] - order[0][1], 1) if len(order) > 1 else None
    return {
        "means": means,
        "order": [k for k, _ in order],
        "gap": gap,
        "darkest": lo,
        "darkestAt": [px, py],
        "darkestInAttention": inside,
    }


def k2(img, m):
    """채도>0.15·명도>0.2 픽셀 수(참고)와 그중 회색 팔레트 색조(195~245도) 밖 픽셀 수(판정)"""
    root = m["root"]
    crop = img.convert("RGB").crop(
        (
            int(root["x"]),
            int(root["y"]),
            int(root["x"] + root["w"]),
            int(root["y"] + root["h"]),
        )
    )
    raw = off = 0
    for h, s, v in crop.convert("HSV").getdata():
        if s / 255 > 0.15 and v / 255 > 0.2:
            raw += 1
            if not 195 <= h * 360 / 255 <= 245:
                off += 1
    return {"raw": raw, "offGray": off}


def shoot(browser, data, width, greeting):
    mobile = width < 640
    page = browser.new_page(
        viewport={"width": width, "height": 900},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=1,
    )
    logs = []
    page.on(
        "console",
        lambda msg: (
            logs.append(f"{msg.type}: {msg.text}")
            if msg.type in ("warning", "error")
            else None
        ),
    )
    page.on("pageerror", lambda e: logs.append(f"pageerror: {e}"))
    page.goto(f"{BASE}&data={data}&greeting={greeting}")
    page.wait_for_selector("[data-s5-variant]", timeout=20000)
    page.wait_for_timeout(700)
    name = f"{width}-{data}-{greeting}"
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    page.screenshot(path=str(OUT / f"{name}-first.png"))
    m = page.evaluate(MEASURE)
    page.evaluate(HIDE_FIXED)
    page.screenshot(path=str(OUT / f"{name}-bodyonly.png"), full_page=True)
    img = Image.open(OUT / f"{name}-bodyonly.png")
    blur_of(Image.open(OUT / f"{name}.png")).save(OUT / f"{name}-blur.png")
    m["k2"] = k2(img, m)
    if data == "main" and width in (1280, 390):
        m["k1"] = k1(blur_of(img), m, FIRST if width == 390 else None)
    m["logs"] = logs
    page.close()
    return name, m


def ask_shot(browser):
    """[묻기] 창 시늉: 물은 줄(답 있음)을 눌러 대화 패널을 연 화면"""
    page = browser.new_page(
        viewport={"width": 1280, "height": 900}, device_scale_factor=1
    )
    page.goto(f"{BASE}&data=main&greeting=line")
    page.wait_for_selector("[data-s5-variant]", timeout=20000)
    page.wait_for_timeout(500)
    page.get_by_role("button", name="10월 28일 물어봄").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "1280-main-line-ask.png"))
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    page.get_by_role("button", name="묻기").first.click()
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "1280-main-line-ask-new.png"))
    page.close()


def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--disable-lcd-text", "--force-color-profile=srgb"]
        )
        for data, width, greeting in CASES:
            if ONLY and ONLY not in f"{width}-{data}-{greeting}":
                continue
            name, m = shoot(browser, data, width, greeting)
            results[name] = m
            print(name, "logs", len(m["logs"]))
        if not ONLY:
            ask_shot(browser)
        browser.close()
    (OUT / "measure.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=1), encoding="utf8"
    )


main()
