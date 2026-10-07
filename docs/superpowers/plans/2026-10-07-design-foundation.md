# 프론트엔드 디자인 기반 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 와이어프레임의 디자인 언어를 Tailwind v4 토큰과 shadcn/ui 방식의 부품으로 옮기고, 화면을 그 부품으로만 다시 조립한다.

**Architecture:**
- **토큰:** `src/index.css` 하나에 Tailwind, 와이어프레임 색 토큰, 기준 글자 크기(14px, 휴대폰 16px), Pretendard를 둔다.
- **부품:** 기본 부품은 `src/components/ui`(shadcn 코드를 통일 규칙대로 고친 것)에, 여러 기능이 같이 쓰는 표시 부품은 `src/components`에 둔다.
- **화면:** 기능 폴더에 그대로 두고 부품만 쓰게 바꾼다.
- **사이드바:** 데스크톱은 `aside`, 768px 미만은 Radix Dialog로 만든 옆 메뉴(sheet)다.
- **옛 CSS:** 모두 지운다.

**Tech Stack:** Tailwind CSS 4.3.3(@tailwindcss/vite), shadcn/ui 방식 부품(radix-ui 1.7.0, class-variance-authority, tailwind-merge, clsx), lucide-react, Pretendard, React 19.3, Vite 8.3, vitest 5(jsdom)

**Spec:** `docs/superpowers/specs/2026-10-07-design-foundation-design.md`

## Global Constraints

- **브랜치와 배포:**
  - 작업 브랜치는 `design-foundation`이다. Task마다 커밋한다.
  - 마지막 Task에서 main 병합과 푸시를 묻지 않고 한다(사용자 결정). DB 변경은 없다.
- **의존성:** 정확한 버전으로 고정한다(`--save-exact`).
  - `dependencies`: `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@3.7.0`, `radix-ui@1.7.0`, `tw-animate-css@1.4.0`, `lucide-react@1.52.0`, `pretendard@1.3.9`
  - `devDependencies`: `tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`
  - `pretendard`는 설치 크기가 약 98MB다(글꼴 파일 전체). 빌드 결과에는 CSS가 가리키는 woff2만 들어간다.
- **비밀 파일:** `.env`는 읽지 않는다.
- **테스트 범위:**
  - 관련 테스트만 돌린다. 웹 전체 스위트는 Task 1(가져오기 경로를 여러 파일에서 바꾸므로)과 Task 9(웹 파일 대부분이 바뀌므로)에서만 돌린다. API·계약 테스트는 바뀐 곳이 없어 돌리지 않는다(브랜치 CI가 돌린다).
  - 웹 테스트는 `--no-file-parallelism`으로 돌린다.
  - 모양만 바꾸는 Task는 동작이 같으므로 기존 테스트가 회귀 검사다. 새 동작(대화상자, 휴대폰 메뉴, 늘 보이는 초대 정보)에만 실패하는 테스트를 먼저 쓴다.
- **문구:**
  - 기존 문구는 바꾸지 않는다. 테스트가 역할과 문구로 화면을 찾는다.
  - 새로 쓰는 문구는 아래뿐이다.
    - 행사 만들기: "새 행사"(대화상자 제목, 사이드바 버튼), "행사를 만들면 대화방이 함께 생겨요.", "취소"
    - 구성원 초대: "구성원 초대"(버튼, 대화상자 제목), "링크나 코드를 공유하면 학생회에 참여할 수 있어요. 참여한 사람은 미배정으로 등록돼요."
    - 복사 실패: "복사하지 못했어요. 링크나 코드를 직접 선택해 복사해 주세요."
    - 메뉴와 대화상자: "메뉴 열기", "메뉴 닫기", "닫기"(대화상자 X), "행사"(고른 행사가 없을 때 헤더 제목)
  - 와이어프레임에 없어 화면에서 빼는 것:
    - 사이드바의 이메일과 "M1" 칩. 이메일은 로그인 카드에는 남는다.
    - 행사 화면의 "행사 작업 공간" 머리말
    - 빈 화면의 "함께 준비하는 공간" 머리말. 채팅 제목 "함께 준비하는 공간"은 남는다.
    - 사이드바 로그아웃 버튼의 글자. 아이콘 버튼이 되고 이름은 "로그아웃"이다.
- **모양 규칙:**
  - 색은 테마 토큰이나 Tailwind 기본 팔레트 단계만 쓴다.
  - 크기와 간격은 Tailwind 스케일만 쓴다(`p-6`, `max-w-148`처럼 0.25rem 배수 포함).
  - 임의 값 클래스(`bg-[#…]`, `text-[13px]`, `p-[7px]`, `w-[calc(…)]`)는 쓰지 않는다. 임의 variant(`aria-[current=page]:`, `[&_svg]:`)는 쓸 수 있다.
  - 줄바꿈 없는 긴 글이 들어갈 수 있는 곳에는 `wrap-anywhere`를 쓴다. `break-words`는 Tailwind 4.3에서 옛 이름이고 flex 항목 안에서는 넘침을 막지 못한다.
  - 새 CSS 파일을 만들지 않는다. 아이콘은 `lucide-react`만 쓴다.
- **기준 글자 크기와 중단점:**
  - 기준 글자 크기는 `87.5%`(14px)이고, `width < 40rem`(640px)에서 `100%`다.
  - 사이드바는 `md`(768px) 미만에서 숨기고 옆 메뉴로 연다.
- **와이어프레임 실측값:**
  - 클래스 값은 2026-10-07에 Figma(get_design_context)에서 잰 값이다(기준 14px).
    - 사이드바: 위 블록 `px-5 py-4`, 메뉴 항목 `px-3 py-2`
    - 헤더: `h-16 px-6`
    - 탭: `px-4 py-3`(높이 40px)
    - 버튼: md `px-4 py-2`, sm `px-3 py-1.5`
    - 칩: `px-2 py-0.5`
    - 인증 카드: 폭 520px(`max-w-148`), 여백 `p-10`
    - 빈 화면 원: `size-14`
  - 설계 문서의 통일 규칙과 다른 곳은 통일 규칙을 따른다. Task 10의 비교에서 이 차이는 고치지 않는다.
    - 대화상자 여백: 21px(`p-6`). 폼 모달은 29px다.
    - 입력칸 반경: 3.5px. 와이어프레임 입력칸은 5.25px다.
    - 배너 테두리: 200 단계. 폼 모달의 배너는 100이다.
- **`Button`은 `type`을 기본으로 정하지 않는다:** form 안의 버튼이 브라우저 기본값(submit)에 기대는 곳이 있다(초안 저장, 초안 만들기).
- **Radix Dialog:** 제목(`DialogTitle`)과 설명(`DialogDescription`, 또는 옆 메뉴처럼 `aria-describedby={undefined}`)을 늘 둔다.
- **주석과 커밋:**
  - 주석은 한국어로 "왜"만 짧게 쓴다.
  - 커밋 제목은 한국어 50자 이내로 쓰고, AI 서명과 Co-Authored-By는 붙이지 않는다.
- **비교할 와이어프레임 노드:** SIGN-IN `568:2`, INV-00 `13:2`, INV-01 `9:2`, 행사 화면 EVT-02 `20:4671`(사이드바·헤더·탭), 초대 패널 ORG-03C `30:5153`, 폼 대화상자 `20:4647`, 빈 화면 `30:6768`.

## Review Focus

1. **Linux 빌드:**
   - 문제: Windows에서 만든 `package-lock.json`에 Tailwind의 Linux용 네이티브 패키지(`@tailwindcss/oxide-linux-x64-gnu`, `lightningcss-linux-x64-gnu`)가 빠지면 CI와 Render의 설치·빌드가 깨진다.
   - 확인: Task 1 Step 2(잠금 파일), Task 10 Step 2(브랜치 CI)
2. **`hidden` 속성:**
   - 문제: 탭 패널처럼 `hidden` 속성과 표시 클래스(`flex`)가 함께 붙은 요소가 실제 브라우저에서 숨겨져야 한다. jsdom은 CSS를 적용하지 않아 테스트로 잡지 못한다.
   - 근거: Tailwind 4.3.3 preflight에 `[hidden]:where(:not([hidden='until-found'])) { display: none !important }`가 있다.
   - 확인: Task 2(숨김 표본), Task 10 Step 1·4
3. **긴 글:**
   - 문제: 100자 행사 이름, 띄어쓰기 없는 링크·이름이 사이드바·헤더·채팅·목록에서 화면 밖으로 넘치지 않아야 한다.
   - 확인: Task 2(긴 글 표본), Task 10 Step 1(가로 넘침)
4. **좁은 화면:**
   - 문제: 640px 미만에서 기준 글자가 16px로 커지고, 대화상자·옆 메뉴·로그인 카드가 화면 안에 들어와야 한다.
   - 확인: Task 10 Step 1·5
5. **키보드:**
   - 문제: 대화상자와 옆 메뉴가 Escape로 닫혀야 하고, 키보드만 쓰는 사람이 갇히지 않아야 한다.
   - 확인: Task 4 Step 1(Escape 테스트)

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `apps/web/package.json`, `package-lock.json` (수정) | 새 의존성 |
| `apps/web/vite.config.ts`, `apps/web/tsconfig.json` (수정) | Tailwind 플러그인, `@/` 별칭 |
| `apps/web/components.json` (신규) | 나중에 shadcn CLI로 부품을 더할 때 쓰는 설정 |
| `apps/web/src/index.css` (신규) | 유일한 CSS: Tailwind, 토큰, 기준 글자 크기, 글꼴 |
| `apps/web/src/lib/utils.ts` (신규) | `cn()` |
| `apps/web/src/lib/in-app-browser.ts` (옮김) | `shared/in-app-browser.ts`에서 옮김 |
| `apps/web/src/components/StateMessage.tsx` (옮김) | `shared/ui/StateMessage.tsx`에서 옮김, 모양 클래스 추가 |
| `apps/web/src/components/ui/*.tsx` (신규) | button, input, textarea, native-select, label, badge, card, alert, dialog, sheet, nav-item, tab-button |
| `apps/web/src/components/{EmptyState,Avatar,AuthCard,BrandMark}.tsx` (신규) | 공통 표시 부품 |
| `apps/web/ui.html`, `apps/web/src/ui-gallery/*` (신규) | 개발 전용 부품 확인 화면 |
| `apps/web/src/workspace/{Workspace,WorkspaceSidebar,WorkspaceHeader,EventWorkspace}.tsx` | 앱 틀 (`Sidebar.tsx` → `WorkspaceSidebar.tsx`) |
| `apps/web/src/events/{EventList,CreateEventForm,useEvents}.ts(x)` | 행사 메뉴, 행사 만들기 폼(대화상자 안) |
| `apps/web/src/access/{InviteShare,InviteCodeForm,JoinOrganization,Memberships}.tsx` | 초대 대화상자 내용, 가입 카드 |
| `apps/web/src/App.tsx`, `apps/web/src/chat/Chat.tsx` | 로그인 카드, 채팅 |
| `apps/web/src/purchases/*`, `apps/web/src/deliveries/*` | 부품 교체 (배치 유지) |
| 삭제 | `src/styles/`, `src/shared/`, `App.css`, `chat/Chat.css`, `workspace/Workspace.css`, `purchases/Purchases.css`, `deliveries/Deliveries.css` |
| `AGENTS.md` (수정) | "화면" 절 |

---

### Task 1: 기반 설치 (Tailwind, 별칭, 토큰, 글꼴)

**Files:**
- Modify: `apps/web/package.json`, `package-lock.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/components.json`, `apps/web/src/index.css`, `apps/web/src/lib/utils.ts`
- Move:
  - `apps/web/src/shared/ui/StateMessage.tsx`, `StateMessage.test.tsx` → `apps/web/src/components/`
  - `apps/web/src/shared/in-app-browser.ts`, `in-app-browser.test.ts` → `apps/web/src/lib/`
- Delete: `apps/web/src/styles/tokens.css`, `apps/web/src/styles/base.css`

**Interfaces:**
- Produces:
  - 별칭 `@/` = `apps/web/src/`
  - `cn(...inputs: ClassValue[]): string`
  - `@/components/StateMessage`: 기본 내보내기, props는 지금과 같다(`kind`, `children`, `className?`).
  - `@/lib/in-app-browser`: `isKakaoInAppBrowser`, `openOutsideKakao`
  - 테마 색 유틸리티:
    - `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`
    - `bg-primary`, `text-primary-foreground`, `bg-secondary`, `text-secondary-foreground`
    - `bg-muted`, `text-muted-foreground`, `bg-accent`, `text-accent-foreground`
    - `bg-destructive`, `text-destructive`, `border-border`, `border-input`, `ring-ring`
  - 반경 `rounded-sm`(3.5px), `rounded-md`(5.25px), `rounded-lg`(8.75px)

- [ ] **Step 1: 의존성 설치**

Run (저장소 루트):
```bash
npm install --save-exact --workspace @vada/web class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 radix-ui@1.7.0 tw-animate-css@1.4.0 lucide-react@1.52.0 pretendard@1.3.9
npm install --save-exact --save-dev --workspace @vada/web tailwindcss@4.3.3 @tailwindcss/vite@4.3.3
```
Expected: 오류 없이 끝나고, `apps/web/package.json`에 `^` 없는 버전으로 추가된다.

- [ ] **Step 2: Linux 빌드에 필요한 패키지와 글꼴 파일 확인**

Run:
```bash
grep -c '"node_modules/@tailwindcss/oxide-linux-x64-gnu"' package-lock.json
grep -c '"node_modules/lightningcss-linux-x64-gnu"' package-lock.json
ls node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css
```
Expected:
- 앞의 두 줄은 각각 `1` 이상이다. 기존 잠금 파일에 rolldown의 모든 플랫폼 패키지가 있으므로 npm 11이 같은 방식으로 기록한다.
- 셋째 줄은 파일 경로를 출력한다.
- 하나라도 `0`이면 CI와 Render에서 Tailwind가 실행되지 않는다. 그래도 진행하되 ledger에 기록하고, Task 10의 브랜치 CI로 반드시 확인한다(Review Focus 1).

- [ ] **Step 3: Vite 설정과 별칭**

`apps/web/vite.config.ts` 전체:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8891' },
  },
})
```

vitest도 이 설정을 읽으므로 테스트에서도 `@/`가 풀린다.

`apps/web/tsconfig.json`의 `compilerOptions`에 더한다. TypeScript 7은 `baseUrl` 없이 설정 파일 기준으로 푼다.

```json
    "paths": { "@/*": ["./src/*"] }
```

`apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/index.css", "baseColor": "gray", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 4: 토큰과 기준 글자 크기**

`apps/web/src/index.css`:

```css
@import 'tailwindcss';
@import 'tw-animate-css';
@import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';

/* 와이어프레임(Figma)의 색은 Tailwind v4 기본 팔레트와 같다. shadcn 부품이 쓰는 이름으로 묶는다. */
:root {
  --background: #f9fafb;
  --foreground: #101828;
  --card: #ffffff;
  --card-foreground: #101828;
  --popover: #ffffff;
  --popover-foreground: #101828;
  --primary: #155dfc;
  --primary-foreground: #ffffff;
  --secondary: #f3f4f6;
  --secondary-foreground: #364153;
  --muted: #f3f4f6;
  --muted-foreground: #6a7282;
  --accent: #eff6ff;
  --accent-foreground: #1447e6;
  --destructive: #e7000b;
  --border: #e5e7eb;
  --input: #d1d5dc;
  --ring: #155dfc;
}

@theme inline {
  --font-sans: 'Pretendard Variable', Pretendard, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  /* 반경 세 단계(기준 14px일 때): 작은 값 3.5px 버튼·입력칸·칩, 중간 값 5.25px 배너, 큰 값 8.75px 카드·대화상자. */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.625rem;
}

/* 와이어프레임 크기는 Tailwind 기본값에 0.875를 곱한 값이다. 기준 글자를 14px로 두면 표준 클래스가 그대로 맞는다. */
html { font-size: 87.5%; }
/* 휴대폰 폭에서는 기준을 16px로 키워 모든 크기를 함께 키운다. 미디어 쿼리의 rem은 브라우저 기본값 16px 기준이다. */
@media (width < 40rem) { html { font-size: 100%; } }

@layer base {
  /* Tailwind v4의 테두리 기본색은 글자색이다. 부품마다 적지 않도록 와이어프레임 선 색을 기본으로 둔다. */
  * { @apply border-border; }
  body { @apply bg-background font-sans text-sm text-foreground antialiased; }
  h1, h2, h3, h4 { @apply font-semibold text-gray-900; }
  a { @apply text-blue-500 hover:underline; }
}
```

Pretendard CSS 안의 `url()`은 상대 경로다. `@tailwindcss/vite`가 `@import`를 풀 때 경로를 다시 쓴다(`shouldRewriteUrls: true`, 4.3.3 소스에서 확인). Step 6의 woff2 개수로 확인한다.

`apps/web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 부품 기본 클래스 뒤에 쓰는 쪽 클래스를 붙일 때, 충돌하는 Tailwind 클래스는 뒤의 것을 남긴다.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: 공통 코드를 `components/`·`lib/`로 옮기고 옛 전역 CSS 지우기**

Run (저장소 루트):
```bash
cd apps/web/src
mkdir -p components lib
git mv shared/ui/StateMessage.tsx components/StateMessage.tsx
git mv shared/ui/StateMessage.test.tsx components/StateMessage.test.tsx
git mv shared/in-app-browser.ts lib/in-app-browser.ts
git mv shared/in-app-browser.test.ts lib/in-app-browser.test.ts
git rm -q styles/tokens.css styles/base.css
```

가져오기 경로를 바꾸는 일회용 스크립트를 scratchpad에 두고 실행한다(`python -X utf8 <스크립트>`):

```python
from pathlib import Path
import re

src = Path(r'C:\Users\82108\vada-m1\apps\web\src')
for path in src.rglob('*.ts*'):
    text = path.read_text(encoding='utf-8')
    new = re.sub(r"(['\"])(?:\.\.?/)+shared/ui/StateMessage\1", r"\1@/components/StateMessage\1", text)
    new = re.sub(r"(['\"])(?:\.\.?/)+shared/in-app-browser\1", r"\1@/lib/in-app-browser\1", new)
    if new != text:
        path.write_text(new, encoding='utf-8')
        print(path.relative_to(src))
```

이어서 아래를 고친다.
- `apps/web/src/App.tsx`: `import './styles/tokens.css'`와 `import './styles/base.css'` 두 줄을 지운다. `import './App.css'`는 Task 5에서 지운다.
- `apps/web/src/main.tsx`: import 끝에 `import './index.css'`를 더한다.

`apps/web/src/components/StateMessage.tsx` 전체. 역할 규칙은 그대로이고 모양만 더한다.

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  kind: 'loading' | 'error' | 'empty' | 'notice'
  children: ReactNode
  className?: string
}

// 표시와 접근성만 담당한다. 표시 조건·문구·재시도는 사용하는 기능에서 결정한다.
export default function StateMessage({ kind, children, className }: Props) {
  const role = kind === 'error' ? 'alert' : kind === 'empty' ? undefined : 'status'
  return <p role={role} className={cn('text-sm wrap-anywhere', kind === 'error' ? 'text-destructive' : 'text-gray-500', className)}>{children}</p>
}
```

Run: `find apps/web/src/shared apps/web/src/styles -type f`
Expected: 출력 없음. 빈 폴더가 남는 것은 git에 영향이 없다.

- [ ] **Step 6: 검사**

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

Run: `cd apps/web && npx vitest run --no-file-parallelism`
Expected: 실패 0. 가져오기 경로를 여러 파일에서 바꿨으므로 웹 전체를 돌린다.

Run: `npm run build --workspace @vada/web && grep -c "155dfc" apps/web/dist/assets/*.css && ls apps/web/dist/assets | grep -c woff2`
Expected: 빌드 성공, 토큰 개수 1 이상, woff2 개수 1 이상.

- [ ] **Step 7: 커밋**

```bash
git add -A apps/web package-lock.json
git commit -m "Tailwind·shadcn 기반과 디자인 토큰 설치"
```

---

### Task 2: 기본 부품과 부품 확인 화면

**Files:**
- Create:
  - `apps/web/src/components/ui/{button,input,textarea,native-select,label,badge,card,alert,dialog,sheet,nav-item,tab-button}.tsx`
  - `apps/web/src/components/{EmptyState,Avatar,AuthCard,BrandMark}.tsx`
  - `apps/web/ui.html`, `apps/web/src/ui-gallery/{main,Gallery}.tsx`
- Test: `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `cn`, 테마 유틸리티
- Produces (모두 이름 있는 내보내기):
  - `Button`(variant: `default|outline|secondary|ghost|destructive|link`, size: `md|sm|icon`), `buttonVariants`
  - `Input`, `fieldClass`, `Textarea`, `NativeSelect`, `Label`
  - `Badge`(tone: `info|success|warning|danger|neutral`), `type Tone`
  - `Card`, `cardClass`
  - `Alert`(tone: `info|success|warning|danger`)
  - `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
  - `Sheet`, `SheetContent`(prop `title: string`)
  - `NavItem`(prop `active?: boolean`), `TabButton`
  - `EmptyState`(props `icon: LucideIcon`, `title`, `description?`, `className?`), `Avatar`(`className?`), `AuthCard`(div props), `BrandMark`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/ui-gallery/Gallery.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Gallery from './Gallery'

afterEach(cleanup)

test('부품 확인 화면이 모든 부품 묶음을 보여 준다', () => {
  render(<Gallery />)
  for (const name of ['버튼', '입력', '칩', '카드·배너', '메뉴·탭', '빈 화면·아바타·로고', '대화상자·옆 메뉴', '상태 문구', '인증 카드', '긴 글', '숨김']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
  }
})

test('대화상자 예시는 열고 X 버튼으로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '대화상자 열기' }))
  expect(await screen.findByRole('dialog', { name: '새 행사' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('옆 메뉴 예시는 열고 닫기 버튼으로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '옆 메뉴 열기' }))
  expect(await screen.findByRole('dialog', { name: '예시 메뉴' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/ui-gallery/Gallery.test.tsx`
Expected: FAIL. `./Gallery`를 찾지 못한다.

- [ ] **Step 3: 기본 부품 작성**

`apps/web/src/components/ui/button.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 Btn: 반경 3.5px, 굵기 500. 모든 변형에 1px 테두리를 둬 주 버튼과 테두리 버튼의 높이(md 33.5px)를 맞춘다.
export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-sm border font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-blue-700',
        outline: 'border-input bg-white text-gray-700 hover:bg-gray-50',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-gray-200',
        ghost: 'border-transparent bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700',
        destructive: 'border-transparent bg-destructive text-white hover:bg-red-700',
        link: 'border-transparent bg-transparent text-blue-500 underline-offset-4 hover:underline',
      },
      size: {
        md: 'px-4 py-2 text-sm [&_svg]:size-4',
        sm: 'px-3 py-1.5 text-xs [&_svg]:size-3.5',
        icon: 'p-2 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

// type을 따로 정하지 않는다. form 안의 버튼은 브라우저 기본값(submit)을 그대로 쓴다.
export function Button({ className, variant, size, ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
```

`apps/web/src/components/ui/input.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 입력칸·선택칸·여러 줄 입력이 같은 모양을 쓴다(높이 33.5px). 라벨 안에 넣어도 라벨 굵기를 물려받지 않게 font-normal을 둔다.
// 선택칸은 :read-only에 걸리므로 읽기 전용 모양은 입력칸과 여러 줄 입력에만 준다.
export const fieldClass = 'w-full min-w-0 rounded-sm border border-input bg-white px-3 py-2 text-sm font-normal text-gray-800 outline-none placeholder:text-gray-400 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:border-border disabled:bg-gray-50 disabled:text-gray-400 aria-invalid:border-destructive'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(fieldClass, 'read-only:border-border read-only:bg-gray-50', className)} {...props} />
}
```

`apps/web/src/components/ui/textarea.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(fieldClass, 'min-h-20 resize-y read-only:border-border read-only:bg-gray-50', className)} {...props} />
}
```

`apps/web/src/components/ui/native-select.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

// 입력칸 모양의 브라우저 선택칸. 휴대폰에서도 시스템 선택 화면을 그대로 쓴다.
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn(fieldClass, 'cursor-pointer', className)} {...props} />
}
```

`apps/web/src/components/ui/label.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 폼 라벨: 10.5px, 굵기 500, gray-700.
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('text-xs font-medium text-gray-700', className)} {...props} />
}
```

`apps/web/src/components/ui/badge.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 상태 칩: 50 배경, 200 테두리, 700 글자, 반경 3.5px. 경고는 amber가 아니라 yellow다.
const badgeVariants = cva('inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      info: 'border-blue-200 bg-blue-50 text-blue-700',
      success: 'border-green-200 bg-green-50 text-green-700',
      warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
      danger: 'border-red-200 bg-red-50 text-red-700',
      neutral: 'border-transparent bg-gray-100 text-gray-500',
    },
  },
  defaultVariants: { tone: 'neutral' },
})
export type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

export function Badge({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}
```

`apps/web/src/components/ui/card.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 카드: 반경 큰 값, gray-200 테두리, 옅은 그림자. section·details처럼 의미 있는 태그에는 cardClass를 직접 준다.
export const cardClass = 'rounded-lg border bg-card text-card-foreground shadow-sm'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card" className={cn(cardClass, className)} {...props} />
}
```

`apps/web/src/components/ui/alert.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 안내 배너: 반경 중간 값, 50 배경, 200 테두리, 700 글자, 10.5px. 알림 역할(role)은 StateMessage가 맡으므로 두지 않는다.
const alertVariants = cva('rounded-md border p-3 text-xs wrap-anywhere', {
  variants: {
    tone: {
      info: 'border-blue-200 bg-blue-50 text-blue-700',
      success: 'border-green-200 bg-green-50 text-green-700',
      warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
      danger: 'border-red-200 bg-red-50 text-red-700',
    },
  },
  defaultVariants: { tone: 'info' },
})

export function Alert({ className, tone, ...props }: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ tone }), className)} {...props} />
}
```

`apps/web/src/components/ui/dialog.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

// 통일 규칙: 오버레이 검정 45%, 반경 큰 값, 큰 그림자, 안쪽 여백 21px, 폭 약 440px.
// 내용을 오버레이 안에 둔다(Radix 문서의 scrollable overlay). 좁거나 낮은 화면에서는 오버레이가 스크롤되어 내용이 잘리지 않는다.
export function DialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4 data-[state=open]:animate-in data-[state=open]:fade-in-0">
      <DialogPrimitive.Content data-slot="dialog-content" className={cn(
        'relative flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        className)} {...props}>
        {children}
        <DialogPrimitive.Close aria-label="닫기" className="absolute top-6 right-6 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Overlay>
  </DialogPrimitive.Portal>
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 pr-6', className)} {...props} />
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-base font-semibold text-gray-900', className)} {...props} />
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-gray-500', className)} {...props} />
}

// 버튼 줄은 오른쪽 정렬한다. 회색 footer 띠는 쓰지 않는다(통일 규칙).
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)} {...props} />
}
```

`apps/web/src/components/ui/sheet.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Sheet = DialogPrimitive.Root

// 768px 미만에서 사이드바를 왼쪽에서 여는 패널. 제목은 화면에 보이지 않게 두고 설명은 생략한다.
export function SheetContent({ className, children, title, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content aria-describedby={undefined} className={cn(
      'fixed inset-y-0 left-0 z-50 flex w-60 max-w-full flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
      className)} {...props}>
      <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close aria-label="메뉴 닫기" className="absolute top-5 right-3 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
```

`apps/web/src/components/ui/nav-item.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 사이드바 메뉴 항목: 반경 3.5px, 기본 gray-600, 활성 blue-50 배경과 blue-700 글자(굵기 500).
export function NavItem({ className, active = false, ...props }: ComponentProps<'button'> & { active?: boolean }) {
  return <button type="button" aria-current={active ? 'page' : undefined} className={cn(
    'w-full cursor-pointer rounded-sm px-3 py-2 text-left text-sm wrap-anywhere text-gray-600 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-45 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground',
    className)} {...props} />
}
```

`apps/web/src/components/ui/tab-button.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 페이지 탭: 높이 40px(py-3 + 밑줄 2px), 굵기 500, 비활성 gray-500, 활성 blue-700과 blue-600 밑줄. 탭 동작(ARIA·키보드)은 쓰는 쪽이 정한다.
export function TabButton({ className, ...props }: ComponentProps<'button'>) {
  return <button type="button" role="tab" className={cn(
    '-mb-px inline-flex cursor-pointer items-center border-b-2 border-transparent px-4 py-3 text-sm font-medium whitespace-nowrap text-gray-500 transition-colors hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-selected:border-primary aria-selected:text-accent-foreground',
    className)} {...props} />
}
```

`apps/web/src/components/EmptyState.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = { icon: LucideIcon; title: string; description?: string; className?: string }

// 와이어프레임 빈 화면: blue-50 원(49px) 안에 아이콘(21px), 굵은 제목, 회색 설명.
export function EmptyState({ icon: Icon, title, description, className }: Props) {
  return <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
    <span className="mb-5 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon aria-hidden className="size-6" /></span>
    <p className="text-sm font-bold text-gray-900">{title}</p>
    {description && <p className="mt-2 text-xs/6 text-gray-500">{description}</p>}
  </div>
}
```

`apps/web/src/components/Avatar.tsx`:

```tsx
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

// 와이어프레임 아바타: gray-200 원(24.5px)에 사람 아이콘(14px). 사진과 이니셜은 와이어프레임에 없다.
export function Avatar({ className }: { className?: string }) {
  return <span aria-hidden className={cn('flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500', className)}>
    <User className="size-4" />
  </span>
}
```

`apps/web/src/components/AuthCard.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 SIGN-IN·INV 화면의 가운데 카드(폭 520px, 여백 36px). 페이지 가운데 정렬은 쓰는 쪽이 맡는다.
export function AuthCard({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex w-full max-w-148 flex-col gap-6 rounded-lg border bg-white p-6 shadow-sm sm:p-10', className)} {...props} />
}
```

`apps/web/src/components/BrandMark.tsx`:

```tsx
// 와이어프레임 로고: blue-600 정사각형(24.5px) 안의 흰 V. 사이드바와 로그인·가입 카드 머리에 쓴다.
export function BrandMark() {
  return <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">V</span>
}
```

- [ ] **Step 4: 부품 확인 화면 작성**

`apps/web/ui.html`:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VADA 부품</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/ui-gallery/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/ui-gallery/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Gallery from './Gallery'
import '../index.css'

// 개발 서버에서만 /ui.html로 열린다. 운영 빌드는 index.html만 묶는다.
createRoot(document.getElementById('root')!).render(<StrictMode><Gallery /></StrictMode>)
```

`apps/web/src/ui-gallery/Gallery.tsx`:

```tsx
import { useState, type ReactNode } from 'react'
import { CalendarDays, Copy, Plus } from 'lucide-react'
import { AuthCard } from '@/components/AuthCard'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { NavItem } from '@/components/ui/nav-item'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { TabButton } from '@/components/ui/tab-button'
import { Textarea } from '@/components/ui/textarea'

const longName = '2026 소프트웨어융합대학 체육대회 준비와 참가자 명단 확인 그리고 물품 구매 요청 정리를 위한 아주 긴 행사 이름'.repeat(2)
const unbroken = `https://www.coupang.com/vp/products/${'1234567890'.repeat(12)}`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3 border-b py-6">
    <h2 className="text-base">{title}</h2>
    <div className="flex flex-wrap items-start gap-3">{children}</div>
  </section>
}

// 새 부품이나 변형을 더하면 여기에도 더한다(AGENTS.md "화면" 절). 와이어프레임 스크린샷과 나란히 비교하는 화면이다.
export default function Gallery() {
  const [sheetOpen, setSheetOpen] = useState(false)
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <h1 className="text-xl font-bold">VADA 부품</h1>
    <Section title="버튼">
      <Button>주 버튼</Button><Button variant="outline">테두리</Button><Button variant="secondary">보조</Button>
      <Button variant="ghost">텍스트</Button><Button variant="destructive">위험</Button><Button variant="link">링크 →</Button>
      <Button size="sm"><Plus />새 행사</Button><Button size="sm" variant="outline"><Copy />코드 복사</Button><Button disabled>비활성</Button>
      <Button variant="ghost" size="icon" aria-label="달력"><CalendarDays /></Button>
    </Section>
    <Section title="입력">
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-input">행사 이름</Label><Input id="g-input" placeholder="새 행사 이름" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-code">초대 코드</Label><Input id="g-code" readOnly value="ABCD2345" className="font-mono text-xl font-bold tracking-widest" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-invalid">송장번호</Label><Input id="g-invalid" aria-invalid defaultValue="잘못된 값" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-select">상태 필터</Label><NativeSelect id="g-select"><option>전체 상태</option><option>승인</option></NativeSelect></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-textarea">메시지</Label><Textarea id="g-textarea" placeholder="행사 준비 이야기를 나눠 주세요" /></div>
      <div className="flex w-72 flex-col gap-1.5"><Label htmlFor="g-disabled">비활성</Label><Input id="g-disabled" disabled value="입력할 수 없음" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-blue-600" defaultChecked />체크박스</label>
    </Section>
    <Section title="칩">
      <Badge tone="info">접수</Badge><Badge tone="success">승인</Badge><Badge tone="warning">보완 요청</Badge>
      <Badge tone="danger">반려</Badge><Badge>검토 대기</Badge>
    </Section>
    <Section title="카드·배너">
      <Card className="w-72 p-4"><p className="text-sm font-semibold">카드 제목</p><p className="text-xs text-gray-500">카드 설명</p></Card>
      <div className="flex w-full flex-col gap-2">
        <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
        <Alert tone="success">참여했어요.</Alert>
        <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요.</Alert>
        <Alert tone="danger">처리하지 못했어요.</Alert>
      </div>
    </Section>
    <Section title="메뉴·탭">
      <div className="flex w-60 flex-col gap-0.5 rounded-lg border bg-white p-2"><NavItem active>체육대회</NavItem><NavItem>축제</NavItem><NavItem disabled>비활성 행사</NavItem></div>
      <div role="tablist" aria-label="예시 탭" className="flex gap-0.5 border-b bg-white px-6">
        <TabButton aria-selected>대화</TabButton><TabButton aria-selected={false}>구매요청</TabButton>
      </div>
    </Section>
    <Section title="빈 화면·아바타·로고">
      <Card className="w-96"><EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." /></Card>
      <div className="flex items-center gap-2"><Avatar /><span className="text-xs font-medium text-gray-700">박해랑</span></div>
      <div className="flex items-center gap-2"><BrandMark /><span className="text-base font-semibold">VADA M1</span></div>
    </Section>
    <Section title="대화상자·옆 메뉴">
      <Dialog>
        <DialogTrigger asChild><Button variant="outline">대화상자 열기</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>새 행사</DialogTitle><DialogDescription>행사를 만들면 대화방이 함께 생겨요.</DialogDescription></DialogHeader>
          <div className="flex flex-col gap-1.5"><Label htmlFor="g-dialog-name">행사 이름</Label><Input id="g-dialog-name" placeholder="새 행사 이름" /></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">취소</Button></DialogClose><Button>행사 만들기</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Button variant="outline" onClick={() => setSheetOpen(true)}>옆 메뉴 열기</Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="예시 메뉴"><div className="flex flex-col gap-0.5 px-2 pt-14"><NavItem active>체육대회</NavItem><NavItem>축제</NavItem></div></SheetContent>
      </Sheet>
    </Section>
    <Section title="상태 문구">
      <StateMessage kind="loading">불러오는 중…</StateMessage><StateMessage kind="notice">저장했어요.</StateMessage>
      <StateMessage kind="empty">아직 대화가 없어요.</StateMessage><StateMessage kind="error">연결을 확인해 주세요.</StateMessage>
    </Section>
    <Section title="인증 카드">
      <AuthCard>
        <div className="flex flex-wrap items-center gap-2"><BrandMark /><p className="text-base font-semibold">VADA M1</p><p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p></div>
        <div className="flex flex-col gap-3">
          <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>
          <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
          <Button>Google로 로그인</Button>
        </div>
      </AuthCard>
    </Section>
    <Section title="긴 글">
      <div className="flex w-60 flex-col rounded-lg border bg-white p-2"><NavItem active>{longName}</NavItem></div>
      <div className="flex w-60 flex-wrap items-baseline gap-x-2 rounded-lg border bg-white p-2"><strong className="min-w-0 text-sm font-semibold wrap-anywhere">{unbroken}</strong><time className="text-xs text-gray-400">오후 3:00</time></div>
      <p className="w-full text-sm wrap-anywhere">{unbroken}</p>
    </Section>
    <Section title="숨김">
      <div hidden className="flex" data-check="hidden">이 문장이 보이면 hidden 속성이 깨진 것이다.</div>
      <p className="text-xs text-gray-500">위에 아무 문장도 보이지 않아야 한다.</p>
    </Section>
  </main>
}
```

`DialogTrigger asChild`와 `DialogClose asChild`는 Radix가 자식 버튼에 동작을 붙이는 방식이다. 그래서 `Button`이 `ref`와 이벤트 props를 그대로 넘겨야 한다. React 19는 `ref`를 일반 prop으로 넘기므로 지금 구현으로 된다.

Radix Dialog는 jsdom에서 따로 채울 기능이 없다(ResizeObserver를 쓰지 않는다). 테스트가 `ResizeObserver is not defined`처럼 jsdom에 없는 기능 때문에 실패할 때만 아래처럼 처리하고 ledger에 Ruling으로 남긴다.
1. `apps/web/src/test-support/radix-jsdom.ts`를 만든다. 내용은 다음 두 줄이다.
   ```ts
   // jsdom에 없는 브라우저 기능 중 Radix가 쓰는 것만 채운다.
   globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
   ```
2. 실패한 테스트 파일에서 `import '../test-support/radix-jsdom'`으로 불러온다(`LinkDialog.test-support.ts`와 같은 방식).

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/ui-gallery/Gallery.test.tsx src/components`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음. 아이콘 이름(`CalendarDays`, `ChevronRight`, `Copy`, `LogOut`, `Menu`, `Plus`, `RefreshCw`, `User`, `UserPlus`, `X`)은 lucide-react 1.52.0에 있는 것을 확인해 두었다.

- [ ] **Step 6: 커밋**

```bash
git add apps/web/ui.html apps/web/src/components apps/web/src/ui-gallery
git commit -m "기본 부품과 부품 확인 화면 추가"
```

---

### Task 3: 앱 틀 (사이드바, 헤더, 행사 탭, 휴대폰 메뉴)

**Files:**
- Move: `apps/web/src/workspace/Sidebar.tsx` → `apps/web/src/workspace/WorkspaceSidebar.tsx`
- Create: `apps/web/src/workspace/WorkspaceHeader.tsx`
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/EventWorkspace.tsx`, `apps/web/src/events/EventList.tsx`
- Delete: `apps/web/src/workspace/Workspace.css`
- Test: `apps/web/src/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `Sheet`, `SheetContent`, `EmptyState`, `Avatar`, `BrandMark`, `Badge`, `Button`, `Card`, `Label`, `NativeSelect`, `NavItem`, `TabButton`
- Produces:
  - `WorkspaceSidebar`: 기본 내보내기. props는 지금 `Sidebar`와 같다(`AccountProps & { membership; memberships; onMembershipChange; children }`). `type AccountProps`도 내보낸다.
  - `WorkspaceHeader({ councilName: string; title: string; onMenu: () => void })`
  - 헤더 `h1`: 고른 행사 이름, 없으면 "행사"
  - 휴대폰 메뉴: 버튼 이름 "메뉴 열기", 옆 메뉴 대화상자 이름 "학생회 작업 공간"
  - `EventList`: props는 지금과 같다. Task 4가 `onCreate`를 더한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/workspace/Workspace.test.tsx`의 testing-library import에 `within`을 더하고, 파일 끝에 더한다.

```tsx
test('the header title is the chosen event, or 행사 before one is chosen', async () => {
  setup()
  render(<Workspace {...props} />)
  expect(screen.getByRole('heading', { level: 1, name: '행사' })).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('on a narrow screen the menu button opens the sidebar, and choosing an event closes it', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const menu = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.click(await within(menu).findByRole('button', { name: '체육대회' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '학생회 작업 공간' })).toBeNull())
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})
```

jsdom은 CSS를 적용하지 않으므로 `md:hidden`인 메뉴 버튼도 보인다. 옆 메뉴가 열려 있는 동안 Radix가 바깥 내용(데스크톱 aside)에 `aria-hidden`을 붙이므로 역할 조회는 옆 메뉴 안만 찾는다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/workspace/Workspace.test.tsx`
Expected: FAIL. "행사" 제목(h1)과 "메뉴 열기" 버튼이 아직 없다.

- [ ] **Step 3: 사이드바**

Run: `git mv apps/web/src/workspace/Sidebar.tsx apps/web/src/workspace/WorkspaceSidebar.tsx && git rm -q apps/web/src/workspace/Workspace.css`

`apps/web/src/workspace/WorkspaceSidebar.tsx` 전체:

```tsx
import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import type { MembershipSummary } from '@vada/contracts'
import InviteShare from '../access/InviteShare'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

export type AccountProps = { user: { name: string; email: string }; logoutBusy: boolean; onLogout: () => void }
type Props = AccountProps & { membership: MembershipSummary; memberships: MembershipSummary[]; onMembershipChange: (id: string) => void; children: ReactNode }

// 와이어프레임 사이드바(210px): 위 로고와 학생회 이름, 가운데 행사 메뉴, 아래 사용자.
// 데스크톱 aside와 휴대폰 옆 메뉴가 같이 쓴다. 위 블록의 오른쪽 여백은 옆 메뉴 닫기 버튼 자리다.
export default function WorkspaceSidebar({ membership, memberships, onMembershipChange, user, logoutBusy, onLogout, children }: Props) {
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-4 pr-10 pl-5">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">VADA</p>
        <h2 className="text-xs font-normal wrap-anywhere text-gray-400">{membership.organization.name}</h2>
      </div>
    </div>
    <section className="flex shrink-0 flex-col gap-2 border-b border-gray-100 px-4 py-3" aria-label="내 소속">
      {memberships.length > 1 && <Label className="flex flex-col gap-1.5">학생회 선택
        <NativeSelect value={membership.id} onChange={event => onMembershipChange(event.target.value)}>
          {memberships.map(item => <option key={item.id} value={item.id}>{item.organization.name} · {item.department?.name ?? '미배정'}</option>)}
        </NativeSelect></Label>}
      <InviteShare code={membership.organization.inviteCode} />
    </section>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{children}</div>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-gray-400">{membership.department?.name ?? '미배정'}
          {membership.department?.handlesFinance && <Badge tone="info">재정 담당</Badge>}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
```

`InviteShare`는 Task 4에서 대화상자로 옮긴다. 그 전까지는 옛 클래스가 남아 모양이 없다.

- [ ] **Step 4: 헤더**

`apps/web/src/workspace/WorkspaceHeader.tsx`:

```tsx
import { ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { councilName: string; title: string; onMenu: () => void }

// 와이어프레임 헤더(56px): 경로(상위 gray-400, 마지막 gray-600)와 제목. 사이드바가 숨는 폭(768px 미만)에서만 메뉴 버튼을 보여 준다.
export default function WorkspaceHeader({ councilName, title, onMenu }: Props) {
  return <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-white px-4 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" onClick={onMenu}><Menu /></Button>
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-xs text-gray-400">
        <span className="truncate">{councilName}</span>
        <ChevronRight aria-hidden className="size-3 shrink-0" />
        <span className="shrink-0 text-gray-600">행사</span>
      </p>
      <h1 className="mt-0.5 truncate text-base font-semibold text-gray-900">{title}</h1>
    </div>
  </header>
}
```

- [ ] **Step 5: 행사 메뉴**

`apps/web/src/events/EventList.tsx` 전체:

```tsx
import { RefreshCw } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/components/ui/nav-item'

type Props = {
  events: EventSummary[] | null; loading: boolean; error: string; saving: boolean
  selectedId?: string; onSelect: (event: EventSummary) => void; onRefresh: () => void
}
export default function EventList({ events, loading, error, saving, selectedId, onSelect, onRefresh }: Props) {
  return <nav aria-label="행사 목록" className="flex flex-col gap-1">
    <div className="flex items-center gap-1 pl-3">
      <h2 className="mr-auto text-xs font-medium text-gray-400">행사</h2>
      <Button variant="ghost" size="icon" aria-label="목록 새로고침" disabled={loading || saving} onClick={onRefresh}><RefreshCw /></Button>
    </div>
    {loading ? <StateMessage kind="loading" className="px-3">행사 목록 불러오는 중…</StateMessage> : error ? <StateMessage kind="error" className="px-3">{error}</StateMessage>
      : events?.length ? <ul className="flex flex-col gap-0.5">{events.map(event => <li key={event.id}>
        <NavItem active={selectedId === event.id} onClick={() => onSelect(event)}>{event.name}</NavItem>
      </li>)}</ul> : <StateMessage kind="empty" className="px-3 text-xs">아직 행사가 없어요.</StateMessage>}
  </nav>
}
```

- [ ] **Step 6: 앱 틀 조립**

`apps/web/src/workspace/Workspace.tsx` 전체:

```tsx
import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { EventSummary, MembershipSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import { Card } from '@/components/ui/card'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import EventList from '../events/EventList'
import CreateEventForm from '../events/CreateEventForm'
import { useEvents } from '../events/useEvents'
import EventWorkspace from './EventWorkspace'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type AccountProps } from './WorkspaceSidebar'

type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string }
export default function Workspace({ initialOrganizationId, ...props }: Props) {
  // 초대로 방금 참여한 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId} />
}

function CouncilWorkspace({ membership, onMembershipChange, ...props }: Props & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  const [selected, setSelected] = useState<EventSummary | null>(null)
  const [leaveRisk, setLeaveRisk] = useState(false)
  // 768px 미만에서 옆 메뉴로 연 사이드바. 행사를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  function canLeave() { return !leaveRisk || window.confirm('입력 중이거나 처리 중인 구매요청이 있어요. 이동하면 입력 내용이 사라지고 서버 처리는 계속될 수 있어요. 이동할까요?') }
  useEffect(() => {
    if (!leaveRisk) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk])
  function select(event: EventSummary) {
    if (event.id !== selected?.id && canLeave()) setSelected(event)
    setNavOpen(false)
  }
  // 데스크톱 aside와 휴대폰 옆 메뉴가 같은 내용을 쓴다. 옆 메뉴는 열렸을 때만 그려진다.
  const sidebar = <WorkspaceSidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
    onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}>
    <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
      selectedId={selected?.id} onSelect={select} onRefresh={events.refresh} />
    <CreateEventForm name={events.name} onNameChange={events.setName} saving={events.saving}
      disabled={events.loading || Boolean(events.loadError)} error={events.createError} onSubmit={event => { void events.create(event) }} />
  </WorkspaceSidebar>
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={membership.organization.name} title={selected?.name ?? '행사'} onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {selected ? <EventWorkspace key={selected.id} event={selected} handlesFinance={membership.department?.handlesFinance ?? false} onLeaveRiskChange={setLeaveRisk} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
    </div>
  </div>
}
```

`CreateEventForm`은 Task 4에서 대화상자로 옮긴다.

- [ ] **Step 7: 행사 탭**

`apps/web/src/workspace/EventWorkspace.tsx` 전체. 상태와 함수는 그대로다.

```tsx
import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { EventSummary } from '@vada/contracts'
import Chat from '../chat/Chat'
import Purchases from '../purchases/Purchases'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'

// 재정부 보기 전환 버튼: 눌린 쪽을 활성 메뉴 색으로 보여 준다.
const pressed = 'aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground'

export default function EventWorkspace({ event, handlesFinance, onLeaveRiskChange }: { event: EventSummary; handlesFinance: boolean; onLeaveRiskChange: (risk: boolean) => void }) {
  const [tab, setTab] = useState<'chat' | 'purchases'>('chat')
  const [purchasesOpened, setPurchasesOpened] = useState(false)
  const [financeOpened, setFinanceOpened] = useState(false)
  const [purchaseView, setPurchaseView] = useState<'own' | 'finance'>('own')
  const viewingFinance = handlesFinance && purchaseView === 'finance'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [ownRisk, setOwnRisk] = useState(false)
  const [financeRisk, setFinanceRisk] = useState(false)
  useEffect(() => { onLeaveRiskChange(ownRisk || (handlesFinance && financeRisk)) }, [ownRisk, financeRisk, handlesFinance, onLeaveRiskChange])
  useEffect(() => () => onLeaveRiskChange(false), [onLeaveRiskChange])
  const prefix = useId()
  function select(next: typeof tab) { setTab(next); if (next === 'purchases') setPurchasesOpened(true) }
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const next = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'purchases' : tab === 'chat' ? 'purchases' : 'chat'
    select(next)
    document.getElementById(`${prefix}-${next}-tab`)?.focus()
  }
  // 행사 이름은 WorkspaceHeader의 제목이 보여 준다. 대화 탭은 흰 바탕 전체 화면, 구매요청 탭은 gray-50 본문에 여백 21px다.
  return <>
    <div className="flex shrink-0 gap-0.5 border-b bg-white px-4 sm:px-6" role="tablist" aria-label="행사 작업">
      {(['chat', 'purchases'] as const).map(value => <TabButton key={value} id={`${prefix}-${value}-tab`}
        aria-selected={tab === value} aria-controls={`${prefix}-${value}-panel`} tabIndex={tab === value ? 0 : -1}
        onClick={() => select(value)} onKeyDown={navigate}>{value === 'chat' ? '대화' : '구매요청'}</TabButton>)}
    </div>
    {/* 탭은 숨기기만 하여 대화 입력·스크롤과 구매 편집 상태를 보존한다. 행사 이동은 key로 격리한다. */}
    <div className="flex min-h-0 flex-1 flex-col bg-white" role="tabpanel" id={`${prefix}-chat-panel`} aria-labelledby={`${prefix}-chat-tab`} hidden={tab !== 'chat'}>
      <div className="flex shrink-0 justify-end border-b border-gray-100 px-4 py-2 sm:px-6">
        <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => { setPurchasesOpened(true); setDialogOpen(true) }}>끼룩이</Button>
      </div>
      <Chat organizationId={event.organizationId} eventId={event.id} eventName={event.name} />
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" role="tabpanel" id={`${prefix}-purchases-panel`} aria-labelledby={`${prefix}-purchases-tab`} hidden={tab !== 'purchases'}>
      {purchasesOpened && <div className="mx-auto flex max-w-5xl flex-col gap-4">
        {handlesFinance && <div className="flex flex-wrap gap-2" role="group" aria-label="구매요청 보기">
          <Button variant="outline" size="sm" className={pressed} aria-pressed={!viewingFinance} onClick={() => setPurchaseView('own')}>내 요청 보기</Button>
          <Button variant="outline" size="sm" className={pressed} aria-pressed={viewingFinance} onClick={() => { setFinanceOpened(true); setPurchaseView('finance') }}>재정부 제출 요청 보기</Button>
        </div>}
        <div hidden={viewingFinance}>
          <Purchases organizationId={event.organizationId} eventId={event.id} dialogOpen={dialogOpen}
            onDialogClose={() => setDialogOpen(false)} onDetailOpen={() => { setTab('purchases'); setPurchaseView('own') }} onLeaveRiskChange={setOwnRisk}
            onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />
        </div>
        {handlesFinance && <div hidden={!viewingFinance}>
          {financeOpened && <Purchases organizationId={event.organizationId} eventId={event.id} finance onLeaveRiskChange={setFinanceRisk}
            onReturnToChat={() => { setTab('chat'); document.getElementById(`${prefix}-chat-tab`)?.focus() }} />}</div>}
      </div>}
    </div>
  </>
}
```

끼룩이 버튼은 대화 기록 위에 겹치지 않도록 대화 탭 맨 위 한 줄에 둔다. 구매 링크 대화상자는 `document.body`에 그려지므로 구매요청 탭이 숨겨져 있어도 열린다(지금과 같다).

- [ ] **Step 8: 테스트가 통과하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/workspace src/events src/App.integration.test.tsx`
Expected: PASS. 새 테스트 2개와 기존 사이드바·행사·통합 테스트가 모두 통과한다.

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add -A apps/web/src/workspace apps/web/src/events
git commit -m "앱 틀을 와이어프레임 모양으로 바꾸고 휴대폰 메뉴 추가"
```

---

### Task 4: 행사 만들기와 구성원 초대를 대화상자로

**Files:**
- Modify: `apps/web/src/events/CreateEventForm.tsx`, `apps/web/src/events/useEvents.ts`, `apps/web/src/events/EventList.tsx`, `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/access/InviteShare.tsx`
- Test: `apps/web/src/workspace/Workspace.test.tsx`, `apps/web/src/access/InviteShare.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `Dialog*`, `Input`, `Label`, `Button`; Task 3의 `EventList`, `WorkspaceSidebar`, `Workspace`
- Produces:
  - `useEvents().create(e: FormEvent<HTMLFormElement>): Promise<boolean>`: 성공하면 true
  - `EventList`에 선택 prop `onCreate?: () => void`. 버튼 이름은 "새 행사"다.
  - `CreateEventForm`에 선택 prop `onCancel?: () => void`. 있으면 "취소" 버튼을 보여 준다.
  - 대화상자 이름 "새 행사", "구성원 초대"
  - `InviteShare({ code })`: 시그니처는 그대로다. 링크와 코드를 늘 보여 준다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/workspace/Workspace.test.tsx`를 고친다. 먼저 `an unassigned member sees 미배정 ...` 테스트의 마지막 줄 `expect(screen.getByRole('button', { name: '초대 링크 복사' })).toBeTruthy()`를 아래로 바꾼다.

```tsx
  expect(screen.getByRole('button', { name: '구성원 초대' })).toBeTruthy()
```

파일 끝에 더한다.

```tsx
test('the invite dialog shows the council link and code', async () => {
  setup()
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '구성원 초대' }))
  const dialog = await screen.findByRole('dialog', { name: '구성원 초대' })
  expect((within(dialog).getByLabelText('초대 코드') as HTMLInputElement).value).toBe('ABCD2345')
  expect((within(dialog).getByLabelText('초대 링크') as HTMLInputElement).value).toBe(`${window.location.origin}/join/ABCD2345`)
})

test('a new event is created in a dialog that closes on success and on Escape', async () => {
  const created = { ...event, id: 'e3', name: '가을 축제' }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({ ok: true, status: 200, json: async () =>
    init?.method === 'POST' ? { event: created }
      : url.endsWith('/events') ? { events: [event] }
        : url.endsWith('/messages') ? { messages: [], nextCursor: null } : { requests: [], nextCursor: null } })))
  render(<Workspace {...props} />)
  // 목록을 다 불러온 뒤에야 만들기 버튼이 활성화되므로 목록을 먼저 기다린다.
  await screen.findByRole('button', { name: '체육대회' })
  fireEvent.click(screen.getByRole('button', { name: '새 행사' }))
  const dialog = await screen.findByRole('dialog', { name: '새 행사' })
  fireEvent.change(within(dialog).getByLabelText('행사 이름'), { target: { value: '가을 축제' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '행사 만들기' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 행사' })).toBeNull())
  expect(await screen.findByRole('button', { name: '가을 축제' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 행사' }))
  fireEvent.keyDown(await screen.findByRole('dialog', { name: '새 행사' }), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '새 행사' })).toBeNull())
})
```

`apps/web/src/access/InviteShare.test.tsx`에서 마지막 테스트(`a browser without the clipboard API falls back the same way`)를 지우고, 아래 두 테스트를 더한다. 이제 링크와 코드는 처음부터 보이고, 복사에 실패하면 직접 선택하라는 안내만 나온다.

```tsx
test('shows the link and code before any copy so they can be copied by hand', () => {
  render(<InviteShare code="ABCD2345" />)
  expect((screen.getByLabelText('초대 링크') as HTMLInputElement).value).toBe(link())
  expect((screen.getByLabelText('초대 코드') as HTMLInputElement).value).toBe('ABCD2345')
})

test('a browser without the clipboard API explains how to copy by hand', async () => {
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '코드 복사' }))
  expect((await screen.findByRole('alert')).textContent).toContain('직접 선택해 복사')
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/workspace/Workspace.test.tsx src/access/InviteShare.test.tsx`
Expected: FAIL
- Workspace: "구성원 초대"와 "새 행사" 버튼이 없다.
- InviteShare: 새 테스트 두 개가 실패한다. 지금은 복사에 실패해야 입력칸이 나오고, 안내 문구가 "아래에서 직접 복사해 주세요"다.

- [ ] **Step 3: 행사 만들기 폼과 성공 여부**

`apps/web/src/events/useEvents.ts`의 `create` 함수 전체를 아래로 바꾼다. 성공 여부를 돌려준다.

```ts
  // 성공하면 true를 돌려준다. 대화상자는 성공했을 때만 닫는다.
  async function create(e: FormEvent<HTMLFormElement>): Promise<boolean> {
    e.preventDefault()
    const parsed = CreateEventSchema.safeParse({ name })
    if (!parsed.success || pending.current || loading || loadError) return false
    pending.current = true
    setSaving(true)
    setCreateError('')
    try {
      const body: CreateEventRequest = parsed.data
      const response = await fetch(url, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Event creation failed')
      const result = await response.json() as EventResponse
      if (!result.event?.id || result.event.organizationId !== organizationId) throw new Error('Invalid response')
      if (active.current) {
        setEvents(previous => [result.event, ...(previous ?? [])])
        setName('')
      }
      return true
    } catch {
      // 응답 유실 시 서버에는 저장됐을 수 있으므로 자동으로 재전송하지 않는다.
      if (active.current) setCreateError('생성 결과를 확인하지 못했어요. 다시 만들기 전에 목록을 새로고침해 주세요.')
      return false
    } finally {
      pending.current = false
      if (active.current) setSaving(false)
    }
  }
```

`apps/web/src/events/CreateEventForm.tsx` 전체. 와이어프레임 폼 모달처럼 입력 묶음과 버튼 줄 사이를 28px(`gap-5` + `pt-3`) 띄운다.

```tsx
import { useId, type FormEvent } from 'react'
import { CreateEventSchema, EVENT_NAME_MAX, codePoints } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = {
  name: string; onNameChange: (name: string) => void; saving: boolean; disabled: boolean; error: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void
}
export default function CreateEventForm({ name, onNameChange, saving, disabled, error, onSubmit, onCancel }: Props) {
  const inputId = useId()
  const valid = CreateEventSchema.safeParse({ name }).success
  return <form className="flex flex-col gap-5" aria-label="행사 만들기" onSubmit={onSubmit}>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>행사 이름</Label>
      <Input id={inputId} value={name} required disabled={saving} placeholder="새 행사 이름" onChange={event => onNameChange(event.target.value)} />
      <p className="text-xs text-gray-400">{codePoints(name.trim())} / {EVENT_NAME_MAX}자</p>
    </div>
    {error && <StateMessage kind="error">{error}</StateMessage>}
    <DialogFooter className="pt-3">
      {onCancel && <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>}
      <Button type="submit" disabled={!valid || disabled || saving}>{saving ? '만드는 중…' : '행사 만들기'}</Button>
    </DialogFooter>
  </form>
}
```

`apps/web/src/events/EventList.tsx` 전체. "새 행사" 버튼은 목록을 불러오는 중에도 열 수 있다. 저장 버튼은 폼이 막는다.

```tsx
import { Plus, RefreshCw } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { NavItem } from '@/components/ui/nav-item'

type Props = {
  events: EventSummary[] | null; loading: boolean; error: string; saving: boolean
  selectedId?: string; onSelect: (event: EventSummary) => void; onRefresh: () => void; onCreate?: () => void
}
export default function EventList({ events, loading, error, saving, selectedId, onSelect, onRefresh, onCreate }: Props) {
  return <nav aria-label="행사 목록" className="flex flex-col gap-1">
    <div className="flex items-center gap-1 pl-3">
      <h2 className="mr-auto text-xs font-medium text-gray-400">행사</h2>
      <Button variant="ghost" size="icon" aria-label="목록 새로고침" disabled={loading || saving} onClick={onRefresh}><RefreshCw /></Button>
      {onCreate && <Button variant="ghost" size="sm" onClick={onCreate}><Plus />새 행사</Button>}
    </div>
    {loading ? <StateMessage kind="loading" className="px-3">행사 목록 불러오는 중…</StateMessage> : error ? <StateMessage kind="error" className="px-3">{error}</StateMessage>
      : events?.length ? <ul className="flex flex-col gap-0.5">{events.map(event => <li key={event.id}>
        <NavItem active={selectedId === event.id} onClick={() => onSelect(event)}>{event.name}</NavItem>
      </li>)}</ul> : <StateMessage kind="empty" className="px-3 text-xs">아직 행사가 없어요.</StateMessage>}
  </nav>
}
```

- [ ] **Step 4: 대화상자 연결**

`apps/web/src/workspace/Workspace.tsx` 전체:

```tsx
import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { EventSummary, MembershipSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import EventList from '../events/EventList'
import CreateEventForm from '../events/CreateEventForm'
import { useEvents } from '../events/useEvents'
import EventWorkspace from './EventWorkspace'
import WorkspaceHeader from './WorkspaceHeader'
import WorkspaceSidebar, { type AccountProps } from './WorkspaceSidebar'

type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string }
export default function Workspace({ initialOrganizationId, ...props }: Props) {
  // 초대로 방금 참여한 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId} />
}

function CouncilWorkspace({ membership, onMembershipChange, ...props }: Props & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  const [selected, setSelected] = useState<EventSummary | null>(null)
  const [leaveRisk, setLeaveRisk] = useState(false)
  // 768px 미만에서 옆 메뉴로 연 사이드바. 행사를 고르면 닫는다.
  const [navOpen, setNavOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  function canLeave() { return !leaveRisk || window.confirm('입력 중이거나 처리 중인 구매요청이 있어요. 이동하면 입력 내용이 사라지고 서버 처리는 계속될 수 있어요. 이동할까요?') }
  useEffect(() => {
    if (!leaveRisk) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [leaveRisk])
  function select(event: EventSummary) {
    if (event.id !== selected?.id && canLeave()) setSelected(event)
    setNavOpen(false)
  }
  // 데스크톱 aside와 휴대폰 옆 메뉴가 같은 내용을 쓴다. 옆 메뉴는 열렸을 때만 그려진다.
  const sidebar = <WorkspaceSidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
    onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}>
    <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
      selectedId={selected?.id} onSelect={select} onRefresh={events.refresh} onCreate={() => { setNavOpen(false); setCreateOpen(true) }} />
  </WorkspaceSidebar>
  return <div className="flex h-dvh">
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col" aria-label="학생회 작업 공간">{sidebar}</aside>
    <Sheet open={navOpen} onOpenChange={setNavOpen}><SheetContent title="학생회 작업 공간">{sidebar}</SheetContent></Sheet>
    {/* 저장 중에는 닫지 않는다. 응답을 기다리는 동안 닫으면 결과를 볼 곳이 없다. */}
    <Dialog open={createOpen} onOpenChange={open => { if (!events.saving) setCreateOpen(open) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>새 행사</DialogTitle><DialogDescription>행사를 만들면 대화방이 함께 생겨요.</DialogDescription></DialogHeader>
        <CreateEventForm name={events.name} onNameChange={events.setName} saving={events.saving}
          disabled={events.loading || Boolean(events.loadError)} error={events.createError} onCancel={() => setCreateOpen(false)}
          onSubmit={event => { void events.create(event).then(created => { if (created) setCreateOpen(false) }) }} />
      </DialogContent>
    </Dialog>
    <div className="flex min-w-0 flex-1 flex-col">
      <WorkspaceHeader councilName={membership.organization.name} title={selected?.name ?? '행사'} onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {selected ? <EventWorkspace key={selected.id} event={selected} handlesFinance={membership.department?.handlesFinance ?? false} onLeaveRiskChange={setLeaveRisk} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
    </div>
  </div>
}
```

`apps/web/src/workspace/WorkspaceSidebar.tsx` 전체:

```tsx
import { useState, type ReactNode } from 'react'
import { LogOut, UserPlus } from 'lucide-react'
import type { MembershipSummary } from '@vada/contracts'
import InviteShare from '../access/InviteShare'
import { Avatar } from '@/components/Avatar'
import { BrandMark } from '@/components/BrandMark'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

export type AccountProps = { user: { name: string; email: string }; logoutBusy: boolean; onLogout: () => void }
type Props = AccountProps & { membership: MembershipSummary; memberships: MembershipSummary[]; onMembershipChange: (id: string) => void; children: ReactNode }

// 와이어프레임 사이드바(210px): 위 로고와 학생회 이름, 가운데 행사 메뉴, 아래 사용자.
// 데스크톱 aside와 휴대폰 옆 메뉴가 같이 쓴다. 위 블록의 오른쪽 여백은 옆 메뉴 닫기 버튼 자리다.
export default function WorkspaceSidebar({ membership, memberships, onMembershipChange, user, logoutBusy, onLogout, children }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false)
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 items-center gap-2 border-b border-gray-100 py-4 pr-10 pl-5">
      <BrandMark />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">VADA</p>
        <h2 className="text-xs font-normal wrap-anywhere text-gray-400">{membership.organization.name}</h2>
      </div>
    </div>
    <section className="flex shrink-0 flex-col gap-2 border-b border-gray-100 px-4 py-3" aria-label="내 소속">
      {memberships.length > 1 && <Label className="flex flex-col gap-1.5">학생회 선택
        <NativeSelect value={membership.id} onChange={event => onMembershipChange(event.target.value)}>
          {memberships.map(item => <option key={item.id} value={item.id}>{item.organization.name} · {item.department?.name ?? '미배정'}</option>)}
        </NativeSelect></Label>}
      <Button variant="outline" size="sm" className="w-full" onClick={() => setInviteOpen(true)}><UserPlus />구성원 초대</Button>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>구성원 초대</DialogTitle>
            <DialogDescription>링크나 코드를 공유하면 학생회에 참여할 수 있어요. 참여한 사람은 미배정으로 등록돼요.</DialogDescription></DialogHeader>
          <InviteShare code={membership.organization.inviteCode} />
        </DialogContent>
      </Dialog>
    </section>
    <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{children}</div>
    <footer className="flex shrink-0 items-center gap-2 border-t border-gray-100 px-4 py-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-gray-700">{user.name}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-gray-400">{membership.department?.name ?? '미배정'}
          {membership.department?.handlesFinance && <Badge tone="info">재정 담당</Badge>}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="로그아웃" disabled={logoutBusy} onClick={onLogout}><LogOut /></Button>
    </footer>
  </div>
}
```

`apps/web/src/access/InviteShare.tsx` 전체. 와이어프레임 ORG-03C처럼 라벨, 읽기 전용 칸, 그 아래 작은 테두리 버튼 순서다.

```tsx
import { useId, useState } from 'react'
import { Copy } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// 와이어프레임 ORG-03C. 링크와 코드는 같은 초대 권한이다. 늘 보이므로 복사에 실패하면 직접 선택해 복사한다.
export default function InviteShare({ code }: { code: string }) {
  const link = `${window.location.origin}/join/${code}`
  const linkId = useId()
  const codeId = useId()
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [failed, setFailed] = useState(false)
  async function copy(kind: 'link' | 'code') {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(kind === 'link' ? link : code)
      setCopied(kind)
      setFailed(false)
    } catch {
      setCopied(null)
      setFailed(true)
    }
  }
  return <section className="flex flex-col gap-5" aria-label="학생회 초대">
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={linkId} className="text-gray-600">초대 링크</Label>
      <Input id={linkId} readOnly value={link} className="font-mono text-xs text-gray-500" onFocus={event => event.currentTarget.select()} />
      <Button variant="outline" size="sm" className="mt-0.5 self-start" onClick={() => { void copy('link') }}><Copy />초대 링크 복사</Button>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={codeId} className="text-gray-600">초대 코드</Label>
      <Input id={codeId} readOnly value={code} className="font-mono text-xl font-bold tracking-widest" onFocus={event => event.currentTarget.select()} />
      <Button variant="outline" size="sm" className="mt-0.5 self-start" onClick={() => { void copy('code') }}><Copy />코드 복사</Button>
    </div>
    {copied && <StateMessage kind="notice">{`${copied === 'link' ? '초대 링크를' : '초대 코드를'} 복사했어요`}</StateMessage>}
    {failed && <StateMessage kind="error">복사하지 못했어요. 링크나 코드를 직접 선택해 복사해 주세요.</StateMessage>}
  </section>
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/workspace src/events src/access src/App.integration.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add apps/web/src/workspace apps/web/src/events apps/web/src/access
git commit -m "행사 만들기와 구성원 초대를 대화상자로 옮기기"
```

---

### Task 5: 로그인·가입 카드

**Files:**
- Modify: `apps/web/src/App.tsx`, `apps/web/src/access/Memberships.tsx`, `apps/web/src/access/JoinOrganization.tsx`, `apps/web/src/access/InviteCodeForm.tsx`
- Delete: `apps/web/src/App.css`
- Test: `apps/web/src/App.test.tsx`, `apps/web/src/App.integration.test.tsx`, `apps/web/src/access/*.test.tsx`(바꾸지 않고 회귀 검사로 실행)

**Interfaces:**
- Consumes: Task 2의 `AuthCard`, `BrandMark`, `Alert`, `Button`, `Input`, `Label`
- Produces: 없음. 문구, 역할, props는 그대로다.

- [ ] **Step 1: 회귀 검사 기준 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/App.test.tsx src/App.integration.test.tsx src/access`
Expected: PASS. 바꾸기 전 기준이다. 이 Task는 모양만 바꾸므로 같은 테스트가 끝에도 통과해야 한다.

- [ ] **Step 2: App**

Run: `git rm -q apps/web/src/App.css`

`apps/web/src/App.tsx` 전체. 상태와 함수는 그대로다. 와이어프레임의 로그인·가입 카드는 로고 줄(로고, 이름, 오른쪽 작은 회색 글)로 시작한다.

```tsx
import { useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import Memberships from './access/Memberships'
import InviteCodeForm from './access/InviteCodeForm'
import JoinOrganization from './access/JoinOrganization'
import { inviteCodeFromPath, invitePath } from './access/invite-path'
import Workspace from './workspace/Workspace'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'

// 초대 링크(/join/코드)로 왔는지, 소속이 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 sm:py-12">
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA M1</h1>
        <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
      </div>
      {children}
    </AuthCard>
  </main>
}

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  const [typedCode, setTypedCode] = useState('')
  const [joinedOrganizationId, setJoinedOrganizationId] = useState<string>()

  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }

  function finishInvite(organizationId: string) {
    leaveInvite()
    setJoinedOrganizationId(organizationId)
  }

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out failed')
    } catch {
      setMessage('로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (!isPending && !error && session) {
    const card = (content: ReactNode) => <AuthPage>
      <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
        <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
        <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
        <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
      </div>
      {content}
      <Button variant="outline" disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
    </AuthPage>
    return <>
      {message && <StateMessage kind="error" className="border-b bg-white px-6 py-3">{message}</StateMessage>}
      {invite ? card(<JoinOrganization key={invite.code} code={invite.code}
        leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'} onJoined={finishInvite} onLeave={leaveInvite} />)
        : <Memberships key={`${session.user.id}:${joinedOrganizationId ?? ''}`}
          renderMemberships={memberships => <Workspace memberships={memberships} initialOrganizationId={joinedOrganizationId}
            user={session.user} logoutBusy={busy} onLogout={() => { void logout() }} />}
          renderEmpty={() => <InviteCodeForm initialCode={typedCode}
            onSubmit={code => { setTypedCode(code); setInvite({ code, from: 'form' }) }} />}
          renderFallback={card} />}
    </>
  }

  return <AuthPage>
    {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={() => { void refetch() }}>다시 확인</Button>
    </div> : <div className="flex flex-col gap-3">
      {invite?.from === 'link' && <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>}
      {isKakaoInAppBrowser(navigator.userAgent) && <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</Alert>}
      <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
      <Button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</Button>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>
}
```

- [ ] **Step 3: 소속, 코드 입력, 학생회 확인**

`apps/web/src/access/Memberships.tsx` 전체. 불러오기 로직은 그대로다.

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import type { MembershipSummary, MembershipsResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

type Props = {
  renderMemberships?: (memberships: MembershipSummary[]) => ReactNode
  renderFallback?: (content: ReactNode) => ReactNode
  // 소속이 없을 때 보여 줄 내용. 앱에서는 초대 코드 입력이다.
  renderEmpty?: () => ReactNode
}
export default function Memberships({ renderMemberships, renderFallback = content => content, renderEmpty }: Props) {
  const [result, setResult] = useState<MembershipsResponse | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setFailed(false)
    async function load() {
      try {
        const response = await fetch('/api/me/memberships', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Membership lookup failed')
        const data = await response.json() as MembershipsResponse
        if (!Array.isArray(data.memberships)) throw new Error('Invalid response')
        if (!controller.signal.aborted) setResult(data)
      } catch {
        if (!controller.signal.aborted) setFailed(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [attempt])

  if (failed) return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    <StateMessage kind="error">소속을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
  if (!result) return renderFallback(<StateMessage kind="loading">소속 확인 중…</StateMessage>)
  if (result.memberships.length && renderMemberships) return renderMemberships(result.memberships)
  if (!result.memberships.length && renderEmpty) return renderFallback(renderEmpty())
  return renderFallback(<section aria-label="내 소속" className="flex flex-col gap-3">
    {result.memberships.length === 0 ? <h2 className="text-lg font-semibold">아직 참여한 학생회가 없어요</h2> : (
      <><h2 className="text-lg font-semibold">내 소속</h2><ul className="flex flex-col gap-1">{result.memberships.map(membership => <li key={membership.id} className="text-sm wrap-anywhere text-gray-700">
        {membership.organization.name} · {membership.department?.name ?? '미배정'}
        {membership.department?.handlesFinance && <span className="text-xs text-gray-500"> (재정 담당)</span>}
      </li>)}</ul></>
    )}
    <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>소속 다시 확인</Button>
  </section>)
}
```

`apps/web/src/access/InviteCodeForm.tsx` 전체. 와이어프레임 INV-00처럼 제목은 15.75px(`text-lg`), 코드 칸은 크고 가운데 정렬한 고정폭 글자다.

```tsx
import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'
import { inviteCodeFromText } from './invite-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { initialCode: string; onSubmit: (code: string) => void }

// 와이어프레임 INV-00. 소속이 없을 때 보이는 첫 화면이다.
export default function InviteCodeForm({ initialCode, onSubmit }: Props) {
  const [value, setValue] = useState(initialCode)
  const parsed = InviteCodeSchema.safeParse(inviteCodeFromText(value))
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onSubmit(parsed.data)
  }
  return <form aria-label="초대 코드 입력" className="flex flex-col gap-6" onSubmit={submit}>
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold">초대 코드를 입력해 주세요</h2>
      <p className="text-sm text-gray-500">학생회에서 받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있어요.</p>
    </div>
    <Label className="flex flex-col gap-2">초대 코드
      <Input value={value} onChange={event => setValue(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
        className="px-4 py-3 text-center font-mono text-xl tracking-widest" />
    </Label>
    <Button type="submit" className="mt-2" disabled={!parsed.success}>학생회 확인</Button>
  </form>
}
```

`apps/web/src/access/JoinOrganization.tsx` 전체. 불러오기와 참여 로직은 그대로다. 와이어프레임 INV-01처럼 학생회를 테두리 상자에 보여 주고, 안내는 작은 회색 글로 둔다.

```tsx
import { useEffect, useState } from 'react'
import type { InvitePreviewResponse, JoinOrganizationResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

type Props = { code: string; leaveLabel: string; onJoined: (organizationId: string) => void; onLeave: () => void }
type View = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'failed' }
  | { kind: 'ready'; organization: InvitePreviewResponse['organization'] }

// 와이어프레임 INV-01. 학생회를 확인하고 참여한다. 부서는 고르지 않고 미배정으로 등록된다.
export default function JoinOrganization({ code, leaveLabel, onJoined, onLeave }: Props) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [joinFailed, setJoinFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    async function load() {
      try {
        const response = await fetch(`/api/invites/${encodeURIComponent(code)}`,
          { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        if (response.status === 404) return setView({ kind: 'invalid' })
        if (!response.ok) throw new Error('Invite lookup failed')
        const preview = await response.json() as InvitePreviewResponse
        if (controller.signal.aborted) return
        // 이미 참여한 학생회면 묻지 않고 바로 연다.
        if (preview.joined) onJoined(preview.organization.id)
        else setView({ kind: 'ready', organization: preview.organization })
      } catch {
        if (!controller.signal.aborted) setView({ kind: 'failed' })
      }
    }
    void load()
    return () => controller.abort()
  }, [code, attempt])

  async function join() {
    setJoining(true)
    setJoinFailed(false)
    try {
      const response = await fetch('/api/organizations/join', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      if (response.status === 404) return setView({ kind: 'invalid' })
      if (!response.ok) throw new Error('Join failed')
      const { membership } = await response.json() as JoinOrganizationResponse
      onJoined(membership.organization.id)
    } catch {
      setJoinFailed(true)
    } finally {
      setJoining(false)
    }
  }

  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid') return <section aria-label="학생회 참여" className="flex flex-col gap-3">
    <StateMessage kind="error">초대 코드가 올바르지 않아요. 다시 확인해 주세요.</StateMessage>
    <Button variant="outline" onClick={onLeave}>{leaveLabel}</Button>
  </section>
  if (view.kind === 'failed') return <section aria-label="학생회 참여" className="flex flex-col gap-3">
    <StateMessage kind="error">초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>
    <Button onClick={() => setAttempt(value => value + 1)}>다시 시도</Button>
    <Button variant="ghost" size="sm" onClick={onLeave}>{leaveLabel}</Button>
  </section>
  return <section aria-label="학생회 참여" className="flex flex-col gap-4">
    <div className="rounded-lg border p-6">
      <h2 className="text-base font-semibold wrap-anywhere">{view.organization.name}에 참여할까요?</h2>
    </div>
    <p className="text-xs text-gray-400">참여하면 미배정 구성원으로 등록돼요.</p>
    {joinFailed && <StateMessage kind="error">참여하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>}
    <div className="flex flex-col gap-2">
      <Button disabled={joining} onClick={() => { void join() }}>{joining ? '참여하는 중…' : joinFailed ? '다시 시도' : '참여하기'}</Button>
      <Button variant="ghost" size="sm" disabled={joining} onClick={onLeave}>참여하지 않기</Button>
    </div>
  </section>
}
```

- [ ] **Step 4: 회귀 검사**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/App.test.tsx src/App.integration.test.tsx src/access`
Expected: PASS(Step 1과 같은 결과)

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add -A apps/web/src/App.tsx apps/web/src/App.css apps/web/src/access
git commit -m "로그인·가입 화면을 가운데 카드로 바꾸기"
```

---

### Task 6: 채팅

**Files:**
- Modify: `apps/web/src/chat/Chat.tsx`
- Delete: `apps/web/src/chat/Chat.css`
- Test: `apps/web/src/chat/Chat.test.tsx`, `apps/web/src/workspace/Workspace.test.tsx`(바꾸지 않고 회귀 검사)

**Interfaces:**
- Consumes: Task 2의 `Avatar`, `Button`, `Label`, `Textarea`
- Produces: 없음. 라벨 "메시지"는 화면에서 숨기되(`sr-only`) 접근성 이름으로 남는다.

- [ ] **Step 1: 회귀 검사 기준 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/chat src/workspace/Workspace.test.tsx`
Expected: PASS

- [ ] **Step 2: 채팅 화면**

Run: `git rm -q apps/web/src/chat/Chat.css`

`apps/web/src/chat/Chat.tsx` 전체:

```tsx
import { useId } from 'react'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX, codePoints } from '@vada/contracts'
import { useChat } from './useChat'
import StateMessage from '@/components/StateMessage'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = { organizationId: string; eventId: string; eventName: string }
export default function Chat(props: Props) {
  return <ChatPanel key={JSON.stringify([props.organizationId, props.eventId])} {...props} />
}

// 와이어프레임에 말풍선 디자인이 없어 같은 디자인 언어(아바타, 이름 600, 시간 회색 작은 글)로 목록형 메시지를 그린다.
function ChatPanel({ organizationId, eventId, eventName }: Props) {
  const chat = useChat(organizationId, eventId)
  const inputId = useId()
  const length = codePoints(chat.draft.trim())
  return <section className="flex min-h-0 flex-1 flex-col" aria-label={`${eventName} 대화방`}>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" tabIndex={0} role="region" aria-label="대화 기록">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold">함께 준비하는 공간</h2>
          <p className="text-xs text-gray-400">대화는 약 3초마다 갱신돼요.</p>
        </div>
        {chat.nextCursor && <Button variant="outline" size="sm" className="self-center" disabled={chat.busy || chat.denied} onClick={chat.older}>이전 메시지</Button>}
        {chat.loading ? <StateMessage kind="loading">대화 불러오는 중…</StateMessage> : (
          chat.messages.length ? <ol className="flex flex-col" aria-label="대화 내용">{chat.messages.map(message => <li key={message.id} className="flex gap-2 border-b border-gray-100 py-3 last:border-b-0">
            <Avatar />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <strong className="min-w-0 text-sm font-semibold wrap-anywhere text-gray-900">{message.author.name}</strong>
                <time className="text-xs text-gray-400" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString('ko-KR')}</time>
              </div>
              <p className="mt-0.5 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700">{message.content}</p>
            </div>
          </li>)}</ol> : !chat.loadError && <StateMessage kind="empty">아직 대화가 없어요.</StateMessage>
        )}
        {chat.loadError && <StateMessage kind="error">{chat.loadError}</StateMessage>}
        <Button variant="ghost" size="sm" className="self-start" disabled={chat.busy} onClick={chat.refresh}>대화 다시 불러오기</Button>
      </div>
    </div>
    <form className="shrink-0 border-t px-4 py-3 sm:px-6" aria-label="메시지 보내기" onSubmit={event => { event.preventDefault(); chat.send() }}>
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <Label htmlFor={inputId} className="sr-only">메시지</Label>
        <Textarea id={inputId} rows={3} className="max-h-40" placeholder="행사 준비 이야기를 나눠 주세요" value={chat.draft} disabled={chat.denied} onChange={event => chat.setDraft(event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">{length} / {MESSAGE_CONTENT_MAX.toLocaleString('ko-KR')}자 · 줄바꿈은 Enter, 전송은 버튼을 눌러 주세요.</p>
          <Button type="submit" disabled={chat.busy || chat.loading || chat.denied || Boolean(chat.loadError) || !CreateMessageSchema.safeParse({ content: chat.draft }).success}>전송</Button>
        </div>
        {chat.sendError && <StateMessage kind="error">{chat.sendError}</StateMessage>}
      </div>
    </form>
  </section>
}
```

- [ ] **Step 3: 회귀 검사**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/chat src/workspace/Workspace.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add -A apps/web/src/chat
git commit -m "채팅 화면을 새 부품으로 바꾸기"
```

---

### Task 7: 구매 화면 부품 교체

**Files:**
- Modify: `apps/web/src/purchases/{Purchases,PurchaseList,PurchaseDetail,DraftForm,FinanceReview,LinkDialog}.tsx`, `apps/web/src/purchases/purchase-status.ts`
- Delete: `apps/web/src/purchases/Purchases.css`
- Test: `apps/web/src/purchases/*.test.tsx`, `apps/web/src/workspace/*.test.tsx`(바꾸지 않고 회귀 검사)

**Interfaces:**
- Consumes: Task 2의 `Badge`, `Tone`, `Button`, `cardClass`, `Input`, `Label`, `NativeSelect`, `Textarea`, `cn`
- Produces: `purchaseStatusTones: Record<PurchaseStatus, Tone>`

- [ ] **Step 1: 회귀 검사 기준 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/purchases src/workspace`
Expected: PASS

- [ ] **Step 2: 상태 칩 색**

`apps/web/src/purchases/purchase-status.ts` 전체:

```ts
import type { PurchaseStatus } from '@vada/contracts'
import type { Tone } from '@/components/ui/badge'

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  draft: '검토 대기', discarded: '폐기', submitted: '접수', approved: '승인', rejected: '반려',
}
// 접수는 정보, 승인은 성공, 반려는 위험, 작성 중·폐기는 중립 색이다.
export const purchaseStatusTones: Record<PurchaseStatus, Tone> = {
  draft: 'neutral', discarded: 'neutral', submitted: 'info', approved: 'success', rejected: 'danger',
}
```

- [ ] **Step 3: 목록과 패널**

Run: `git rm -q apps/web/src/purchases/Purchases.css`

`apps/web/src/purchases/Purchases.tsx`는 두 군데만 바꾼다. 로직은 그대로다.

1. import에서 `import './Purchases.css'`를 지우고, `import StateMessage from '@/components/StateMessage'` 아래에 `import { Button } from '@/components/ui/button'`를 더한다.
2. `return`의 앞부분을 바꾼다. 바꾸기 전:

```tsx
  return <section className="purchases-panel" aria-label="구매요청서">
    <div className="purchase-toolbar">
      <h2>{finance ? '재정부 · 제출 요청 조회' : '내 구매요청'}</h2>
      <div className="purchase-actions">
        {!finance && <button disabled={data.busy || data.denied} onClick={() => setLocalDialog(true)}>끼룩이 · 초안 만들기</button>}
        <button className="button-quiet" disabled={data.busy || data.denied} onClick={data.refresh}>요청 목록 새로고침</button>
      </div>
    </div>
```

바꾼 뒤:

```tsx
  return <section className="flex flex-col gap-4" aria-label="구매요청서">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">{finance ? '재정부 · 제출 요청 조회' : '내 구매요청'}</h2>
      <div className="flex flex-wrap gap-2">
        {!finance && <Button disabled={data.busy || data.denied} onClick={() => setLocalDialog(true)}>끼룩이 · 초안 만들기</Button>}
        <Button variant="outline" disabled={data.busy || data.denied} onClick={data.refresh}>요청 목록 새로고침</Button>
      </div>
    </div>
```

`{data.error && …}`부터 끝까지는 그대로 둔다.

`apps/web/src/purchases/PurchaseList.tsx` 전체:

```tsx
import { useState } from 'react'
import type { PurchaseStatus, PurchaseSummary } from '@vada/contracts'
import { purchaseStatusLabels, purchaseStatusTones } from './purchase-status'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

type Props = { rows: PurchaseSummary[]; finance: boolean; loading: boolean; error: string; disabled: boolean; onSelect: (id: string) => void; hasMore: boolean; onOlder: () => void }
export default function PurchaseList({ rows, finance, loading, error, disabled, onSelect, hasMore, onOlder }: Props) {
  const [status, setStatus] = useState<PurchaseStatus | 'all'>('all')
  const visible = rows.filter(row => status === 'all' || row.status === status)
  const statuses = (Object.keys(purchaseStatusLabels) as PurchaseStatus[]).filter(value => !finance || !['draft', 'discarded'].includes(value))
  return <section className={cn(cardClass, 'flex flex-col gap-3 p-4')} tabIndex={-1} aria-label={finance ? '제출된 요청서' : '내 요청서'} aria-busy={loading}>
    <h3 className="text-sm font-semibold">{finance ? '제출된 요청서' : '내 요청서'}</h3>
    <Label className="flex max-w-xs flex-col gap-1.5">상태 필터<NativeSelect value={status} onChange={event => setStatus(event.target.value as PurchaseStatus | 'all')}>
      <option value="all">전체 상태</option>{statuses.map(value => <option key={value} value={value}>{purchaseStatusLabels[value]}</option>)}
    </NativeSelect></Label>
    {hasMore && <p className="text-xs text-gray-500">불러온 요청서에만 필터가 적용돼요. 이전 요청서를 더 불러올 수 있어요.</p>}
    {loading ? <StateMessage kind="loading">요청서 불러오는 중…</StateMessage> : !rows.length && !error && <StateMessage kind="empty">{finance ? '제출된 요청서가 없어요.' : '아직 내 요청서가 없어요.'}</StateMessage>}
    {!loading && !error && rows.length > 0 && !visible.length && <StateMessage kind="notice">불러온 요청서 중 해당 상태가 없어요.</StateMessage>}
    <ul className="flex flex-col gap-2">{visible.map(row => <li key={row.id}>
      <Button variant="outline" className="w-full flex-wrap justify-start gap-3 p-4 text-left whitespace-normal" data-purchase-id={row.id} disabled={disabled} onClick={() => onSelect(row.id)}>
        <strong className="min-w-0 flex-1 wrap-anywhere">{row.purpose || '구매 목적 확인 필요'}</strong>{' '}
        <Badge tone={purchaseStatusTones[row.status]}>{purchaseStatusLabels[row.status]}</Badge>{' '}
        <time className="text-xs font-normal text-gray-400" dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString('ko-KR')}</time>
      </Button>
    </li>)}</ul>
    {hasMore && <Button variant="outline" className="self-start" disabled={disabled} onClick={onOlder}>이전 요청서</Button>}
  </section>
}
```

- [ ] **Step 4: 상세, 초안, 검토, 링크 대화상자**

`apps/web/src/purchases/PurchaseDetail.tsx` 전체. 넓은 화면(`lg`, 1024px 이상)에서 2:1 두 칸이고, 그보다 좁으면 한 칸이다(지금 CSS와 같다).

```tsx
import { useEffect, useRef } from 'react'
import type { PurchaseDetail as PurchaseRequest, UpdatePurchaseDraftRequest } from '@vada/contracts'
import DraftForm from './DraftForm'
import FinanceReview from './FinanceReview'
import DeliveryPanel from '../deliveries/DeliveryPanel'
import { analyzeDraft, createDraftValues } from './draft-form-model'
import { purchaseStatusLabels } from './purchase-status'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = {
  request: PurchaseRequest; busy: boolean; stale: boolean; dirty: boolean; finance: boolean
  onDirty: (value: boolean) => void; onSave: (input: UpdatePurchaseDraftRequest) => void
  onDiscard: () => void; onReload: () => void; onSubmit: () => void
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void
  onBack: () => void; onReturnToChat?: () => void
}
export default function PurchaseDetail({ onBack, onReturnToChat, ...props }: Props) {
  const { request, busy } = props
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const element = heading.current
    if (element && !element.closest('[hidden]')) element.focus()
  }, [request.id])
  return <article className="flex flex-col gap-4">
    <nav className="flex flex-wrap gap-2" aria-label="요청서 이동">
      <Button variant="ghost" size="sm" disabled={busy} onClick={onBack}>요청 목록으로</Button>
      {onReturnToChat && <Button variant="ghost" size="sm" disabled={busy} onClick={onReturnToChat}>대화로 돌아가기</Button>}
    </nav>
    <header className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
      <p className="text-xs text-gray-500">구매요청 · v{request.version}</p>
      <h2 ref={heading} tabIndex={-1} className="text-xl font-bold outline-none">구매요청서 · {purchaseStatusLabels[request.status]}</h2>
      <p className="text-sm wrap-anywhere text-gray-700">{request.purpose || '구매 목적 확인 필요'}</p>
      <p className="text-xs text-gray-500">생성 {new Date(request.createdAt).toLocaleString('ko-KR')}</p>
    </header>
    {request.status === 'rejected' && <section className={cn(cardClass, 'flex flex-col gap-1 p-4')} aria-label="반려 결과"><h3 className="text-sm font-semibold">반려 사유</h3><p className="text-sm wrap-anywhere whitespace-pre-wrap">{[...request.history].reverse().find(entry => entry.action === 'rejected')?.reason ?? '사유를 확인할 수 없어요.'}</p></section>}
    {request.warnings.length > 0 && <details className={cn(cardClass, 'p-4')}><summary className="cursor-pointer text-sm font-medium">초안 생성 시 확인 사항</summary><ul className="mt-2 list-disc pl-5 text-sm wrap-anywhere">{request.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>}
    {request.status === 'approved' && <DeliveryPanel request={request} finance={props.finance} />}
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className={cn(cardClass, 'flex min-w-0 flex-col gap-3 p-4 lg:col-span-2')}>
        <DraftForm request={request} busy={busy} stale={props.stale} dirty={props.dirty} readOnly={props.finance}
          onDirty={props.onDirty} onSave={props.onSave} onDiscard={props.onDiscard} onSubmit={props.onSubmit} />
        <Button variant="outline" className="self-start" disabled={busy} onClick={props.onReload}>요청서 다시 불러오기</Button>
        {props.finance && request.status === 'submitted' && <FinanceReview busy={busy} stale={props.stale}
          amountUnknown={analyzeDraft(createDraftValues(request)).total === null} onDirty={props.onDirty} onDecide={props.onDecide} />}
      </div>
      <aside className="flex min-w-0 flex-col gap-4" aria-label="요청서 근거와 이력">
        <details className={cn(cardClass, 'p-4')} open><summary className="cursor-pointer text-sm font-medium">근거 대화 ({request.sources.length})</summary>
          {request.sources.length ? request.sources.map(source => <blockquote key={source.id} className="mt-2 border-l-4 border-gray-200 pl-3 text-sm wrap-anywhere whitespace-pre-wrap text-gray-700">{source.content}</blockquote>) : <p className="mt-2 text-sm text-gray-500">연결된 근거 대화가 없어요.</p>}
        </details>
        <details className={cn(cardClass, 'p-4')} open><summary className="cursor-pointer text-sm font-medium">처리 이력 ({request.history.length})</summary><ul className="mt-2 flex flex-col gap-1 text-xs text-gray-600">{request.history.map(entry => <li key={entry.id}>
          v{entry.version} · {({ created: '생성', updated: '수정', discarded: '폐기', submitted: '제출', approved: '승인', rejected: '반려' } as Record<string, string>)[entry.action] ?? entry.action} · {new Date(entry.createdAt).toLocaleString('ko-KR')}
        </li>)}</ul></details>
      </aside>
    </div>
  </article>
}
```

`apps/web/src/purchases/DraftForm.tsx` 전체. 바깥 `fieldset`(제출 뒤 잠금)과 물품별 `fieldset`은 그대로 둔다. 테스트가 `closest('fieldset').disabled`로 잠금을 확인한다.

```tsx
import { useId, useState } from 'react'
import type { PurchaseDetail, UpdatePurchaseDraftRequest } from '@vada/contracts'
import { createDraftValues, analyzeDraft, serializeDraft } from './draft-form-model'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

export type DraftFormProps = {
  request: PurchaseDetail; busy: boolean; stale: boolean; dirty: boolean; readOnly: boolean
  onDirty: (value: boolean) => void
  onSave: (input: UpdatePurchaseDraftRequest) => void
  onDiscard: () => void; onSubmit: () => void
}
export default function DraftForm({ request, busy, stale, dirty, readOnly, onDirty, onSave, onDiscard, onSubmit }: DraftFormProps) {
  const [purpose, setPurpose] = useState(request.purpose ?? '')
  const [neededBy, setNeededBy] = useState(request.neededBy ?? '')
  const [shipping, setShipping] = useState(request.estimatedShippingCost?.toString() ?? '')
  const [items, setItems] = useState(() => createDraftValues(request).items)
  const prefix = useId()
  const readonly = readOnly || request.status !== 'draft'
  const values = { purpose, neededBy, shipping, items }
  const { invalid, missing, total } = analyzeDraft(values)
  function changeItem(index: number, key: string, value: string | boolean | null) {
    setItems(previous => previous.map((item, i) => i === index ? { ...item, [key]: value } : item)); onDirty(true)
  }
  return <section className="flex min-w-0 flex-col gap-3" aria-label="초안 상세">
    <form aria-label="초안 수정" className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault()
      if (busy || readonly || stale || invalid) return
      onSave(serializeDraft(values, request.version))
    }}>
      <fieldset disabled={busy || readonly} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-purpose`}>구매 목적</Label>
          <Textarea id={`${prefix}-purpose`} value={purpose} onChange={event => { setPurpose(event.target.value); onDirty(true) }} placeholder="확인 필요" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-date`}>필요한 날짜</Label>
          <Input id={`${prefix}-date`} type="date" value={neededBy} onChange={event => { setNeededBy(event.target.value); onDirty(true) }} />
        </div>
        {items.map((item, index) => <fieldset key={item.id} className="grid min-w-0 gap-3 rounded-md border p-4 md:grid-cols-2"><legend className="px-1 text-xs font-semibold text-gray-700">물품 {index + 1}</legend>
          <a className="text-sm md:col-span-2" href={item.productUrl} target="_blank" rel="noopener noreferrer">상품 링크 열기</a>
          {(['productName', 'selectedOption', 'packagingUnit', 'quantity', 'estimatedUnitPrice'] as const).map((key, field) => <Label key={key} className="flex flex-col gap-1.5">
            {['상품명', '선택 옵션', '포장 단위', '주문 수량', '예상 단가 (원)'][field]}
            <Input value={item[key]} type={field >= 3 ? 'number' : 'text'} min={key === 'quantity' ? 1 : 0} step={1} max={field >= 3 ? 2147483647 : undefined}
              placeholder="확인 필요" onChange={event => changeItem(index, key, event.target.value)} />
          </Label>)}
          <Label className="flex flex-col gap-1.5">옵션 선택 필요 여부<NativeSelect value={item.optionRequired === null ? 'unknown' : item.optionRequired ? 'yes' : 'no'}
            onChange={event => changeItem(index, 'optionRequired', event.target.value === 'unknown' ? null : event.target.value === 'yes')}>
            <option value="unknown">확인 필요</option><option value="yes">옵션 선택 필요</option><option value="no">옵션 없음</option>
          </NativeSelect></Label>
          {!item.selectedOption && item.optionRequired !== false && <p className="text-xs text-gray-500 md:col-span-2">선택 옵션을 상품 링크에서 확인해 주세요.</p>}
          <p className="text-xs text-gray-500 md:col-span-2">포장 단위와 주문 수량은 달라요. 40개입 2묶음이면 주문 수량은 2예요.</p>
        </fieldset>)}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${prefix}-shipping`}>예상 배송비 (원)</Label>
          <Input id={`${prefix}-shipping`} type="number" min={0} step={1} max={2147483647} value={shipping} placeholder="확인 필요" onChange={event => { setShipping(event.target.value); onDirty(true) }} />
        </div>
      </fieldset>
      <p className="text-sm font-medium">예상 합계: {total === null ? '확인 필요' : `${total.toLocaleString('ko-KR')}원`}</p>
      <p className="text-xs text-gray-500">비어 있는 값은 미확인으로 저장해요. 예상 금액은 실제 결제 금액이 아니에요.</p>
      {!readonly && <div className="flex flex-wrap gap-2"><Button disabled={busy || stale || invalid}>초안 저장</Button><Button type="button" variant="destructive" disabled={busy || stale} onClick={onDiscard}>초안 폐기</Button></div>}
    </form>
    {!readonly && <>
      {missing.length > 0 && <p className="text-sm text-gray-700">제출 전 확인: {missing.join(', ')}</p>}
      {dirty && <p className="text-sm text-gray-700">수정한 내용을 먼저 저장해 주세요.</p>}
      <p className="text-xs text-gray-500">금액이 미확인이어도 제출할 수 있어요. 제출 후에는 수정·폐기가 불가능해요.</p>
      <Button className="self-start" disabled={busy || stale || dirty || invalid || missing.length > 0} onClick={onSubmit}>요청서 제출</Button>
    </>}
  </section>
}
```

`apps/web/src/purchases/FinanceReview.tsx` 전체:

```tsx
import { useId, useState } from 'react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  busy: boolean; stale: boolean; amountUnknown: boolean
  onDirty: (value: boolean) => void
  onDecide: (decision: 'approved' | 'rejected', reason: string) => void
}

export default function FinanceReview({ busy, stale, amountUnknown, onDirty, onDecide }: Props) {
  const [reason, setReason] = useState('')
  const reasonId = useId()
  return <section className="flex flex-col gap-2 border-t pt-4" aria-label="재정부 처리">
    <h3 className="text-sm font-semibold">요청서 검토</h3>
    <p className="text-xs text-gray-500">요청서 전체를 승인하거나 반려해요. 처리 후에는 변경할 수 없어요.</p>
    {amountUnknown && <p className="text-xs text-gray-500">금액이 미확인입니다. 승인 전 상품 가격과 배송비를 별도로 확인해 주세요.</p>}
    {stale && <StateMessage kind="notice">최신 요청서를 다시 불러온 뒤 검토해 주세요.</StateMessage>}
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={reasonId}>반려 사유</Label>
      <Textarea id={reasonId} value={reason} disabled={busy || stale} maxLength={2000}
        onChange={event => { setReason(event.target.value); onDirty(true) }} placeholder="반려할 경우 사유를 입력해 주세요." />
    </div>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy || stale} onClick={() => {
        if (window.confirm(`${amountUnknown ? '금액이 미확인입니다. 별도로 확인했나요?\n' : ''}이 요청을 승인할까요? 처리 후에는 변경할 수 없어요.`)) onDecide('approved', '')
      }}>요청 승인</Button>
      <Button variant="destructive" disabled={busy || stale || !reason.trim() || [...reason].length > 2000} onClick={() => {
        if (window.confirm('입력한 사유로 반려할까요? 처리 후에는 변경할 수 없어요.')) onDecide('rejected', reason)
      }}>요청 반려</Button>
    </div>
  </section>
}
```

`apps/web/src/purchases/LinkDialog.tsx` 전체. 브라우저 `<dialog>` 동작은 그대로다. preflight가 dialog의 바깥 여백을 0으로 지우므로 `m-auto`로 다시 가운데에 둔다.

```tsx
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean; links: string; busy: boolean; disabled: boolean; error: string
  onLinksChange: (value: string) => void; onClose: () => void; onCreate: (links: string[]) => void
}
// 브라우저 <dialog>를 그대로 쓰고 모양만 Radix 대화상자와 맞춘다. 좌우 1rem을 띄워 좁은 화면에서도 화면 안에 들어온다.
export default function LinkDialog({ open, links, busy, disabled, error, onLinksChange, onClose, onCreate }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const prefix = useId()
  const urls = links.split(/\r?\n/).map(value => value.trim()).filter(Boolean)
  useEffect(() => {
    if (!open) return
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    element.showModal()
    input.current?.focus()
    return () => { element.close(); if (opener?.isConnected) opener.focus() }
  }, [open])
  return createPortal(<dialog ref={dialog} className="inset-x-4 m-auto w-auto max-w-lg rounded-lg border bg-white p-6 text-foreground shadow-2xl backdrop:bg-black/45" aria-labelledby={prefix}
    aria-describedby={`${prefix}-description`} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="flex items-center justify-between gap-3">
      <h2 id={prefix} className="text-base font-semibold">끼룩이 · 구매요청서 초안</h2>
      <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>닫기</Button>
    </div>
    <p id={`${prefix}-description`} className="mt-2 text-sm text-gray-500">상품 링크와 현재 행사방의 최근 대화를 외부 AI로 처리해요. 생성된 초안을 확인·수정한 후 제출해 주세요.</p>
    <form aria-label="구매 초안 생성" className="mt-6 flex flex-col gap-1.5" onSubmit={event => {
      event.preventDefault()
      if (!busy && !disabled && urls.length > 0 && urls.length <= 5) onCreate(urls)
    }}>
      <Label htmlFor={`${prefix}-links`}>쿠팡 상품 링크</Label>
      <Textarea ref={input} id={`${prefix}-links`} value={links} rows={5} disabled={busy || disabled}
        onChange={event => onLinksChange(event.target.value)} placeholder="주소창의 상품 링크를 한 줄에 하나씩, 최대 5개" />
      {urls.length > 5 && <StateMessage kind="error">상품 링크는 최대 5개까지 입력해 주세요.</StateMessage>}
      {error && <StateMessage kind="error">{error}</StateMessage>}
      {busy && <StateMessage kind="loading">초안 생성 중… 최대 약 75초 걸릴 수 있어요. 완료될 때까지 기다려 주세요.</StateMessage>}
      <Button className="mt-4 self-end" disabled={busy || disabled || !urls.length || urls.length > 5}>초안 만들기</Button>
    </form>
  </dialog>, document.body)
}
```

- [ ] **Step 5: 회귀 검사**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/purchases src/workspace`
Expected: PASS(Step 1과 같은 결과)

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add -A apps/web/src/purchases
git commit -m "구매 화면의 버튼·입력칸·칩을 새 부품으로 교체"
```

---

### Task 8: 배송 화면 부품 교체

**Files:**
- Modify: `apps/web/src/deliveries/DeliveryPanel.tsx`, `apps/web/src/deliveries/ShipmentForm.tsx`, `apps/web/src/deliveries/delivery-status.ts`
- Delete: `apps/web/src/deliveries/Deliveries.css`
- Test: `apps/web/src/deliveries/DeliveryPanel.test.tsx`, `apps/web/src/purchases/PurchaseDetail.test.tsx`(바꾸지 않고 회귀 검사)

**Interfaces:**
- Consumes: Task 2의 `Badge`, `Tone`, `Button`, `cardClass`, `Input`, `Label`, `NativeSelect`, `cn`
- Produces: `deliveryStatusTones: Record<DeliveryStatus, Tone>`

- [ ] **Step 1: 회귀 검사 기준 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/deliveries src/purchases/PurchaseDetail.test.tsx`
Expected: PASS

- [ ] **Step 2: 상태 칩 색**

`apps/web/src/deliveries/delivery-status.ts`에서 첫 줄 `import type { DeliveryStatus } from '@vada/contracts'` 아래에 `import type { Tone } from '@/components/ui/badge'`를 더하고, `deliveryStatusLabels` 바로 아래에 더한다.

```ts
// 배송 중은 정보, 배송 완료는 성공, 배송 문제는 위험, 예정·확인 불가는 중립 색이다.
export const deliveryStatusTones: Record<DeliveryStatus, Tone> = {
  unknown: 'neutral', pending: 'neutral', in_transit: 'info', delivered: 'success', exception: 'danger',
}
```

- [ ] **Step 3: 배송 패널과 송장 등록**

Run: `git rm -q apps/web/src/deliveries/Deliveries.css`

`apps/web/src/deliveries/DeliveryPanel.tsx` 전체:

```tsx
import { useState } from 'react'
import type { PurchaseDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import ShipmentForm from './ShipmentForm'
import { carrierName, deliveryStatusLabels, deliveryStatusTones } from './delivery-status'
import { useDeliveries } from './useDeliveries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Props = { request: PurchaseDetail; finance: boolean }

// 승인된 요청서의 품목별 배송 상태. 배송 수량 배분이 없으므로 요청서 전체 완료 여부는 판정하지 않는다.
export default function DeliveryPanel({ request, finance }: Props) {
  const data = useDeliveries(request.organizationId, request.eventId, request.id, finance)
  // 등록에 성공하면 입력 폼을 새로 만들어 기본 선택(송장 없는 품목)을 다시 계산한다.
  const [formRevision, setFormRevision] = useState(0)
  if (!data.available || data.items === null) return null
  const shipmentsOf = (id: string) => data.items?.find(item => item.id === id)?.shipments ?? []
  const rows = [...request.items].sort((a, b) => a.position - b.position)
  const time = (value: string) => new Date(value).toLocaleString('ko-KR')
  return <section className={cn(cardClass, 'flex flex-col gap-3 p-4')} aria-label="구매·발주 처리">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">구매·발주 처리</h3>
      <Button variant="ghost" size="sm" disabled={data.busy} onClick={data.refresh}>배송 상태 새로고침</Button>
    </div>
    {data.error && <StateMessage kind="error">{data.error}</StateMessage>}
    {data.notice && <StateMessage kind="notice">{data.notice}</StateMessage>}
    <table className="w-full border-collapse text-sm wrap-anywhere">
      <thead><tr className="border-b text-left text-xs text-gray-500">
        <th scope="col" className="px-3 py-2 font-normal">품목</th><th scope="col" className="px-3 py-2 font-normal">수량</th><th scope="col" className="px-3 py-2 font-normal">배송 상태</th>
      </tr></thead>
      <tbody>{rows.map(item => {
        const shipments = shipmentsOf(item.id)
        return <tr key={item.id} className="border-b border-gray-100 align-top">
          <th scope="row" className="px-3 py-2 text-left font-medium">{item.productName || '상품명 확인 필요'}</th>
          <td className="px-3 py-2">{item.quantity ?? '—'}</td>
          <td className="px-3 py-2">{shipments.length === 0 ? '—' : <ul className="flex flex-col gap-2">{shipments.map(shipment => <li key={shipment.linkId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge tone={deliveryStatusTones[shipment.status] ?? 'neutral'}>{deliveryStatusLabels[shipment.status] ?? deliveryStatusLabels.unknown}</Badge>
            <span>{carrierName(shipment.carrierId, data.carriers)} · {shipment.trackingNumber}</span>
            {shipment.lastCheckedAt && <span className="text-xs text-gray-500">확인 {time(shipment.lastCheckedAt)}</span>}
            {shipment.refreshFailed && <span className="text-xs text-destructive">최근 확인 실패</span>}
            {finance && <Button variant="ghost" size="sm" disabled={data.busy} onClick={() => {
              if (window.confirm('이 송장 연결을 해제할까요? 해제한 뒤 올바른 송장을 다시 등록할 수 있어요.')) data.unlink(shipment.id, shipment.linkId)
            }}>연결 해제</Button>}
          </li>)}</ul>}</td>
        </tr>
      })}</tbody>
    </table>
    <p className="text-xs text-gray-500">배송 상태는 택배사 기록을 기준으로 자동 갱신돼요. 품목 수량이 모두 도착했는지는 직접 확인해 주세요.</p>
    {finance && <ShipmentForm key={formRevision} busy={data.busy} carriers={data.carriers} onSearchCarriers={data.searchCarriers}
      items={rows.map(item => ({ id: item.id, name: item.productName || '상품명 확인 필요', shipped: shipmentsOf(item.id).length > 0 }))}
      onLookup={data.lookup} onRegister={async (input, itemIds) => {
        const done = await data.register(input, itemIds)
        if (done) setFormRevision(value => value + 1)
        return done
      }} />}
  </section>
}
```

`apps/web/src/deliveries/ShipmentForm.tsx` 전체. 상태와 함수는 그대로다.

```tsx
import { useId, useState, type FormEvent } from 'react'
import type { DeliveryLookupRequest, DeliveryLookupResponse } from '@vada/contracts'
import { deliveryStatusLabels, validTrackingNumber } from './delivery-status'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'

type Props = {
  items: { id: string; name: string; shipped: boolean }[]
  carriers: { id: string; name: string }[]
  busy: boolean
  onSearchCarriers: (search: string) => void
  onLookup: (input: DeliveryLookupRequest) => Promise<DeliveryLookupResponse | null>
  onRegister: (input: DeliveryLookupRequest, itemIds: string[]) => Promise<boolean>
}

// 택배사를 추정하지 않는다. 조회 결과를 확인한 입력만 등록할 수 있다.
export default function ShipmentForm({ items, carriers, busy, onSearchCarriers, onLookup, onRegister }: Props) {
  const [search, setSearch] = useState('')
  const [carrierId, setCarrierId] = useState('')
  const [number, setNumber] = useState('')
  const [selected, setSelected] = useState(() => items.filter(item => !item.shipped).map(item => item.id))
  const [result, setResult] = useState<DeliveryLookupResponse | null>(null)
  const searchId = useId(), carrierFieldId = useId(), numberId = useId()
  const trackingNumber = number.trim()
  const chosen = carriers.some(carrier => carrier.id === carrierId) ? carrierId : ''
  const ready = Boolean(chosen) && validTrackingNumber(trackingNumber) && selected.length > 0
  const input = { carrierId: chosen, trackingNumber }

  async function lookup(event: FormEvent) {
    event.preventDefault()
    if (ready && !busy) setResult(await onLookup(input))
  }
  return <form className="flex flex-col gap-3 border-t pt-4" aria-label="송장 등록" onSubmit={event => { void lookup(event) }}>
    <h4 className="text-sm font-semibold">송장 등록</h4>
    <p className="text-xs text-gray-500">택배사를 직접 고르고 송장번호를 입력해 주세요. 조회 결과를 확인한 뒤 등록할 수 있어요.</p>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={searchId}>택배사 이름 검색</Label>
      <div className="flex flex-col gap-2 md:flex-row">
        <Input id={searchId} value={search} maxLength={100} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder="목록에 없으면 이름으로 검색해 주세요." />
        <Button type="button" variant="outline" className="shrink-0" disabled={busy} onClick={() => onSearchCarriers(search.trim())}>택배사 검색</Button>
      </div>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={carrierFieldId}>택배사</Label>
      <NativeSelect id={carrierFieldId} value={chosen} disabled={busy} onChange={event => { setCarrierId(event.target.value); setResult(null) }}>
        <option value="">택배사를 선택해 주세요</option>
        {carriers.map(carrier => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
      </NativeSelect>
    </div>
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={numberId}>송장번호</Label>
      <Input id={numberId} value={number} maxLength={110} disabled={busy} inputMode="text" autoComplete="off"
        onChange={event => { setNumber(event.target.value); setResult(null) }} />
    </div>
    {trackingNumber && !validTrackingNumber(trackingNumber) && <p className="text-xs text-gray-500">송장번호는 영문·숫자·하이픈만 입력할 수 있어요.</p>}
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-xs font-medium text-gray-700">이 송장으로 받는 품목</legend>
      {items.map(item => <label key={item.id} className="flex items-center gap-2 text-sm wrap-anywhere">
        <input type="checkbox" className="size-4 shrink-0 accent-blue-600" checked={selected.includes(item.id)} disabled={busy} onChange={event => {
          setSelected(previous => event.target.checked ? [...previous, item.id] : previous.filter(id => id !== item.id)); setResult(null)
        }} />{item.name}
      </label>)}
    </fieldset>
    {result && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-700" aria-live="polite">
      조회 결과: {deliveryStatusLabels[result.status] ?? deliveryStatusLabels.unknown}
      {result.lastEventAt ? ` · 마지막 배송 기록 ${new Date(result.lastEventAt).toLocaleString('ko-KR')}` : ' · 배송 기록 없음'}
      <br />선택한 품목의 송장이 맞는지 확인한 뒤 등록해 주세요.
    </p>}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant="outline" disabled={busy || !ready}>송장 조회</Button>
      <Button type="button" disabled={busy || !ready || !result} onClick={() => {
        // 품목 순서와 무관하게 같은 등록 의도는 같은 입력이 되도록 정렬한다.
        void onRegister(input, [...selected].sort())
      }}>이 송장으로 등록</Button>
    </div>
  </form>
}
```

- [ ] **Step 4: 회귀 검사**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/deliveries src/purchases/PurchaseDetail.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add -A apps/web/src/deliveries
git commit -m "배송 화면의 버튼·입력칸·칩을 새 부품으로 교체"
```

---

### Task 9: 정리, 화면 규칙, 웹 전체 검사

**Files:**
- Modify: `AGENTS.md`
- Test: 웹 전체 스위트, 타입 검사, 빌드

- [ ] **Step 1: 옛 CSS와 옛 클래스가 남지 않았는지 확인**

Run: `find apps/web/src -name "*.css" ! -name index.css`
Expected: 출력 없음

Run: `grep -rnE 'className="[^"]*\b(hint|eyebrow|badge|button-quiet|button-secondary|danger|email|auth-card|app-notice|membership-list|event-list|create-event|workspace-[a-z]+|sidebar-[a-z]+|chat-[a-z]+|message-list|composer-actions|purchase-[a-z]+|purchases-panel|finance-review|draft-editor|link-dialog|ai-launcher|delivery-[a-z]+|shipment-[a-z]+)\b' apps/web/src --include=*.tsx`
Expected: 출력 없음. 남은 곳이 있으면 같은 Task의 방식대로 부품과 Tailwind 클래스로 바꾼다.

Run: `grep -rnE '\b[a-z-]+-\[(#|[0-9.]+px)' apps/web/src --include=*.tsx`
Expected: 출력 없음. 임의 색이나 px 값이 없어야 한다.

Run: `grep -rn 'break-words' apps/web/src --include=*.tsx`
Expected: 출력 없음(긴 글은 `wrap-anywhere`)

- [ ] **Step 2: AGENTS.md "화면" 절**

`## 마이그레이션` 앞에 더한다.

```markdown
## 화면
- 버튼·입력칸·선택칸·여러 줄 입력·라벨·칩·카드·배너·대화상자·옆 메뉴·메뉴 항목·탭은 `apps/web/src/components/ui`의 부품을 쓴다. 날것의 `<button>`·`<input>`에 직접 모양을 주지 않는다. 체크박스만 브라우저 기본 모양에 `size-4 accent-blue-600`을 준다.
- 여러 기능이 같이 쓰는 표시용 부품은 `src/components`에 둔다(API 호출 금지). 기능 화면과 데이터 훅은 기능 폴더에 둔다.
- 모양은 Tailwind 클래스로만 준다. 새 CSS 파일을 만들지 않는다. 토큰과 전역 기본값은 `src/index.css` 하나에 둔다.
- 색은 테마 토큰(`primary`, `muted-foreground` 등)이나 Tailwind 기본 팔레트 단계만 쓴다. 크기와 간격은 Tailwind 스케일(`p-6`, `max-w-148`처럼 0.25rem 배수)만 쓴다. `bg-[#…]`, `text-[13px]`, `p-[7px]` 같은 임의 값은 쓰지 않는다.
- 기준 글자 크기가 14px(휴대폰 폭 16px)이라 와이어프레임 값이 표준 클래스로 옮겨진다(사이드바 210px = `w-60`, 본문 12.25px = `text-sm`).
- 줄바꿈 없는 긴 글(링크, 이름)이 들어갈 수 있는 곳에는 `wrap-anywhere`를 준다.
- 새 부품이나 변형은 개발용 부품 확인 화면(`/ui.html`, `src/ui-gallery`)에 더한다.
- 화면을 바꾸면 와이어프레임(Figma `B5OHqrl9bbvXCUkhME4Sfo`)의 같은 화면 노드 스크린샷과 비교한다.
```

`## 검사` 절 끝에 더한다.

```markdown
- 부품 확인 화면: `npm run dev --workspace @vada/web` 후 `http://127.0.0.1:5180/ui.html`
```

- [ ] **Step 3: 웹 전체 검사**

Run: `npm run typecheck`
Expected: 오류 없음. 저장소 전체 타입 검사다(새 패키지가 다른 워크스페이스에 영향이 없는지 본다).

Run: `cd apps/web && npx vitest run --no-file-parallelism`
Expected: 실패 0

Run: `npm run build --workspace @vada/web`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add AGENTS.md
git commit -m "화면 규칙을 AGENTS.md에 추가"
```

---

### Task 10: 눈으로 확인, 브랜치 CI, 병합, 운영 확인

브랜치 전체 리뷰(executing-plans의 최종 리뷰)는 Task 9 뒤, 이 Task의 Step 3(병합) 전에 받는다. 운영에 배포한 뒤에 리뷰하면 의미가 없기 때문이다.

- [ ] **Step 1: 부품 확인 화면을 와이어프레임과 비교**

1. 개발 서버를 백그라운드로 띄운다: `npm run dev --workspace @vada/web`
2. Chrome 도구로 `http://127.0.0.1:5180/ui.html`을 새 탭에서 열고 스크린샷을 찍는다.
3. Figma 노드 스크린샷(`get_screenshot`)과 나란히 비교한다. 노드는 다음과 같다.
   - 행사 화면 `20:4671`: 메뉴 항목, 탭, 칩
   - 폼 대화상자 `20:4647`
   - 초대 패널 `30:5153`
   - 빈 화면 `30:6768`
   - SIGN-IN `568:2`
4. 색, 크기, 반경, 간격이 다르면 해당 부품을 고치고 다시 찍는다. Global Constraints의 "통일 규칙을 따르는 차이"(대화상자 여백, 입력칸 반경, 배너 테두리)는 고치지 않는다.

Review Focus 2·3·4는 javascript 도구로 확인한다.

```js
const hidden = getComputedStyle(document.querySelector('[data-check="hidden"]')).display
const overflow = document.documentElement.scrollWidth > window.innerWidth
const root = getComputedStyle(document.documentElement).fontSize
JSON.stringify({ hidden, overflow, root })
```

Expected:
- 데스크톱 폭: `{"hidden":"none","overflow":false,"root":"14px"}`
- 창을 640px 미만으로 줄였을 때(`resize_window`, Chrome이 허용하는 가장 좁은 폭): `root`가 `"16px"`이고 `overflow`는 `false`다. Chrome 창은 500px 안팎보다 좁아지지 않을 수 있다. 390px 휴대폰 확인은 Step 5에서 사용자가 실제 휴대폰으로 한다.
- 좁은 폭에서 대화상자와 옆 메뉴 예시를 열어, 화면 안에 들어오는지 스크린샷으로 확인한다.

- [ ] **Step 2: 브랜치에서 CI 실행 (Review Focus 1)**

```bash
git push -u origin design-foundation
gh workflow run CI --ref design-foundation
gh run list --workflow CI --branch design-foundation --limit 1 --json databaseId,status,conclusion
```

실행 목록에 새 실행이 보일 때까지 다시 조회한다(바로는 안 보일 수 있다). 보이면 `gh run watch <databaseId> --exit-status`로 끝까지 기다린다.

Expected: 성공(`conclusion: success`). `npm ci`나 빌드에서 Tailwind 네이티브 모듈 오류가 나면 병합하지 않고 원인을 고친다.

- [ ] **Step 3: 병합과 푸시**

```bash
git switch main
git merge --ff-only design-foundation
git push origin main
```

- [ ] **Step 4: 운영 확인**

1. 새 버전이 배포될 때까지 기다린다. `curl -s https://vada-m1.onrender.com/ | grep -o 'assets/index-[^"]*\.css'`로 CSS 파일 이름을 얻고, 그 파일 안에 `155dfc`가 있으면 새 버전이다.
2. 사용자의 Chrome(이미 로그인된 상태)에서 운영 주소를 새 탭으로 열고 스크린샷을 찍는다. 확인할 화면은 다음과 같다.
   - 사이드바, 헤더, 행사 탭
   - 채팅
   - 구매요청 목록·상세
   - 구성원 초대 대화상자
3. 읽기만 한다. 행사 만들기, 메시지 보내기, 복사 버튼처럼 데이터나 클립보드를 바꾸는 동작은 하지 않는다.
4. 대화 탭에서 구매요청 탭으로 바꿨을 때 대화 패널이 사라지는지 확인한다(`hidden`, Review Focus 2). 가림 여부는 `elementFromPoint`로 본다.
5. 창을 가장 좁게 줄여 메뉴 버튼과 옆 메뉴를 확인한다.

- [ ] **Step 5: 사용자 확인 요청**

스크린샷과 함께 휴대폰에서 직접 확인해 달라고 요청한다. 확인할 것은 다음과 같다.
- 로그인 화면이 가운데 카드로 보인다.
- 메뉴 버튼으로 옆 메뉴가 열리고, 행사를 고르면 닫힌다.
- 글자 크기가 읽기 편하다.

- [ ] **Step 6: 정리**

Run: `git branch -d design-foundation && git push origin --delete design-foundation`
Expected: 병합된 브랜치라 지워진다. 권한 설정이 거부하면 사용자에게 알리고 남겨 둔다.
