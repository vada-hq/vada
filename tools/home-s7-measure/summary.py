"""B2 측정 요약: K1~K14와 어긋난 것. 사용: python -X utf8 summary.py <회차>"""

import json
import sys
from pathlib import Path

R = json.loads(
    Path(f"C:/tmp/home-s7/r{sys.argv[1]}/measure.json").read_text(encoding="utf8")
)
GREETING_MAX = {1280: 56, 1024: 56, 390: 96}
# 견본별 줄 수(규칙 4절): ①, ③, ⑤, 사용 가능 한 줄 유무
EXPECT = {
    "main": {"attention": 7, "todo": 6, "week": 3, "available": False},
    "normal": {"attention": 0, "todo": 1, "week": 2, "available": True},
    "empty": {"attention": 1, "todo": 0, "week": 0, "available": False},
}
bad = []
for name, m in R.items():
    width, data, greeting = name.split("-")
    width = int(width)
    c = m["content"]
    k = {}
    k["K2"] = m["k2"]["offGray"] == 0
    k["K3"] = m["filledBadges"] == 0
    box_ok = len(m["boxes"]) == (0 if (data == "normal" and greeting == "merge") else 1)
    k["K4"] = box_ok and m["shadows"] == 0 and m["depth"] <= 1 and not m["bands"]
    k["K5"] = (
        len(m["sizes"]) <= 4
        and not m["offCombos"]
        and all(h["ok"] for h in m["hierarchy"])
    )
    k["K6"] = not m["dots"]
    k["K7"] = m["greetingH"] is not None and m["greetingH"] <= GREETING_MAX[width]
    k["K9"] = m["ellipsis"] == 0 and m["clamp"] == 0 and not m["overflow"]
    k["K10"] = not m["spacing"]
    k["K11"] = m["minContrast"] >= 4.5
    k["K12"] = (
        not m["dup"]
        and not m["removed"]
        and not m["removedFromAttention"]
        and m["meters"] == 0
    )
    e = EXPECT[data]
    head_ok = (
        c["attentionHeadCount"] == (e["attention"] or None) if e["attention"] else True
    )
    k["K13"] = (
        c["attentionRows"] == e["attention"]
        and head_ok
        and c["todoRows"] == e["todo"]
        and c["weekRows"] == e["week"]
        and bool(c["availableText"]) == e["available"]
    )
    if width == 390:
        rows = m["rowHeights"] or [99]
        btns = [h for _, h in m["buttonHeights"]] or [99]
        k["K14"] = min(rows) >= 44 and min(btns) >= 44
    if width == 390 and data == "main":
        k["K8"] = m["attentionBottom"] <= 836 and m["attentionBottom"] + 56 <= 836
    fails = [key for key, ok in k.items() if not ok]
    extra = f"인사 {m['greetingH']} 대비 {m['minContrast']} 높이 {m['pageH']} ①아래 {m['attentionBottom']} 색조밖 {m['k2']['offGray']}(채도 {m['k2']['raw']}) 크기 {m['sizes']}"
    if width == 390:
        extra += f" 줄최저 {min(m['rowHeights'] or [0])} 버튼최저 {min([h for _, h in m['buttonHeights']] or [0])}"
    print(
        f"{name:22} {'합격' if not fails else '불합격 ' + ','.join(fails):24} {extra}"
    )
    if "k1" in m:
        k1 = m["k1"]
        print(
            f"   K1 평균 {k1['means']} 차례 {k1['order']} 차 {k1['gap']} 최저 {k1['darkest']} at {k1['darkestAt']} ①안 {k1['darkestInAttention']}"
        )
    for key in fails:
        detail = {
            "K4": (m["boxes"], m["shadows"], m["depth"], m["bands"]),
            "K5": (
                m["sizes"],
                m["offCombos"],
                [h for h in m["hierarchy"] if not h["ok"]],
            ),
            "K6": m["dots"],
            "K9": (m["ellipsis"], m["clamp"], m["overflow"]),
            "K10": m["spacing"],
            "K11": m["lowContrast"],
            "K12": (m["dup"], m["removed"], m["removedFromAttention"], m["meters"]),
            "K13": {
                key2: c[key2]
                for key2 in [
                    "attentionRows",
                    "attentionHeadCount",
                    "todoRows",
                    "weekRows",
                    "availableText",
                ]
            },
            "K14": (m["rowHeights"], m["buttonHeights"]),
            "K8": m["attentionBottom"],
        }.get(key)
        print(f"   {key}: {detail}")
    if m["logs"]:
        print("   logs:", m["logs"][:3])
