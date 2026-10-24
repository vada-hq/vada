---
독자: 에이전트
---

# 016 주소

> 만들 때의 명세다. 지금의 규칙은 vada-docs `navigation.md` '이동'과 `decisions/0078-navigation-rules.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 모양 잡기 2026-10-24, 만들기 시작 시각은 진행 에이전트가 적는다. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/016-조각번호`, 진행 기록은 `.superpowers/sdd/016/progress.md`. 기한: 2026-11-02까지 끝나면 리허설(2026-11-03)에서 함께 확인하고, 아니면 시범 운영 뒤에 마친다(DEC-78 '만드는 차례'). 상한을 넘으면 늘리지 않고 메뉴별 적용 조각(4~7)을 뒤로 넘긴다.

## 왜

지금 화면의 위치(학생회, 메뉴, 탭, 거르기, 연 기록)는 모두 React 상태이고 주소는 늘 `/`다(pushState·popstate 0곳, `notes/structure-audit/gap3-navigation.md`). 그래서 운영진이 새로고침하거나 로그인하면 홈으로 돌아가고, 기록을 링크로 나누지 못하고, 기기 뒤로가 앱을 닫거나 들어온 곳이 아닌 메뉴 목록으로 가고(홈에서 연 업무를 닫으면 업무 목록, 방 → 공지 → 뒤로가 방 목록), '모두 보기'가 그 줄이 없는 탭을 연다(홈 '받은 것' → 재정 '내 요청'). 이동은 `WorkspaceContent`가 넘기는 `onOpenX` 콜백뿐이라 행사 화면은 요청이나 다른 메뉴로 가는 길이 없다. 운영 서버는 `apps/api/src/web.ts`의 `ENTRY_PATHS`에 없는 주소를 404로 돌려, 개발(Vite)에서 되는 주소가 운영에서 막힌다.

이 기능은 라이브러리 없이 직접 만든 주소 층을 두어, 학생회 안의 메뉴·기록·탭·거르기가 주소를 가지고, 서버와 화면이 contracts 한 곳(`paths.ts`)의 같은 주소 목록을 쓰게 한다. 그 위에서 '이동' 규칙 1(주소), 2(다시 열기), 3(뒤로), 4의 기록 상세 창, 5(메뉴 다시 누르기), 6(도착지), 10(떠날 때), 11(스크롤)을 지킨다.

- 근거: DEC-78(규칙 11개, 주소 목록 한 곳, 만드는 차례), navigation.md '이동', gap3 조사의 대책 S1(주소 층 직접 구현)·S3(도착지 타입, S1에 흡수).
- 먼저 있는 것: 기능 013이 공통 창 부품(`components/ui/dialog.tsx`, `sheet.tsx`)을 방문 기록에 넣어 뒤로가 창부터 닫게 한다(규칙 4의 앞 절반, 주소 없는 한 칸). 이 기능은 그 위에 얹는다. 013이 main에 오른 뒤 조각 2를 시작한다.
- 이미 있는 것: 알림 주소 셋과 읽기(`packages/contracts/src/push.ts`의 `chatRoomUrl`·`taskUrl`·`purchaseRequestUrl`과 `…FromPath`), 알림 주소를 한 번 읽고 `/`로 되돌리는 `apps/web/src/workspace/useChatLink.ts`, 서비스 워커가 열린 창에 주소를 알리는 `vada:open`(`apps/web/public/sw.js`, `lib/service-worker.ts`), 공개 화면 주소(`public/public-path.ts`), 초대 주소(`councils/invite-path`), 로그인 돌아올 곳(`auth/useAuthActions.ts`의 `callbackURL`, 지금은 초대 아니면 `/`), 대화의 마지막 방 기억(`chat/last-room.ts`).

### 원칙 대조

- 새로 하는 입력: 없다. 운영진은 지금처럼 누르고, 새로고침·로그인·알림 뒤에 보던 곳으로 돌아오며, 링크를 붙여 넣어 같은 기록을 연다. 그 자리에서 바로 이득이다(PRIN-1).
- 근거 연결, 변경 이력: 기록을 만들거나 바꾸지 않아 해당 없다. 표와 API 변경도 없다.
- PRIN-5: 주소는 볼 권한을 주지 않는다. 주소로 연 기록도 서버가 요청마다 권한과 학생회를 다시 보고, 화면은 못 보는 기록을 그 자리에서 알린다.
- AI: 쓰지 않는다.

## 범위 밖

- 창을 방문 기록에 넣기(규칙 4의 만들기·확인 창): 기능 013.
- 규칙 7(같은 기록, 같은 동작), 8(다음 단계), 9(빈 상태 버튼): 주소와 무관하다. 요청 승인 뒤 '지출 적기' 길, 수입·결산 빈 상태 버튼은 메뉴 작업 폴더에서 바로 고친다(gap3 12·13번).
- 라우터 라이브러리, Navigation API, 서버 쪽 화면 그리기. 검색어 같은 자유 입력을 주소에 넣기. 화면 안 뒤로 버튼을 새로 그리기(지금 있는 뒤로·닫기의 동작만 바꾼다).
- 공개 화면(`/apply`, `/r`)과 초대(`/join`)의 동작. 서버 진입 목록에만 같이 든다.
- 학생회 밖의 주소(내 학생회 목록, 학생회 만들기)와 학생회 이름이 든 읽기 쉬운 주소.

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 만드는 방법 | History API(`pushState`, `replaceState`, `popstate`)로 직접 만든 층 하나. 라우터 라이브러리를 쓰지 않는다. Navigation API는 Safari 26.2·Firefox 147부터라 쓰지 않는다 | gap3 대책 S1, [MDN History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API), [web.dev Navigation API Baseline 2026](https://web.dev/blog/baseline-navigation-api) | 쉽다(층 하나 안) |
| 주소 꼴 | 메뉴 첫 화면 `/{메뉴}/{학생회}`(home, chat, events, tasks, finance, people, departments, settings). 기록 하나 `/{종류}/{학생회}/{기록}`이고 종류는 chat(방), events, tasks, purchases, expenses, incomes. 종류마다 여는 메뉴와 탭이 목록에 있다(purchases·expenses·incomes는 재정의 그 탭). 학생회와 기록 칸은 id(uuid)다. 알림 주소 셋은 이 꼴 그대로라 이미 보낸 알림도 열린다 | 지금 알림 주소, [Slack 웹 주소의 팀·채널 id](https://docs.slack.dev/interactivity/deep-linking), [Google URL 구조](https://developers.google.com/search/docs/crawling-indexing/url-structure) | 어렵다(보낸 알림, 나눈 링크) |
| 탭과 거르기 | 쿼리(`?tab=`, `view=`, `filter=`, `period=` 등)에 기본값이 아닌 값만 둔다. 키와 허용 값은 `paths.ts`에 메뉴마다 있고, 모르는 값은 기본값으로 읽고 주소를 고쳐 쓴다(replace). 탭·거르기 바꾸기는 기록을 쌓지 않는다(replace). 검색칸 글은 넣지 않는다 | DEC-78 근거 Smashing 2022(크게 바뀌지 않으면 기록을 쌓지 않는다), Google URL 구조(거르기 조합이 주소를 불린다) | 쉽다 |
| 한 곳 | `packages/contracts/src/paths.ts`가 주소 목록, 만들기, 읽기를 맡는다. 서버 `ENTRY_PATHS`와 화면 해석기, 알림 주소(`push.ts`)가 이것만 쓴다. 끝 슬래시는 모든 주소에서 같은 화면이다 | DEC-78 '주소 목록은 한 곳', gap3 E(`/apply/X/` 404) | 쉽다 |
| 뒤로 | 기기·브라우저 뒤로는 방문 기록 그대로다. 화면 안의 뒤로·닫기는 앱 안에서 쌓은 칸이면 한 칸 뒤로, 아니면 상위 목록으로 바꿔 쓴다. 칸마다 들어온 곳의 이름을 기록 상태에 둔다. 기록 주소로 바로 들어오면 상위 목록 칸을 밑에 깔고 그 위에 기록 칸을 쌓아, 어느 뒤로든 상위 목록으로 간다 | DEC-78 규칙 3, [Android 탐색 원칙(딥 링크도 손으로 들어온 것과 같은 뒤로)](https://developer.android.com/guide/navigation/navigation-principles) | 쉽다 |
| 기록 상세 창 | 업무·요청·지출·수입 상세 창은 주소로 연다(여는 것 = 기록 주소로 한 칸, 닫기 = 뒤로). 013의 주소 없는 한 칸을 겹쳐 쓰지 않는다. 만들기·확인 창은 013 그대로 | DEC-78 규칙 4 | 쉽다 |
| 없는 주소 | 모르는 학생회(내 목록에 없음), 없는 기록, 볼 수 없는 기록은 모두 같은 '찾을 수 없음'을 그 자리에 보이고 상위 목록으로 가는 버튼을 둔다. 있는지 없는지를 가르지 않는다 | DEC-78 규칙 1, [GitHub REST, 권한이 없으면 404](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource) | 쉽다 |
| 다시 열기 | 새로고침은 주소 그대로. 로그인은 `callbackURL`에 지금 주소(경로와 쿼리)를 넣되, 해석기가 아는 학생회 안 주소일 때만이고 아니면 `/`. 초대 링크가 먼저다. `/`로 열리면(홈 화면 앱 시작) 이 기기가 마지막에 본 학생회 안 주소로, 없으면 첫 학생회 홈으로 바꿔 쓴다 | DEC-78 규칙 2, [OWASP 열린 리다이렉트](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html), `chat/last-room.ts`(Slack 마지막 채널) | 쉽다 |
| 알림 누르기 | 열린 창은 `vada:open`의 주소로 한 칸 쌓는다. 작업 공간을 새로 그리지 않는다(gap3 D, `MyCouncils.tsx:66`) | DEC-78 규칙 2 | 쉽다 |
| 메뉴 다시 누르기 | 열린 메뉴를 누르면 그 메뉴 첫 화면(기본 탭·거르기)으로 한 칸 쌓는다. 이미 첫 화면이면 맨 위로 올리기만 하고 칸을 쌓지 않는다. 학생회를 바꾸면 그 학생회 홈으로 한 칸 | DEC-78 규칙 5, [Apple UITabBarController(선택된 탭을 다시 누르면 첫 화면)](https://developer.apple.com/documentation/uikit/uitabbarcontroller) | 쉽다 |
| 떠날 때 | 화면이 저장하지 않은 입력을 층에 알리면, 앱 안 이동(메뉴, 탭, 화면 안 뒤로)은 확인 창을 먼저 보인다. 기기 뒤로는 막을 수 없어 한 칸 되돌려 놓고 묻는다. 새로고침·닫기는 입력이 있는 동안만 `beforeunload`를 건다 | DEC-78 규칙 10, [MDN beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event), [React Router 이동 막기](https://reactrouter.com/how-to/navigation-blocking) | 쉽다 |
| 스크롤 | `history.scrollRestoration = 'manual'`. 본문(`WorkspaceContent`의 `main`)의 위치를 칸마다 `sessionStorage`에 두고, 뒤로 돌아오면 목록을 그린 뒤 그 자리로, 새 칸은 맨 위에서 연다 | DEC-78 규칙 11, [MDN scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration), [Chrome 블로그](https://developer.chrome.com/blog/history-api-scroll-restoration) | 쉽다 |
| 이동 부르기 | 화면은 층의 이동 함수(주소 만들기 + 쌓기)를 부른다. `onOpenX` 콜백 사슬과 `useChatLink`·`useOnceLinked`는 조각마다 걷어 낸다 | gap3 A·B(행사 화면이 콜백을 못 받음) | 쉽다 |

## 위험

- **013 창 기록과 잇기(013 조각 1 검토 Minor 4).** 013의 `use-window-history.ts`는 창이 닫힐 때 `history.go(-extra)`로 자기 칸을 지운다. 창이 열린 채 주소를 `pushState`하면 그 되돌리기가 새 주소까지 되돌린다. 주소 이동은 창을 먼저 닫은 뒤에 하거나, 창 기록이 주소 이동을 알고 칸을 세게 고친다. 새로고침으로 되살린 창이 칸을 하나 더 쌓지 않게 한다. 같은 칸의 상태 키는 `vadaWindow` 하나라 주소 상태를 얹어도 된다.

- **공통 파일 충돌(가장 크다).** `Workspace.tsx`(10/10 이후 21회), `CouncilWorkspace.tsx`·`WorkspaceContent.tsx`(14회), `App.tsx`(11회), `SidebarNav.tsx`, contracts `index.ts`, `web.ts`를 조각 1~3이 모두 고치고, 4~7이 메뉴 화면을 고친다. 진행 에이전트는 시작할 때 사람에게 알리고, 이 기능을 하는 동안 메뉴 작업 폴더(`vada-home`, `vada-chat`, `vada-events`, `vada-tasks`, `vada-finance`)의 수정을 쉰다. 마지막 조각이 main에 오르면 푼다. 쉬는 동안 온 버그는 진행 에이전트가 조각 사이에 main에서 고친다(`work-method.md` '버그').
- **013과 겹치기.** 기록 상세 창이 013의 한 칸과 주소의 한 칸을 둘 다 쌓으면 뒤로를 두 번 눌러야 닫힌다. 조각 2의 수용 기준으로 막고, 013이 main에 오르기 전에는 조각 2를 시작하지 않는다.
- **되돌리기 어려운 주소 꼴.** 보낸 알림과 나눈 링크가 주소를 가리킨다. 옛 알림 주소 셋을 시험으로 고정한다. 진행 에이전트는 조각 1이 main에 오른 뒤 vada-docs DEC-78 '결과'에 주소 꼴 한 줄을 더한다.
- **학생회 격리(깊게).** 주소의 학생회 id는 남의 것일 수 있다. 서버는 이미 요청마다 소속을 보고, 화면은 내 목록에 없으면 '찾을 수 없음'이다. 다른 학생회 id·기록 id로 시험하고, 거르기를 지우면 시험이 실패하는지 본다(자주 잡힌 것 6, 11).
- **열린 리다이렉트(깊게).** `callbackURL`에는 해석기를 통과한 같은 사이트 경로만 들어간다. `//`, `\`, 바깥 주소, 공개·초대 주소를 시험한다.
- **개인 링크 토큰.** `/r#토큰`과 초대 코드는 지금 그대로이고 새 주소에 토큰을 넣지 않는다. 마지막 주소 기억에 공개 화면 주소를 넣지 않는다.
- **아이폰 홈 화면 앱.** 뒤로 밀기와 `popstate`, 서비스 워커가 열린 창을 navigate하지 않는 것(`sw.js` 주석)은 가짜 DOM이 증명하지 못한다. 닫기의 기기 확인에서 본다.
- **표, 마이그레이션, 새 의존성, 비밀 값, 새 라우트 모듈**: 없다.

### 사람이 시작 전에 할 일

메뉴 작업 폴더의 세션을 닫는다(위 '공통 파일 충돌'). 그 밖에는 닫을 때의 기기 확인만 한다.

## 조각

1 → 2 → 3은 차례로 한다(핵심). 4~7은 3이 main에 오른 뒤 시작하고, 서로 파일이 겹치지 않으면 둘까지 동시에 한다. 상한을 넘으면 남은 4~7을 시범 운영 뒤로 넘기고, 그때까지 그 메뉴는 메뉴 첫 화면 주소만 가진다.

### 1. 주소 목록과 서버 진입 [x]
- 할 수 있게 되는 것: 학생회 안의 모든 메뉴·기록 주소가 운영 서버에서 열리고, 서버와 화면이 같은 목록으로 주소를 만들고 읽는다.
- 수용 기준: 목록의 메뉴 여덟과 기록 종류 여섯마다 주소를 만들고 다시 읽으면 같은 값이 나온다(학생회·기록·탭·거르기). 끝 슬래시, 퍼센트 인코딩, 대문자 메뉴 이름, 모르는 메뉴·종류, uuid가 아닌 id, 칸이 하나 더 많은 주소를 시험한다. 모르는 쿼리 값은 기본값으로 읽힌다. 옛 알림 주소 셋(`/chat/학생회/방`, `/tasks/…`, `/purchases/…`)이 지금과 같은 값으로 읽히고 알림을 만드는 쪽도 같은 주소를 낸다. 운영 모드 서버에서 목록의 모든 꼴과 그 끝 슬래시, `/apply/X/`가 `index.html`(`no-cache`)을 주고, 목록에 없는 경로는 지금처럼 404다. 서버 진입 목록을 손으로 적은 곳이 없다.
- 닿는 곳: `packages/contracts/src/paths.ts`(새), `push.ts`(알림 주소를 paths로), `index.ts`, `apps/api/src/web.ts`와 그 시험, 알림을 만드는 곳(`chat`, `tasks`, `purchases`의 알림 주소 호출).
- 검토: 깊게(주소). 마이그레이션: 없음.

### 2. 주소로 움직이는 작업 공간 [x]
- 할 수 있게 되는 것: 학생회와 메뉴가 주소를 따라 바뀌고, 새로고침·뒤로·알림·메뉴 다시 누르기가 주소대로 움직인다.
- 수용 기준: 메뉴를 누르면 주소가 `/{메뉴}/{학생회}`로 바뀌고 브라우저 뒤로가 앞 메뉴로 간다. 새로고침하면 같은 학생회·메뉴가 열린다. 열린 메뉴를 다시 누르면 첫 화면으로 가고, 이미 첫 화면이면 칸이 늘지 않는다. 학생회를 바꾸면 그 학생회 홈 주소가 된다. 방금 만든 학생회는 운영진 화면 주소로 열린다. 열린 창에서 알림을 누르면 그 주소로 한 칸 쌓이고 작업 공간이 새로 그려지지 않는다(학생회 불러오기가 다시 일지 않는다). 모르는 학생회·없는 주소는 '찾을 수 없음'과 상위 목록 버튼이다. 기록 주소로 바로 들어오면 그 아래에 상위 목록 칸이 깔려 뒤로가 목록으로 간다. 013의 창을 연 뒤 메뉴로 가도 뒤로가 두 번 걸리지 않는다. 이동 층을 끊으면(주소를 읽지 않게 하면) 시험이 실패한다(자주 잡힌 것 14).
- 닿는 곳: `apps/web/src/lib/`의 새 이동 층(주소 상태, 쌓기·바꿔 쓰기, 화면 안 뒤로, 들어온 곳 이름), `workspace/Workspace.tsx`, `CouncilWorkspace.tsx`, `WorkspaceContent.tsx`, `useWorkspaceNav.ts`, `SidebarNav.tsx`, `pages.ts`, `useChatLink.ts`(걷어 냄), `App.tsx`, `councils/MyCouncils.tsx`.
- 검토: 깊게(주소, 학생회 격리). 마이그레이션: 없음.

### 3. 로그인 뒤 복귀, 떠날 때 확인, 스크롤 [ ]
- 할 수 있게 되는 것: 로그아웃 상태로 받은 링크가 로그인 뒤 그 화면으로 열리고, 저장하지 않은 입력은 떠나기 전에 묻고, 뒤로 돌아오면 있던 자리가 보인다.
- 수용 기준: 로그아웃 상태에서 학생회 안 주소를 열고 로그인하면(보통 길과 홈 화면 앱 길 모두) 그 주소로 돌아온다. 초대 링크는 지금처럼 초대로 돌아온다. 바깥 주소·`//`·공개 주소는 `/`로 바뀐다. `/`로 열면 이 기기가 마지막에 본 학생회 안 주소가, 없거나 그 학생회를 잃었으면 첫 학생회 홈이 열린다. 입력이 남았다고 알린 화면에서 메뉴·탭·화면 안 뒤로를 누르면 확인 창이 먼저 보이고, '계속 쓰기'면 그대로, 나가면 이동한다. 기기 뒤로도 같은 확인을 거친다. 입력이 있을 때만 `beforeunload`가 걸린다. 새 칸은 맨 위에서 열리고, 긴 목록에서 기록을 열었다 뒤로 오면 같은 위치다. 확인 창 문구는 '화면 문구와 폼'을 따르고 부품 확인 화면에 있다.
- 닿는 곳: `apps/web/src/auth/useAuthActions.ts`, `auth/popup-login`, 이동 층(떠날 때 확인 훅, 스크롤), `workspace/WorkspaceContent.tsx`, `lib/messages.ts`, `ui-gallery/`.
- 검토: 깊게(인증 돌아올 곳). 마이그레이션: 없음.

### 4. 업무와 홈의 업무 줄 [ ]
- 할 수 있게 되는 것: 업무의 탭·거르기와 업무 상세가 주소를 가지고, 홈에서 연 업무를 닫으면 홈으로 돌아간다.
- 수용 기준: 업무의 보기(`TASK_VIEWS`)·거르기(`TASK_FILTERS`)·배치·부서 거르기가 주소에 남아 새로고침해도 같다. 업무 상세는 `/tasks/{학생회}/{업무}`이고 닫으면 들어온 곳(홈, 업무 목록, 행사)으로 간다. 홈의 업무 묶음과 행사 개요의 '담당자 없음'은 그 줄이 보이는 보기·거르기로 연다(gap3 B). 업무에서 누른 행사는 행사 주소로 연다. 이 메뉴의 `onOpenTask` 사슬이 없다.
- 닿는 곳: `apps/web/src/tasks/TasksPage.tsx`와 상세 창, `home/`의 업무 줄, `events/OverviewTasks.tsx`, 이동 층.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 5. 재정과 홈의 받은 것 [ ]
- 할 수 있게 되는 것: 재정의 탭·거르기·회계 기간과 요청·지출·수입 상세가 주소를 가지고, 요청에서 연 지출을 닫으면 요청으로 돌아간다.
- 수용 기준: 재정 탭 일곱, 요청 거르기(`PURCHASE_VIEWS`), 회계 기간이 주소에 남는다. 납부자 명단 권한이 없으면 그 탭 주소는 구매 요청 탭으로 바꿔 쓴다. 요청·지출·수입 상세는 그 종류의 주소이고 닫으면 들어온 곳으로 간다(요청 → 지출 → 닫기 → 요청). 홈 '받은 것' 모두 보기는 결재 대기 거르기로 연다(gap3 B, `FinancePage.tsx:232`). 대화의 '재정에서 보기' 뒤 뒤로는 그 방이다. 행사에서 연 요청에도 예산 탭으로 가는 길이 있다(`MoneyRecordDialogs.tsx`). 지출 상세의 행사는 행사 주소로 가는 링크다(`ExpenseFacts.tsx`).
- 닿는 곳: `apps/web/src/finance/FinancePage.tsx`, `FinanceTabs.tsx`, 요청·지출·수입 상세 창, `ExpenseFacts.tsx`, `events/MoneyRecordDialogs.tsx`, `home/`의 받은 것·요청 줄, 이동 층.
- 검토: 보통. 마이그레이션: 없음.

### 6. 행사와 신청 양식 편집 [ ]
- 할 수 있게 되는 것: 행사 하나와 그 탭이 주소를 가지고, 신청 양식 편집을 저장하지 않고 떠나면 묻는다.
- 수용 기준: `/events/{학생회}/{행사}?tab=`(`EventTab` 넷)로 그 행사·탭이 열리고 새로고침해도 같다. 행사 목록에서 연 행사의 뒤로는 목록, 업무·홈·지출에서 연 행사의 뒤로는 그곳이다. 행사 화면에서 요청·업무·다른 메뉴로 가는 길이 이동 층으로 열린다(gap3 A, `WorkspaceContent.tsx:132-138`). 신청 양식 편집에 고친 것이 남았을 때 탭·메뉴·뒤로·새로고침을 누르면 3의 확인을 거친다(gap3 D).
- 닿는 곳: `apps/web/src/events/EventsPage.tsx`, `EventDetailView.tsx`, `registrations/FormEditor.tsx`·`RegistrationTab.tsx`, 이동 층.
- 검토: 보통. 마이그레이션: 없음.

### 7. 대화의 방과 공지 [ ]
- 할 수 있게 되는 것: 방과 공지 모아 보기가 주소를 가지고, 뒤로가 들어온 방으로 가며, 방을 바꿔도 쓰던 입력이 남는다.
- 수용 기준: 방은 `/chat/{학생회}/{방}`, 공지 모아 보기는 대화의 탭 주소다. 방 → 공지 → 뒤로는 그 방이다(gap3 A, `ChatPage.tsx:185,191`). 홈의 공지 줄은 어느 기기에서나 공지 모아 보기로 연다(gap3 B). 대화 메뉴 첫 화면은 지금처럼 기억한 방(PC)이나 방 목록(휴대폰)이다. 방을 바꿨다 돌아오면 쓰던 입력이 그대로다(새로고침 전까지, 규칙 10). 들어가지 않은 방 주소는 '찾을 수 없음'이다.
- 닿는 곳: `apps/web/src/chat/ChatPage.tsx`, `RoomView.tsx`, `Composer.tsx`·`useComposer.ts`, `NoticePage.tsx`, `home/`의 공지 줄, 이동 층.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 진행 에이전트가 사람에게 기기 확인을 맡기고 결과를 `docs/device-checks.md`의 새 절 '주소'에 옮긴다. A는 아이폰 홈 화면 앱, B는 갤럭시 Chrome.

1. B가 재정 지출 탭을 열고 새로고침한다 → 같은 탭이다. 지출 상세를 열고 기기 뒤로 → 창이 닫히고 같은 스크롤 위치다. 한 번 더 뒤로 → 앞 메뉴다.
2. B가 업무 상세 주소를 카톡으로 A에게 보낸다. A가 로그아웃 상태에서 열고 로그인한다 → 그 업무가 열리고, 뒤로 밀기 → 업무 목록이다.
3. A가 앱을 닫았다 다시 연다 → 마지막에 본 화면이다. 알림을 누른다 → 그 방이 열리고 뒤로 → 앞 화면이다.
4. 신청 양식을 고치다 메뉴를 누른다 → 확인이 나온다.

지표와 회고 세 줄은 이 아래에 적는다.
