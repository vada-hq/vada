# 백엔드 구현 교차검증 브리프 (2026-08-31)

두 번째 교차검증이다. **첫 번째는 설계를 봤고 이번엔 도는 코드를 본다.**

그때는 서버가 2자리였고 브리프에 담긴 것은 계획이었다. 지금은 2,037줄이 돌고
그중 상당수가 **누가 무엇을 열 수 있는가**를 판정한다.

아래는 사실과 이미 아는 약한 곳과 물음뿐이다. 만든 쪽의 결론은 일부러 뺐다.

---

## 0. 첫 검토가 무엇을 찾았는지 (왜 또 부르는가)

검증 가능한 지적이 **전부 사실이었다.** 그중 셋은 만든 쪽이 못 본 것이었다.

- **공개 자리의 개인정보 유출.** 참석 확인 결과를 QR의 공유 토큰으로 조회하게 했다 —
  같은 QR을 찍은 다른 사람의 이름·학번·납부 상태가 열리고, 앞사람의 결과가 덮였다.
- 전날 넣은 결함 둘 — 권한 변경 기록이 조직 삭제에 cascade로 함께 지워졌고,
  감사 미들웨어가 정보주체를 남기지 않고 터진 요청을 통째로 놓쳤다.
- 문서 두 곳에 퍼진 측정 오류.

그 뒤 109개 커밋이 쌓였고 **검토받은 것은 전부 다른 것으로 바뀌었다.**

---

## 1. 지금 있는 것

```
명세 → 계약        화면 82 · 출처 145 · 선택지 51 · 변이 44 → OpenAPI 동작 216
백엔드             2,037줄 (검사 1,155줄) · 표 10개 · 답하는 자리 23/216
프런트             화면 82개 구현. 개발용 응답 4,400줄이 서버 대역을 한다
검사               앱 737 · 계약 191 · api 93 · e2e 428
```

### 계약이 자리를 만든다

`apps/api/src/routes.ts`의 `attach(app, deps, handlers)` 하나다. method·path·응답
모양을 코드에 다시 적지 않고 생성된 `openapi.json`에서 읽는다. 계약에 없는 이름을
붙이면 시작할 때 던진다.

응답이 계약의 모양을 지키는지는 **검사가 ajv로 견준다**(자리마다 zod를 쓰지 않는다).

### 권한

`specs/figma/vada-wireframe/permissions.json`이 영역 19개와 조건 11개를 갖고,
216동작이 저마다 `x-authorize: { area, object? }`를 든다.

| 영역 | 동작 수 |
| --- | --- |
| `member` 그 학생회 구성원이면 된다 | 131 |
| `finance.read` · `students.read` 행렬이 "전원 가능"이라 한 열람 | 37 |
| `public` 로그인 없음 | 9 |
| `event.*` · `finance.manage` · `org.*` · `meeting.*` 행렬이 제한 | 31 |
| `unstated` 명세가 아직 말하지 않음 | 8 |

판정은 `src/permissions.ts`의 `can(viewer, area, object, lookups)` 하나에서 나온다.
화면에 내려보내는 `can*` 조각도 같은 함수를 부른다.

강제는 `src/authorize.ts`의 미들웨어가 한다 — 자리마다 손으로 부르지 않는다.
계약이 든 경로 틀로 실제 주소를 맞추고(`matchRoute`), **계약에 없는 자리는 403**이다.

막는 것 셋: `unstated` 영역, 조건이 대상을 요구하는데 대상이 없는 요청,
계약에 없는 자리.

### 로그인 없이 열리는 자리 아홉

```
GET  /api/public/attendance/check-in-form
GET  /api/public/attendance/check-in-result
POST /api/public/attendance/{checkInToken}/check-in
GET  /api/public/surveys/apply-form
GET  /api/public/surveys/apply-result
GET  /api/public/surveys/colleges
GET  /api/public/surveys/departments
GET  /api/public/surveys/link-state
POST /api/public/surveys/{surveyToken}/applications
```

- **QR/링크 토큰은 여럿이 공유한다.** 한 행사의 참석자 전부가 같은 QR을 찍는다.
- **결과 조회는 사람마다 다른 영수증(`receiptToken`)으로 한다** — 첫 검토가 찾은
  구멍을 그렇게 고쳤다. POST가 영수증을 돌려주고 결과 화면이 그것으로 조회한다.
- 감사 기록은 공개 경로의 토큰 자리를 `*`로 지운다(`maskSecrets`).
- 계약은 이 아홉에 **429**를 선언한다. **구현은 없다**(아래 3장).

### 두 번 눌리는 것

변이 44개가 저마다 `repeat.kind`를 든다 — `overwrite` 16 · `naturalKey` 3 ·
`idempotencyKey` 10 · `conflict` 15.

- `naturalKey`: QR 출석은 `(checkInToken, studentNumber)`로 가린다. 같은 사람이
  두 번 낸 것은 한 번이고 두 번째에는 첫 번째의 영수증을 준다.
- `idempotencyKey`: 자연 열쇠가 없는 자리는 `Idempotency-Key` 머리를 **요구**한다.
  미들웨어가 계약을 읽어 강제하고, 없으면 422다.
- `conflict`: 이미 그 상태면 409.

### 법이 요구하는 기록

- `audit_logs` — 접속 기록 1년. 미들웨어가 전부를 본다. 읽기도 남기고, 터진 요청도
  남기고, 정보주체(`subjectType`/`subjectId`)를 핸들러가 알려 준다.
- `permission_changes` — 권한 변경 3년. **조직을 가리키지 않는다**(cascade로 두었더니
  조직 삭제에 3년치가 함께 사라졌다). 구성원이 지워져도 누구였는지 이름이 남는다.
  바뀐 때만 남긴다 — 같은 역할로 다시 눌린 것은 변경이 아니다.

### 표 열 개

`users` `organizations` `departments` `members` `permissions`(삭제됨) `invites`
`students` `roster_updates` `audit_logs` `permission_changes` `events`

권한 행렬 표는 **없앴다.** 모든 학생회가 같은 표를 쓰기로 정했으므로(사람이 결정)
조직마다 저장할 까닭이 없다. ORG-04이 그리는 표는 정책에서 만들어 내려보낸다.

### 검사가 진짜 Postgres를 쓴다

PGlite(WASM Postgres)를 프로세스 안에서 띄운다. 도커도 설치도 없이 게이트가 돌린다.
표를 만드는 SQL은 `schema.ts` 하나에서 생성된다.

---

## 2. 이미 아는 약한 곳 (여기 확인하는 데 시간 쓰지 말 것)

정직하게 먼저 적는다. 아래는 **알고 있고 아직 안 한 것들**이다.

| | |
| --- | --- |
| **인증이 없다** | `deps.who()`가 밖에서 주입된다. Better Auth를 아직 안 붙였다 |
| **`Lookups` 넷이 전부 미구현** | 행사 운영 조직·회의 진행 권한자 표가 없어 `isEventStaff` 등이 항상 false다 |
| **429가 계약에만 있다** | 속도 제한 코드가 없다 |
| **멱등 저장이 프로세스 안이다** | `inMemoryAttempts`. 계산이 여럿이면 안 듣는다 |
| **트랜잭션 경계가 없다** | 역할 변경이 `members` 갱신과 `permission_changes` 삽입을 따로 한다 |
| **`unstated` 8자리** | 회의록 4 · 기록 3 · 대화방 1. 사람이 나중에 정하기로 했다 |
| **인자를 받는 출처는 프런트가 아직 서버로 못 부른다** | 그릇이 요소별 인자를 모른다 |
| **배포 안 함** | AWS 계정도 없다 |

---

## 3. 물음

### (1) 권한을 우회할 수 있는가

미들웨어 하나가 216자리를 판정한다. 다음이 궁금하다.

- 미들웨어를 **지나치는 경로**가 있는가.
- `matchRoute`가 실제 주소를 계약의 틀에 맞추는 방식(글자 자리가 인자 자리를 이긴다)에
  **틀린 자리로 맞아떨어지는 경우**가 있는가.
- **`orgId` 격리.** 모든 조회가 `where orgId = ?`를 갖는지가 이 서비스의 가장 기본적인
  벽인데, 한 자리라도 빠뜨리면 조용히 샌다. 지금 강제하는 장치가 없다 —
  각 저장소 함수가 손으로 적는다.
- 조건이 대상을 요구할 때 그 대상을 **요청이 정한다**(`c.req.param`/`query`).
  대상을 바꿔 넣어 남의 것을 여는 길이 있는가.

### (2) 공개 자리가 안전한가

로그인이 없고 주소가 실어 온 토큰이 열쇠다.

- 토큰을 마구 넣어 보는 것을 막지 않으면 그것이 유일한 벽이다. 429가 계약에만 있다.
- `receiptToken`이 사람마다 다르게 발급된다는 계약은 있지만 **아직 구현이 없다**
  (참석·설문 표가 없다). 이것을 만들 때 무엇을 지켜야 하는가.
- `maskSecrets`가 `/api/public/` 아래 **넷째 조각부터 한 칸 걸러** 지운다.
  이 규칙이 새 자리가 생겼을 때도 맞는가.

### (3) 멱등이 진짜로 막는가

- 같은 키로 **동시에** 두 요청이 오면? 지금은 처음 것이 끝난 뒤에야 기록한다.
- 답을 기록하는 자리가 `c.res.clone().json()`이다. 실패한 답은 기록하지 않는데
  그 판정이 `status === 200`이다.
- `naturalKey`(QR 출석)는 아직 구현 전이다. 무엇을 조심해야 하는가.

### (4) 법정 기록이 요구를 만족하는가

- `audit_logs`가 미들웨어에서 쓰인다 — **저장이 실패하면?** 지금은 던진다.
- 접속 기록에 무엇이 더 있어야 하는가(기준이 요구하는 항목 대비).
- `permission_changes`가 조직을 안 가리키는 대신 **아무것도 강제하지 않는다.**
  그 대가가 무엇인가.

### (5) '계약이 자리를 만든다'가 성립하는가

- 생성된 `openapi.json`을 **런타임이 읽는다**(routes·authorize·idempotency 셋 다).
  이 결합이 옳은가, 아니면 빌드 때 코드로 굳혀야 하는가.
- 계약과 구현이 갈릴 수 있는 자리가 남아 있는가.

### (6) 묻지 않았는데 물어야 했던 것

물음 다섯은 만든 쪽이 고른 것이고, 그 고름 자체가 편향이다.
**더 크거나 더 급한 위험이 있으면 그것부터 말해 달라.**

---

## 4. 읽을 곳

```
apps/api/src/
  app.ts             자리에 답을 놓는 곳 (23자리)
  routes.ts          계약이 자리를 만드는 층
  authorize.ts       권한 강제 미들웨어 · matchRoute
  permissions.ts     판정 함수 하나
  idempotency.ts     두 번 눌린 것을 가리는 층
  audit.ts           누가 무엇을 언제 만졌는가 · maskSecrets
  db/schema.ts       표 열 개
  org/ events/       저장소 함수들

specs/figma/vada-wireframe/
  permissions.json   영역 19 · 조건 11
  openapi.json       동작 216 (생성물 — 손으로 고치지 않는다)
  mutations.json     변이 44 (repeat · irreversible)
  data-sources.json  출처 145
```

## 5. 답할 때 부탁

- **이 코드의 이 자리에 걸린 답**을 달라. 일반론은 필요 없다.
- 각 지적에 **어떻게 실패하는가**(구체적인 요청과 그 결과)를 함께 적어 달라.
- 확신이 낮으면 낮다고 적어 달라. 확신 있는 척한 답이 가장 비싸다.
- 2장에 적은 것을 확인하는 데 시간을 쓰지 말아 달라 — 이미 안다.
- **이 규모에 맞는 답**을 달라. 개발자가 소수이고 학생회 하나가 쓴다.
