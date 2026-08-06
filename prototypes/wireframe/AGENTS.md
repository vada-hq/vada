# 와이어프레임 프로토타입 지침

- 이 디렉터리는 **UI 정본**이다. 화면의 구조와 시각 표현은 여기가 기준이다.
- 권한·상태·필드 의미를 `App.tsx` 코드만 보고 확정하지 않는다. `docs/`의 제품 명세와 `contracts/`의 계약을 함께 읽는다.
- 프로토타입 동작을 변경하면 `pnpm --filter @vada/wireframe test`와 `pnpm --filter @vada/wireframe build`를 실행한다.
- 배포 설정의 `.openai/hosting.json` 프로젝트 ID를 새로 만들거나 임의로 바꾸지 않는다.

## 여기 있는 것

| 경로 | 내용 |
| --- | --- |
| `src/app/App.tsx` | 화면 87개. `SCREENS`(목록) · `SPEC_DATA`(화면정의서) · 화면 컴포넌트 |
| `docs/VADA_FINANCE_SPEC.md` | **재정 도메인 단일 기준.** 상태 전이·권한·금액 계산·예외 |
| `docs/VADA_PERMISSION_MATRIX.md` | 역할·권한 매트릭스와 구현 규칙 |
| `docs/VADA_SCREEN_QA.md` | 화면별 진입·표시·동작·예외 검증 항목 |
| `docs/VADA_MENU_STRUCTURE.md` | 메뉴 구조와 화면 목록(§10) |
| `docs/VADA_MVP_SPEC.md` · `docs/VADA_EVENT_ARCHIVE_SPEC.md` | 범위와 행사 아카이브 명세 |
| `docs/VADA_HANDOFF.md` | 현재 상태·공간 원칙·미결정 사항·다음 작업 |
| `CONTEXT.md` | 도메인 용어집. 같은 개념에 같은 이름을 쓰기 위한 기준 |
| `src/app/finance.test.tsx` | 재정 규칙 회귀 검사 |

## 공유본 반입 절차

와이어프레임은 이 저장소 밖에서 편집된 뒤 공유본(압축)으로 전달된다. 저장소 사본이 낡으면 그것을 근거로 만든 제품 화면이 전부 틀리므로, **화면 작업 착수 전에 최신 여부를 확인한다.**

```bash
# 1. 공유본과 저장소 사본을 비교한다
diff <SHARE>/src/app/App.tsx prototypes/wireframe/src/app/App.tsx

# 2. 반입한다 (내용 파일만)
cp <SHARE>/src/app/App.tsx        prototypes/wireframe/src/app/
cp <SHARE>/src/app/finance.test.tsx prototypes/wireframe/src/app/
cp <SHARE>/src/styles/index.css   prototypes/wireframe/src/styles/
cp <SHARE>/CONTEXT.md             prototypes/wireframe/
cp <SHARE>/docs/*.md              prototypes/wireframe/docs/
cp <SHARE>/public/*.png           prototypes/wireframe/public/

# 3. 검증한다
pnpm --filter @vada/wireframe test
pnpm --filter @vada/wireframe build
just validate-screens
```

**반입하지 않는 것** — 저장소가 따로 관리하며 공유본 것으로 덮으면 깨진다.

| 파일 | 이유 |
| --- | --- |
| `package.json` · `pnpm-lock.yaml` · `pnpm-workspace.yaml` | 공유본은 단독 프로젝트, 저장소는 모노레포 |
| `src/main.tsx` | 저장소 사본만 `?review=du001-r2` 진입점을 갖는다 |
| `build/sites-vite-plugin.ts` | 저장소 사본이 drizzle 자산 복사를 추가로 한다 |
| `index.html` | 공유본은 Figma MCP 캡처 스크립트를 외부 CDN에서 불러온다 |
| `.openai/hosting.json` | 배포 연결 정보 |
| `src/app/reviews/` | 저장소 전용 |
| `docs/VADA_SCREEN_QA.html` · `.docx` | `.md`에서 생성된 내보내기본 |

반입 후에는 `screens/*.md`의 `wireframe:` 줄 번호가 어긋난다. 화면 컴포넌트 정의 위치를 다시 찾아 고친다.

```bash
grep -nE '^function [A-Z]' prototypes/wireframe/src/app/App.tsx
```

## 화면정의서 정합성

화면을 추가하거나 지우면 `SCREENS` · `SPEC_DATA` · 화면 컴포넌트 맵의 수가 일치해야 하고, `nextScreens`와 `entryPath`가 없는 화면을 가리키면 안 된다. `docs/VADA_MENU_STRUCTURE.md` §10, `docs/VADA_HANDOFF.md`의 현재 상태, `docs/VADA_PERMISSION_MATRIX.md` 헤더의 화면 수도 함께 갱신한다.
