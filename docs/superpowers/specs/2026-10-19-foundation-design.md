# 바탕: 새 표 위의 학생회, 운영진, 권한

2026-10-19. 다시 만들기(`2026-10-19-rebuild-design.md`)의 둘째 덩어리다. 이후의 모든 기능이 기대는 바닥을 만든다. 범위는 다음과 같다.

- 새 DB와 첫 마이그레이션
- 기록과 판
- 학생회, 기수, 운영진, 부서, 직급, 소속
- 권한
- 운영진 들이기와 내보내기

설계는 vada-docs의 다음 문서를 따른다.

- physical-model.md, logical-model.md
- DEC-16, DEC-17, DEC-27, DEC-28, DEC-33, DEC-34
- DEC-46(지금 판도 판), DEC-47(초대 링크와 기수)

문서도 코드도 정하지 않았던 것 12가지는 사전 조사(`.superpowers/research/2026-10-19-bataang-findings.md`, git 밖)에서 찾았다. 업계 기준과 기존 원칙으로 정했고, 사용자가 승인했다(그림 `notes/vada-bataang-decisions.html`, 20261019).

## 원칙 대조

| 사람이 하는 일 | 새로 생긴 일인가 | 바로 이득 | 판단 |
|---|---|---|---|
| 학생회 만들기(이름, 단위, 학교, 임기) | 처음 한 번 | 운영 공간이 생긴다 | 그대로. 시범 운영에서는 회장단과 같이 한다 |
| 초대 링크 나누기 | 아니다. 단톡방에 링크 올리기는 하던 일이다 | 운영진이 들어온다 | 그대로 |
| 링크로 들어오기 | 처음 한 번 | 학생회의 대화와 업무에 들어간다 | 그대로 |
| 부서 배정, 직급 주기 | 아니다. 학생회가 원래 하는 편성이다 | 권한이 맞게 열린다 | 그대로 |
| 내보내기, 초대 코드 바꾸기 | 드물게 | 잘못 들어온 사람을 뺀다 | 그대로 |

- **근거 연결:** 바탕의 기록(학생회, 소속, 부서)은 편성이라 근거 메시지를 받지 않는다.
- **변경 이력:** 모든 변경을 판으로 남긴다. 판마다 그 판을 만든 사람과 시각이 붙는다(DEC-34, DEC-46). 바탕의 변경은 확정한 기록이 아니라서 사유를 받지 않는다.

## 정한 것

| 번호 | 정한 것 | 근거 |
|---|---|---|
| G1 | 로그인 계정과 운영진은 '로그인 잇기' 표(설계 밖)로 잇는다. 운영진의 이메일은 보여 주고 연락하는 칸으로만 쓰고, 소문자로 저장한다. 운영진은 학생회를 만들 때나 초대로 들어올 때 처음 생긴다 | OpenID Connect 5.7: 안정된 식별자는 sub와 iss뿐이고, 이메일은 식별자로 쓰면 안 된다 |
| G2 | 초대 코드는 학생회마다 하나를 설계 밖 표에 둔다. 보기와 바꾸기는 회장단이 한다. 바꾸면 옛 코드는 막히고, 만료는 두지 않는다 | DEC-47 |
| G3 | 초대 링크로 로그인한 사람은 지금 기수에 바로 들어온다. 부서와 직급은 없다 | DEC-47, DEC-17 |
| G4 | 내보내면 학생회 소속과 그 기수의 부서 소속을 함께 끝낸다. 다시 들어오면 같은 소속을 다시 연다. 회장은 넘긴 뒤에만 내보낸다. 스스로 나가기는 없다 | DEC-47 |
| G5 | 학생회를 만들 때 첫 기수를 함께 만든다. 기본값은 올해 1/1~12/31, 이름은 연도다. 기수를 고치는 사람은 회장단이다. 다음 기수로 넘기기는 하지 않는다 | DEC-47, 한양대 ERICA 학생회 임기, RFC-6 보류 |
| G6 | 학생회 만들기는 한 거래다. 운영진(없으면), 로그인 잇기, 학생회, 첫 기수, 회장 소속, 재정부(재정 역할), 초대 코드를 함께 만든다. 감사기구와 의결기구는 만들지 않는다 | DEC-16, DEC-17 |
| G7 | 지금 상태도 판이다. 바뀌면 지금 판을 닫고 새 판을 연다. 시각은 실제 시계 시각(`clock_timestamp()`)으로 적는다 | DEC-46 |
| G8 | 회장은 기수마다 한 명이다. DB 부분 유일 인덱스가 막는다(physical-model.md). 회장이 없어지는 변경은 기록 모듈이 막는다. 부서 없애기는 쓰인 적 없는 부서만 된다 | DEC-17, DEC-47 |
| G9 | 권한표를 코드 표 하나로 둔다. 바탕에서는 엔진과 조직 칸, 공통 규칙(상속, 합치기, 직무 분리)을 테스트와 함께 만든다. 나머지 칸은 그 기능을 만드는 덩어리가 더한다 | DEC-27, DEC-28, DEC-47 |
| G10 | 알림 받을 기기는 로그인 계정에 붙인다(설계 밖). 학생회에 들어오기 전에도 알림을 켤 수 있어야 해서다. 끝난 구독은 지운다 | 휴대폰 길 설계서 |
| G11 | 설계 밖 표(로그인 4개, 로그인 잇기, 초대 코드, 알림 기기)는 설계 검사에서 뺀다 | 다시 만들기 설계서 |
| G12 | 구성원 목록에는 이메일을 보이지 않는다 | 최소 공개, 개인정보 보호법 제21조 |

G9의 범위를 다시 만들기 설계서보다 좁혔다. 아직 없는 기능의 칸을 미리 만들면, 그 기능을 만들 때 칸의 뜻이 바뀌어 다시 고치게 된다. 그래서 바탕의 완료 기준은 '조직 칸과 공통 규칙을 모두 테스트로 확인했다'가 된다.

## 범위

- **넣는다**
  - 첫 작업: 옛 기능 지우기(아래 '옛 기능 지우기')
  - 새 DB와 첫 마이그레이션, 시험 DB 도우미, 조회용 표 정의와 맞춤 검사, 설계 검사 스크립트
  - 기록 모듈(만들기, 바꾸기, 판)
  - 권한 엔진과 조직 칸
  - 로그인 잇기, 학생회 만들기, 초대 링크로 들어오기, 초대 코드 보기와 바꾸기
  - 운영진: 목록, 부서 배정과 빼기, 직급 주기와 거두기, 회장 넘기기, 내보내기
  - 부서: 만들기, 이름 바꾸기, 재정 역할 주고 거두기, 쓰인 적 없는 부서 없애기
  - 설정: 학생회 정보와 직급 표시 이름, 기수 이름과 기간 고치기
  - 알림 받을 기기 저장(휴대폰 길의 '알림 켜기'가 저장까지 한다)
  - 시험 데이터 스크립트를 새 표에 맞춰 다시 쓰기
  - 바꾸는 날 준비: 새 DB에 마이그레이션을 적용하는 방법
- **넣지 않는다**
  - **대화방, 업무, 구매와 지출, 행사:** 덩어리 3~7에서 만든다.
  - **다음 기수로 넘기기:** RFC-6에서 정한다.
  - **감사기구와 의결기구, 스스로 나가기, 직급마다의 홈**
  - **시연 데이터:** 덩어리 6에서 다시 쓴다.
  - **고치기 충돌 막기(판 번호로 낙관적 잠금):** 바탕의 편집은 회장단 몇 명이 드물게 한다. 기록 모듈이 행을 잠가 값이 어긋나지는 않는다. 나중 쓰기가 이긴다.

## 옛 기능 지우기 (첫 작업)

다시 만들기 설계서(8ff743c)대로, 바탕의 첫 작업에서 옛 기능을 먼저 지운다.

- **지운다**
  - 서버: `apps/api/src/`의 access, organization, events, chat, purchases, deliveries, expenses, settlement, budget, incomes, registrations, fees, tasks, reports, home, workbook과 그 테스트
  - DB: `apps/api/src/db/schema.ts`의 옛 기능 표, 옛 마이그레이션 29개와 journal
  - 화면: `apps/web/src/`의 access, budget, chat, events, deliveries, purchases, expenses, settlement, registrations, fees, tasks, reports, home, records, organization, public, workspace와 그 테스트
  - 계약: `packages/contracts`의 옛 기능 스키마. input, push, korean-time은 남긴다.
  - 배송 추적: `.github/workflows/delivery-worker.yml`, `scripts/`의 배송 도구, 배송 문서 4개
  - 데이터 스크립트: `apps/api/scripts/`의 옛 스크립트. test-data는 새 표로 다시 쓴다.
  - 표시용 부품과 부품 확인 화면: 지운 기능만 쓰던 부품(예: 계좌 상자)과 그 예시
- **남긴다**
  - 로그인: `auth/`(better-auth, require-session)
  - HTTP: `http/`(공통 가드, 입력 검사, 오류 처리, Sentry, 경계 테스트), `app.ts`, `serve.ts`, `runtime.ts`, `web.ts`
  - 휴대폰 길: `push/`
  - 영수증 저장소(R2): `expenses/storage.ts`와 그 테스트를 `storage/`로 옮겨 남긴다. 다시 만들기 설계서가 남기는 배관으로 정했고, 덩어리 5가 다시 잇는다.
  - 화면: `components/ui`, `lib`, `auth`, `push`, `test-support`, `ui-gallery`, `index.css`
  - CI와 배포 설정, `.node-version`
- 지운 뒤에도 앱은 돌아야 한다. 화면은 로그인, 학생회가 없을 때의 안내, 휴대폰 알림만 남는다. 모든 테스트가 통과해야 한다.
- 옛 이름 `organizations`가 들어간 API 경로 접두어(`/api/organizations/`)는 그대로 쓴다. 공통 가드, 경계 테스트, 저장소 규칙이 이 접두어에 걸려 있기 때문이다. 코드 안의 이름은 council(학생회)이다.
- 화면의 기준은 vada-docs의 navigation.md와 screens.md다. Figma(M1 와이어프레임)와는 같은 화면이 있을 때만 맞대 본다.

## 데이터

### 첫 마이그레이션

`apps/api/migrations/0000_baseline.sql` 하나에 차례로 담는다.

1. 로그인 표 4개: 지금 정의 그대로다.
2. physical-model.md의 SQL 블록: `apps/api/scripts/baseline-from-design.ts`가 `../vada-docs/physical-model.md`에서 뽑는다. 블록 안의 문장은 줄 끝 `;`로 나누고, 문장 사이에 drizzle의 `--> statement-breakpoint`를 넣는다.
3. 설계 밖 표 3개(아래)

새 journal은 처음부터 다시 쓴다. `.sql`은 LF다.

```sql
-- 로그인 잇기: 로그인 계정(users)과 운영진(member)을 하나씩 잇는다(G1)
CREATE TABLE member_login (
  member_id uuid PRIMARY KEY REFERENCES member (id),
  user_id   text NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now()
);

-- 초대 코드: 학생회마다 하나(G2). 형식은 지금 vada와 같다
CREATE TABLE invite_code (
  council_id uuid PRIMARY KEY REFERENCES council (id),
  code       text NOT NULL UNIQUE CHECK (code ~ '^[2-9A-HJ-NP-Z]{8}$'),
  created_by uuid NOT NULL REFERENCES member (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON invite_code (created_by);

-- 알림 받을 기기(G10). 구독 주소는 기기를 가리키는 비밀 주소다
CREATE TABLE push_device (
  id              uuid PRIMARY KEY DEFAULT uuidv7(),
  user_id         text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  endpoint        text NOT NULL UNIQUE CHECK (char_length(endpoint) <= 1024),
  p256dh          text NOT NULL CHECK (char_length(p256dh) <= 200),
  auth            text NOT NULL CHECK (char_length(auth) <= 100),
  expiration_time timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON push_device (user_id);
```

### 시험 DB와 표 정의

- **시험 DB 도우미:** 새 표는 btree_gist 확장이 필요하다. `apps/api/src/db/test-db.ts`가 `PGlite.create({ extensions: { btree_gist } })`로 DB를 만들고 마이그레이션을 적용해 돌려준다. 모든 시험은 이 도우미만 쓴다.
- **`schema.ts`:** 새 표를 조회용으로 다시 쓴다. drizzle이 담지 못하는 `tstzrange`는 customType으로 칸만 맞춘다. EXCLUDE와 부분 유일 인덱스는 SQL에만 있다.
- **맞춤 검사(CI):** 마이그레이션을 적용한 DB의 `information_schema`와 drizzle 정의를 맞댄다. 표, 칸, 타입, NULL 여부를 본다.
- **설계 검사(로컬, `npm run check:design --workspace @vada/api`):**
  - 마이그레이션 DB와 physical-model.md를 그대로 적용한 DB를 맞댄다. 표, 칸, 제약, 인덱스를 본다.
  - 설계 밖 표 7개는 목록으로 적어 빼고 본다.

## 기록 모듈 (`apps/api/src/records/`)

모든 쓰기는 이 모듈을 거친다(DEC-33, DEC-34, DEC-46).

- **`createRecord(tx, { kind, councilId, actor, values })`**
  1. `record` 행을 넣는다. `created_by`는 행위자이고, 신청자나 시스템이면 비운다.
  2. 하위 행을 넣는다.
  3. 판 1을 연다. 유효 기간은 [지금, 끝 없음)이고, 바꾼 사람은 행위자다. 판에는 하위 행의 칸 값 전체를 담는다.
  4. 식별자를 돌려준다.
  - `councilId`는 학생회와 운영진만 비운다. 나머지 종류는 꼭 받는다.
  - 학생회 소속과 부서 소속은 기수나 부서의 학생회와 같아야 한다.
- **`updateRecord(tx, { kind, id, actor, reason, changes })`**
  1. 하위 행을 `FOR UPDATE`로 잠근다.
  2. 하위 행을 바꾼다.
  3. 지금 판을 닫는다(끝 = 지금).
  4. 새 판을 연다. 바뀐 칸 값 전체와 바꾼 사람, 사유를 담는다.
  - 확정한 기록(`record.confirmed_at`이 있음)은 사유가 꼭 있어야 한다.
- 시각은 `clock_timestamp()`로 적는다. 한 거래에서 두 번 바꿔도 판이 겹치거나 비지 않는다.
- 지우기는 이 모듈의 일이 아니다. 바탕에서 지우는 것은 쓰인 적 없는 부서 하나뿐이다. 이때 판, 하위 행, 기록 행을 한 거래로 지운다.

## 권한 (`apps/api/src/access/`)

- **`actorOf(tx, userId, councilId)`:** 요청마다 DB를 읽는다. 그래서 내보내면 세션이 남아 있어도 다음 요청부터 막힌다.
  1. 로그인 잇기에서 운영진을 찾는다.
  2. 지금 소속을 찾는다. 지금 소속은 끝 시각이 비어 있고, 오늘(한국 날짜)이 기수 기간 안인 학생회 소속이다.
  3. 학생회 직급과 지금 부서 소속(부서, 역할, 부서 직급)을 돌려준다.
- **`can(actor, action, context)`:** 권한표 하나를 코드로 둔다.
  - 회장단: 학생회 직급이 있다.
  - 재정부: 재정 역할 부서의 지금 소속이다.
  - 상속: 회장단은 모든 부서에서 부장 권한을 가진다. 재정 권한은 상속하지 않는다.
  - 합치기: 여러 기준에 해당하면 권한을 합친다.
  - 직무 분리: 요청한 사람은 자기 요청을 승인하지 않는다. 구매 결재 칸은 직무 분리를 두지 않는다(DEC-41).
- **바탕의 조직 칸(DEC-28, DEC-47)**

| 동작 | 하는 사람 |
|---|---|
| 학생회 정보와 직급 표시 이름 고치기 | 회장단 |
| 기수 고치기 | 회장단 |
| 부서 만들기, 이름 바꾸기, 없애기, 재정 역할 주고 거두기 | 회장단 |
| 초대 코드 보기와 바꾸기 | 회장단 |
| 운영진 내보내기, 부서 배정과 빼기 | 회장단 |
| 부회장 직급, 부장과 부부장 직급 주고 거두기 | 회장단 |
| 회장 직급 넘기기 | 회장 |
| 학생회, 운영진, 부서 보기 | 모든 운영진 |

- 라우트는 입력 검사(`json()`), 세션 확인, `actorOf`, `can` 순서다(AGENTS.md: 입력 검사를 인증보다 앞에 둔다). 권한이 없으면 403 `FORBIDDEN`이다.
- 화면은 서버가 돌려준 내 권한 목록으로 동작 버튼을 보이거나 숨긴다(DEC-38). 권한을 화면에서 다시 계산하지 않는다.

## 로그인 잇기 (G1)

- 학생회를 만들거나 초대로 들어올 때, 로그인한 계정이 운영진과 이어져 있지 않으면 새로 잇는다.
  1. 운영진(`member`)을 만든다. 이름은 로그인 이름, 이메일은 로그인 이메일의 소문자다.
  2. 로그인 잇기 행을 만든다.
  - 같은 이메일의 운영진이 이미 있고 아직 잇지 않았으면, 그 운영진에 잇는다.
- 그 밖의 요청은 로그인 잇기로 운영진을 찾는다. 이어지지 않은 계정은 어느 학생회에도 없는 것으로 본다.
- 이메일이 바뀌어도 같은 Google 계정이면 연결이 그대로다. 다른 Google 계정으로 로그인하면 다른 사람으로 본다.

## API

경로는 `/api/organizations/`(공통 가드)와 `/api/me/`, 읽기 전용 초대 확인에 둔다. 요청 본문은 `packages/contracts`의 `z.strictObject`이고, 저장소 규칙(AGENTS.md)을 따른다.

| 경로 | 하는 일 | 권한 |
|---|---|---|
| `GET /api/me/councils` | 내 학생회 목록(학생회, 직급, 부서) | 로그인 |
| `POST /api/organizations/create` | 학생회 만들기(이름, 단위, 학교, 기수 이름과 기간) | 로그인 |
| `GET /api/invites/:code` | 초대 확인(학생회 이름, 이미 들어왔는지) | 로그인 |
| `POST /api/organizations/join` | 초대 코드로 들어오기 | 로그인 |
| `GET /api/organizations/:councilId` | 학생회 정보, 지금 기수, 내 직급과 부서, 내 권한 목록 | 운영진 |
| `POST /api/organizations/:councilId/settings` | 학생회 정보와 직급 표시 이름 고치기 | 회장단 |
| `POST /api/organizations/:councilId/cohort` | 지금 기수의 이름과 기간 고치기 | 회장단 |
| `GET /api/organizations/:councilId/members` | 운영진 목록(이름, 직급, 부서와 부서 직급, 들어온 시각). 이메일은 없다 | 운영진 |
| `GET /api/organizations/:councilId/invite` | 초대 코드 | 회장단 |
| `POST /api/organizations/:councilId/invite/rotate` | 초대 코드 바꾸기 | 회장단 |
| `POST /api/organizations/:councilId/departments` | 부서 만들기 | 회장단 |
| `POST /api/organizations/:councilId/departments/:departmentId` | 이름 바꾸기, 재정 역할 주고 거두기 | 회장단 |
| `POST /api/organizations/:councilId/departments/:departmentId/delete` | 쓰인 적 없는 부서 없애기. 쓰였으면 409 `DEPARTMENT_IN_USE` | 회장단 |
| `POST /api/organizations/:councilId/members/:memberId/departments` | 부서 배정과 부서 직급(부장, 부부장, 없음) | 회장단 |
| `POST /api/organizations/:councilId/members/:memberId/departments/:departmentId/remove` | 부서에서 빼기 | 회장단 |
| `POST /api/organizations/:councilId/members/:memberId/rank` | 부회장 주고 거두기 | 회장단 |
| `POST /api/organizations/:councilId/president/transfer` | 회장 넘기기. 넘긴 사람은 직급 없음이 된다 | 회장 |
| `POST /api/organizations/:councilId/members/:memberId/remove` | 내보내기. 회장이면 409 `PRESIDENT_CANNOT_LEAVE` | 회장단 |
| `POST /api/me/push/devices` | 알림 받을 기기 저장. 같은 주소면 열쇠를 갱신한다 | 로그인 |
| `POST /api/me/push/devices/remove` | 알림 받을 기기 지우기 | 로그인 |

- 다른 학생회의 운영진이 경로의 `councilId`를 바꿔 부르면 403이다. 다른 학생회의 부서나 운영진 번호를 넣으면 404다.
- 초대 코드 입력은 지금 vada의 `InviteCodeSchema`(공백과 하이픈 제거, 대문자)를 그대로 쓴다.
- 운영진이 이미 지금 기수에 들어와 있으면 들어오기는 아무것도 바꾸지 않고 그 학생회를 돌려준다. 동시에 와도 유일 제약이 소속을 하나로 지킨다.

## 화면

메뉴는 navigation.md의 틀을 따르되, 바탕에서는 '운영진'만 연다. 나머지 메뉴(대화, 업무, 재정, 행사)는 그 덩어리에서 연다.

- **학생회가 없을 때:** [초대 코드로 들어가기](코드 입력)와 [학생회 만들기] 둘을 보인다.
- **학생회 만들기**
  - 입력: 이름, 단위(학과, 단과대, 총학생회), 학교, 기수 이름(기본 올해 연도), 임기(기본 올해 1/1~12/31)
  - 만들면 운영진 > 사람으로 간다.
- **초대 링크(`/join/코드`)**
  - "OOO 학생회에 들어갈까요?" [들어가기]
  - 이미 들어왔으면 그 학생회를 연다.
  - 로그인 전이면 로그인 뒤 같은 화면으로 돌아온다(지금 vada와 같다).
- **작업 공간 틀**
  - 위: 학생회 이름 메뉴(학생회 고르기, 설정)
  - 옆 메뉴: 운영진
  - 아래 사용자 줄: 이름, 휴대폰 알림(종), 로그아웃
  - 휴대폰 폭에서는 옆 메뉴가 시트로 바뀐다(지금 vada와 같다).
- **운영진 > 사람**
  - 목록: 이름, 직급(학생회가 정한 표시 이름), 부서와 부서 직급, 들어온 날
  - 회장단: 위의 [초대 링크](링크 복사, 코드 바꾸기)와, 줄마다 ⋯ 메뉴(부서 배정, 직급, 내보내기)를 본다.
  - 회장: ⋯ 메뉴에 [회장 넘기기]가 더 있다.
  - 내보내기와 회장 넘기기는 확인 대화상자를 거친다.
- **운영진 > 부서**
  - 목록: 이름, 역할(재정), 부서원 수
  - 회장단: [부서 만들기]와 줄마다 이름 바꾸기, 재정 역할 주고 거두기, 없애기를 본다. 없애기는 쓰인 적 없는 부서만 된다.
- **설정 > 학생회 정보**
  - 이름, 단위, 학교, 직급 표시 이름 4개, 지금 기수의 이름과 기간
  - 회장단만 고친다. 나머지 운영진은 보기만 한다.
- **휴대폰 알림:** '알림 켜기'가 구독을 만든 뒤 `POST /api/me/push/devices`로 저장한다. 시험 알림은 그대로다.
- 문구, 부품, 모양은 저장소 규칙(AGENTS.md 화면 절)을 따른다. 새 부품과 변형은 `/ui.html`에 더한다.

## 시험 데이터

`apps/api/scripts/test-data.ts`를 새 표로 다시 쓴다. 개발 DB에 시험 학생회 하나를 만들고, 기존 Google 계정을 회장이나 부서원으로 넣는다. 한 번 더 돌려도 같은 결과가 나와야 한다. 시연 데이터는 덩어리 6에서 다시 쓴다.

## 테스트

- **DB:** 표 45개와 설계 밖 표 3개가 만들어진다. 회장 둘, 판 기간 겹침, 초대 코드 형식, 로그인 잇기 중복을 DB가 막는다.
- **맞춤 검사:** 조회용 정의와 DB가 같다.
- **기록 모듈:** 만들기는 기록, 하위 행, 판 1을 한 번에 만든다. 바꾸기는 지금 판을 닫고 새 판을 연다. 한 거래에서 두 번 바꿔도 판이 이어진다. 확정한 기록은 사유 없이 바꿀 수 없다. 학생회 번호 규칙이 지켜진다.
- **권한:** 조직 칸마다 허용 한 사람과 거부 한 사람을 둔다. 다음도 시험한다.
  - 상속(회장단의 부장 권한)과 재정 권한이 상속되지 않는 것
  - 끝난 소속이나 기간이 지난 기수의 사람은 막힌다.
  - 다른 학생회 사람은 막힌다.
- **흐름(서버 통합):** 아래를 한 이야기로 잇는다(그림의 예시와 같다).
  1. 학생회를 만든다.
  2. 링크로 들어온다.
  3. 부서를 배정한다.
  4. 내보낸다. 내보낸 사람의 다음 요청은 403이다.
  5. 다시 들어온다.
  6. 회장을 넘긴다.
  - 판의 개수와 바꾼 사람, 각 단계의 DB 상태를 확인한다.
- **입력:** 새 스키마마다 저장소 규칙의 경우를 모두 넣는다. 필수값 누락, 빈 값, 상한+1(이모지), NUL과 서러게이트, 모르는 키, 다른 학생회 사용자, 미인증이다.
- **경계 테스트:** 새 경로가 모두 들어간다.
- **화면:** 학생회 없음, 만들기, 초대 확인, 사람과 부서 목록, 회장단과 아닌 사람의 동작 보이기·숨기기, 확인 대화상자, 알림 켜기의 기기 저장을 시험한다.

## 바꾸는 날

다시 만들기 설계서의 순서를 따른다. 바탕이 끝나면 아래 차례로 한다.

1. 사용자가 로컬 `.env`의 `DATABASE_URL`을 새 Neon 프로젝트 `vada`의 `dev` 가지 주소로 바꾼다. 개발 중에는 이 DB를 쓴다.
2. 배포 전 점검:
   - 첫 마이그레이션을 새 `production` 가지에 적용한다. 적용 전에 DB가 비어 있는지 확인한다(사용자 승인).
   - 적용은 `DATABASE_URL`을 그 주소로 준 채 `npm run db:migrate --workspace @vada/api`를 사용자가 직접 실행한다.
3. 사용자가 반영하라고 하면 main에 합치고 올린다.
4. 사용자가 Render의 `DATABASE_URL`을 새 `production` 주소로 바꾼다.
5. vada-m1에서 확인한다.
   - 로그인, 학생회 만들기, 초대로 들어오기
   - 휴대폰 알림 켜기와 기기 저장
6. 막히면 Render를 옛 주소와 바탕 전 배포로 되돌린다. 옛 DB(`vada-m1-dev`)는 시범 운영이 시작할 때까지 둔다.

## 열린 것

- **다음 기수:** 기수 기간이 끝나면 모든 운영진의 권한이 닫힌다. 시범 운영은 12/21에 끝나 괜찮지만, 1월 전에 다음 기수 도구(RFC-6)가 있어야 한다.
- **나간 운영진의 개인정보:** 이름과 이메일을 언제 지울지는 처리방침(덩어리 6)에서 정한다.
- **같은 사람의 두 Google 계정:** 다른 사람으로 본다. 시범 운영에서 문제가 되는지 본다.
- **로그아웃한 브라우저의 알림 기기:** 바탕에서는 계정에 남기고, 같은 브라우저에서 다른 계정이 알림을 켜면 그 계정으로 옮긴다. 업계에서는 보통 로그아웃할 때 구독을 지운다. 알림을 처음 보내는 덩어리 3이 그 전에 정한다.
