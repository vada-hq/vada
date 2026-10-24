---
독자: 에이전트
---

# 004 업무

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-21 08:29. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/004-조각번호`, 진행 기록은 `.superpowers/sdd/004/progress.md`, 이슈는 vada-hq/vada-docs#10이다. 커밋하지 않은 옛 설계와 계획(2026-10-20)을 지금 main 코드에 맞춰 줄여 썼고, 옛 문서는 지운다.

## 왜

운영진이 카톡의 "@준호 현수막 주문 부탁해"를 VADA 업무로 맡기고 진행하게 한다. RFC-8 첫 시험(대화와 업무를 VADA로 옮긴다)의 '업무' 쪽이고, 성공 기준 S2(업무 5개 이상, 담당자·마감·상태 관리)와 지표 '담당자와 마감일을 모두 가진 업무 비율'을 여기서 처음 셀 수 있다. RFC-7은 업무와 업무 배정 알림을 '꼭'에 둔다.

- 근거: DEC-22(업무는 한 종류, 담당 부서·담당자는 하나 이하), DEC-28(업무 권한 네 줄), DEC-37(알림 '배정'), DEC-39(상태 셋, 해요체), DEC-45·49(지우면 취소한 시각), DEC-34·46(판), DEC-38(화면은 권한을 다시 셈하지 않는다).
- 표는 vada-docs main에 있다(58d8e21): `task`의 제목 100·내용 1000 CHECK, 상태 기본값 `'todo'`와 CHECK, `cancelled_at`, '업무의 담당 부서와 담당자는 업무와 같은 학생회' 규칙. `notification.type`에 `assignment`가 이미 있다.
- 이미 있는 것: 기록 모듈(`records/records.ts`, `records/same-council.ts`), 권한표(`access/permissions.ts`), 학생회 변경 거래(`access/authorize.ts`의 `inCouncilChange`), 속도 제한(`http/rate-limit.ts`), 알림 보내기(`push/fanout.ts`의 `createFanout`, TTL 1일), 알림 누르기(`public/sw.js`, `workspace/useChatLink.ts`, `apps/api/src/web.ts`의 화면 진입 주소), 알림 꺼짐 띠(`push/PushOffBand.tsx`).
- 닫는 조건: 업무를 맡기면 맡은 사람의 휴대폰에 알림이 오고, 알림을 누르면 그 업무가 열린다('닫기'의 기기 확인).

### 원칙 대조

- 새로 하는 입력: 업무 만들기는 카톡의 부탁을 다시 적는 일이라 PRIN-1의 틀린 예에 가깝다. 맡은 사람에게 알림이 가고 내 업무와 지남이 한곳에 모이는 바로 이득이 있어 둔다. 시범에서 부탁만 하고 업무를 안 만드는 일이 보이면 메시지에서 업무 만들기(DEC-21, RFC-7 '할 수 있으면')를 앞당긴다. 맡기기와 상태 바꾸기는 원래 하던 일이고 처리 내용은 받지 않는다.
- 근거 연결: 이번에는 근거 메시지를 받지 않는다(RFC-7 '할 수 있으면'). 표는 모든 기록에 근거를 붙일 수 있어 나중에 칸 변경 없이 더한다.
- 변경 이력: 업무는 기록이라 만들 때 판 1, 바꿀 때마다 판이 남고, 같은 값이면 남지 않는다. 상세 맨 아래에 판끼리 바뀐 칸을 바꾼 사람·시각과 함께 보인다. 지워도 판과 배정 알림 기록이 남는다(DEC-49). 확정하지 않는 기록이라 사유는 받지 않는다.
- PRIN-5: 업무는 모든 운영진이 본다(DEC-28 기준 1). 휴대폰 알림은 맡은 사람에게만 간다.

## 범위 밖

- 다른 기능: 행사 업무(업무의 행사 칸, 행사 책임자 기준, 행사 업무 탭, 만들기의 행사 고르기)는 006, 완료한 행사의 업무 잠금(DEC-4)은 행사 완료 기능, 앱 안 알림 목록과 `read_at`.
- 할 수 있으면: 반복(DEC-22), 근거 메시지와 메시지에서 업무 만들기(DEC-21).
- 그 밖: 마감 알림, 마감 시각 입력, 끝남·변경을 맡긴 사람이나 이전 담당자에게 알리기, 지운 업무 보기·되살리기, 판 번호로 동시 수정 막기, 여러 담당자, 상태를 바꿀 때 처리 내용, 옆 메뉴 수의 일정 간격 다시 읽기, 목록 인덱스.

## 정한 것

T1~T10과 작은 결정은 옛 설계의 사전 조사대로다(다시 조사하지 않았다). '(바꿈)' 셋은 옛 설계가 가정한 코드가 지금 main과 달라 고친 것이다.

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| T1 상태 | 할 일(`todo`), 진행 중(`in_progress`), 끝남(`done`). 새 업무는 할 일이고 어느 상태로든 바로 바꾼다. 끝낸 시각은 저장하지 않는다. 끌기 없이 버튼이다 | DEC-39, [Jira 상태 범주](https://help.usehaystack.io/faq/what-is-status-category), [Notion 상태](https://www.notion.com/en-gb/help/guides/status-property-gives-clarity-on-tasks), [WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Techniques/failures/F108.html) | 어렵다(DB CHECK, 이미 표에 있다) |
| T2 마감 | 날짜만 받고 비울 수 있다. 그날 한국 23:59:59로 저장하고 한국 날짜로 돌려준다. 지남은 끝나지 않았고 오늘(한국)이 마감일 뒤일 때이고 서버가 센다 | [Google Tasks](https://googleapis.dev/nodejs/googleapis/latest/tasks/interfaces/Schema$Task.html), [Asana](https://developers.asana.com/docs/task), [Linear](https://linear.app/docs/due-dates) | 쉽다. 칸이 시각이라 시각 입력은 화면만 더한다 |
| T3 배정 알림 | 새 담당자에게만. 담당자를 정해 만들 때와 다른 사람으로 바꿀 때 보낸다. 나에게 맡기기, 같은 사람 다시, 비우기, 다른 칸 바꾸기는 없다. 같은 거래에서 알림 기록(`assignment`)을 남기고 커밋 뒤 따로 보낸다 | RFC-7, [Asana 나에게 맡기기](https://community.asana.com/t/notifications-for-tasks-you-assign-to-yourself/22815), [Linear 알림](https://linear.app/docs/notifications), [Jira 알림](https://confluence.atlassian.com/adminjiraserver/creating-a-notification-scheme-938847330.html) | 쉽다 |
| T4 마감 알림 | 보내지 않는다. 내 업무와 옆 메뉴에 '지남'을 빨강으로 보인다 | [Render 무료](https://render.com/docs/free), [Render cron](https://render.com/docs/cronjobs) | 쉽다 |
| T5 권한 | 칸 넷: `task.manage`(만들기·고치기·지우기, 부장 기준과 담당자), `task.set_department`(회장단), `task.assign`(부장 기준), `task.status`(부장 기준과 담당자). 새 기준 '담당자'는 회장단도 물려받지 않는다. 부서 없는 업무의 부장 기준은 회장단이다. 업무마다 할 수 있는 동작(`actions`)을 서버가 준다 | DEC-28, DEC-38, [Jira 권한](https://confluence.atlassian.com/display/JIRA/Managing+Project+Permissions) | 쉽다(코드) |
| 만들기의 '본인' | 담당자가 나여도 부서가 없거나 내 부서일 때만 본인으로 본다(남의 부서 목록에 넣지 않는다) | 옛 프로토타입의 부원 만들기, Jira(만들기와 맡기기 권한이 따로) | 쉽다 |
| T6 담당자 | 이 학생회의 지금 운영진 누구나(부서 상관없음). 떠난 사람의 업무는 담당자를 남긴 채 '담당자 없음' 탭에 '떠난 사람'으로 | DEC-22, DEC-47, [Asana](https://asana.com/inside-asana/new-admin-functionality), [Jira 비활성 사용자](https://support.atlassian.com/jira/kb/how-to-remove-inactive-users-from-the-backlog/) | 쉽다 |
| T7 지우기 | `cancelled_at`을 채우고 204. 목록, 내 업무, 수에서 빠지고 열면 404 | DEC-49, [Asana](https://help.asana.com/hc/en-us/articles/19131320650011-Recover-deleted-tasks-projects-and-more), [Linear](https://linear.app/docs/delete-archive-issues), [MDN 204](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/204) | 쉽다(취소 → 삭제는 나중에 된다) |
| T8 행사 칸 | 계약에 넣지 않는다. 기록 모듈은 행사 칸을 바꾸지 못하게 막는다 | 행사를 만드는 길이 006 | 쉽다 |
| T9 화면 | 옆 메뉴 '업무'에 탭 셋(내 업무, 전체(부서별, '학생회 업무'는 맨 뒤), 담당자 없음(떠난 사람, 부서 없는 업무 포함))과 거르기 둘(끝나지 않은 것, 끝남). 상세는 대화상자 | vada-docs navigation.md '업무', Asana My Tasks, Linear My issues | 쉽다 |
| T10 바꾸기 | 동작마다 자기 칸만 바꾸는 경로(내용, 담당자, 부서, 상태, 지우기). 나중 것이 이긴다. 계약이 다듬은 값이 같으면 판도 알림도 없이 200 | [If-Match](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/headers/If-Match)는 나중 | 쉽다 |
| 상한과 목록 | 제목 100자, 내용 1000자. 끝나지 않은 것은 마감 순(없으면 뒤), 만든 순으로 300개. 끝남은 마지막으로 바뀐 순 50개. 넘치면 `truncated` | 옛 계약, AGENTS.md | 보통(DB CHECK) |
| 속도 제한 | 만들기와 맡기기가 한도 하나를 같이 쓴다. 계정마다 10초에 20번, 넘으면 429 `TOO_MANY_REQUESTS` | 기능 003 보내기와 같은 값, [Slack](https://docs.slack.dev/apis/web-api/rate-limits) | 쉽다 |
| 오류 | 409 `TASK_ASSIGNEE_INVALID`(지금 운영진이 아님), 409 `TASK_DEPARTMENT_INVALID`(이 학생회 부서가 아님). 403이 409보다 먼저다 | [RFC 9110 403](https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden) | 쉽다 |
| 알림 내용 | 제목 "업무를 맡았어요", 본문 "{맡긴 사람}: {제목} · {M}월 {D}일까지"(마감이 없으면 뒤가 없다), tag `task:{업무}`, 대화와 같은 TTL 1일 | [Apple HIG 알림](https://developer.apple.com/design/human-interface-guidelines/notifications), [FCM 보관](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan) | 쉽다 |
| 이력 | 오래된 것부터 모든 판. 내용은 '내용 고침'만, 부서와 사람은 지금 이름, 없앤 부서는 '없앤 부서' | [Jira 이력](https://jira.atlassian.com/browse/JRACLOUD-73076), [GitHub ghost](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-personal-account/deleting-your-personal-account) | 쉽다 |
| 만들기 폼 | 마감 기본은 비움(지표를 부풀리지 않게). 고를 수 있는 부서와 담당자는 서버가 준 권한 목록과 내 부서 직급으로 좁힌다 | Google Tasks·Asana(마감은 선택 칸), DEC-38 | 쉽다 |
| (바꿈) 알림 주소 | `/tasks/{학생회}/{업무}` 경로. 대화의 `chatRoomUrl`·`chatRoomFromPath`처럼 계약에 만들기와 읽기 한 쌍을 두고, `web.ts`의 화면 진입 주소에 더한다. 옛 설계의 `/?council=…&task=…`는 쓰지 않는다 | 기능 003 '알림 누르기'와 지금 `push.ts`, `web.ts` | 쉽다 |
| (바꿈) 권한 묻기 | 학생회 행을 잠근 거래에서 운영진인지 먼저 보고(아니면 대상을 읽기 전에 403), 업무 행을 읽어 그 부서·담당자로 권한표를 묻는다. 대화의 방 참여 확인(`chat/room-access.ts`)과 같은 자리다 | 지금 `inCouncilChange`는 맥락 없이 권한을 묻는다 | 쉽다 |
| (바꿈) 다시 읽기 | 서비스 워커의 `vada:push`에는 주소가 없다. 업무 화면과 옆 메뉴 수는 알림이 오면(어느 알림이든) 다시 읽는다 | 지금 `sw.js`, `lib/service-worker.ts`의 `PUSH_ARRIVED_EVENT` | 쉽다 |

## 위험

- **마이그레이션 둘과 적용 순서.** 새 칸(`0002`, `cancelled_at`)과 이미 있는 칸의 제약·기본값(`0003`, 제목·내용·상태 CHECK와 상태 기본값)을 두 파일로 나눈다(AGENTS.md). 적용 스크립트는 남은 것을 모두 거래 하나로 적용하므로(`ops/migrate/migrate.ts:29`, drizzle-orm `pg-core/dialect.js:60`) 둘을 함께 적용한다. '코드 먼저'가 지키려는 것(확인과 적용 사이에 위반 행이 쓰이지 않게)은 지켜진다. 2026-10-21 main(1fc26c6)에서 `apps` 전체를 `INSERT INTO task|UPDATE task|insert\(task\)|update\(task\)|kind: 'task'`로 찾으면 `task`에 쓰는 것은 시험 한 줄(`team/departments.test.ts:199`, 상태 `'open'`)뿐이다. 차례: 조각 1이 main에 오른다 → 진행 에이전트가 그날 main에서 grep을 다시 돈다 → 두 DB에서 위반 0건(`status NOT IN ('todo','in_progress','done') OR char_length(title) > 100 OR char_length(body) > 1000`) → 미리 보기가 2개 → dev → production → 그다음에 조각 2(`cancelled_at`을 읽는 첫 코드)를 올린다. dev에 적용한 뒤 `.sql`을 고치면 production 적용이 기록 불일치로 멈추므로 검토가 끝난 뒤 적용한다. grep에 쓰는 코드가 나오면 `0003`은 배포 뒤에 따로 만든다.
- **권한과 학생회 격리.** 부서와 담당자는 바뀌는 참조라 DB가 같은 학생회인지 막지 못한다. 지금 기록 모듈은 같은 학생회를 만들 때만 보고(`same-council.ts`), 모든 종류에 걸리는 주인 칸에 `departmentId`가 있어 업무의 부서 바꾸기를 막는다. 조각 1이 업무만 부서·담당자 바꾸기를 열고, 바꿀 때도 같은 학생회를 다시 본다. 업무 쓰기는 모두 학생회 행을 먼저 잠근다(직급·부서 변경과 한 줄로 선다). 401·403·404 경로, 다른 학생회 사람, 거르기를 지우면 시험이 실패하는지(자주 잡힌 것 4, 6, 11)를 조각마다 본다.
- **속도 제한.** 서버 메모리에 계정마다 센다. Render 인스턴스가 하나일 때만 맞다(기능 003과 같다).
- **뒤에서 보내는 알림.** 커밋 뒤 메모리에서 한 번 보낸다. 재시작 중이면 사라지고 알림 기록과 내 업무에는 남는다. 실패는 `push_send_failed` 한 줄이다. 운영진 → 로그인 계정 찾기는 대화 알림(`chat/notify.ts`)과 같은 일이라 공유 도우미로 옮긴다(자주 잡힌 것 9).
- **새 라우트 모듈** `tasks`: `AppOptions.tasks`로만 잇고 `boundary.test.ts`가 검사한다(변경 경로 여섯). **새 화면 진입 주소** `/tasks/:council/:task`: 화면은 같은 사이트, uuid, 내 학생회일 때만 연다.
- **개인정보.** 업무 제목과 내용에 이름·연락처가 적힐 수 있고 지운 업무도 남는다. 로그와 Sentry에 제목, 내용, 운영진 번호를 넣지 않는다. 잠금 화면에 제목이 보인다. 보관 기간은 처리방침(006)에서 정한다.
- **기능 003 기기 확인이 아직이다**(`docs/device-checks.md`에 '대화와 알림' 절이 없다). 003은 알림이 안 오면 004의 배정 알림을 미룬다고 적었다. 조각은 멈추지 않고, 닫기의 기기 확인을 003 확인과 함께 한다.

## 조각

1 → 2 → 3 → 4는 서버라 차례로 한다. 5는 3이 main에 오른 뒤 4와 함께 해도 된다(파일이 겹치지 않는다). 6은 4가, 7은 6이 main에 오른 뒤 시작한다.

### 1. 표, 기록 종류, 권한 칸 [x]
- 할 수 있게 되는 것: 서버가 업무 기록을 학생회 경계와 판 규칙 안에서 만들고 바꾸며, 업무 권한을 묻는다.
- 수용 기준: 101자 제목(이모지), 1001자 내용, 정하지 않은 상태(`'open'`)는 DB가 거절하고 100자와 1000자는 받는다. 상태 없이 넣으면 할 일이다. 업무를 만들면 판 1, 부서·담당자·상태·취소 시각을 바꾸면 판이 하나씩 는다. 다른 학생회의 부서나 운영진으로 만들거나 바꾸면(drizzle 이름과 DB 칸 이름 모두) 실패하고 하위 행과 판이 그대로다. 떠난 운영진으로 바꾸기는 모듈이 막지 않는다. 업무의 행사 칸과 다른 종류의 부서 칸은 여전히 바꿀 수 없다. 업무에 배정 알림 기록을 만들 수 있고 다른 학생회 사람에게는 실패한다. 권한표는 '정한 것' T5와 같고, 담당자 기준은 맥락의 담당자가 나일 때만 맞다. 내 권한 목록에서 회장단은 업무 넷을 받고 부장과 직급 없는 운영진은 받지 않는다. `check:design`이 설계와 같다고 낸다.
- 닿는 곳: `apps/api/migrations/0002_*.sql`·`0003_*.sql`과 journal, `db/schema-work.ts`, `db/baseline.test.ts`(journal 넷), `team/departments.test.ts`(상태 값), `records/records.ts`, `records/same-council.ts`, `access/permissions.ts`, contracts `permissions.ts`. `docs/superpowers/specs/2026-10-19-rebuild-design.md` 덩어리 표의 4줄(학생회 업무(부서 업무 포함), 지우기(DEC-49), 행사와 잇기는 6에서)과 6줄(행사 업무: 행사 칸, 행사 책임자 기준, 행사 업무 탭, 만들기의 행사 고르기).
- 검토: 깊게. 마이그레이션: 있음(새 칸 하나, 이미 있는 칸의 제약과 기본값). 올린 뒤 '위험'의 차례로 두 DB에 적용한다.

### 2. 업무 읽기 [x]
- 할 수 있게 되는 것: 운영진이 업무 목록 셋과 업무 하나(이력, 할 수 있는 동작)를 API로 읽는다.
- 수용 기준: `view=mine`은 나에게 맡긴 것, `all`은 지운 것만 뺀 모두, `unassigned`는 담당자 없음·떠난 담당자(`current: false`)·부서 없는 업무다. `status=open`(기본)과 `done`의 순서와 개수, `truncated`는 '정한 것'대로다. 모르는 키, 틀린 값, 같은 키 두 번은 400 `INVALID_INPUT`. 마감일 당일 한국 23:59:59는 지남이 아니고 다음 날 00:00은 지남이다(±1초), 끝남은 지나도 아니다. 업무 하나는 내용, 만든 사람, 판마다 바뀐 칸(판 1은 '만듦')을 준다. 줄마다 `actions`가 그 사람의 권한과 같다. 다른 학생회 업무는 목록에 없고 열면 404, 지운 업무와 형식이 틀린 번호도 404, 운영진이 아니면 403, 로그인하지 않으면 401, 내보낸 사람의 다음 요청은 403이다. JSON은 `no-store`다.
- 닿는 곳: contracts `tasks.ts`(새: 상태·상한·목록 상수, `TaskListQuerySchema`, `TaskSummary`, `TaskDetail`, `TasksResponse`, `TaskResponse`). `apps/api/src/tasks/`(새: `routes.ts`의 `createTaskRoutes`, `queries.ts`, `due.ts`), `app.ts`, `serve.ts`, `http/boundary.test.ts`. 경로는 `/api/organizations/:councilId/` 아래 `GET tasks`, `GET tasks/:taskId`.
- 검토: 깊게. 마이그레이션: 없음(1의 적용 뒤에 올린다).

### 3. 만들기, 고치기, 상태, 지우기 [x]
- 할 수 있게 되는 것: 권한 있는 운영진이 업무를 만들고, 제목·내용·마감을 고치고, 상태를 바꾸고, 지운다.
- 수용 기준: 회장단은 아무 부서나 학생회 업무를, 부장은 자기 부서 업무를, 누구나 부서가 없거나 내 부서인 자기 업무를 만든다(201, 판 1, 할 일). 부장의 학생회 업무, 부원의 남 업무, 내 부서가 아닌 부서의 자기 업무는 403이고 기록이 없다. 다른 학생회 부서는 409 `TASK_DEPARTMENT_INVALID`, 내보낸 사람이나 다른 학생회 사람을 담당자로 하면 409 `TASK_ASSIGNEE_INVALID`. 담당자와 부장은 고치고 상태를 어느 쪽으로든 바꾸고, 다른 부원은 403이다. 같은 값(앞뒤 공백, 대문자 번호 포함)이면 판이 늘지 않는다. 지우면 204이고 다시 열거나 지우면 404, 판과 알림 기록은 남는다. 응답은 거래 안에서 만든다. 계정마다 10초에 21번째 만들기는 429이고 다른 사람은 막히지 않는다. 학생회 행 잠금이 업무 행 읽기보다 먼저다. AGENTS.md의 입력 경우를 모두 시험한다.
- 닿는 곳: contracts `CreateTaskSchema`, `UpdateTaskSchema`, `ChangeTaskStatusSchema`, `errors.ts`. `tasks/service.ts`(새), `tasks/routes.ts`. 경로는 `POST tasks`, `POST tasks/:taskId`, `POST tasks/:taskId/status`, `POST tasks/:taskId/delete`.
- 검토: 깊게. 마이그레이션: 없음.

### 4. 맡기기, 부서 정하기, 배정 알림 [x]
- 할 수 있게 되는 것: 부장이 사람을, 회장단이 부서를 정하고, 맡은 사람의 휴대폰에 알림이 간다.
- 수용 기준: 그 부서 부장과 회장단은 지금 운영진 누구에게나 맡기고 비운다. 담당자와 부원은 403, 떠난 사람과 다른 학생회 사람은 409이고 판이 없다. 회장단만 부서를 정하고 비운다(부장 403). 담당자는 그대로다. 담당자를 정해 만들거나 다른 사람으로 바꾸면 같은 거래에 배정 알림 기록 하나가 생기고, 커밋 뒤 새 담당자의 기기마다 한 번 '정한 것'의 내용과 주소 `/tasks/{학생회}/{업무}`로 알림이 간다. 나에게 맡기기, 같은 사람 다시, 비우기, 부서·상태·내용 바꾸기, 지우기, 실패한 쓰기는 알림도 기록도 없다. 이전 담당자는 받지 않는다. 응답은 알림을 기다리지 않는다(끝나지 않는 보내기로 시험한다). 알림 열쇠가 없어도 업무와 알림 기록은 생긴다. 만들기와 맡기기가 한도 하나를 같이 쓴다. 로그에 제목, 내용, 운영진 번호, 구독 주소가 없다. `/tasks/{학생회}/{업무}`를 열면 화면 진입점이 온다.
- 닿는 곳: contracts `AssignTaskSchema`, `SetTaskDepartmentSchema`, 업무 주소 한 쌍(`push.ts`). `tasks/service.ts`, `tasks/routes.ts`, `tasks/notify.ts`(새), 운영진 → 로그인 계정 찾기 공유(`chat/notify.ts`에서 꺼낸다), `push/fanout.ts`, `serve.ts`, `web.ts`. 경로는 `POST tasks/:taskId/assignee`, `POST tasks/:taskId/department`.
- 검토: 깊게. 마이그레이션: 없음.

### 5. 업무 화면: 목록, 카드, 옆 메뉴 [x]
- 할 수 있게 되는 것: 운영진이 옆 메뉴 '업무'에서 내 업무와 전체를 보고 카드에서 상태를 바꾼다.
- 수용 기준: 옆 메뉴 '대화' 아래 '업무'에, 내 업무 중 지난 것이 있으면 "지남 N"(danger), 없으면 남은 수(info), 0이면 배지가 없고, 넘치면 '+'다. 탭 셋과 거르기 둘이 있다. 전체와 담당자 없음은 부서 이름순으로 묶고 '학생회 업무'를 맨 뒤에 둔다. 카드에 제목(`wrap-anywhere`), 마감("10월 25일", "마감 없음"), '지남', 상태 배지, 담당자("담당자 없음", "떠난 사람: 이름")가 보인다. `task.status`가 있을 때만 [시작]·[끝내기]가 보이고 보내는 동안 막힌다. 빈 목록, 넘침, 불러오기 실패 문구가 있다. 탭을 바꾸면 늦게 온 응답을 버린다. 화면이 다시 보일 때, 내 변경 뒤, 알림이 오면 다시 읽는다. 403이면 학생회를 닫는다. 알림이 꺼져 있으면 업무 화면에도 업무에 맞는 문구의 띠가 보인다. 부품 확인 화면에 카드와 수 배지가 있다. 390px과 데스크톱으로 확인한다.
- 닿는 곳: `apps/web/src/tasks/`(새), `workspace/`(`pages.ts`, `SidebarNav.tsx`, `WorkspaceContent.tsx`, `CouncilWorkspace.tsx`), `push/PushOffBand.tsx`, `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 6. 업무 상세와 만들기 [x]
- 할 수 있게 되는 것: 운영진이 업무를 만들고, 상세에서 상태·부서·담당자·내용을 바꾸고 지우며 이력을 본다.
- 수용 기준: 상세는 제목, 상태, 마감, 담당 부서, 담당자, 내용, 이력 차례다. `actions`에 따라 상태 버튼 셋, 부서 [바꾸기], 담당자 [바꾸기](그 부서 부서원을 먼저), [고치기], [지우기]가 보이거나 숨는다. 지우기는 확인을 거친다. 이력 줄은 "이름 · 10월 20일 14:03 · 상태 할 일 → 진행 중" 꼴이다(한국 자정 ±1초). 만들기 폼은 회장단이면 모든 부서와 '학생회 업무', 모든 지금 운영진과 '담당자 없음'을 고르고, 그 밖은 내 부서들과 '학생회 업무'를 고르며 고른 부서의 부장이면 모든 운영진을, 아니면 '나'만 고른다. 마감은 비어 있다. [만들기]는 계약 `safeParse`로 켠다. 두 번 누름이 막힌다. 바꾸는 중 업무가 지워지거나(404) 권한을 잃으면(403) 대화상자를 닫고 이유를 보인다. 409와 429 문구가 동작 옆에 보인다.
- 닿는 곳: `apps/web/src/tasks/`(상세·만들기 대화상자, 폼 선택지 계산), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

### 7. 알림을 누르면 그 업무가 열린다 [x]
- 할 수 있게 되는 것: 배정 알림을 누르면 그 학생회의 업무 화면과 그 업무 상세가 열린다.
- 수용 기준: 앱이 닫혀 있어 `/tasks/{학생회}/{업무}`로 열리든, 열린 창에 서비스 워커가 그 주소를 알리든 그 업무 상세가 열리고 주소는 맨 앞으로 돌아간다. 같은 업무를 다시 눌러도 다시 열린다. 내 학생회가 아니거나, 다른 사이트이거나, 번호가 uuid가 아니면 아무것도 바뀌지 않는다. 지운 업무면 "이 업무를 볼 수 없어요. 지워졌을 수 있어요."가 보인다. 방 주소의 기존 시험은 그대로 통과한다.
- 닿는 곳: `workspace/useChatLink.ts`(방이나 업무를 읽게 넓힌다), `workspace/pages.ts`, `App.tsx`, `auth/SignedInView.tsx`, `councils/MyCouncils.tsx`, `workspace/CouncilWorkspace.tsx`, `apps/web/src/tasks/`. `public/sw.js`는 고치지 않는다.
- 검토: 깊게(주소와 이동). 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 진행 에이전트가 사람에게 아래 기기 확인을 맡기고, 결과(날짜, 기기, OS, 브라우저, 단계마다 됨·안 됨과 보인 것)를 `docs/device-checks.md`의 새 절 '업무'에 옮긴다. 기능 003의 기기 확인이 아직이면 함께 한다. 1이나 4에서 알림이 오지 않으면 원인을 찾을 때까지 닫지 않는다.

기기 확인. A는 아이폰 홈 화면 앱(회장), B는 갤럭시 Chrome(기획부 부장)이고 둘 다 알림을 켠다. 먼저 데스크톱 Chrome에서 업무를 만들고 상태를 바꾸고 지운다.

1. B가 앱을 닫고 잠근다. A가 기획부 업무를 마감과 함께 만들며 B에게 맡긴다 → B의 잠금 화면에 "업무를 맡았어요 / A: 제목 · 10월 25일까지". 안 오면 Render 로그의 `push_send_failed`, 그 업무의 `assignment` 기록, B의 기기 줄을 본다.
2. B가 앱을 완전히 닫은 채 그 알림을 누른다 → 그 학생회의 업무 화면과 그 업무 상세가 열린다. 첫 화면만 열리면 기능 003 기기 확인 7의 대안이 업무 주소에도 도는지 본다.
3. B가 상세에서 '진행 중', 카드에서 [끝내기]를 누른다 → 상태가 바뀌고 옆 메뉴 수가 준다. A에게 알림이 없다.
4. A가 앱을 닫고 잠근다. B가 기획부 업무를 만들며 A에게 맡긴다 → A(아이폰)의 잠금 화면에 알림.
5. A가 앱을 대화 화면에 둔 채 그 알림을 누른다 → 업무 화면과 그 업무 상세로 바뀐다.
6. A가 1의 업무를 자기에게 맡겼다가 다시 B에게 맡긴다 → A에게는 없고 B에게 온다. B는 그 알림을 누르지 않고 둔다.
7. B가 B에게 맡겨진 그 업무를 다시 B에게 맡긴다 → 알림이 없다.
8. A가 1의 업무를 지운 뒤 B가 6의 알림을 누른다 → "이 업무를 볼 수 없어요. 지워졌을 수 있어요."

지표와 회고 세 줄은 이 아래에 적는다.

### 지표(2026-10-21, `.superpowers/sdd/004/metrics.md`)

- 기능 리드타임: 명세 시작 08:29 → 마지막 조각 main 13:16, 약 4시간 47분(상한 6시간의 80%). 배포 live 13:23.
- 조각 리드타임: 평균 58분, 중앙값 44분(7조각, 가지 첫 커밋 → main).
- 검토: 판정 12번 중 fix 4번(33%, 기능 3은 44%), Important 6건, Critical 0. 다시 올린 가지 6개.
- 배포: 기능 커밋이 든 main 푸시 8번과 배포 뒤 확인의 버그 고치기 1번. 마이그레이션 2개(0002, 0003)를 두 DB에 적용. 실제 PostgreSQL 점검에 업무 동시 처리 두 경우를 더해 모두 통과.
- 막힌 것: 학교 망이 5432를 막아 마이그레이션과 점검을 두 번 핫스팟으로 했다(기다림 약 2분). 위반 행 수는 Neon HTTP(443)로 먼저 읽었다.

### 회고

- 그대로 둘 것: 조각 N을 검토하는 동안 N의 가지 위에서 N+1을 만들었다. 5432가 막혔을 때도 가지를 쌓아 만들고 검토해 망이 열리자 바로 올렸다. 마이그레이션은 '새 칸을 읽는 코드보다 먼저'를 지켜 조각 1만 먼저 올리고 적용한 뒤 조각 2를 올렸다.
- 바꿀 것: 연결 시험이 없다는 지적이 조각 3(잠금 순서), 5(배지·알림 띠·다시 읽기), 6(대화상자 잇기)에서 되풀이됐다. 떠난 사람이나 없는 값이 처음 값일 때의 처리도 조각 4와 6에서 나왔다. 둘을 '자주 잡힌 것' 14, 15에 더했다.
- 다음에 시험할 것: 화면 확인을 닫을 때만 하니 탭 줄의 스크롤 막대(부품의 `-mb-px`와 부모의 overflow)를 마지막에 찾았다. 화면 조각의 검토 지시에 "부품 주석의 조건을 지키는지"를 넣어, 배포 뒤 확인에서 나오는 화면 결함이 줄어드는지 본다.
