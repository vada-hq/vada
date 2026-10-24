---
독자: 사람, 에이전트
---

```text
vada-m1/
├─ AGENTS.md                  # 저장소 규칙. 에이전트와 사람이 같이 따른다
├─ .github/workflows/         # CI
├─ apps/
│  ├─ api/                    # API 서버(Hono, better-auth, drizzle)
│  │  ├─ migrations/          # 마이그레이션. 표 구현의 원문이다(.sql은 LF)
│  │  ├─ scripts/             # 시험 데이터
│  │  └─ src/
│  │     ├─ access/           # 지금 소속(actorOf)과 권한표(can)
│  │     ├─ auth/             # Google 로그인과 세션 확인
│  │     ├─ councils/         # 로그인 잇기, 학생회 만들기·보기·설정
│  │     ├─ db/               # 조회용 표 정의, 시험 DB, 마이그레이션 적용(기본은 미리 보기, --apply로 적용)
│  │     ├─ http/             # 공통 가드, 입력 검사, 오류 처리, Sentry
│  │     ├─ invites/          # 초대 코드와 들어오기
│  │     ├─ push/             # 휴대폰 알림과 알림 받을 기기
│  │     ├─ records/          # 기록과 판. 모든 쓰기가 거친다
│  │     ├─ storage/          # 영수증 저장소(R2). 쓰는 기능은 구매와 지출 덩어리가 다시 만든다
│  │     ├─ team/             # 운영진과 부서 편성
│  │     └─ test-support/     # 시험용 학생회와 요청
│  └─ web/                    # 화면(React, Vite, Tailwind)
│     ├─ public/              # 홈 화면 설정, 아이콘, 서비스 워커
│     └─ src/
│        ├─ auth/             # 로그인 화면
│        ├─ components/       # 화면 부품(ui/는 기본 부품)
│        ├─ councils/         # 학생회 없음, 만들기, 초대 링크, 내 학생회 목록
│        ├─ lib/
│        ├─ push/             # 휴대폰 알림 대화상자
│        ├─ settings/         # 설정 > 학생회 정보
│        ├─ team/             # 운영진 > 사람·부서
│        ├─ test-support/
│        ├─ ui-gallery/       # 부품 확인 화면(/ui.html)
│        └─ workspace/        # 작업 공간 틀
├─ docs/
│  ├─ device-checks.md        # 실제 기기 확인 기록
│  └─ superpowers/            # 설계서(specs)와 구현 계획(plans)
└─ packages/
   └─ contracts/              # 요청 스키마와 응답 타입(zod). 화면과 서버가 같이 쓴다
```
