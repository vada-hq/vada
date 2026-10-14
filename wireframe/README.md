# VADA 와이어프레임

학생회 운영 서비스 **VADA**의 핵심 사용자 흐름을 검증하는 데스크톱 와이어프레임입니다. 학생회 업무·회의·행사·메시지·재정(구매 요청과 검토)을 한 화면 목록(현재 100개)에서 오가며 확인할 수 있습니다.

- 백엔드는 없습니다. 모든 데이터는 예시이며 새로 고침하면 초기화되는 로컬 상태입니다.
- 화면 구현은 `src/app/App.tsx` 한 파일에 있습니다(화면 목록 `SCREENS`, 화면정의서 `SPEC_DATA`, 화면 컴포넌트 `SCREEN_COMPONENTS`).

## 실행

준비물: Node.js 20 이상과 pnpm(`npm install -g pnpm` 또는 `corepack enable`).

```bash
pnpm install
pnpm run dev     # http://localhost:5173/
pnpm run build   # 빌드 검증
pnpm run test    # 재정 로직·화면 테스트
```

앱 왼쪽 `Vada 와이어프레임` 패널에서 화면을 고르고, 위쪽 `화면정의서` 버튼으로 각 화면의 목적·기능·예외를 봅니다.

## 문서 지도

처음이라면 **`docs/VADA_HANDOFF.md`부터** 읽으세요. 현재 구조와 확정 원칙, 다음 작업이 요약되어 있습니다.

| 위치 | 내용 |
|---|---|
| `docs/VADA_HANDOFF.md` | 현재 와이어프레임 구조·확정 원칙·다음 작업 |
| `docs/VADA_MENU_STRUCTURE.md` | 메뉴와 화면 위치(메뉴 v6.2) |
| `docs/VADA_PERMISSION_MATRIX.md` | 역할별 버튼 노출 기준 |
| `docs/VADA_MVP_SPEC.md`, `docs/VADA_ROADMAP.md` | MVP 범위와 마일스톤 |
| `docs/VADA_FINANCE_*.md`, `docs/VADA_AUDIT_*.md`, `CONTEXT.md` | 재정 명세·화면 설계·보류 기능·감사 기준 대조·용어집 |
| `docs/VADA_EVENT_ARCHIVE_SPEC.md` | 행사 아카이브 |
| `docs/planning/` | 진행 중인 기획의 채택 결정 기록(홈·메시지·구매 후보·끼룩이) |
| `CLAUDE.md` | 작업 순서와 필수 주의사항(사람과 AI 에이전트 공통) |

## 함께 작업하는 방식

1. 화면을 고치기 전에 로컬 화면과 관련 코드를 확인하고, 고칠 화면의 목적·구조·문제점을 먼저 공유합니다.
2. 기획 결정은 채택된 것만 `docs/planning/<주제>/design.md`에 날짜와 근거를 붙여 남깁니다.
3. 화면을 만들거나 구조를 바꾸면 같은 변경에서 화면정의서(`SPEC_DATA`)와 관련 문서를 함께 고칩니다.
4. `pnpm run build`와 `pnpm run test`를 통과시킨 뒤 올립니다.

## 배포

Cloudflare Worker `vada-wireframe-2026`로 배포합니다(`pnpm run build` 후 `node_modules/.bin/wrangler deploy`, Cloudflare 계정 로그인 필요).
