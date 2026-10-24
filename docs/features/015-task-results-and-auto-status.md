---
독자: 에이전트
---

# 015 업무 결과물과 저절로 바뀌는 업무 상태

> 만들 때의 명세다. 지금의 규칙은 vada-docs `decisions/`와 `logical-model.md`, 동작은 코드가 원문이다(DEC-77).

상한: 6시간(실제로 도는 시간). 시작 2026-10-24 23:51. 양식은 `docs/work-method.md`를 따른다. 가지는 `work/015-조각번호`, 진행 기록은 `.superpowers/sdd/015/progress.md`. 012(`docs/features/012-event-registration-policy.md`)가 main에 오른 뒤 시작한다(그 `<도메인>/policy.ts` 모양을 업무에 쓴다).

## 왜

운영진이 업무 상태를 손으로 바꿔야 해서 상태가 실제와 어긋난다(노션·GitHub로 팀 일을 관리하다 실패한 가장 큰 까닭, DEC-82 맥락). 이 기능은 업무에 결과물(구매 요청, 신청 양식, 공지, 행사)을 잇고, 결과물에 일이 생기면 업무 상태를 앞으로 한 번 옮긴다. 사람은 늘 손으로 바꿀 수 있다. 함께 업무 상태 규칙을 서버 한 곳으로 모으고, 담당자가 남이 맡긴 업무를 지우는 결함(DEC-73, 구조 점검 N3)을 고친다.

- 근거: DEC-82(결과물, 규칙 표 한 곳, 앞으로만 한 번, 바꾼 사람 없이 까닭), `logical-model.md` RULE-41과 표 '업무 결과물', DEC-39(상태 셋), DEC-73(담당자는 자기가 만든 업무만 지운다), DEC-38(화면은 권한·상태를 다시 계산하지 않는다), DEC-68(요청의 행사는 낼 때 정함), 구조 점검 `notes/structure-audit/gap1-state.md` '자동 전환'과 N3, 같은 폴더 `plan.md`('늦어지면 업무 자동 전환 → 구매만').
- 이미 있는 것: 기록 쓰기 한 통로 `apps/api/src/records/records.ts`(`createRecord`, `updateRecords`, 판의 `changed_by`·`reason`), 업무 서비스 `tasks/service.ts`·`actions.ts`·`history.ts`, 권한표 `access/permissions.ts`(`task.manage`가 고치기와 지우기를 겸함), 웹의 상태 다음 단계 `apps/web/src/tasks/task-view.ts`의 `NEXT_STEP`(서버는 셋 중 아무 값이나 받는다), 요청 상태 셈 `purchases/status.ts`, 행사 완료 `settlement/complete.ts`(결재 기록 `completed`), 공지 `chat/notice.ts`(전체방 메시지의 `is_notice`), 대화에서 요청 만들기(011), 모든 직원 쓰기가 학생회 행을 먼저 잠그는 거래(`access/authorize.ts`의 `inCouncilChange`).

### 원칙 대조

- 새로 하는 입력: 없다. 업무 상세의 '○○ 만들기'는 원래 하던 만들기를 업무 옆에서 여는 것이고(제목·행사가 업무에서 채워진다), 대화에서 요청을 낼 때 업무 고르기는 선택이다. 상태를 손으로 옮기던 일이 줄어 지금 그 사람에게 이득이다(PRIN-1).
- 근거 연결: 결과물과 업무의 연결은 만드는 그 거래에서 저절로 생긴다. 사람이 나중에 잇지 않는다.
- 변경 이력: 저절로 바뀐 상태는 업무 판에 바꾼 사람 없이(`changed_by` 비움) 까닭 코드와 함께 남고, 이력에 '저절로: 구매 요청 냄'처럼 보인다. 연결은 기록이 아니라 판이 없고, 떼지 않는다.

## 범위 밖

- 문서(기획안, 결과보고서) 결과물(DEC-82, RFC-7 '이번엔 안 함'), 시간이 지나 바뀌는 상태(양식 마감 등, 주기 작업), 사용자가 규칙을 만드는 화면(규칙은 코드의 표 하나).
- 이미 있는 결과물을 나중에 잇기·떼기, 결과물에서 업무로 가는 표시와 이동(주소 기능 016 뒤), 결과물 줄을 눌러 그 상세로 가기, 저절로 바뀔 때 알림, 업무를 메시지에서 만들기, 상태를 뒤로 저절로 되돌리기.

## 정한 것

| 무엇 | 정한 것 | 근거(주소) | 되돌리기 |
|---|---|---|---|
| 표 | 연결 표 `task_result`(`task_id` → task, `result_id`, `result_kind`). 기록이 아니다. PK (`task_id`, `result_id`), UNIQUE `result_id`(결과물 하나는 업무 하나에만), (`result_id`, `result_kind`) → record(id, kind), `result_kind` CHECK IN ('request', 'registration_form', 'message', 'event'). 만든 시각·사람은 두지 않는다(결과물 기록의 만든 사람·시각이 같다). 같은 학생회인지는 앱이 본다(`records/same-council.ts`) | logical-model '업무 결과물', AGENTS.md '마이그레이션'(연결 표, 여러 종류를 가리키는 칸), `evidence_link` 선례 | 어렵다(운영 DB의 표·데이터) |
| 상태 규칙 한 곳 | `apps/api/src/tasks/lifecycle.ts`: 상태 차례(할 일 < 진행 중 < 끝남), 사람의 이동(셋 사이 어디로든, 같은 값은 판 없음), 카드의 다음 단계(할 일 → 진행 중 → 끝남, 끝남은 없음), 저절로 이동(목표가 지금보다 앞일 때만 목표로), 까닭 코드 목록. 웹 `NEXT_STEP`은 지우고 업무 응답의 `next`(다음 상태나 null)를 쓴다 | DEC-39, DEC-82, gap1 '자동 전환', [Jira 고급 워크플로](https://confluence.atlassian.com/display/JIRA/Advanced+workflow+configuration)(전이는 워크플로 한 곳) | 쉽다(코드) |
| 업무 정책 | `tasks/policy.ts`를 012의 `<도메인>/policy.ts` 모양(사실 모으기 + 순수 판정)으로 둔다. 업무 응답의 `actions`·`canMake`와 쓰기 경로의 확인이 같은 판정을 부른다 | 012, gap1 대책 B, DEC-38 | 쉽다 |
| 지우기 권한 | 새 동작 `task.delete`(`TASK_ACTIONS`에 더함): 그 부서 부장(회장단 상속), 행사 책임자, 그리고 담당자이면서 만든 사람. `task.manage`는 고치기만. 화면의 지우기 버튼은 `task.delete`로 보인다 | DEC-73, DEC-28(행사 책임자의 이어진 업무 다루기), [Jira 'Delete issues' 권한](https://support.atlassian.com/jira-cloud-administration/docs/manage-project-permissions/) | 쉽다 |
| 진행 단계 | 결과물마다 단계: 없음(살아 있고 일 없음), 진행 중, 끝남, 빠짐(목표 셈에서 뺀다). 요청: 냈으면 진행 중, 품목이 모두 결제(취소 안 한 지출에 결제 내역)·반려·취소(결재 기록 `cancelled`, 014가 더하면)면 끝남, 요청을 취소했으면 빠짐. 신청 양식: 있으면 끝남. 공지: 공지 표시가 있으면 끝남, 떼었거나 지웠으면 빠짐. 행사: 완료면 끝남, 아니면 없음. 단계는 도메인마다 낸다(`purchases/`, `registrations/`, `chat/`, `events/`의 단계 셈, 읽기만) | RULE-41, DEC-82(승인만으로는 끝나지 않음), DEC-73(취소), gap1 '결과물별 progressOf는 각 도메인이' | 쉽다 |
| 요청 취소 | 낸 사람이 결재 전에 요청을 취소하면 끝남으로 보지 않고 빠짐이다(새 요청을 다시 낼 일이라). 업무는 그대로 둔다 | DEC-82(품목의 결제·반려·취소만), 앞으로만 | 쉽다 |
| 결과물이 여럿 | 업무의 목표 = 빠지지 않은 결과물 단계 가운데 가장 낮은 것. 모두 끝나야 끝남 | [Linear GitHub 연동](https://linear.app/docs/github)("final linked PR moves to the required state"), DEC-82 맥락 | 쉽다 |
| 한 번 | 쓰기 하나가 어떤 결과물의 단계를 올렸을 때만 그 업무의 목표를 다시 세고, 목표가 지금 상태보다 앞이면 옮긴다. 단계가 그대로이거나 내려간 쓰기(감사 결재, 지출 취소, 완료 취소)는 아무것도 하지 않는다. 그래서 사람이 그 뒤에 바꾼 상태를 덮지 않는다. 쓰기 전후 단계를 같은 거래에서 견주고, 표에 칸을 더하지 않는다. 지출 취소 뒤 다시 결제처럼 단계가 다시 오르면 새 일로 본다 | RULE-41, [GitHub Projects 기본 자동화](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)(사건 때 옮김) | 쉽다 |
| 맞추는 곳 | `records.ts`의 `createRecord`·`updateRecords`가 쓰기 끝에 한 모듈(`tasks/result-sync.ts`)을 부른다. 서비스·라우트는 부르지 않는다. 그 모듈은 `records.ts`를 import하지 않는다(순환 금지, 업무 판 쓰기는 인자로 받는다). 결과물 종류에 닿지 않는 쓰기와 이어진 업무가 없는 결과물은 쿼리 하나 안에서 끝난다. 취소했거나 끝난 업무는 옮기지 않는다 | gap1 '동기화 고리는 records.ts 한 곳', 지시 | 쉽다 |
| 이력 | 저절로 바뀐 판은 `changed_by` 비움, `reason`에 까닭 코드(`request_submitted`, `request_finished`, `form_created`, `notice_posted`, `event_completed`). `TaskVersion`에 `cause`(코드나 null)를 더하고 화면이 '저절로: 구매 요청 냄' 등으로 옮긴다. 글이 아니라 코드라 문구를 나중에 바꿔도 옛 판이 따라간다 | DEC-82, [Jira 자동화 actor](https://support.atlassian.com/jira-software-cloud/docs/what-is-a-rule-actor/)(이력에 'Automation for Jira'로 남음) | 보통(쌓인 판의 코드 값) |
| 잇는 길 | 만들기 계약에 `taskId`(선택): `CreatePurchaseRequestSchema`, `CreateFormSchema`, `CreateEventSchema`, 공지는 `SendMessageSchema`에 `notice`(참)과 `taskId`(전체방, `chat.notice`만, `notice` 없이 `taskId`면 400). 만드는 거래에서 결과물과 연결을 함께 쓰고 그때 단계가 오른 것으로 본다(요청 → 진행 중, 양식·공지 → 끝남, 행사 → 없음) | DEC-82('업무 안에서 만들면 저절로 이어진다', 배정할 때 고르게 하지 않음), 011 `sourceMessageId` 선례 | 쉽다(선택 칸) |
| 이을 수 있는 업무 | 이 학생회의, 취소하지 않았고 끝나지 않은 업무이고, 만드는 사람이 그 업무에 `task.status`가 있다. 아니면(다른 학생회, 없는 번호, 취소·끝남, 권한 없음) 모두 409 `TASK_INVALID`이고 아무것도 생기지 않는다. 결과물 자체의 권한(403)이 먼저다 | 011 `MESSAGE_INVALID` 방식, 남의 업무 상태를 옮기지 않게 | 쉽다 |
| 만들기 버튼 | 업무 상세의 `canMake`(서버가 셈): 위 조건 + 요청 `purchase.request`, 양식은 업무에 행사가 있고 그 행사에 `registration.manage`(그 행사에 만든다), 공지 `chat.notice`, 행사 `event.create`. 요청은 제목·행사를 업무에서 채운다. 만든 행사를 업무의 행사로 바꾸지 않는다(권한 맥락이 바뀐다) | DEC-38, DEC-28, PRIN-1 | 쉽다 |
| 대화에서 고르기 | 011의 메시지 메뉴 '구매 요청 만들기' 대화상자에 '업무(선택)': 내 업무(`view=mine`, 끝나지 않음) 가운데 `actions`에 `task.status`가 있는 것. 기본은 고르지 않음 | 지시, NN/g 기본값 | 쉽다 |

## 위험

- **새 표(깊게).** AGENTS.md '마이그레이션': `db:generate`로 빈 파일을 만들어 SQL을 쓰고 `src/db/schema.ts`를 같이 고친다. 새 표만 더하므로 마이그레이션을 두 DB에 먼저 적용한 뒤 그 표를 읽는 코드를 배포한다(진행 에이전트가 개발 DB 적용, 운영은 main CI). `ops/migrate`의 public 표 수 시험(`migrate-check.test.ts` 55 → 56, `migrate-run.test.ts`)을 같이 고친다. 마이그레이션은 조각 2 하나에만 있다.
- **vada-docs 반영(진행 에이전트).** 같은 때에 `logical-model.md` RULE-41에 "결과물이 여럿이면 빠지지 않은 것 모두가 그 단계일 때, 요청 취소는 빠짐"을 더하고, '이름 대응'에 `task_result`를 적는다(DEC-77). 이 명세는 그 문서를 고치지 않았다.
- **모든 쓰기에 걸리는 고리(깊게).** `records.ts`는 모든 쓰기의 통로라, 고리의 실패가 모든 쓰기를 깬다. 결과물 종류가 아닌 쓰기는 일을 하지 않는지 시험하고, 기존 기록 시험(`records/*.test.ts`)이 그대로 통과해야 한다. 업무 판을 쓰는 것이 다시 고리를 부르지만 업무는 결과물 종류가 아니라 돌지 않는다(시험으로 굳힌다).
- **동시 처리(깊게).** 재정부원 둘이 같은 요청의 다른 품목을 동시에 결재하면 각 거래가 상대 쓰기를 못 봐 끝남을 놓칠 수 있다. 직원 쓰기는 학생회 행 잠금으로 한 줄로 서므로 막히지만, 그 잠금 없이 쓰는 경로(공개 신청, 주기 작업 `purge/run.ts`)가 단계를 바꾸지 않는지 확인한다. 조각 3 배포 뒤 진행 에이전트가 `pg-smoke`에 두 결재가 겹치는 경우를 더해 돌린다.
- **012·014와의 차례.** 012의 policy 모양을 먼저 본다(없으면 조각 1이 그 모양을 따라 만들고 012가 맞춘다). 품목 취소(DEC-73)는 014가 더한다. 단계 셈은 품목 상태 셈 한 곳(`purchases/status.ts`)을 거쳐, 취소가 더해지면 저절로 끝남에 든다.
- **새 라우트 모듈 없음, 비밀 값·의존성 없음.** 기존 경로에 칸만 더한다. 새 칸마다 `boundary.test.ts`와 AGENTS.md의 입력 경우를 시험한다. 계약을 바꾸는 조각은 contracts·web 시험도 돌린다(011 회고).
- **와이어프레임.** Figma(`B5OHqrl9bbvXCUkhME4Sfo`)의 업무 상세 노드를 보지 못했다. 화면 조각에서 비교한다.

### 사람이 시작 전에 할 일

없음.

## 조각

1 → 2 → 3 → 4는 서버라 차례로 한다(같은 고리 모듈을 고친다). 5는 2와 4가, 6은 2가 main에 오른 뒤 시작한다. 시간이 모자라면 4를 빼고 5에서 요청 버튼만 둔다(구매만, `plan.md`).

### 1. 업무 상태 규칙 한 곳과 지우기 권한 [x]
- 할 수 있게 되는 것: 업무의 다음 단계와 할 수 있는 동작을 서버가 한 곳에서 정하고, 담당자는 자기가 만든 업무만 지운다.
- 수용 기준: 업무 목록·상세의 줄마다 `next`가 할 일이면 진행 중, 진행 중이면 끝남, 끝남이면 null이고 카드의 [시작]·[끝내기]가 이것으로 보인다. 상태 바꾸기는 셋 중 어디로든 되고 같은 값이면 판이 늘지 않는다. 부장이 맡긴 업무의 담당자에게 `actions`에 `task.delete`가 없고 지우기는 403이며 업무가 그대로다. 담당자가 직접 만든 업무, 그 부서 부장, 회장단, 행사 책임자는 지운다(204). 고치기(`task.manage`)는 담당자에게 그대로 된다. 응답의 `actions`와 쓰기 경로가 같은 판정을 쓰고, 판정을 바꾸면 두 시험이 함께 실패한다. 웹에 `NEXT_STEP`이 없다.
- 닿는 곳: contracts `tasks.ts`(`TASK_ACTIONS`에 `task.delete`, `TaskSummary.next`), `permissions.ts`(contracts `Action`), api `tasks/lifecycle.ts`(새), `tasks/policy.ts`(새, `actions.ts` 대신), `tasks/service.ts`, `access/permissions.ts`, web `tasks/task-view.ts`, `TaskRow.tsx`, 지우기 버튼이 있는 상세 부품.
- 검토: 깊게(권한). 마이그레이션: 없음.

### 2. 업무 결과물 표와 구매 요청 잇기(서버) [ ]
- 할 수 있게 되는 것: 업무에서 낸 구매 요청이 그 업무에 이어지고, 할 일이던 업무가 저절로 진행 중이 된다.
- 수용 기준: 요청 내기에 `taskId`를 주면 201이고 같은 거래에 연결 한 줄이 생기며, 할 일이던 업무가 진행 중이 되고 그 판은 바꾼 사람 없이 `cause` `request_submitted`다. 이미 진행 중·끝남이면 판이 늘지 않는다. `taskId`가 없으면 지금과 같다. 다른 학생회·없는·취소·끝난 업무, `task.status`가 없는 업무는 409 `TASK_INVALID`이고 요청·품목·알림·연결이 없다. 같은 요청을 두 업무에 이을 수 없다(DB UNIQUE). 업무 상세에 `results`(종류, 번호, 제목, 단계)와 `canMake`가 있고, 이력의 `cause`가 실린다. 결과물 종류가 아닌 쓰기(업무 고치기, 메시지 보내기)는 업무 판을 늘리지 않는다. 재정부가 대신 낸 요청도 만든 사람 기준으로 잇는다.
- 닿는 곳: `apps/api/migrations/`(새 `task_result`), `src/db/schema.ts`, `ops/migrate/*.test.ts`(표 수), contracts `purchases.ts`, `tasks.ts`(`TaskDetail.results`·`canMake`, `TaskVersion.cause`), `errors.ts`(`TASK_INVALID`), api `records/records.ts`(고리), `tasks/result-sync.ts`(새), `tasks/results.ts`(새, 잇기·읽기), `purchases/service.ts`, 요청 단계 셈(`purchases/`), `tasks/history.ts`, `tasks/queries.ts`.
- 검토: 깊게(운영 DB, 격리). 마이그레이션: 있음.

### 3. 품목이 모두 끝나면 업무 끝남(서버) [ ]
- 할 수 있게 되는 것: 이어진 요청의 물건을 다 사면(또는 반려되면) 업무가 저절로 끝난다.
- 수용 기준: 이어진 요청의 마지막 남은 품목이 결제(지출 적기)·반려되는 쓰기에서 업무가 끝남이 되고 `cause`는 `request_finished`다. 승인만으로는 바뀌지 않는다. 사람이 끝남을 할 일로 되돌린 뒤 같은 요청에 감사 결재·증빙 붙이기·지출 고치기가 있어도 덮지 않는다. 지출을 취소해 결제가 없어져도 뒤로 가지 않고, 다시 결제해 모두 끝나면 다시 끝남이 된다. 요청을 취소하면 업무는 그대로다. 결과물이 여럿이면 빠지지 않은 것이 모두 끝나야 끝남이다(요청 둘 중 하나만 끝나면 진행 중). 취소한 업무는 바뀌지 않는다. 다른 학생회의 같은 모양 자료로 거르기를 시험한다.
- 닿는 곳: 요청 단계 셈(`purchases/`, `purchases/status.ts`), `expenses/service.ts`(지출 적기·취소가 고리에 닿는지), `tasks/result-sync.ts`, `ops/pg-smoke/`(겹치는 결재 경우, 진행 에이전트가 돌림).
- 검토: 깊게(동시 처리, 돈 기록). 마이그레이션: 없음.

### 4. 신청 양식·공지·행사 잇기(서버) [ ]
- 할 수 있게 되는 것: 업무에서 만든 신청 양식·공지는 업무를 끝내고, 업무에서 만든 행사는 완료하면 업무를 끝낸다.
- 수용 기준: 양식 만들기에 `taskId`를 주면 연결이 생기고 업무가 끝남(`form_created`)이다. 전체방에 `notice: true`로 보내면 공지 표시가 붙은 메시지가 되고(`chat.notice`가 아니거나 전체방이 아니면 403), `taskId`가 있으면 업무가 끝남(`notice_posted`)이다. 공지를 떼면 그 결과물은 빠지고 다시 붙이면 다시 끝남이 될 수 있다. 행사 만들기에 `taskId`를 주면 이어지되 업무는 그대로이고, 그 행사를 완료하는 쓰기에서 끝남(`event_completed`)이다. 완료 취소는 뒤로 가지 않는다. 409 `TASK_INVALID` 경우는 2와 같다. 기존 양식·메시지·행사 시험이 그대로 통과한다.
- 닿는 곳: contracts `registrations.ts`, `chat.ts`(`SendMessageSchema`), `events.ts`, api `registrations/service.ts`, `chat/send.ts`·`routes.ts`, `events/service.ts`, 각 도메인의 단계 셈, `tasks/result-sync.ts`, `http/boundary.test.ts`.
- 검토: 깊게(권한, 대화 보내기 경로). 마이그레이션: 없음.

### 5. 업무 상세의 결과물과 만들기(화면) [ ]
- 할 수 있게 되는 것: 운영진이 업무 상세에서 결과물을 보고 '○○ 만들기'로 바로 만든다.
- 수용 기준: 업무 상세에 '결과물' 묶음이 있고 줄마다 종류·제목·단계('진행 중', '끝남', '취소')가 보이며, 없으면 '결과물 없음'이다. `canMake`에 있는 것만 [구매 요청 만들기]·[신청 양식 만들기]·[공지 만들기]·[행사 만들기]가 보인다. 각 버튼은 지금의 만들기 대화상자를 열고(요청은 제목·행사가 업무에서 채워짐, 양식은 업무의 행사로, 공지는 글 하나), 만들면 업무 상세가 새로 그려져 결과물과 바뀐 상태가 보인다. 이력에 저절로 바뀐 판이 '저절로: 구매 요청 냄' 꼴로 보인다(이름 없는 사람 문구가 아니다). 409 `TASK_INVALID`는 버튼 옆 문구, 403·404는 닫고 이유(자주 잡힌 것 1, `useDialogGuard`), 두 번 누름을 막는다. 390px과 데스크톱으로 확인하고 와이어프레임 업무 상세와 비교한다.
- 닿는 곳: `apps/web/src/tasks/TaskDetailDialog.tsx`, 새 결과물 묶음 부품, `TaskHistory.tsx`·`task-text.ts`, `finance/RequestCreateDialog.tsx`, `events/EventCreateDialog.tsx`, 신청 양식 만들기 부품(`events/FormEditor.tsx` 쪽), 공지 대화상자(새), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통(쓴 `components/ui` 부품의 주석 조건). 마이그레이션: 없음.

### 6. 대화에서 구매 요청을 낼 때 업무 고르기(화면) [ ]
- 할 수 있게 되는 것: 운영진이 메시지에서 요청을 낼 때 내 업무 하나를 골라 잇는다.
- 수용 기준: 메시지 메뉴의 '구매 요청 만들기' 대화상자에 '업무(선택)'가 있고, 내 끝나지 않은 업무 가운데 `task.status`가 있는 것만 나오며 기본은 고르지 않음이다. 고르고 내면 `taskId`가 같이 가고, 그 업무가 진행 중이 된다(업무 화면에서 보인다). 고르지 않으면 지금과 같다. 그사이 업무가 끝났거나 취소되면 409 `TASK_INVALID` 문구가 버튼 옆에 보인다. 재정 화면의 [구매 요청 내기]는 지금과 같다. 390px에서 넘침이 없다.
- 닿는 곳: `apps/web/src/finance/RequestCreateDialog.tsx`·`request-form.ts`, `chat/MessageItem.tsx`, `tasks/useTasks.ts`(내 업무 읽기), `lib/messages.ts`, `ui-gallery/`.
- 검토: 보통. 마이그레이션: 없음.

## 닫기

마지막 조각을 배포한 뒤 사람에게 기기 확인을 맡기고 `docs/device-checks.md`의 새 절 '업무 결과물'에 옮긴다. A는 기획부 부원(아이폰), B는 기획부장, C는 재정부원(갤럭시).

1. B가 A에게 '현수막 사기'를 맡긴다. A의 상세에 [지우기]가 없다.
2. A가 그 업무 상세에서 [구매 요청 만들기] → 제목이 채워져 있다 → 낸다 → 업무가 진행 중이고 이력에 '저절로'가 보인다.
3. C가 승인 → 업무는 진행 중 그대로. C가 결제(지출 적기) → 업무가 끝남.
4. A가 끝남을 할 일로 되돌린다 → C가 그 지출에 증빙을 붙여도 할 일 그대로다.
5. 회장단이 다른 업무에서 [공지 만들기]로 올린다 → 업무가 끝남이고 대화 전체방에 공지가 있다.
6. A가 대화의 메시지에서 구매 요청을 만들며 업무를 고른다 → 그 업무가 진행 중이다.

지표와 회고 세 줄은 이 아래에 적는다.
