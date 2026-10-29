"""측정 JSON → 시안별 K1~K14 표. 사용: python -X utf8 summary.py <회차> [자세히]"""

import json
import sys
from pathlib import Path

ROUND = sys.argv[1]
DETAIL = len(sys.argv) > 2
R = json.loads(Path(f"C:/tmp/home-s5/r{ROUND}/measure.json").read_text(encoding="utf8"))
CASES = [
    "{v}-1280",
    "{v}-1024",
    "{v}-390",
    "{v}-1280-normal",
    "{v}-390-normal",
    "{v}-1280-empty",
    "{v}-390-empty",
]
LIMIT = {1280: 56, 1024: 56, 390: 96}


def ok(flag):
    return "합격" if flag else "**불합격**"


def content_check(v):
    issues = []
    m = R[f"{v}-1280"]["content"]
    if m["attentionRows"] != 5:
        issues.append(f"① 줄 {m['attentionRows']}")
    if m["icons"] != 5:
        issues.append(f"① 아이콘 {m['icons']}")
    if "전체 4건 보기" not in m["attentionText"]:
        issues.append("① 전체 4건 보기 없음")
    for s in ["지남 1", "담당자 없음 1", "확인 필요 없음"]:
        if s not in m["eventsText"]:
            issues.append(f"② {s} 없음")
    if m["finishRows"] != 2 or "확정 전" not in m["finishText"]:
        issues.append(f"③ {m['finishRows']}줄")
    if m["financeRows"] != 3:
        issues.append(f"④ {m['financeRows']}줄")
    if m["upcomingRows"] != 3 or "전체 4건 보기" not in m["upcomingText"]:
        issues.append(f"⑤ {m['upcomingRows']}줄")
    n = R[f"{v}-1280-normal"]["content"]
    if n["icons"] != 0:
        issues.append(f"정상 아이콘 {n['icons']}")
    if n["mplus"] != ["완료 가능"]:
        issues.append(f"정상 M+ {n['mplus']}")
    if "확인할 일 없음" not in n["attentionText"]:
        issues.append("정상 ① 빈 문구")
    if n["eventsText"].count("확인 필요 없음") != 3:
        issues.append("정상 ② 확인 필요 없음 3 아님")
    if n["finishRows"] != 2:
        issues.append(f"정상 ③ {n['finishRows']}")
    if "남은 정리 없음" not in n["financeText"]:
        issues.append("정상 ④")
    if n["upcomingRows"] != 2 or "2건" not in n["upcomingText"]:
        issues.append("정상 ⑤")
    if "메시지함" in n["greetingText"]:
        issues.append("정상 메시지함 있음")
    e = R[f"{v}-1280-empty"]["content"]
    if "진행할 행사 없음" not in e["eventsText"] or "새 행사" not in e["eventsText"]:
        issues.append("빈 ②")
    if e["attentionRows"] != 1 or "미배정 구성원 2명" not in e["attentionText"]:
        issues.append("빈 ①")
    if "마무리할 일 없음" not in e["finishText"]:
        issues.append("빈 ③")
    if "남은 정리 없음" not in e["financeText"]:
        issues.append("빈 ④")
    if "7일 안 일정 없음" not in e["upcomingText"]:
        issues.append("빈 ⑤")
    return issues


for v in ["A", "B", "C"]:
    if f"{v}-1280" not in R:
        continue
    rows = []
    a, a3 = R[f"{v}-1280"]["k1"], R[f"{v}-390"]["k1"]
    rows.append(
        (
            "K1",
            f"1280 ①={a['means'].get('①')} 차={a['gap']} 차례={'>'.join(a['order'])} 최저 {a['darkest']}@①:{a['darkestInAttention']} / 390 ①={a3['means'].get('①')} 차={a3['gap']} 차례={'>'.join(a3['order'])} 최저@①:{a3['darkestInAttention']}",
            a["ok"] and a3["ok"],
        )
    )
    k2 = {c.format(v=v): R[c.format(v=v)]['k2'] for c in CASES}
    raw = max(x['raw'] for x in k2.values())
    off = max(x['offGray'] for x in k2.values())
    rows.append(('K2', f"규칙대로 {raw}px(Tailwind gray-500·700 자체가 채도>0.15), 회색 색조(195~245도) 밖 {off}px", raw == 0))
    k3 = max(R[c.format(v=v)]["filledBadges"] for c in CASES)
    rows.append(("K3", f"칠한 칩 {k3}", k3 == 0))
    k4 = [
        (
            len(R[c.format(v=v)]["boxes"]),
            R[c.format(v=v)]["shadows"],
            R[c.format(v=v)]["depth"],
            len(R[c.format(v=v)]["bands"]),
        )
        for c in CASES
    ]
    rows.append(
        (
            "K4",
            f"상자/그림자/깊이/회색띠 최대 {max(x[0] for x in k4)}/{max(x[1] for x in k4)}/{max(x[2] for x in k4)}/{max(x[3] for x in k4)}",
            all(x[0] == 1 and x[1] == 0 and x[2] == 1 and x[3] == 0 for x in k4),
        )
    )
    m = R[f"{v}-1280"]
    hier = all(h["ok"] for h in m["hierarchy"])
    rows.append(
        (
            "K5",
            f"크기 {m['sizes']} 표 밖 조합 {len(m['offCombos'])} 위계 {'맞음' if hier else '틀림'}",
            len(m["sizes"]) <= 4 and not m["offCombos"] and hier,
        )
    )
    k6 = sum(len(R[c.format(v=v)]["dots"]) for c in CASES)
    rows.append(("K6", f"'·' 2개 이상 블록 {k6}", k6 == 0))
    g = [R[f"{v}-{w}"]["greetingH"] for w in (1280, 1024, 390)]
    rows.append(
        ("K7", f"{g[0]} / {g[1]} / {g[2]}px", g[0] <= 56 and g[1] <= 56 and g[2] <= 96)
    )
    b = R[f"{v}-390"]["attentionBottom"]
    rows.append(
        (
            "K8",
            f"① 아래 끝 y={b}, 띠 더하면 {b + 56}",
            True if v == "A" else b + 56 <= 836,
        )
    )
    k9 = [
        (
            R[c.format(v=v)]["ellipsis"],
            R[c.format(v=v)]["clamp"],
            len(R[c.format(v=v)]["overflow"]),
        )
        for c in CASES
    ]
    rows.append(
        (
            "K9",
            f"말줄임/clamp/넘침 최대 {max(x[0] for x in k9)}/{max(x[1] for x in k9)}/{max(x[2] for x in k9)}",
            all(x == (0, 0, 0) for x in k9),
        )
    )
    k10 = len(R[f"{v}-1280"]["spacing"]) + len(R[f"{v}-390"]["spacing"])
    rows.append(("K10", f"단계 밖 간격 {k10}", k10 == 0))
    rows.append(("K11", f"최저 대비 {m['minContrast']}", m["minContrast"] >= 4.5))
    rows.append(
        (
            "K12",
            f"중복 {len(m['dup'])} 뺀 것 {len(m['removed'])}",
            not m["dup"] and not m["removed"],
        )
    )
    issues = content_check(v)
    rows.append(("K13", "같음" if not issues else "; ".join(issues), not issues))
    hs = [
        h
        for c in ["{v}-390", "{v}-390-normal", "{v}-390-empty"]
        for h in R[c.format(v=v)]["rowHeights"]
    ]
    rows.append(("K14", f"줄 최저 {min(hs)}px", min(hs) >= 44))
    print(f"\n### 시안 {v} (회차 {ROUND})\n")
    print("| ID | 값 | 판정 |\n|---|---|---|")
    for k, val, flag in rows:
        print(f"| {k} | {val} | {ok(flag)} |")
    if DETAIL:
        for c in CASES:
            r = R[c.format(v=v)]
            for key in [
                "offCombos",
                "dots",
                "bands",
                "overflow",
                "spacing",
                "lowContrast",
                "dup",
                "removed",
                "logs",
            ]:
                if r.get(key):
                    print(c.format(v=v), key, r[key][:8])
            if len(r["boxes"]) != 1:
                print(c.format(v=v), "boxes", r["boxes"])
        print("page heights", {c.format(v=v): R[c.format(v=v)]["pageH"] for c in CASES})
