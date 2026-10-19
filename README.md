```text
vada-m1/
├─ AGENTS.md                  # 저장소 규칙. 에이전트와 사람이 같이 따른다
├─ .github/workflows/         # CI
├─ apps/
│  ├─ api/                    # API 서버(Hono, better-auth, drizzle)
│  │  ├─ migrations/          # 마이그레이션(.sql은 LF)
│  │  └─ src/
│  │     ├─ auth/             # Google 로그인과 세션 확인
│  │     ├─ db/               # 조회용 표 정의, 마이그레이션 적용
│  │     ├─ http/             # 공통 가드, 입력 검사, 오류 처리, Sentry
│  │     ├─ push/             # 휴대폰 알림(웹 푸시)
│  │     └─ storage/          # 영수증 저장소(R2). 쓰는 기능은 구매와 지출 덩어리가 다시 만든다
│  └─ web/                    # 화면(React, Vite, Tailwind)
│     ├─ public/              # 홈 화면 설정, 아이콘, 서비스 워커
│     └─ src/
│        ├─ auth/             # 로그인 화면
│        ├─ components/       # 화면 부품(ui/는 기본 부품)
│        ├─ lib/
│        ├─ push/             # 휴대폰 알림 대화상자
│        ├─ test-support/
│        └─ ui-gallery/       # 부품 확인 화면(/ui.html)
├─ docs/
│  ├─ device-checks.md        # 실제 기기 확인 기록
│  └─ superpowers/            # 설계서(specs)와 구현 계획(plans)
└─ packages/
   └─ contracts/              # 요청 스키마와 응답 타입(zod). 화면과 서버가 같이 쓴다
```
