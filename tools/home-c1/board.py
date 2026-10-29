from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
H = Path("C:/Users/82108/vada-hq/notes/integration/review/screens/home")
R = H / "refs-c1"; C = H / "c1"
F = lambda s, b=False: ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf" if b else "C:/Windows/Fonts/malgun.ttf", s)
refs = [("r1-linear-inbox.png", "1 Linear Inbox"), ("r2-github-notifications.png", "2 GitHub 알림 묶어 처리"),
        ("r3-linear-my-issues.png", "3 Linear My issues 갈래 머리+수"), ("r4-github-inbox-2020.png", "4 GitHub 알림함"),
        ("r5-github-mobile-inbox.png", "5 GitHub 모바일 알림함"), ("r6-todoist-today.png", "6 Todoist Today")]
W, M = 2140, 40
TW = (W - 2 * M - 5 * 20) // 6; TH = 200
a = Image.open(C / "c1-A-977-main.png"); b = Image.open(C / "c1-B-977-main.png")
half = (W - 2 * M - 40) // 2
sa = a.resize((half, int(a.height * half / a.width))); sb = b.resize((half, int(b.height * half / b.width)))
H_total = M + 50 + TH + 50 + 40 + 60 + max(sa.height, sb.height) + 110 + M
img = Image.new("RGB", (W, H_total), "white"); d = ImageDraw.Draw(img)
d.text((M, M), "레퍼런스 (실제 제품의 같은 종류 목록)", font=F(26, True), fill="#101828")
y = M + 50
for i, (f, label) in enumerate(refs):
    t = Image.open(R / f).convert("RGB"); t.thumbnail((TW, TH))
    x = M + i * (TW + 20)
    img.paste(t, (x, y + (TH - t.height) // 2)); d.rectangle((x, y, x + TW, y + TH), outline="#e5e7eb")
    d.text((x, y + TH + 8), label, font=F(18), fill="#364153")
y += TH + 50 + 40
d.line((M, y - 20, W - M, y - 20), fill="#e5e7eb", width=2)
d.text((M, y), "A 사람이 앞인 인박스 (근거 1·2·4·5, 행동은 hover)", font=F(26, True), fill="#101828")
d.text((M + half + 40, y), "B 이유로 묶고, 사람이 곧 묻기 단추 (근거 3·6)", font=F(26, True), fill="#101828")
y += 60
img.paste(sa, (M, y)); img.paste(sb, (M + half + 40, y))
y += max(sa.height, sb.height) + 20
d.text((M, y), "줄마다 연락할 사람 얼굴이 앞, 지남·오늘은 오른쪽 끝에 빨강.\n[묻기]는 마우스를 올릴 때만, 휴대폰은 말풍선 아이콘.", font=F(20), fill="#364153", spacing=8)
d.text((M + half + 40, y), "이유(지남·오늘·내일·결재)를 갈래 머리에서 한 번만 말하고,\n줄 끝의 사람 이름을 누르면 바로 그 사람에게 묻기.", font=F(20), fill="#364153", spacing=8)
img.save(H / "c1-compare.png"); print(img.size)
