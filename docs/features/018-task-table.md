---
독자: 에이전트
---

# 018 업무 표

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-25 14:42. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/018-조각번호`, 진행 기록은 `.superpowers/sdd/018/progress.md`.

## 왜

운영진이 업무 하나를 만들려고 칸 여섯 개짜리 창(`apps/web/src/tasks/TaskCreateDialog.tsx`)을 열고, 담당자·마감·상태를 바꾸려고 업무마다 상세 창을 연다. 카톡의 부탁 여러 개를 옮기거나 회의 뒤 업무를 나누는 일(navigation.md 핵심 작업 2, 15, 16, 23)이 창을 여닫는 일이 된다. 이 기능은 업무 목록을 GitHub Projects 표처럼 바로 고치는 표로 바꾸고, 제목 한 줄로 만들게 한다. 함께 만들기 선택지를 서버가 내려주게 해 `docs/tech-debt.md` DEBT-1을 고친다.

- 근거: DEC-22(업무 한 종류), DEC-28(권한), DEC-35·DEC-37(업무 목록은 한 곳, 행사 탭은 그 행사로 걸러 보기), DEC-38(화면은 권한을 다시 셈하지 않는다), DEC-39(상태 셋, 해요체), DEC-78과 navigation.md '이동' 규칙 7(같은 기록 같은 동작), 9(빈 상태), 10(떠날 때).
- 이미 있는 것: 업무 화면 `apps/web/src/tasks/TasksPage.tsx`(행사의 업무 탭도 `events/EventDetailView.tsx`에서 같은 화면을 `eventId`로 좁혀 쓴다), 보기 탭 넷(`TASK_VIEWS`: 내 업무, 내 부서, 전체, 담당자 없음), 거르기 둘(끝나지 않은 것, 끝남), 배치 둘(`TASK_LAYOUTS`: 목록, 달력, 보드는 없다), 목록 줄 `TaskRow.tsx`(제목 → 상세, [시작]·[끝내기], 담당자 없는 줄의 '담당자 지정'), 묶음 `task-groups.ts`(내 업무는 급한 순, 그 밖은 부서), 업무마다의 `actions`(`apps/api/src/tasks/policy.ts`의 `actionsOf`), 만들기 예외 `tasks/service.ts`의 `createFacts`, 화면이 다시 짠 만들기 선택지 `tasks/task-form-options.ts`·`useTaskCreateForm.ts`, 행사 개요의 [업무 만들기](`initialCreate`), 목록 다시 읽기 정책(`lib/use-visible-poll.ts`, 15초), 배정 알림 `tasks/notify.ts`(보낼 때 업무를 다시 읽어 지운 업무는 보내지 않는다).

### 원칙 대조

- 새로 하는 입력: 없다. 만들 때 꼭 넣는 것이 칸 여섯에서 제목 하나로 준다(PRIN-1, 004 '원칙 대조'). 나머지 칸은 보는 곳에서 채워지고, 바꾸고 싶을 때만 그 칸을 고친다. 고치는 수고가 창 여닫기에서 칸 하나로 줄어 지금 그 사람에게 이득이다.
- 근거 연결: 바뀌지 않는다(업무에 근거 메시지는 아직 없다, 004).
- 변경 이력: 칸을 고칠 때마다 지금처럼 판이 남고 같은 값이면 남지 않는다. 되돌리기도 판 하나로 남는다(이력을 지우지 않는다, PRIN-3). 이력은 상세 창의 [이력 보기]에서만 본다.

## 범위 밖

- 열 순서·너비·숨기기 고르기, 열 머리로 정렬, 여러 줄 골라 한꺼번에 바꾸기, 끌어서 옮기기, 묶음마다의 추가 줄(GitHub의 묶음 값 채우기), 보드 보기, 표에서 내용(본문) 고치기, 글자를 치면 바로 고치기 시작(한글 입력기 조합 문제).
- 권한 규칙(누가 무엇을) 바꾸기, 상세 창의 모양 바꾸기, 달력 보기 바꾸기, 앱 안 알림함, 이미 간 휴대폰 알림 거두기.

## 정한 것

주인 결정(2026-10-25 대화)은 1~7이고 다시 정하지 않는다. 그 밖은 아래 근거로 정했다.

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 1 빠른 추가(주인) | 제목만 치고 Enter(또는 [추가])로 만든다. 꼭 넣는 것은 제목 하나다. 업무 만들기 창은 없앤다 | PRIN-1, 004 원칙 대조, [GitHub Projects 'Add item'](https://docs.github.com/en/enterprise-server@3.19/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project), Microsoft To Do, Todoist Quick Add, [NN/g 모달은 진행에 꼭 필요한 정보가 빠졌을 때만](https://www.nngroup.com/articles/modal-nonmodal-dialog/) | 쉽다 |
| 2 열(주인) | 제목·상태·담당자·마감·부서·행사가 열이고 모든 줄의 칸에서 바로 고친다. 행사의 업무 탭은 행사 열이 없다. 내용과 이력은 상세 창에서만 | 주인 결정 | 쉽다 |
| 3 기본값과 같은 부품(주인) | 새 줄의 기본값은 보는 곳에서 온다(아래 '기본값 고르기'). 업무 메뉴와 행사의 업무 탭이 같은 표 부품을 쓴다 | navigation.md 이동 규칙 7, DEC-35, DEC-37 | 쉽다 |
| 4 권한(주인) | 칸은 서버의 `actions`대로만 열린다: 제목·마감·행사 `task.edit`, 상태 `task.change_status`, 담당자 `task.change_assignee`, 부서 `task.change_department`. 만들기 선택지도 서버가 준다(DEBT-1). `createFacts`의 예외를 `policy.ts`로 옮기고 권한 규칙은 바꾸지 않는다 | DEC-38, DEC-28, [GitHub GraphQL `viewerCanUpdate`](https://docs.github.com/en/graphql/reference/interfaces#updatable) | 쉽다 |
| 5 휴대폰(주인) | 좁은 화면은 지금의 목록 줄과 상세 창이다. 빠른 추가 줄은 휴대폰에도 있다(제목만) | 주인 결정 | 쉽다 |
| 6 되돌리기(주인) | 칸이나 줄에서 담당자를 바꾸면 화면 아래 띠에 '담당자 변경: {이름}'과 [되돌리기]가 보인다 | 주인 결정 | 쉽다 |
| 7 키보드(주인) | WAI-ARIA grid 패턴을 따른다(아래 '키보드와 낭독기') | [WAI-ARIA APG Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | 쉽다 |
| 표가 대신하는 것 | 배치 '목록'이 넓은 화면에서 표가 된다. 주소 값(`layout=list`)과 이름 '목록'은 그대로, 달력은 그대로다(보드는 지금 없다). 달력 아래의 고른 날 목록은 지금 줄 그대로다 | 지금 코드(`TASK_LAYOUTS`), [GitHub Projects 표·보드·로드맵 배치](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/changing-the-layout-of-a-view) | 쉽다 |
| 표를 보이는 폭 | 화면 폭 1024px(Tailwind `lg`) 이상에서 표, 그 아래는 목록 줄이다. 옆 메뉴(`w-60`)가 768px부터 보여 768px에서는 내용 폭이 약 480px라 열 여섯이 들어가지 않는다. 대화의 나란히 보기(`chat/useSplit.ts`)와 같은 경계다 | [Tailwind 반응형 경계](https://tailwindcss.com/docs/responsive-design), `workspace/WorkspaceFrame.tsx` | 쉽다 |
| 빠른 추가 자리 | 목록·표 맨 위(탭 줄 아래)에 보이는 라벨 '새 업무'가 있는 입력칸 하나와 [추가]. 예시 글은 없다. 줄이 300개까지 늘어 맨 아래는 스크롤해야 닿는다. 만든 뒤 칸은 비고 초점은 칸에 남아 이어서 만든다. 배치가 목록이고 거르기가 '끝나지 않은 것'일 때만 있다(끝남·달력에는 새 업무가 보이지 않는다) | [Microsoft To Do 'Add a task'는 목록 위](https://ittraining.iu.edu/explore-topics/titles/ms-todo/index.html), Google Tasks, GitHub(이어서 추가), AGENTS.md '화면 문구와 폼'(예시 글 금지) | 쉽다 |
| 기본값 고르기 | 행사: 행사의 업무 탭이면 그 행사. 담당자: 내 업무면 나, 그 밖(담당자 없음, 전체, 내 부서, 행사 탭)은 없음. 부서: 부서 거르기(`dept`)가 있으면 그 부서, 회장단이면 학생회 업무, 그 밖은 내 부서 가운데 부장인 부서 먼저 첫 것. 고른 값이 서버 선택지에 없으면 부서는 선택지의 첫 부서, 담당자는 그 부서 선택지에 '나'가 있으면 나, 없으면 첫 값이다. 화면은 선택지 안에서 고르기만 하고 권한을 셈하지 않는다 | 주인 결정 3, DEC-38, [GitHub 묶음 안에서 만들면 묶음 값](https://docs.github.com/en/enterprise-server@3.19/issues/planning-and-tracking-with-projects/managing-items-in-your-project/adding-items-to-your-project) | 쉽다 |
| 지금 보기에 없는 새 업무 | 기본값이 선택지에 없어 바뀐 탓에 새 업무가 지금 보기에 없으면 빠른 추가 칸 아래에 '추가한 업무는 이 보기에 없음'과 [열기](상세)를 보인다 | [Jira 'created but is not currently visible on the board'](https://support.atlassian.com/jira/kb/the-issue-xxx-has-been-created-but-is-not-currently-visible-on-the-board/) | 쉽다 |
| 만들기 선택지 API | `GET /api/organizations/:councilId/tasks/options?event=`(선택) → `TaskCreateOptionsResponse`: 부서마다(학생회 업무는 부서 없음) 고를 수 있는 담당자(번호와 이름, 담당자 없음 가능). 고를 수 있는 부서만 실린다. 판정은 만들기 경로와 같은 `policy.ts` 판정을 부서 × (없음 + 지금 운영진)마다 부른다. 목록과 따로 두어 달력·대화의 업무 읽기에 일이 붙지 않게 하고, 목록을 다시 읽을 때 같이 읽는다 | DEBT-1 '고치는 법', 012의 `policy.ts` 모양, `TaskListQuerySchema`의 `event` | 쉽다 |
| 칸 하나 고치기 | `UpdateTaskSchema`의 제목·내용·마감을 행사처럼 '빼면 그대로'로 바꾼다(`z.strictObject` 그대로, 내용·마감은 null이면 비움, 제목은 null 불가). 칸 하나는 그 키 하나만 보낸다. 빈 본문은 판 없이 200. 상세 창의 고치기는 지금처럼 셋을 다 보낸다 | [RFC 7396 JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396)(빠진 키는 그대로), [GitHub REST 이슈 고치기](https://docs.github.com/en/rest/issues/issues#update-an-issue) | 쉽다(늘리기만) |
| 저장 시점 | 고르는 칸(상태·담당자·부서·행사)은 고르면 바로 보낸다. 글 칸(제목, 마감)은 Enter나 칸을 떠날 때 보내고 Escape는 되돌린다. 미리 바꿔 보이지 않고 보내는 동안 그 칸만 막고 응답의 업무로 줄을 바꾼 뒤 목록을 다시 읽는다(`actions`도 응답대로) | [APG 그리드 편집](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), GitHub Projects 칸 편집, 자주 잡힌 것 2 | 쉽다 |
| 다시 읽기와 초점 | 칸을 고치는 동안 15초 다시 읽기가 와도 고치던 글과 초점은 그대로다. 고친 줄이 다른 묶음으로 옮기면 초점이 그 업무의 같은 칸을 따라가고, 보기에서 빠지면(끝남, 남에게 맡김) 다음 줄의 같은 칸으로 간다 | [APG 그리드: 초점은 한 칸](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), 013 '권한·운영진 갱신' | 쉽다 |
| 키보드와 낭독기 | 표는 하나이고 `grid`다. Tab 한 번으로 들어가 마지막에 있던 칸에 선다. 화살표는 한 칸(가장자리에서 멈춤, 묶음 머리 줄은 건너뜀), Home/End는 줄의 처음·끝, Ctrl+Home/End는 표의 처음·끝 칸. Enter는 제목 칸이면 상세를 열고 다른 고칠 수 있는 칸이면 고치기를 시작한다. F2는 어느 칸이든 고치기 시작과 끝. Escape는 고치기를 그만두고 그 칸으로 돌아온다. 고칠 수 없는 칸은 `aria-readonly`. 열 머리는 `columnheader`, 묶음 이름은 표 안의 머리 줄이다. 마우스는 제목을 누르면 상세, 제목 칸의 연필 단추('{제목} 제목 고치기')로 고친다 | [APG Grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), [APG Data Grid 예](https://www.w3.org/WAI/ARIA/apg/patterns/grid/examples/data-grids/) | 쉽다 |
| 오류 | 칸의 오류는 그 줄 아래 한 줄(`role="alert"`)이다. 빈 제목·100자 넘음은 계약 문구(`TASK_CONTRACT_MESSAGES`)로 고치기를 이어 간다. 403은 지금 줄의 [시작]처럼 학생회와 목록을 다시 읽는다. 404는 목록에서 빠지고 화면 위에 이유. 409·429는 줄 아래 문구 | 자주 잡힌 것 1, 3, 4, AGENTS.md '새 API를 만들 때' | 쉽다 |
| 되돌리기와 알림 | 배정 휴대폰 알림은 바꾼 뒤 10초 모았다가, 그때 담당자가 처음(모으기 전) 담당자와 다르고 그 사람일 때만 한 번 보낸다. 그래서 10초 안에 되돌리거나 다른 사람으로 다시 고르면 처음 바꾼 사람은 받지 않는다. 띠는 닫거나 다른 담당자 변경이 올 때까지 남고, 10초 뒤의 되돌리기는 담당자만 되돌린다(이미 간 알림은 거두지 않는다). 상세 창의 맡기기도 같은 모으기를 거친다 | [Gmail 보내기 취소(보내기를 미룸)](https://support.google.com/mail/answer/2819488), [Linear 배정 알림 지연](https://linear.app/changelog/2019-07-18-cycles-are-here), [Linear 다시 맡기면 이전 담당자 알림 지움](https://linear.app/changelog/2021-09-29-slack-notification-actions), [Flutter·Material 3: 동작이 있는 스낵바는 저절로 닫지 않음](https://docs.flutter.dev/release/breaking-changes/snackbar-with-action-behavior-update) | 쉽다(값 하나) |
| 띠 | 화면 아래 띠, `role="status"`, 초점을 옮기지 않고 표 다음 Tab에 닿는다. [되돌리기]와 아이콘 [닫기]. 되돌리기는 이전 값으로 보내는 보통 맡기기다 | [WAI-ARIA status](https://www.w3.org/TR/wai-aria-1.2/#status), AGENTS.md '화면 문구와 폼'(명사형) | 쉽다 |
| 행사 개요의 [업무 만들기] | 행사의 업무 탭을 열고 빠른 추가 칸에 초점을 둔다 | 이동 규칙 6, 지금 `initialCreate` | 쉽다 |
| 떠날 때 | 빠른 추가 칸이나 고치는 글 칸에 보내지 않은 글이 있으면 떠날 때 묻는다(`useUnsavedInput`) | 이동 규칙 10 | 쉽다 |

## 위험

- **권한 선택지(깊게).** 서버 선택지와 만들기 판정이 어긋나면 고른 값이 403이 된다. 조각 1의 시험은 선택지에 있는 (부서, 담당자)마다 만들기가 201이고 선택지에 없는 짝은 403인지를 직급(회장단, 부장, 부원, 행사 책임자)마다 표로 본다(`tasks/policy-table.test.ts`에 줄을 더한다). 판정을 지우거나 바꾸면 두 쪽이 함께 실패해야 한다(자주 잡힌 것 11). 다른 학생회 행사는 404, 다른 학생회 사람·부서는 선택지에 없다(자주 잡힌 것 6).
- **부분 고치기(깊게).** '빼면 그대로'를 잘못 읽으면 내용이나 마감이 null로 지워진다. 키마다 빠짐·null·값 세 경우를 시험하고, 상세 창 고치기 시험이 그대로 통과해야 한다. 계약을 바꾸므로 contracts·web 시험도 돌린다(011 회고).
- **뒤에서 보내는 알림(깊게).** 모으기는 서버 메모리의 업무별 타이머다. 같은 업무에 타이머는 하나이고(겹쳐 돌지 않음), 보낼 때 DB의 지금 담당자를 다시 읽어 판단하므로 여러 번 불려도 결과가 같다. 실패는 지금처럼 `push_send_failed` 한 줄이다. 10초 안에 서버가 재시작하면 그 알림은 사라진다(004 '위험'과 같은 성질, 창만 10초 늘어난다). 인스턴스가 하나일 때만 맞다(속도 제한과 같다). 시험은 시계와 타이머를 주입해 고정 대기 없이 본다(자주 잡힌 것 10).
- **알림 기록.** 배정 알림 기록(`notification`, `assignment`)은 지금처럼 바꿀 때마다 같은 거래에 남아, 되돌린 배정에도 기록은 있다. 지금 읽는 곳이 없어 영향은 없다. 앱 안 알림함을 만들 때 되돌린 배정을 거른다(Linear처럼). 마이그레이션은 없다.
- **속도 제한.** 빠른 추가를 이어 치면 만들기·맡기기가 같이 쓰는 한도(10초에 20번)에 닿는다. 429 문구를 칸 아래에 보인다.
- **화면 접근성.** 기계 검사가 grid 키보드를 다 보지 못한다. 조각 5의 시험은 키 입력으로 초점 이동과 고치기 시작·끝을 확인하고, 진행 에이전트가 배포 뒤 키보드만으로 한 번 돈다.
- **와이어프레임.** Figma(`B5OHqrl9bbvXCUkhME4Sfo`)에 표 화면은 없다. 휴대폰 목록은 지금 노드(MY-01)와 비교하고, 표는 데스크톱 1280px와 1024px 캡처로 본다.

### 사람이 시작 전에 할 일

없음.

## 조각

1 → 2 → 3은 서버라 차례로 한다(`tasks/service.ts`가 겹친다). 4는 1이 main에 오른 뒤, 5는 4 뒤, 6은 2·3·5 뒤에 시작한다. 4는 2·3과 파일이 겹치지 않아 나란히 해도 된다. 시간이 모자라면 6에서 휴대폰 줄의 되돌리기를 뺀다(3의 모으기로 10초 안에 다시 고르면 알림은 그대로 막힌다).

### 1. 만들기 판정 한 곳과 만들기 선택지(서버) [x]
- 할 수 있게 되는 것: 서버가 그 사람이 만들 수 있는 부서와 부서마다의 담당자를 내려준다.
- 수용 기준: `GET tasks/options`는 회장단에게 모든 부서와 학생회 업무, 부서마다 담당자 없음과 모든 지금 운영진을 준다. 부장은 부장인 부서에 없음과 모든 운영진, 내 다른 부서와 학생회 업무에는 나만이다. 부원은 내 부서들과 학생회 업무에 나만이다. `event`가 내가 책임자인 행사면 모든 부서에 없음과 모든 운영진이다. 선택지에 있는 짝으로 만들면 201, 없는 짝은 403이고 기록이 없다(직급마다 표). 떠난 사람과 다른 학생회 사람·부서는 선택지에 없다. 다른 학생회 행사·형식이 틀린 번호는 404·400, 모르는 키는 400, 운영진이 아니면 403, 로그인하지 않으면 401. 만들기의 '본인' 예외가 `policy.ts`에 있고 `service.ts`에 `createFacts`가 없다. 지금 만들기 시험이 그대로 통과한다. JSON은 `no-store`다.
- 닿는 곳: contracts `tasks.ts`(`TaskOptionsQuerySchema`, `TaskCreateOptionsResponse`), api `tasks/policy.ts`, `tasks/service.ts`, `tasks/routes.ts`, 선택지 셈 모듈(새, `tasks/` 안), `tasks/policy-table.test.ts`.
- 검토: 깊게(권한, 격리). 마이그레이션: 없음.

### 2. 칸 하나 고치기(서버) [x]
- 할 수 있게 되는 것: 화면이 제목·마감·행사 가운데 하나만 보내 고친다.
- 수용 기준: `POST tasks/:taskId`에 `{ title }`만 보내면 제목만 바뀌고 내용·마감·행사는 그대로다. `{ dueDate: null }`은 마감만 비우고 `{ body: null }`은 내용만 비운다. `{}`는 판 없이 200이다. `{ title: null }`, 빈 제목, 101자(이모지), NUL, 모르는 키는 400이다. 같은 값이면 판이 늘지 않는다. 셋을 다 보내는 지금 상세 고치기는 그대로다. 권한은 지금과 같다(`task.edit`, 행사를 바꾸면 앞뒤 맥락).
- 닿는 곳: contracts `tasks.ts`(`UpdateTaskSchema`), api `tasks/service.ts`(`updateTask`), `tasks/write.test.ts`, `http/boundary.test.ts`.
- 검토: 깊게(데이터 무결성). 마이그레이션: 없음.

### 3. 배정 알림 모아 보내기(서버) [x]
- 할 수 있게 되는 것: 담당자를 잘못 골라 곧바로 되돌리면 아무에게도 알림이 가지 않는다.
- 수용 기준: B가 맡은 업무를 C로 바꾸면 10초 뒤 C의 기기에 한 번 간다. 10초 안에 B로 되돌리면 B와 C 모두 받지 않는다. 10초 안에 C → D면 D만 한 번 받고, 본문의 맡긴 사람은 마지막에 바꾼 사람이다. 담당자를 정해 만들 때도 10초 뒤 한 번이다. 10초 안에 업무를 지우면 보내지 않는다. 나에게 맡기기, 같은 사람 다시, 비우기는 지금처럼 없다. 다른 업무의 변경끼리는 모으지 않는다. 응답은 알림을 기다리지 않는다. 10초 뒤의 되돌리기는 새 변경으로 다룬다. 시험은 주입한 시계로 9.999초와 10초를 견준다.
- 닿는 곳: api `tasks/notify.ts`, `tasks/service.ts`(알림을 넘기는 곳), `tasks/routes.ts` 또는 `write-routes.ts`, `serve.ts`(타이머 연결), `tasks/assign.test.ts`.
- 검토: 깊게(뒤에서 돌리는 일). 마이그레이션: 없음.

### 4. 빠른 추가와 서버 선택지(화면) [x]
- 할 수 있게 되는 것: 운영진이 업무 화면과 행사의 업무 탭에서 제목만 쳐 업무를 만든다.
- 수용 기준: 목록 배치의 '끝나지 않은 것'에서 탭 줄 아래에 '새 업무' 칸과 [추가]가 있고(휴대폰 포함), 제목을 치고 Enter나 [추가]를 누르면 '기본값 고르기'대로 만들어져 목록에 보이며 칸이 비고 초점이 남는다. 빈 제목이면 칸 아래 오류이고 보내지 않는다. 보내는 동안 [추가]는 `busy`이고 두 번 가지 않는다. 내 업무의 부원 → 담당자 나, 내 부서, 행사 탭 → 그 행사, 회장단 전체 → 학생회 업무·담당자 없음, 부원이 담당자 없음 탭에서 만들면 나로 만들어지고 '추가한 업무는 이 보기에 없음'과 [열기]가 보인다. 409·429·403은 칸 아래 문구다. 끝남·달력에는 칸이 없다. 업무 만들기 창과 머리글의 [업무 만들기]가 없다. 행사 개요의 [업무 만들기]는 업무 탭의 '새 업무' 칸에 초점을 둔다. 칸에 글이 남았으면 떠날 때 묻는다. `task-form-options.ts`에 만들기 선택지 셈(`departmentChoices`, `assigneeChoices`, `defaultDepartmentId`, `ownsEvent`)이 없고, `docs/tech-debt.md` DEBT-1이 '고침'과 커밋이다. 390px에서 넘침이 없다.
- 닿는 곳: `apps/web/src/tasks/`(빠른 추가 부품(새), `TasksPage.tsx`, `TaskDialogs.tsx`, `task-form-options.ts`, `useTaskCreate.ts`, 지우는 `TaskCreateDialog.tsx`·`useTaskCreateForm.ts`와 시험), `events/EventDetailView.tsx`·`EventsPage.test.tsx`, `lib/use-record-dialogs.ts`, `lib/messages.ts`, `ui-gallery/`, `docs/tech-debt.md`.
- 검토: 보통. 마이그레이션: 없음.

### 5. 넓은 화면의 업무 표와 고르는 칸(화면) [x]
- 할 수 있게 되는 것: 넓은 화면에서 업무가 표로 보이고 상태·담당자·부서·행사를 칸에서 바로 고른다.
- 수용 기준: 1024px 이상이면 목록 배치가 열 제목·상태·담당자·마감·부서·행사의 표이고, 그 아래 폭은 지금 목록 줄이다(창 폭을 바꾸면 따라 바뀐다). 행사의 업무 탭에는 행사 열이 없다. 묶음(급한 순, 부서)은 표 안의 머리 줄로 남는다. `actions`에 그 동작이 있는 칸만 고르는 칸이고 나머지는 글자이며 `aria-readonly`다. 고르면 바로 보내고 그 칸만 막힌 뒤 응답대로 바뀐다. 떠난 담당자는 '떠난 사람: 이름'으로 보이고 다른 사람을 고르면 바뀐다. 같은 값을 다시 고르면 요청이 없다. '정한 것' '키보드와 낭독기'의 키가 모두 동작한다(Tab 한 번, 화살표, Home/End, Ctrl+Home/End, Enter, F2, Escape). 제목을 누르거나 제목 칸에서 Enter면 상세가 열린다. 다시 읽기가 와도 열린 고르는 칸과 초점이 그대로이고, 줄이 옮기거나 빠지면 초점이 '다시 읽기와 초점'대로 간다. 오류는 '정한 것' '오류'대로다. 1024px와 1280px에서 표가 화면 밖으로 넘치지 않는다(제목은 `wrap-anywhere`). 부품 확인 화면에 표가 있다.
- 닿는 곳: `apps/web/src/tasks/`(표 부품(새), 칸 키보드 훅(새), `TasksPage.tsx`, `TaskListBody.tsx`, `task-groups.ts`), 넓은 화면 훅(`chat/useSplit.ts`를 `src/lib`로 옮겨 같이 쓴다, 자주 잡힌 것 9), `ui-gallery/`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 6. 제목·마감 칸 고치기와 담당자 되돌리기(화면) [x]
- 할 수 있게 되는 것: 표에서 제목과 마감을 고치고, 잘못 바꾼 담당자를 띠에서 되돌린다.
- 수용 기준: `task.edit`가 있는 줄의 제목 칸은 F2나 연필 단추로 글 칸이 되고, Enter나 칸을 떠나면 `{ title }`만 보내며 Escape는 원래 제목으로 돌아온다. 빈 제목·101자는 칸 아래 계약 문구이고 고치기가 이어진다. 마감 칸은 날짜 칸이고 비우면 '마감 없음'이다. 바뀐 값이 같으면 요청이 없다. 표의 담당자 칸이나 휴대폰 줄의 '담당자 지정'으로 바꾸면 화면 아래 띠에 '담당자 변경: {이름}'(비우면 '담당자 없음')과 [되돌리기]·[닫기]가 보이고, 줄이 보기에서 빠져도 띠는 남는다. [되돌리기]는 이전 값으로 맡기고 띠를 닫는다. 다른 담당자 변경이 오면 띠가 그것으로 바뀐다. 되돌리기의 409(이전 사람이 떠남)는 띠 안의 문구다. 띠는 `role="status"`이고 초점을 옮기지 않는다. 10초 안에 되돌리면 두 사람 모두 알림이 없다(3과 이어진 시험, 자주 잡힌 것 14).
- 닿는 곳: `apps/web/src/tasks/`(표 부품, `TaskRow.tsx`, `useTaskAssign.ts`, 되돌리기 띠(새, 다른 기능이 쓰면 `src/components`)), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

기기 확인은 사람이 하고 `docs/device-checks.md`의 새 절 '업무 표'에 옮긴다. A는 기획부장(데스크톱 Chrome), B는 기획부 부원(아이폰), C는 회장(갤럭시).

1. A가 업무 화면 '내 부서'에서 제목만 쳐 Enter로 셋을 잇달아 만든다 → 셋 다 기획부·담당자 없음이다.
2. A가 키보드만으로 첫 업무의 담당자 칸을 B로 고르고 곧바로 [되돌리기] → B에게 알림이 없다. 다시 B로 고르고 기다린다 → 약 10초 뒤 B의 잠금 화면에 알림이 온다.
3. B가 휴대폰 업무 화면에서 표가 아니라 목록 줄이고, 맨 위 '새 업무'로 하나 만든다 → 담당자가 B다. B의 줄에서 담당자·부서는 고칠 수 없다(상세에서도 버튼이 없다).
4. C가 행사의 업무 탭에서 만든다 → 그 행사로 만들어지고 표에 행사 열이 없다.

지표와 회고 세 줄은 이 아래에 적는다.

### 지표(2026-10-25)

| 지표 | 값 |
|---|---|
| 기능 리드타임 | 14:42 명세 → 16:13 마지막 조각 main(df31c20) 약 1시간 31분, 배포 뒤 확인의 표 열 고침까지 약 2시간(상한 6시간) |
| main에 올린 횟수 | 10(조각 6, 검토 지적 2, 배포 뒤 확인 고침 2) |
| 다시 한 일 | 깊은 검토 Important 1(조각 3), 보통 검토 Important 3(조각 5), 합칠 때 깨진 시험 2번(조각 4·6의 표 초점 시험, knip 중복 1), 배포 뒤 확인에서 찾은 표 결함 2(선택칸 글 잘림·상태 칩 겹침, 1024px 칸 넘침) |
| 변경 실패율 | main CI 실패 2번 중 우리 탓 1(037f9ff, 표 초점 시험이 가끔 실패, 5a612b8로 고침). 다른 1은 재정 세션 커밋(f10eb20) |

### 회고

- 그대로 둘 것: 기다릴 까닭이 없는 조각을 모두 나란히 만든 것(54373b3). 서버 셋과 화면 둘이 겹쳐 돌아 6조각이 약 1시간 반에 main에 올랐다.
- 바꿀 것: 나란히 만든 화면 조각(4·6)이 같은 부품(표, `TasksPage`)을 고쳐, 합칠 때마다 서로의 시험이 깨지고 작업자가 "부하 탓"으로 잘못 봤다. 그리고 jsdom 시험은 열 너비·잘림을 못 봐, 화면 결함 둘을 배포 뒤에야 찾았다(기능 4의 탭 스크롤 막대와 같은 종류). `docs/work-method.md` '동시에 하는 일'과 차례 6에 반영했다.
- 다음에 시험할 것: 실제 폭에 기대는 화면 조각은 진행이 main에 올리기 전에 로컬 화면(`pnpm --filter @vada/web dev`)에서 1024·1280·390px를 재고 올린다. 배포 뒤 확인에서 나오는 화면 결함이 줄었는지 본다.
