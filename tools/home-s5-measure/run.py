"""S5 시안 찍기와 K1~K14 측정. 사용: python -X utf8 run.py <회차> [A B C]"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

ROUND = sys.argv[1]
VARIANTS = sys.argv[2:] or ["A", "B", "C"]
BASE = "http://127.0.0.1:5291/home-s5.html"
OUT = Path(f"C:/tmp/home-s5/r{ROUND}")
OUT.mkdir(parents=True, exist_ok=True)
MEASURE = Path("C:/tmp/home-s5/measure.js").read_text(encoding="utf8")
CASES = [
    ("main", 1280),
    ("main", 1024),
    ("main", 390),
    ("normal", 1280),
    ("normal", 390),
    ("empty", 1280),
    ("empty", 390),
]
FIRST = 836
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
    clipped = ymax is not None and r['y'] + r['h'] > ymax
    if y1 - y0 < (40 if clipped else 4) or x1 - x0 < 4:
        return None
    crop = blur.crop((x0, y0, x1, y1))
    data = list(crop.getdata())
    return round(sum(data) / len(data), 1), min(data)


def k1(blur, m, ymax=None):
    names = {
        "s5-greeting": "인사",
        "s5-attention": "①",
        "s5-events": "②",
        "s5-finish": "③",
        "s5-finance": "④",
        "s5-upcoming": "⑤",
    }
    means = {}
    for key, label in names.items():
        rect = m["rects"].get(key)
        if not rect:
            continue
        r = rect["box"] if key == "s5-greeting" else rect["content"]
        got = region_mean(blur, r, ymax)
        if got:
            means[label] = got[0]
    root = m["root"]
    y1 = int(root["y"] + root["h"])
    if ymax:
        y1 = min(y1, ymax)
    body = blur.crop((int(root["x"]), int(root["y"]), int(root["x"] + root["w"]), y1))
    lo = min(body.getdata())
    w = body.size[0]
    idx = list(body.getdata()).index(lo)
    px, py = int(root["x"]) + idx % w, int(root["y"]) + idx // w
    box = m["rects"]["s5-attention"]["box"]
    in_attention = (
        box["x"] <= px <= box["x"] + box["w"] and box["y"] <= py <= box["y"] + box["h"]
    )
    order = sorted(means.items(), key=lambda kv: kv[1])
    first = order[0] if order else None
    second = order[1] if len(order) > 1 else None
    ok = bool(
        first
        and first[0] == "①"
        and second
        and second[1] - first[1] >= 3
        and in_attention
    )
    return {
        "means": means,
        "darkest": lo,
        "darkestAt": [px, py],
        "darkestInAttention": in_attention,
        "ok": ok,
        "gap": round(second[1] - first[1], 1) if first and second else None,
        "order": [k for k, _ in order],
    }


def k2(img, m):
    """규칙 그대로(채도>0.15, 명도>0.2)인 픽셀 수와, 그중 회색 팔레트 색조(195~245도) 밖인 픽셀 수"""
    root = m['root']
    crop = img.convert('RGB').crop((int(root['x']), int(root['y']), int(root['x'] + root['w']), int(root['y'] + root['h'])))
    raw = off = 0
    for (h, s, v) in crop.convert('HSV').getdata():
        if s / 255 > 0.15 and v / 255 > 0.2:
            raw += 1
            deg = h * 360 / 255
            if not 195 <= deg <= 245:
                off += 1
    return {'raw': raw, 'offGray': off}


def main():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--disable-lcd-text', '--force-color-profile=srgb'])
        for variant in VARIANTS:
            for data, width in CASES:
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
                page.goto(f"{BASE}?variant={variant}&data={data}")
                page.wait_for_selector("[data-s5-variant]", timeout=20000)
                page.wait_for_timeout(700)
                name = f"{variant}-{width}" + ("" if data == "main" else f"-{data}")
                full = OUT / f"{name}.png"
                page.screenshot(path=str(full), full_page=True)
                page.screenshot(path=str(OUT / f"{name}-first.png"))
                m = page.evaluate(MEASURE)
                page.evaluate(HIDE_FIXED)
                page.screenshot(path=str(OUT / f"{name}-bodyonly.png"), full_page=True)
                img = Image.open(OUT / f"{name}-bodyonly.png")
                blur = blur_of(Image.open(full))
                blur.save(OUT / f"{name}-blur.png")
                bblur = blur_of(img)
                m["k2"] = k2(img, m)
                if data == "main" and width in (1280, 390):
                    m["k1"] = k1(bblur, m, FIRST if width == 390 else None)
                m["logs"] = logs
                results[name] = m
                page.close()
                print(name, "done", len(logs), "logs")
        browser.close()
    (OUT / "measure.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=1), encoding="utf8"
    )


main()
