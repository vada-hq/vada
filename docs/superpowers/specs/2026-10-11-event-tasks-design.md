# M4 행사 업무·일정 설계

2026-10-11. M3까지 행사마다 대화, 구매, 참가 신청, 재정이 생겼다. 하지만 행사 준비의 할 일(현수막, 장소 대관, 심사위원 섭외)은 아직 카톡 공지나 노션 표로 나눈다. 누가 무엇을 언제까지 하는지 VADA 안에서는 보이지 않는다.

M4는 행사마다 업무를 둔다. 업무에는 담당 부서, 담당자 한 명, 마감일, 상태가 있다. 행사 "업무" 탭은 업무를 상태별 보드와 날짜순 일정 두 가지로 보여 준다. 일정에는 행사 일시와 참가 신청 마감도 자동으로 들어간다. "내 업무"는 여러 행사에서 내가 맡은 업무를 한곳에 모으고, 앱을 열면 가장 먼저 보인다.

## 왜 이렇게

2026-10-11에 사용자가 아래 비판과 범위를 승인했다.

- **"검토 필요" 상태를 뺀다.**
  - 와이어프레임 보드는 예정·진행 중·검토 필요·완료 네 열이다. 하지만 검토할 사람을 정하는 칸이 없다.
  - 내 업무(MY-01)에서는 같은 "검토 필요"가 "검토 의견을 확인하고 처리 내용을 기록"하라는 담당자의 일로 나온다. 누가 움직여야 하는지 알 수 없다.
  - 검토가 필요하면 검토자에게 맡긴 업무로 따로 만든다.
  - Notion 상태 속성도 할 일·진행 중·완료 세 묶음을 고정해 둔다([Notion](https://www.notion.com/en-gb/help/guides/status-property-gives-clarity-on-tasks)).
- **담당자는 한 명이다.** 여러 명이 맡으면 서로 미루다 아무도 하지 않는다. Asana는 이 이유로 담당자를 한 명만 둔다([Asana](https://asana.com/resources/why-one-assignee)).
- **끌어 옮기기 대신 버튼으로 상태를 바꾼다.**
  - WCAG 2.5.7은 칸반 보드를 예로 들며, 끌기 동작에는 끌지 않는 방법도 있어야 한다고 한다([W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging.html)).
  - 휴대폰에서는 끌기가 어렵다. 그래서 끌기는 만들지 않는다.
- **업무와 일정을 탭 하나로 합친다.**
  - 와이어프레임 일정 화면(EVT-SCHED-01)의 줄은 대부분 같은 업무를 날짜순으로 다시 보인 것이다.
  - 그래서 "업무" 탭 안에서 보드와 일정 보기를 고르게 한다.
  - 행사 탭은 대화·업무·구매·참가자·재정 다섯이 되어 375px 폭에 들어간다.
- **업무 상세를 줄인다.** 우선순위, 완료 기준, 예상 결과물, 연결 문서, 업무 번호를 뺀다. 문서 기능이 없고, 완료 기준은 설명에 적으면 된다.
- **알림 대신 첫 화면과 남은 수로 보이게 한다.**
  - M3 범위를 정할 때 업무를 미룬 이유는 둘이었다. 알림이 없으면 업무가 눈에 띄지 않고, 카톡·노션과 겹친다는 것이다.
  - 그래서 학생회를 열면 "내 업무"가 먼저 보이게 한다. 옆 메뉴에는 남은 업무 수를 보인다.
  - 메일·푸시 알림은 보내는 기반부터 만들어야 해서 뺀다.
  - 카톡·노션과 겹치는 부분은 남는다. VADA만의 차이는 행사 일시·신청 마감이 일정에 저절로 들어가고, 구매·재정과 한곳에 있다는 것이다. 그래서 가볍게 만든다.

## 범위

- **넣는다:**
  - 행사 "업무" 탭
    - 보드 보기: 예정·진행 중·완료
    - 일정 보기: 업무 마감일, 행사 일시, 참가 신청 마감을 날짜순으로
    - 요약: D-day, 완료 수, 지연·담당자 없음·내 담당 칩(누르면 거른다)
  - 업무 추가·수정·지우기, 상태 바꾸기, 업무 상세(처리 기록)
  - 내 업무 화면과 옆 메뉴의 남은 수. 학생회를 열면 첫 화면이다.
  - 시연 데이터의 업무
- **넣지 않는다:**
  - 홈 대시보드(HOME-01·01K), 운영 홈(OPS-00), 상시·반복 업무(OPS-TASK-01), 월간 캘린더(OPS-CAL-01)
  - 회의, 문서, 행사 상태(기획 중·후속 정리 중)와 개요 탭, 행사 운영 조직(EVT-01·03)
  - 알림, 끌어 옮기기, 우선순위, 업무 번호, 검토 상태, 댓글

## 정책

1. **업무**
   - 행사 하나에 속한다.
   - 칸: 제목(필수, 100자), 설명(선택, 1,000자), 담당 부서(선택), 담당자(선택, 한 명), 마감일(선택, 날짜), 상태
   - 담당 부서와 담당자는 따로 정한다. 담당자가 그 부서 사람이 아니어도 된다. 다른 부서 사람이 돕는 일이 있기 때문이다.
   - 마감일은 행사 날짜와 무관하다. 행사 뒤에 하는 일(정산, 후기)도 있다.
2. **권한**
   - 보기: 학생회 구성원 모두. 미배정도 본다. 업무에는 개인정보가 없다. 대화·구매와 같다.
   - 추가·수정·상태 바꾸기·지우기: 부서가 있는 구성원(`manageEvents`). 누가 만들었는지, 누가 맡았는지와 상관없다. 참가 신청 관리와 같은 기준이다.
   - 담당자로 정할 수 있는 사람: 같은 학생회에서 부서가 있는 구성원
     - 미배정은 업무를 바꿀 수 없으므로 맡기지 않는다.
     - 맡긴 뒤 그 사람이 미배정이 되어도 업무는 그대로 남는다.
     - 담당자를 바꿀 때만 이 조건을 검사한다. 그래서 담당자를 그대로 두고 제목만 고칠 때는 막히지 않는다.
3. **상태**
   - 예정(`todo`), 진행 중(`doing`), 완료(`done`) 셋이다. 어느 상태로든 바로 바꿀 수 있다.
   - 새 업무는 예정이다.
   - 완료로 바꾸면 완료 시각을 남긴다. 완료에서 다른 상태로 돌리면 지운다.
   - 지연과 담당자 없음은 저장하지 않고 화면이 계산한다.
     - 지연: 완료가 아니고, 마감일이 한국 날짜로 오늘보다 앞이다. 마감일 당일은 지연이 아니다.
     - 담당자 없음: 완료가 아니고 담당자가 없다.
4. **동시 수정**
   - 업무마다 버전이 있다.
   - 수정·상태 바꾸기·지우기는 화면이 본 버전을 보낸다. 다르면 `VERSION_CONFLICT`(409)다.
   - 바뀐 것이 없는 수정이나 같은 상태로 바꾸기는 버전을 올리지 않고 기록도 남기지 않는다.
5. **지우기**
   - 업무와 처리 기록을 함께 지운다. 확인 대화상자를 거친다.
   - 잘못 만든 업무를 치우는 기능이다. 업무는 돈 기록이 아니어서 취소로 남겨 두지 않는다.
6. **처리 기록**
   - 만들기, 수정, 상태 바꾸기를 남긴다. 고치거나 따로 지우지 않는다.
   - 수정은 바뀐 칸만 이전·이후 값으로 남긴다. 부서와 담당자는 ID가 아니라 그때의 이름으로 남긴다. 그래서 부서를 지우거나 이름이 바뀌어도 기록이 읽힌다.
7. **부서를 지우면** 그 부서가 담당 부서인 업무의 담당 부서를 비우고 버전을 올린다(같은 거래).
   - 지울 부서 행을 먼저 `FOR UPDATE`로 잠근다. 그래서 그사이 다른 사람이 그 부서를 업무에 정하려 하면, 지우기가 끝난 뒤 `TASK_DEPARTMENT_INVALID`를 받는다.
   - 처리 기록은 남기지 않는다. 조직 관리에서 한 일이기 때문이다.
   - 업무가 있다고 부서 지우기를 막지는 않는다. 막으면 업무가 한 번이라도 있던 부서는 영영 지울 수 없다.
8. **행사와의 관계**
   - 정산한 행사의 업무도 바꿀 수 있다. 업무는 돈과 관계가 없다.
   - 행사마다 업무는 300개까지다(`TASKS_FULL`, 409). 목록을 한 번에 그리기 위한 상한이다.
9. **일정 보기**
   - 날짜가 있는 항목을 날짜순으로 보인다.
     - 마감일이 있는 업무
     - 행사: 시작 일시. 끝이 다른 날이면 기간을 적는다.
     - 참가 신청 마감: 참가 신청이 있을 때
   - 오늘부터는 "다가오는 일정"으로, 지난 날짜는 접은 "지난 일정"으로 나눈다.
   - 회의는 없다(M3에서 미뤘다).
10. **D-day:** 행사 시작일(한국 날짜)과 오늘의 차이다. 앞이면 D-N, 당일이면 D-DAY, 지나면 D+N이다. 시작 일시가 없으면 보이지 않는다.
11. **내 업무**
    - 이 학생회에서 내가 담당자인 업무다. 모든 행사를 모은다.
    - "할 일"(예정·진행 중)과 "완료" 둘로 나눈다.
      - 할 일은 마감일 순서이고, 지연이 맨 앞, 마감일 없는 업무가 맨 뒤다. 300개까지 보인다.
      - 완료는 최근 완료 순으로 50개까지 보인다.
    - 학생회를 열면 첫 화면이다. 지금 빈 "행사를 선택해 주세요"를 보이는 자리다. 초대로 처음 들어와도 내 업무부터 보인다. 학생회를 새로 만들면 지금처럼 구성원 화면부터 연다.
    - 옆 메뉴 "내 업무"에 남은 수를 보인다. 지연이 있으면 "지연 N"(빨강), 없으면 남은 할 일 수다.
12. **미배정의 화면:** 업무 탭과 상세는 보인다. 추가·상태·수정·지우기 버튼은 없다.

## 와이어프레임과 다른 점

| 화면 | 노드 |
|---|---|
| EVT-TASK-01 행사 업무 — 칸반 보드 | `25:1186` |
| EVT-TASK-02 업무 상세 — 관련 문서·결과물 | `25:1565` |
| EVT-SCHED-01 행사 일정 | `28:2` |
| MY-01 내 업무 | `16:317` |

- **EVT-TASK-01:**
  - 열은 셋이다(검토 필요 없음).
  - 끌기 대신 카드의 [시작]·[완료] 버튼과 상세의 상태 고르기를 쓴다.
  - 휴대폰에서는 열을 위아래로 쌓는다.
  - 머리의 행사 상태 칩(기획 중), 담당 부서·책임자, "다음 일정"은 뺀다. 행사 상태와 책임자는 없는 데이터다.
- **EVT-TASK-02:**
  - 업무 번호(T-03), 우선순위, 완료 기준, 예상 결과물, 연결된 항목, "관련 문서·결과물" 탭을 뺀다.
  - 처리 기록은 상세 아래에 바로 보인다.
  - 전체 화면 대신 대화상자다(구매·지출 상세와 같다).
- **EVT-SCHED-01:**
  - 별도 탭 대신 업무 탭의 "일정" 보기다.
  - 거르기(이번 주·마감·회의·행사 당일)와 "전체 캘린더 보기"를 뺀다. 지연·담당자 없음·내 담당 칩은 보드와 같이 쓴다.
  - "참여 설문 마감"은 참가 신청 마감이다.
- **MY-01:**
  - 탭은 "할 일"과 "완료" 둘이다.
  - "다음 행동" 문구, 검색, 이름 없는 거르기 칸을 뺀다.
  - 상시 업무는 없다.

## 데이터 (마이그레이션 0024)

**tasks** (새 표)

| 칸 | 내용 |
|---|---|
| `id` | text PK |
| `organization_id` | text NOT NULL |
| `event_id` | text NOT NULL. `(organization_id, event_id)` → events `(organization_id, id)`, `ON DELETE RESTRICT` |
| `title` | text NOT NULL. 공백만이면 안 되고 100자까지 |
| `description` | text. 공백만이면 안 되고 1,000자까지 |
| `status` | text NOT NULL, 기본 `todo`. `todo`·`doing`·`done` |
| `department_id` | text. `(organization_id, department_id)` → departments `(organization_id, id)`, `ON DELETE RESTRICT` |
| `assignee_id` | text. `(organization_id, assignee_id)` → memberships `(organization_id, user_id)`, `ON DELETE RESTRICT` |
| `due_on` | date. 2000-01-01~2999-12-31 |
| `completed_at` | timestamptz. 완료일 때만 있다 |
| `created_by` | text NOT NULL. users FK, `ON DELETE RESTRICT` |
| `created_at` | timestamptz NOT NULL, 기본 now() |
| `version` | integer NOT NULL, 기본 1, 1 이상 |

- CHECK `tasks_completed_state`: `(status = 'done') = (completed_at IS NOT NULL)`
- 고유 `tasks_organization_id_unique`: `(organization_id, id)`. 처리 기록의 복합 외래 키가 참조한다.
- 색인
  - `tasks_event_idx`: `(organization_id, event_id)`. 행사 보드가 쓴다.
  - `tasks_assignee_idx`: `(organization_id, assignee_id)`. 내 업무가 쓴다.
- 담당자는 사용자 ID로 저장한다(지출의 결제한 사람과 같다). 복합 외래 키가 같은 학생회 소속만 받는다. 소속은 지우는 경로가 없어 `RESTRICT`로 둔다.
  - API는 구성원 목록과 같은 소속 ID(`assigneeMembershipId`)로 주고받는다.

**task_events** (새 표, 처리 기록)

| 칸 | 내용 |
|---|---|
| `id` | text PK |
| `organization_id` | text NOT NULL |
| `task_id` | text NOT NULL. `(organization_id, task_id)` → tasks `(organization_id, id)`, `ON DELETE RESTRICT` |
| `actor_id` | text NOT NULL. users FK, `ON DELETE RESTRICT` |
| `action` | text NOT NULL. `created`·`updated`·`status_changed` |
| `changes` | jsonb NOT NULL, 기본 `{}`. 객체여야 한다 |
| `created_at` | timestamptz NOT NULL, 기본 now() |

- 색인 `task_events_task_idx`: `(task_id, created_at)`
- 업무를 지울 때 서비스가 기록을 먼저 지운다. 외래 키는 `RESTRICT`라서 다른 곳에서 업무만 지우는 실수를 막는다.

**배포 순서**
- 새 표 둘뿐이다. 새 코드가 새 표를 읽으므로 두 DB에 먼저 적용하고 배포한다.
- 기존 표에는 제약을 더하지 않는다.
- 옛 코드는 새 표를 모른다. 그래서 적용한 뒤 배포 전까지 옛 코드로 부서를 지워도 문제가 없다(업무가 아직 없다).

## API

본문은 contracts의 `z.strictObject`이고, `json(Schema)`를 인증보다 앞에 둔다. 새 모듈 `createTaskRoutes`를 `AppOptions.tasks`로 연결한다.

**행사 업무** (앞부분 `/api/organizations/:organizationId/events/:eventId/tasks`)

| 경로 | 권한 | 본문 → 응답 |
|---|---|---|
| `GET` | 구성원 | → `EventTasksResponse` |
| `POST` | `manageEvents` | `CreateTaskSchema` → `TaskResponse` (201) |
| `GET /:taskId` | 구성원 | → `TaskResponse` |
| `PATCH /:taskId` | `manageEvents` | `UpdateTaskSchema` → `TaskResponse` |
| `POST /:taskId/status` | `manageEvents` | `ChangeTaskStatusSchema` → `TaskResponse` |
| `POST /:taskId/delete` | `manageEvents` | `DeleteTaskSchema` → `EventTasksResponse` |

**내 업무**

| 경로 | 권한 | 응답 |
|---|---|---|
| `GET /api/organizations/:organizationId/my-tasks` | 구성원 | `MyTasksResponse` |

**본문**
- `CreateTaskSchema`: `{ title, description, departmentId, assigneeMembershipId, dueOn }`
  - `title`: `text(100)`
  - `description`: `text(1000)` 또는 null
  - `departmentId`, `assigneeMembershipId`: `token(64)` 또는 null
  - `dueOn`: YYYY-MM-DD(달력에 있고 2000~2999년) 또는 null
- `UpdateTaskSchema`: `{ version, ...CreateTaskSchema의 칸 }`. 모든 칸을 다시 보낸다.
- `ChangeTaskStatusSchema`: `{ version, status }`
- `DeleteTaskSchema`: `{ version }`

**응답**
- `TaskSummary`
  - `id`, `event: { id, name }`, `title`, `description`, `status`
  - `department: { id, name } | null`
  - `assignee: { membershipId, name } | null`
  - `dueOn`, `completedAt`
  - `createdBy: { id, name }`, `createdAt`, `version`
- `TaskDetail`: `TaskSummary` + `history: TaskHistoryEntry[]`
  - `TaskHistoryEntry`: `{ id, action, actor: { id, name }, changes, createdAt }`
- `EventTasksResponse`: `{ tasks: TaskSummary[], registrationClosesAt: string | null }`
  - 보드 순서: 마감일 순, 마감일 없는 업무는 뒤, 그다음 만든 순
  - `registrationClosesAt`: 참가 신청 마감(한국 시각). 미배정도 일정에서 본다. 신청자 정보가 아니다.
- `TaskResponse`: `{ task: TaskDetail }`
- `MyTasksResponse`: `{ open: TaskSummary[], done: TaskSummary[], truncated: boolean }`
  - `truncated`는 할 일이 300개를 넘었는지다.

**오류**

| 코드 | 상태 | 뜻 |
|---|---|---|
| `NOT_FOUND` | 404 | 다른 학생회나 다른 행사의 업무, 없는 업무 |
| `FORBIDDEN` | 403 | 미배정이 바꾸려 함, 소속 아님 |
| `VERSION_CONFLICT` | 409 | 다른 사람이 먼저 바꿈 |
| `TASK_DEPARTMENT_INVALID` | 409 | 같은 학생회에 없는 부서 |
| `TASK_ASSIGNEE_INVALID` | 409 | 같은 학생회 소속이 아니거나 미배정인 담당자 |
| `TASKS_FULL` | 409 | 행사의 업무가 300개 |

**거래와 잠금**
- 추가: 행사 행을 `FOR NO KEY UPDATE`로 잠그고 수를 센다. 같은 행사에 동시에 더해도 300개를 넘지 않는다.
- 수정·상태·지우기: 업무 행을 `FOR UPDATE`로 잠근다. 경로의 행사와 업무의 행사가 다르면 `NOT_FOUND`다.
- 담당 부서가 있으면 업무 행보다 먼저 그 부서 행을 `FOR KEY SHARE`로 잠근다.
  - 부서 지우기는 회장단 부서 행을 `FOR UPDATE`로 잠근 뒤 업무 행을 고친다.
  - 업무를 먼저 잠그고 외래 키 검사로 부서를 잠그면 순서가 엇갈려 교착이 날 수 있다. 그래서 부서를 먼저 잠근다.
- 담당자를 정하거나 바꿀 때는 그 사람의 소속 행을 `FOR SHARE`로 잠그고 부서를 확인한다.
  - 같은 때 회장단이 그 사람을 미배정으로 옮겨도, 둘 중 하나가 끝난 뒤에 다른 하나가 진행된다.
- 잠금 순서는 행사(추가만) → 부서 → 업무 → 소속이다.
- 버전이 다르면 부서·담당자 오류보다 `VERSION_CONFLICT`를 먼저 알린다. 오래된 화면은 새로 불러오면 된다.

## 화면

- **행사 "업무" 탭** (대화 다음)
  - 위: D-day, "완료 N/M"과 진행 막대, 칩(지연·담당자 없음·내 담당), [보드 | 일정], [+ 업무 추가](부서가 있는 구성원)
  - 보드
    - 넓은 화면은 세 열이다. 휴대폰은 예정·진행 중·완료를 위아래로 쌓고, 완료는 접어 둔다.
    - 카드: 제목, 담당 부서 칩, 담당자 또는 "담당자 없음", 마감일(지연이면 빨강), [시작]·[완료] 버튼
  - 일정: 날짜별로 묶은 목록. 업무 줄을 누르면 상세를 연다.
- **업무 추가·수정 대화상자**
  - 칸: 제목, 설명, 담당 부서, 담당자(부서별로 묶음), 마감일
  - 담당 부서가 비어 있을 때 담당자를 고르면 그 사람의 부서로 채운다.
- **업무 상세 대화상자**
  - 칸 내용, 상태 고르기(예정·진행 중·완료), [수정], [지우기], 처리 기록
  - 내 업무에서 열면 [행사로 가기]로 그 행사의 업무 탭을 연다.
- **내 업무 화면**
  - "할 일 N"·"완료" 탭
  - 카드: 제목, 행사 이름, 상태, 마감일·지연. 누르면 업무 상세를 연다.
  - 맡은 업무가 없으면 빈 상태를 보인다.
- **옆 메뉴:** 맨 위에 "내 업무"와 남은 수

## 시연 데이터

`apps/api/scripts/demo-data.ts`에 업무를 더한다.
- 학술제(기획 중): 8개 안팎. 완료·진행 중·예정, 지연 1~2개, 담당자 없음 1~2개를 섞는다.
- 간식 나눔(신청 받는 중): 4개 안팎
- 체육대회(정산함): 몇 개, 모두 완료
- 로그인 계정 회장단에게도 업무 두어 개를 맡겨 내 업무가 비지 않게 한다.

`resetDemo`는 행사보다 먼저 업무와 처리 기록을 지운다. 배포 DB를 다시 초기화할 때는 사용자 승인을 받는다(시연 중 바뀐 데이터가 처음으로 돌아간다).
