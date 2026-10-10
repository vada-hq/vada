# M3a 행사 참가 신청 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:** 행사에 일시·장소를 넣고, 행사마다 공개 신청 링크로 로그인 없이 참가 신청을 받으며, 운영진이 명단을 보고 취소하고, 신청자 정보는 행사가 끝나고 30일 뒤 저절로 지운다.

**Architecture:**
- 신청 설정은 `registration_forms`(행사당 하나), 신청 한 건은 `registrations`다.
- 개인 칸(토큰 해시·이름·학번·휴대폰)은 취소나 보관 기간 만료 때 NULL로 지우고 `purged_at`을 남긴다. 신청 수는 행으로 남는다.
- 지우기는 `registrations/purge.ts` 한 곳이 한다. 서버 시작·1시간마다 전체를 지우고, 신청 하나를 다루는 요청이 먼저 그 신청을 지운다.
- 상태(`open`·`paused`·`upcoming`·`full`·`closed`)는 `registrations/state.ts`의 순수 함수가 주입한 시계로 계산한다.
- 운영진 경로는 `/api/organizations/.../events/:eventId/registration`, 공개 경로는 `/api/public/...`다. 공통 가드를 `/api/public/*`에도 건다.
- 공개 화면은 같은 `index.html`에서 `main.tsx`가 주소를 보고 동적 import로 따로 불러온다. 로그인 코드와 카카오톡 넘기기를 거치지 않는다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, React 19 + Tailwind, vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-10-event-registration-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`다. 문자열은 `text(max)`/`token(max)`으로만 만들고, 모든 문자열·숫자에 상한을 둔다.
  - 이름 30자, 장소 100자, 안내 문구 1000자
  - 정원 1~5000
  - 학번: 공백과 `-`를 뺀 숫자 6~12자리
  - 휴대폰 번호: 공백과 `-`를 뺀 `01` + 8~9자리
  - 토큰: base64url 22자
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`로 던지고, 라우트별 `onError`를 만들지 않는다.
- 길이·형식 제한이 있는 칸은 DB CHECK도 같은 값으로 둔다.
- 0020은 새 칸·새 표를 새 코드가 읽는다. 그래서 두 DB(dev, m1-preview)에 먼저 적용하고 배포한다. 기존 칸에 새 제약을 걸지 않는다.
- 시각은 한국 시각 `YYYY-MM-DDTHH:mm` 문자열로 주고받는다(2000~2999년). DB는 `timestamptz`다.
- 개인정보(이름·학번·휴대폰)와 토큰을 로그·오류 응답·Sentry에 넣지 않는다.
  - 토큰은 화면 주소의 `#` 뒤와 요청 본문에만 둔다. API 경로에 넣지 않는다.
  - DB에는 SHA-256만 둔다.
- 공개 변경 라우트는 `/api/public/` 아래에 두고, 공통 가드(출처·형식·크기)가 먼저 건다.
- 화면 규칙
  - `components/ui` 부품을 쓴다. 체크박스만 `size-4 accent-blue-600`이다.
  - Tailwind 기본 스케일과 테마 토큰만 쓴다.
  - 긴 이름·링크·안내 문구에는 `wrap-anywhere`를 준다.
  - 버튼은 같은 스키마의 `safeParse`로 켠다. 길이 숫자를 화면에 다시 적지 않는다.
- 시간에 기대는 테스트는 2025년 이전이나 2999년 날짜, 또는 주입한 시계만 쓴다.
- 커밋 제목은 한국어 명령형 50자 안이다. AI 서명·트레일러를 붙이지 않는다.
- 새 테스트 파일은 워크스페이스 `test` 스크립트 목록에 더한다(api·contracts는 파일을 나열한다).

## Review Focus

1. **학번을 하이픈·공백으로 바꿔 넣는 중복 신청**(`2022-123456`, ` 2022 123456 `): 정리한 값으로 저장한다. 같은 학번으로 보고 `ALREADY_REGISTERED`가 된다. → Task 1·6 테스트
2. **마감·시작 시각 정각:**
   - 지금 = 마감 시각이면 `closed`다.
   - 지금 = 시작 시각이면 `open`이다.
   - 1분 전은 `upcoming`이다.
   - → Task 4(상태 함수)·Task 6 테스트
3. **정원을 지금 신청 수보다 낮추기:** 기존 신청은 그대로 두고 `full`이 된다. 한 명이 취소해도 아직 정원 이상이면 `full`이다. → Task 5 테스트
4. **localStorage가 막힌 브라우저**(사파리 개인 모드, 일부 웹뷰): 신청과 내 신청 화면은 그대로 되고, 기기 저장만 건너뛴다. → Task 9 테스트
5. **카카오톡 인앱 브라우저:** 공개 경로(`/apply/…`, `/r`)는 기본 브라우저로 넘기지 않는다. 다른 경로는 지금처럼 넘긴다. → Task 7 테스트

---

### Task 1: 참가 신청·행사 정보 계약

**Files:**
- Create: `packages/contracts/src/korean-time.ts`, `packages/contracts/src/registrations.ts`, `packages/contracts/src/registrations.test.ts`
- Modify: `packages/contracts/src/events.ts`, `packages/contracts/src/index.ts`, `packages/contracts/package.json`(test 목록)

**Interfaces (Produces):**
- `korean-time.ts`
  - `koreanDateTime`: `token(16)`에 `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$`, 달력에 있는 날짜, 2000~2999년을 건다.
  - `dateFromKorean(value: string): Date`: `new Date(`${value}:00+09:00`)`
  - `koreanOf(date: Date): string`: `toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16).replace(' ', 'T')`
- `events.ts`
  - `EVENT_PLACE_MAX = 100`
  - `UpdateEventSchema = z.strictObject({ version, startsAt: koreanDateTime.nullable(), endsAt: koreanDateTime.nullable(), place: text(100).nullable() })`
    - `.refine`: `endsAt`가 있으면 `startsAt`도 있고, `endsAt > startsAt`(문자열 비교)이다.
  - `UpdateEventRequest`
- `index.ts`
  - `EventSummary`에 `startsAt: string | null; endsAt: string | null; place: string | null; version: number`
  - `MembershipPermissions.manageEvents: boolean`
- `registrations.ts`
  - 상한
    - `REGISTRATION_NAME_MAX = 30`, `REGISTRATION_NOTICE_MAX = 1000`, `REGISTRATION_CAPACITY_MAX = 5000`
    - `REGISTRATION_RETENTION_DAYS = 30`
  - 값 정리
    - `studentIdInput = token(20).transform(v => v.replace(/[\s-]/g, '')).refine(v => /^\d{6,12}$/.test(v))`
    - `phoneInput = token(20).transform(같은 정리).refine(v => /^01\d{8,9}$/.test(v))`
  - `formFields = { opensAt: koreanDateTime.nullable(), closesAt: koreanDateTime, capacity: z.number().int().min(1).max(5000).nullable(), notice: text(1000).nullable(), collectPhone: z.boolean() }`
    - `.refine`: `opensAt === null || opensAt < closesAt`
  - 요청 스키마
    - `CreateRegistrationFormSchema = z.strictObject(formFields).refine(...)`
    - `UpdateRegistrationFormSchema = z.strictObject({ version, accepting: z.boolean(), ...formFields }).refine(...)`
    - `CancelRegistrationSchema = z.strictObject({})`
    - `RegisterSchema = z.strictObject({ name: text(30), studentId: studentIdInput, phone: phoneInput.nullable(), agreed: z.literal(true) })`
    - `RegistrationTokenSchema = z.strictObject({ token: token(22).refine(v => /^[A-Za-z0-9_-]{22}$/.test(v)) })`
  - 응답 타입
    - `RegistrationState = 'open' | 'paused' | 'upcoming' | 'full' | 'closed'`
    - `RegistrationFormView { id; code; accepting; opensAt; closesAt; capacity; notice; collectPhone; version; state; count; purgeAfter: string /* YYYY-MM-DD */; purged: boolean; updatedAt }`
    - `RegistrationEntry { id; name; studentId; phone: string | null; createdAt /* 한국 시각 */ }`
    - `RegistrationResponse { form: RegistrationFormView | null; registrations: RegistrationEntry[] }`
    - `PublicRegistrationForm { organizationName; event: { name; startsAt; endsAt; place }; notice; collectPhone; state; opensAt; closesAt; remaining: number | null; purgeAfter }`
    - `RegistrationCreated { token: string }`
    - `MyRegistration { code; organizationName; event: {…}; name: string | null; studentId: string | null; phone: string | null; createdAt; cancelled: boolean; cancellable: boolean }`

- [ ] **Step 1: 실패하는 계약 테스트** — `registrations.test.ts`
  - 한국 시각
    - `2026-08-20T10:00`을 받는다. `2026-02-30T10:00`, `2026-08-20 10:00`, `1999-12-31T23:59`, `3000-01-01T00:00`, 17자는 거절한다.
    - `koreanOf(dateFromKorean(v)) === v`(여러 값). `dateFromKorean('2026-08-20T10:00').toISOString() === '2026-08-20T01:00:00.000Z'`
  - 행사 수정
    - 끝만 있음, 끝 ≤ 시작은 거절한다.
    - 장소: 이모지 100자는 받고 101자·공백만·NUL·홀로 쓰인 서러게이트는 거절한다.
    - 버전 0, 모르는 키는 거절한다. `isStrictObject`는 참이다.
  - 신청 설정
    - 시작 ≥ 마감, 정원 0·5001·1.5, 안내 이모지 1001자, `collectPhone` 빠짐, 모르는 키는 거절한다.
    - 정원 null과 안내 null은 받는다.
    - 수정은 `accepting`과 `version`이 꼭 있다.
  - 신청
    - `' 2022-123456 '` → `'2022123456'`
    - `'010-1234-5678'` → `'01012345678'`
    - 학번 `12345`, 13자리, `2022a12345`는 거절한다. 휴대폰 `02-123-4567`, `0101234567890`도 거절한다.
    - `agreed: false`와 빠짐, 이름 31자(이모지)·공백만·NUL, 모르는 키는 거절한다.
  - 토큰: 22자 base64url만 받는다. 21자, 23자, `+/` 섞인 값은 거절한다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations.test.ts`(packages/contracts) → 모듈 없음
- [ ] **Step 3: 구현** — 위 Interfaces 그대로 쓴다. `index.ts`에서 `korean-time.ts`와 `registrations.ts`를 내보낸다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`, `npx tsc --noEmit -p packages/contracts`
  - api·웹의 `EventSummary`·권한 고정값은 Task 3·10에서 고친다.
- [ ] **Step 5: 커밋** — `참가 신청 계약 추가`

### Task 2: 행사 일시·참가 신청 표와 마이그레이션 0020

**Files:**
- Modify: `apps/api/src/db/schema.ts`(`events`에 칸 추가, `registrationForms`·`registrations` 새로)
- Create: `apps/api/migrations/0020_event_registration.sql`, `meta/0020_snapshot.json`, `meta/_journal.json`(drizzle-kit 생성)
- Test: `apps/api/src/db/migrations.test.ts`에 0020 테스트

**Interfaces (Produces):** `events.startsAt/endsAt/place/version`, `registrationForms`, `registrations`(칸 이름은 spec 데이터 절)

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — 0019 테스트와 같은 꼴로 `migrationsBefore('0020_event_registration')`에서 시작한다. 행사 둘(o: e, o2: e2)을 넣고 올린 뒤 다음을 확인한다.
  - 기존 행사의 칸은 그대로이고, 새 칸은 NULL과 `version = 1`이다.
  - events
    - 끝만 있으면 `events_ends_after_start`, 끝 ≤ 시작도 같은 제약이다.
    - 공백 장소는 `events_place_not_blank`, 101자는 `events_place_length`, 1999년은 `events_time_range`다.
  - registration_forms
    - 같은 행사 둘째는 유일 제약에 걸린다.
    - 다른 학생회 행사는 `registration_forms_event_same_organization`이다.
    - `opens_at >= closes_at`는 `registration_forms_opens_before_closes`다.
    - 정원 0·5001은 `_capacity_range`, 공백 안내는 `_notice_not_blank`, 1001자는 `_notice_length`다.
    - 기본 코드는 8자리 형식이고, `abc`는 `_code_format`이다.
  - registrations
    - 살아 있는 행(토큰·이름·학번 있음, `purged_at` NULL)은 된다. 지운 행(네 칸 NULL, `purged_at` 있음)도 된다.
    - 섞인 행(이름만 NULL, 또는 지웠는데 휴대폰이 남음)은 `registrations_purged_state`다.
    - 취소했는데 안 지운 행은 `registrations_cancel_purges`, `cancelled_by`만 있으면 `registrations_cancelled_pair`다.
    - 학번 `abc`는 `_student_id_format`, 휴대폰 `0212345678`은 `_phone_format`, 이름 31자는 `_name_length`다.
    - 같은 신청에 살아 있는 같은 학번 둘째는 `registrations_form_student_active_unique`다. 지운 행끼리는 같은 학번이 없으니 겹치지 않는다.
    - 다른 학생회의 신청 설정을 가리키면 `registrations_form_same_organization`이다.
  - 신청이 있는 신청 설정과 행사는 지울 수 없다(FK RESTRICT).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → `Migration not found: 0020_event_registration`
- [ ] **Step 3: 스키마 추가 후 생성**

```ts
// events에 더한다. 한국 시각으로 받은 시작·끝 일시와 장소(M3a). 끝은 시작이 있어야 하고 시작보다 늦다.
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  place: text('place'),
  version: integer('version').notNull().default(1),
  check('events_ends_after_start', sql`${table.endsAt} IS NULL OR (${table.startsAt} IS NOT NULL AND ${table.endsAt} > ${table.startsAt})`),
  check('events_time_range', sql`(${table.startsAt} IS NULL OR ${table.startsAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND (${table.endsAt} IS NULL OR ${table.endsAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')`),
  check('events_place_not_blank', sql`${table.place} ~ '[^[:space:]]'`),
  check('events_place_length', sql`char_length(${table.place}) <= 100`),
  check('events_version_positive', sql`${table.version} >= 1`),

// 행사의 참가 신청 설정. 행사 하나에 하나이고, 공개 링크 코드는 바뀌지 않는다.
export const registrationForms = pgTable('registration_forms', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  eventId: text('event_id').notNull().unique(),
  code: text('code').notNull().default(sql`vada_invite_code()`),
  accepting: boolean('accepting').notNull().default(true),
  opensAt: timestamp('opens_at', { withTimezone: true }),
  closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
  capacity: integer('capacity'),
  notice: text('notice'),
  collectPhone: boolean('collect_phone').notNull().default(false),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  foreignKey({ name: 'registration_forms_event_same_organization', columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id] }).onDelete('restrict'),
  unique('registration_forms_code_unique').on(table.code),
  unique('registration_forms_organization_id_unique').on(table.organizationId, table.id),
  check('registration_forms_code_format', sql`${table.code} ~ '^[2-9A-HJ-NP-Z]{8}$'`),
  check('registration_forms_opens_before_closes', sql`${table.opensAt} IS NULL OR ${table.opensAt} < ${table.closesAt}`),
  check('registration_forms_time_range', sql`(${table.opensAt} IS NULL OR ${table.opensAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00')
    AND ${table.closesAt} BETWEEN '2000-01-01T00:00+09:00' AND '2999-12-31T23:59+09:00'`),
  check('registration_forms_capacity_range', sql`${table.capacity} BETWEEN 1 AND 5000`),
  check('registration_forms_notice_not_blank', sql`${table.notice} ~ '[^[:space:]]'`),
  check('registration_forms_notice_length', sql`char_length(${table.notice}) <= 1000`),
  check('registration_forms_version_positive', sql`${table.version} >= 1`),
])

// 참가 신청 한 건. 취소하거나 보관 기간이 지나면 개인 칸을 지우고 행은 신청 수로 남긴다.
export const registrations = pgTable('registrations', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  formId: text('form_id').notNull(),
  // 개인 링크 토큰의 SHA-256. 토큰 자체는 저장하지 않는다.
  tokenHash: text('token_hash').unique(),
  name: text('name'),
  studentId: text('student_id'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  // 운영진이 취소하면 그 사람, 신청자가 스스로 취소하면 비어 있다.
  cancelledBy: text('cancelled_by').references(() => users.id, { onDelete: 'restrict' }),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
}, (table) => [
  foreignKey({ name: 'registrations_form_same_organization', columns: [table.organizationId, table.formId],
    foreignColumns: [registrationForms.organizationId, registrationForms.id] }).onDelete('restrict'),
  check('registrations_purged_state', sql`(${table.purgedAt} IS NULL AND ${table.tokenHash} IS NOT NULL AND ${table.name} IS NOT NULL
    AND ${table.studentId} IS NOT NULL) OR (${table.purgedAt} IS NOT NULL AND ${table.tokenHash} IS NULL AND ${table.name} IS NULL
    AND ${table.studentId} IS NULL AND ${table.phone} IS NULL)`),
  check('registrations_cancel_purges', sql`${table.cancelledAt} IS NULL OR ${table.purgedAt} IS NOT NULL`),
  check('registrations_cancelled_pair', sql`${table.cancelledBy} IS NULL OR ${table.cancelledAt} IS NOT NULL`),
  check('registrations_token_hash_format', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
  check('registrations_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('registrations_name_length', sql`char_length(${table.name}) <= 30`),
  check('registrations_student_id_format', sql`${table.studentId} ~ '^[0-9]{6,12}$'`),
  check('registrations_phone_format', sql`${table.phone} ~ '^01[0-9]{8,9}$'`),
  uniqueIndex('registrations_form_student_active_unique').on(table.formId, table.studentId).where(sql`${table.purgedAt} IS NULL`),
  index('registrations_form_created_idx').on(table.formId, table.createdAt),
])
```

  - `npx drizzle-kit generate --name event_registration`(apps/api)로 생성한다.
  - 생성된 SQL에서 events에는 ADD COLUMN과 새 칸의 CHECK만 있는지 확인한다.
  - SQL은 LF여야 한다(`.gitattributes`).
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts`
- [ ] **Step 5: 커밋** — `참가 신청 표와 마이그레이션 0020 추가`

### Task 3: 행사 운영 권한과 행사 정보 수정 API

**Files:**
- Modify: `apps/api/src/access/membership.ts`(`permissionsOf`), `apps/api/src/events/events.ts`
- Modify(고정값)
  - 권한 객체를 비교하는 테스트 6곳: `access.test.ts`, `organization.test.ts`, 웹 `Memberships.test.tsx`, `App.integration.test.tsx`, `App.test.tsx`, `Workspace.test.tsx`
  - `workflow-fixtures.ts`: 권한에 `manageEvents`를 더하고, `event()`에 `startsAt: null, endsAt: null, place: null, version: 1`을 더한다.
- Test: `apps/api/src/events/events.test.ts`에 새 테스트

**Interfaces:**
- Consumes: `UpdateEventSchema`, `koreanOf`, `dateFromKorean`(Task 1), 0020 칸(Task 2)
- Produces:
  - `permissionsOf(...).manageEvents = department !== null`
  - `requireEventManager()`(`access/membership.ts`): `requireMembership` 다음에 두는 미들웨어. `manageEvents`가 아니면 `ApiError('FORBIDDEN', 403)`이다.
  - `serializeEvent(row): EventSummary`: 시각은 `koreanOf`로 바꾼다.
  - `PATCH /api/organizations/:organizationId/events/:eventId`

- [ ] **Step 1: 실패하는 테스트** — `events.test.ts`에 새 `test`를 더한다. setup은 기존 테스트처럼 한다. 미배정 구성원 n을 더하고, 행사를 하나 만든다.
  - 목록과 생성 응답의 새 칸: `startsAt: null, endsAt: null, place: null, version: 1`
  - 수정: `{ version: 1, startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: '  체육관 ' }` → 200
    - 응답은 장소를 다듬은 값이고 `version: 2`다.
    - DB `starts_at`이 `2026-08-20T01:00:00Z`인지 본다.
  - 같은 `version: 1`로 다시 보내면 409 `VERSION_CONFLICT`다.
  - 거절
    - 미배정 n: 403. 다른 학생회 x: 403. 미인증: 401
    - 없는 행사, 다른 학생회 행사: 404
  - 본문 검사는 인증보다 먼저다: 빈 값, 끝만, 101자 장소, NUL, 모르는 키는 미인증이어도 400 `INVALID_INPUT`이다.
  - 신청 설정과의 제약: SQL로 `registration_forms`를 넣는다(closes_at = 2026-08-20T18:00+09).
    - 시작을 비우면 409 `EVENT_TIME_REQUIRED`다.
    - 끝을 17:00으로 당기면 409 `DEADLINE_AFTER_EVENT`다.
    - 끝 없이 시작만 18:00이면 된다(마감 = 행사 끝).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/events/events.test.ts`
- [ ] **Step 3: 구현**
  - `permissionsOf`에 `manageEvents: department !== null`을 더한다. 주석: "부서가 있는 구성원은 행사 정보와 참가 신청을 관리한다(초대 코드만으로 들어온 미배정은 신청자 정보를 보지 않는다)."
  - `events.ts` PATCH
    1. 트랜잭션 안에서 행사를 `FOR UPDATE`로 읽는다(학생회 조건). 없으면 404다.
    2. version이 다르면 409다.
    3. 그 행사의 신청 설정을 읽는다. 있으면 다음을 본다.
       - 시작이 null이면 `EVENT_TIME_REQUIRED`다.
       - `closes_at > (끝 ?? 시작)`이면 `DEADLINE_AFTER_EVENT`다.
    4. 수정하면서 `version + 1`을 한다.
  - 목록·생성·수정은 모두 `serializeEvent`를 쓴다.
  - 권한 고정값 7곳에 `manageEvents`를 더한다. 부서가 있으면 true, 미배정이면 false다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/events/events.test.ts src/access/access.test.ts src/organization/organization.test.ts`, 웹 `npx vitest run src/access src/App.test.tsx src/App.integration.test.tsx src/workspace`
- [ ] **Step 5: 커밋** — `행사 일시·장소 수정과 행사 운영 권한`

### Task 4: 신청 상태 계산과 파기

**Files:**
- Create: `apps/api/src/registrations/state.ts`, `apps/api/src/registrations/purge.ts`, `apps/api/src/registrations/purge.test.ts`
- Modify: `apps/api/package.json`(test 목록), `apps/api/src/serve.ts`

**Interfaces (Produces):**
- `stateOf(form: { accepting: boolean; opensAt: Date | null; closesAt: Date; capacity: number | null }, count: number, now: Date): RegistrationState`
  - 우선순위: closed(now ≥ closesAt) → paused → upcoming(now < opensAt) → full(capacity !== null && count ≥ capacity) → open
- `eventEnd(event: { startsAt: Date | null; endsAt: Date | null }): Date | null`: 끝 ?? 시작
- `purgeAfterOf(end: Date): Date`: end + 30일
- `purgeExpired(db, formId?: string): Promise<number>`
  - 행사 끝 + 30일 ≤ now()인 행사의 신청에서, 아직 지우지 않은 행의 개인 칸을 NULL로 하고 `purged_at = now()`로 둔다.
  - `formId`를 주면 그 신청만 본다. 지운 행 수를 돌려준다.
- `createRegistrationPurger(db, { onFailure })`: `{ run(): Promise<void>; start(intervalMs = 3_600_000): () => void }`. 상품 조회 실행기처럼 `unref`한다. 실패하면 `REGISTRATION_PURGE_FAILED`만 로그에 남긴다.

- [ ] **Step 1: 실패하는 테스트** — `purge.test.ts`
  - `stateOf` 표 테스트. Review Focus 2를 포함한다.
    - now = closesAt이면 closed다.
    - now = opensAt이면 open이고, 1분 전이면 upcoming이다.
    - 멈춤이면서 마감 지남이면 closed다.
    - 멈춤이면서 시작 전이면 paused다.
    - 정원 = 신청 수이면 full이다.
    - 정원 null이면 open이다.
  - `purgeExpired`: PGlite에 행사 셋을 넣는다.
    - A: 끝 2024-01-01. 지울 때가 지났다.
    - B: 시작만 2024-01-01. 시작이 끝이므로 지울 때가 지났다.
    - C: 시작 2999-01-01
    - 각 행사의 신청에 살아 있는 행, 휴대폰 있는 행, 이미 취소해 지운 행을 넣는다.
    - 한 번 돌리면 A·B의 살아 있는 행만 지워진다(돌려준 수 확인). 네 칸이 NULL이고 `purged_at`이 있으며 `cancelled_at`은 그대로다. C는 그대로다.
    - 다시 돌리면 0이다.
    - `formId`로 B만 주면 A는 남는다.
  - 실행기: `start()`가 바로 한 번 돈다. `onFailure`는 DB 오류에서 불리고 예외를 밖으로 내지 않는다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations/purge.test.ts`
- [ ] **Step 3: 구현**

```ts
// 행사 끝 + 30일이 지난 신청의 개인 칸을 지운다. 취소한 행은 이미 지워져 있다.
export async function purgeExpired(db: Database, formId?: string) {
  const rows = await db.update(registrations).set({ tokenHash: null, name: null, studentId: null, phone: null, purgedAt: sql`now()` })
    .where(and(isNull(registrations.purgedAt), formId === undefined ? undefined : eq(registrations.formId, formId),
      sql`${registrations.formId} IN (SELECT f.id FROM registration_forms f JOIN events e ON e.id = f.event_id AND e.organization_id = f.organization_id
        WHERE coalesce(e.ends_at, e.starts_at) + interval '30 days' <= now())`))
    .returning({ id: registrations.id })
  return rows.length
}
```

  `serve.ts`에서 `const stopPurger = createRegistrationPurger(db).start()`를 켜고, `shutdown`에서 끈다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/registrations/purge.test.ts`, `npm run typecheck --workspace @vada/api`
- [ ] **Step 5: 커밋** — `신청 상태 계산과 보관 기간 지난 정보 지우기`

### Task 5: 참가 신청 운영진 API

**Files:**
- Create: `apps/api/src/registrations/service.ts`, `apps/api/src/registrations/routes.ts`, `apps/api/src/registrations/registrations.test.ts`
- Modify: `apps/api/src/app.ts`(`AppOptions.registrations`, `/api/public/*` 가드), `apps/api/src/serve.ts`, `apps/api/src/purchases/test-setup.ts`(events·registrations 모듈과 `publicRequest`, 시계 주입), `apps/api/package.json`

**Interfaces:**
- Consumes: Task 1 스키마·타입, Task 3 `requireEventManager`·`serializeEvent`, Task 4 `stateOf`·`purgeExpired`·`eventEnd`·`purgeAfterOf`
- Produces:
  - `createRegistrationRoutes(db, getSession, { now = () => new Date() } = {})`: 운영진 경로와 공개 경로(Task 6)를 한 Hono에 둔다.
  - `registrationService(db, now)`
    - `view(organizationId, eventId): RegistrationResponse`
    - `create(scope, eventId, input)`
    - `update(scope, eventId, input)`
    - `cancel(scope, eventId, registrationId)`
  - 테스트 setup: `env.publicRequest(method, path, body?)`(`/api` 앞부분, 같은 출처 헤더), `env.clock.set(date)`

- [ ] **Step 1: 실패하는 테스트** — `registrations.test.ts`
  - 준비: 행사 e에 시작 2999-08-20T10:00, 끝 18:00을 넣는다. 시계는 2999-08-01T00:00이다.
  - 만들기(p, 기획부)
    - `{ opensAt: null, closesAt: '2999-08-19T23:59', capacity: 2, notice: '문의: 학생회실', collectPhone: false }` → 201
    - 응답 `form`: 상태 `open`, `count: 0`, 8자리 코드, `purgeAfter: '2999-09-19'`, `purged: false`, `accepting: true`, `version: 1`
    - 신청 목록은 `[]`다.
  - 거절
    - 둘째 만들기는 409 `REGISTRATION_EXISTS`다.
    - 시작 일시 없는 행사 e2는 409 `EVENT_TIME_REQUIRED`다.
    - 마감이 행사 끝보다 늦으면 409 `DEADLINE_AFTER_EVENT`다.
    - 다른 학생회 행사 ex와 없는 행사는 404다.
  - 권한: 미배정 n과 다른 학생회 x는 GET·POST·PATCH·취소 모두 403이다. 미인증은 401이다. 재정 f와 회장 l은 된다.
  - 본문 검사(인증보다 먼저 400)
    - 필수값 누락, 공백만 안내, 이모지 1001자 안내, NUL과 홀로 쓰인 서러게이트 안내
    - 정원 5001, 시작 ≥ 마감, 모르는 키
  - 수정
    - `accepting: false` → `paused`
    - 옛 version은 409 `VERSION_CONFLICT`다.
    - 정원 null, 안내 null로 비울 수 있다.
  - 휴대폰: 켜서 신청 두 건(공개 경로 또는 SQL)을 받은 뒤 끄면, 두 행의 `phone`이 NULL이 되고 응답 목록의 휴대폰도 null이다.
  - 정원 줄이기(Review Focus 3): 신청 2건에서 정원을 1로 줄인다.
    - `full`이 되고 목록은 2건 그대로다.
    - 1건을 취소하면 신청 수 1 = 정원 1이라 여전히 `full`이다.
  - 취소
    - 운영진 취소 → 그 행은 목록에서 빠진다. DB의 개인 칸은 NULL이고 `cancelled_by = 'p'`다. `count`가 준다.
    - 같은 신청을 다시 취소하면 404다. 다른 행사의 신청 ID도 404다.
  - 보관 기간: 시계와 별개로 SQL로 행사 끝을 2024-01-01로 바꾼다.
    - GET → `purged: true`, 목록은 `[]`, `count`는 그대로다(읽기 전에 지웠다).
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations/registrations.test.ts`
- [ ] **Step 3: 구현**
  - 라우트: `const base = '/organizations/:organizationId/events/:eventId/registration'`
    - `get(base, auth, member, manager, …)`
    - `post(base, json(CreateRegistrationFormSchema), auth, member, manager, …)`
    - `patch(base, json(UpdateRegistrationFormSchema), …)`
    - `post(`${base}/entries/:registrationId/cancel`, json(CancelRegistrationSchema), …)`
  - 서비스
    - 모든 처리는 먼저 `purgeExpired(tx, form.id)`를 부른다. 바꾸는 처리는 트랜잭션 안에서 신청 설정 행을 `FOR UPDATE`로 잡는다.
    - 만들기와 수정의 공통 검사(`assertDeadline`)
      - 행사 시작이 없으면 `EVENT_TIME_REQUIRED`다.
      - `closesAt > eventEnd`이면 `DEADLINE_AFTER_EVENT`다.
    - 수정에서 `collectPhone`이 true → false가 되면, 같은 트랜잭션에서 `UPDATE registrations SET phone = NULL WHERE form_id = ? AND phone IS NOT NULL`을 한다.
    - 취소는 `purgedAt IS NULL`인 행만 한다. 개인 칸을 NULL로 하고 `cancelled_at`·`cancelled_by`·`purged_at`을 채운다.
    - `count`는 `cancelled_at IS NULL`인 행의 수다(지운 행도 센다). 목록은 `purged_at IS NULL`인 행을 `created_at, id` 순으로 준다.
  - `app.ts`
    - `app.use('/api/public/*', mutationGuard(trustedOrigin))`
    - `if (registrations) app.route('/api', registrations)`
  - `serve.ts`에서 `createRegistrationRoutes(db, session)`를 연결한다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/registrations/registrations.test.ts src/http/boundary.test.ts`. boundary는 Task 6에서 고치므로, 여기서는 실패해도 이유만 확인한다.
- [ ] **Step 5: 커밋** — `참가 신청 설정·명단·취소 API`

### Task 6: 공개 신청 API

**Files:**
- Modify: `apps/api/src/registrations/service.ts`, `apps/api/src/registrations/routes.ts`, `apps/api/src/http/boundary.test.ts`
- Create: `apps/api/src/registrations/public.test.ts`
- Modify: `apps/api/package.json`

**Interfaces (Produces):**
- `GET /api/public/registration-forms/:code` → `PublicRegistrationForm`
- `POST /api/public/registration-forms/:code/entries` (`RegisterSchema`) → 201 `RegistrationCreated`
- `POST /api/public/registrations/lookup` (`RegistrationTokenSchema`) → `MyRegistration`
- `POST /api/public/registrations/cancel` (`RegistrationTokenSchema`) → `MyRegistration`(`cancelled: true`, 개인 칸 null)
- 토큰: `randomBytes(16).toString('base64url')`. 해시는 `createHash('sha256').update(token).digest('hex')`다.

- [ ] **Step 1: 실패하는 테스트** — `public.test.ts`(Task 5의 준비를 함께 쓴다)
  - 신청 화면 정보: 학생회 이름 `A`, 행사 이름·시각·장소, `remaining: 2`, `state: 'open'`, `purgeAfter`
    - 응답 키는 Interfaces의 것만이다(다른 신청자 정보가 없다).
  - 없는 코드, 소문자 코드, 9자 코드는 404다.
  - 신청: `{ name: '김바다', studentId: '2022-123456', phone: null, agreed: true }` → 201, 22자 토큰
    - DB에는 `2022123456`이 저장되고, `token_hash`는 토큰의 SHA-256이다.
    - 같은 학번을 ` 2022 123456 `으로 다시 보내면 409 `ALREADY_REGISTERED`다(Review Focus 1).
  - 휴대폰: 받지 않는데 보내거나, 받는데 빠지면 400 `INVALID_INPUT`이다(서버가 설정과 대조한다).
  - 정원: 정원 2에서 한 자리 남았을 때 `Promise.all`로 두 건을 보낸다.
    - 하나는 201, 하나는 409 `REGISTRATION_FULL`이다. DB의 살아 있는 행은 2건이다.
  - 상태
    - 시계를 마감 시각과 같게 두면 409 `REGISTRATION_NOT_OPEN`이고, 화면 정보는 `closed`다.
    - 멈춤은 `paused`, 시작 전은 `upcoming`이고, 둘 다 409 `REGISTRATION_NOT_OPEN`이다.
  - 내 신청
    - lookup → 행사와 내 칸, `cancelled: false`, `cancellable: true`
    - 모르는 토큰(형식은 맞음)은 404다. 형식이 틀린 토큰은 400이다.
  - 스스로 취소
    - cancel → `cancelled: true`, 개인 칸 null이다. 다시 lookup하면 404다. 같은 학번으로 다시 신청할 수 있다.
    - 마감 뒤(시계 이동) cancel은 409 `CANCEL_CLOSED`다. 멈춤 상태의 cancel은 된다.
  - 보관 기간이 지난 신청의 lookup은 404다.
  - 공개 경로도 출처가 다르면 403이다. `text/plain`은 415, 큰 본문은 413이다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations/public.test.ts`
- [ ] **Step 3: 구현**
  - 신청
    1. 트랜잭션 안에서 코드로 신청 설정과 행사, 학생회 이름을 읽는다. 신청 설정은 `FOR UPDATE`다.
    2. `purgeExpired(tx, form.id)`를 부른다.
    3. `count`를 세고 `stateOf`로 상태를 낸다.
       - 상태가 `full`이면 `REGISTRATION_FULL`이다.
       - 그 밖에 `open`이 아니면 `REGISTRATION_NOT_OPEN`이다.
    4. 휴대폰을 설정과 대조한다(`INVALID_INPUT` 400).
    5. 넣는다. 유일 색인 위반(23505)은 `ALREADY_REGISTERED`로 바꾼다.
  - lookup·cancel: `token_hash`로 행을 찾고, `purgeExpired(tx, formId)` 뒤에 다시 읽는다. 없으면 404다.
    - `cancellable`은 `now < closesAt`이다.
  - `boundary.test.ts`
    - `modules`에 `events`와 `registrations`를 더한다.
    - 변경 라우트는 `/api/organizations/`나 `/api/public/` 아래 또는 `outsideGuard`에 있어야 한다.
    - 두 앞부분 모두 같은 반복문에서 출처·형식·크기·JSON·모르는 키를 확인한다.
- [ ] **Step 4: 통과 확인** — `npx tsx --test src/registrations/public.test.ts src/registrations/registrations.test.ts src/http/boundary.test.ts src/app.test.ts`
- [ ] **Step 5: 커밋** — `공개 참가 신청·내 신청 API`

### Task 7: 웹 진입과 공개 경로

**Files:**
- Modify: `apps/api/src/web.ts`, `apps/api/src/web.test.ts`, `apps/web/src/main.tsx`
- Create: `apps/web/src/public/public-route.ts`, `apps/web/src/public/public-route.test.ts`, `apps/web/src/public/PublicApp.tsx`(Task 8·9가 채운다)

**Interfaces (Produces):**
- `publicRoute(pathname: string): { kind: 'apply'; code: string } | { kind: 'mine' } | null`
  - `/apply/{코드}` → apply
  - `/r` → mine
  - 그 밖, `/apply/`, `/apply/a/b` → null
- `applyPath(code)`, `minePath(token) = '/r#' + token`
- `tokenFromHash(hash: string): string | null`
- `shouldLeaveKakao(route, userAgent): boolean`
- `PublicApp({ route })`

- [ ] **Step 1: 실패하는 테스트**
  - `web.test.ts`: `/apply/ABCD2345`와 `/r`는 200, `no-cache`, `index.html`이다. `/apply/`, `/apply/a/b`, `/r/x`는 404다.
  - `public-route.test.ts`
    - 위 경로 판별과 `tokenFromHash('#abc')`, 빈 해시는 null이다.
    - 카카오톡(Review Focus 5)
      - 카카오톡이면서 `/apply/X`이면 false, `/r`도 false다.
      - 카카오톡이면서 `/`이면 true다.
      - 크롬이면서 `/`이면 false다.
- [ ] **Step 2: 실패 확인** — `npx tsx --test src/web.test.ts`(api), `npx vitest run src/public/public-route.test.ts`(web)
- [ ] **Step 3: 구현**
  - `attachWeb`의 경로 목록에 `'/apply/:code'`, `'/r'`을 더한다.
  - `main.tsx`

```tsx
const App = lazy(() => import('./App'))
const PublicApp = lazy(() => import('./public/PublicApp'))
const route = publicRoute(window.location.pathname)
// 공개 신청 화면은 로그인이 없어 카카오톡 안에서도 그대로 연다. 나머지는 구글 로그인 때문에 기본 브라우저로 넘긴다.
if (shouldLeaveKakao(route, navigator.userAgent)) openOutsideKakao(navigator.userAgent, window.location)
createRoot(document.getElementById('root')!).render(<StrictMode>
  <Suspense fallback={null}>{route ? <PublicApp route={route} /> : <App />}</Suspense>
</StrictMode>)
```

  - `shouldLeaveKakao(route, userAgent) = route === null && isKakaoInAppBrowser(userAgent)`는 `public-route.ts`에 둔다. 테스트는 Task 8이 아니라 여기서 한다(Review Focus 5).
- [ ] **Step 4: 통과 확인** — 위 두 명령, 웹 `npm run build --workspace @vada/web`(공개 화면이 따로 나뉘는지 `dist/assets` 파일 수로 확인)
- [ ] **Step 5: 커밋** — `공개 신청 주소를 웹 진입에 연결`

### Task 8: 공개 신청 화면

**Files:**
- Create: `apps/web/src/public/ApplyPage.tsx`, `ApplyPage.test.tsx`, `public-api.ts`, `registration-text.ts`, `registration-text.test.ts`, `saved-tokens.ts`, `PublicLayout.tsx`
- Modify: `apps/web/src/public/PublicApp.tsx`

**Interfaces (Produces):**
- `public-api.ts`
  - `fetchPublicForm(code, signal): Promise<PublicRegistrationForm | 'missing' | 'failed'>`
  - `register(code, input): Promise<{ ok: true; token } | { ok: false; message }>`
  - `lookup(token)`, `cancelMine(token)`: `{ ok: true; registration } | { ok: false; missing: boolean; message }`
- `registration-text.ts`
  - `formatKoreanTime(v: string): string`: `8월 20일 (목) 오전 10:00`
  - `eventTimeText(startsAt, endsAt)`
  - `stateText(state, opensAt)`
  - `registrationMessage(code)`: 오류 코드 → 문구
  - `privacyNotice({ organizationName, eventName, collectPhone, purgeAfter }): string[]`
- `saved-tokens.ts`: `saveToken(code, token)`, `savedToken(code)`. 모든 접근을 try/catch로 감싼다.
- `PublicLayout`: 휴대폰 한 열(`max-w-md`), 위에 VADA 표시와 학생회 이름

- [ ] **Step 1: 실패하는 테스트**
  - `registration-text.test.ts`
    - `2026-08-20T10:00` → `8월 20일 (목) 오전 10:00`
    - 같은 날 끝 → `8월 20일 (목) 오전 10:00 ~ 오후 6:00`
    - 다른 날 끝 → 두 날짜를 모두 적는다.
    - 상태 문구 다섯 가지와 오류 문구 매핑
    - 고지 다섯 줄(휴대폰을 켜고 끌 때 항목이 다르다)
  - `ApplyPage.test.tsx`(mockApi)
    - 받는 중
      - 행사 정보, 안내, 남은 자리, 고지가 보인다.
      - 동의 전에는 신청 버튼이 꺼져 있고, 학번 `2022-123456`과 동의 체크 뒤 켜진다.
      - 보내면 본문은 `{ name, studentId: '2022-123456', phone: null, agreed: true }`이다(정리는 서버 스키마가 한다).
      - 성공하면 `location.assign('/r#…')`를 부르고(spy) 토큰을 저장한다.
    - 휴대폰을 받는 신청: 휴대폰 칸이 있고, 빈 값이면 버튼이 꺼진다.
    - `closed`·`paused`·`upcoming`·`full`: 입력 칸 없이 상태 문구만 보인다. `upcoming`은 시작 시각을 적는다.
    - 시작 전 자동 열기: 가짜 타이머로 `opensAt`까지 진행하면 GET이 한 번 더 가고, 응답이 `open`이면 입력 칸이 나온다.
    - 오류
      - 409 `ALREADY_REGISTERED`: "이미 신청한 학번이에요…"를 보여 준다.
      - 409 `REGISTRATION_FULL`: 문구를 보여 주고 정보를 다시 받는다.
      - 404: "신청 링크를 찾을 수 없어요"
    - 저장된 토큰이 있으면 "이미 신청했어요 · 내 신청 보기" 링크(`/r#토큰`)가 보인다.
    - localStorage 접근이 throw해도(`vi.spyOn(Storage.prototype, 'getItem'/'setItem')`) 화면과 신청이 된다(Review Focus 4).
- [ ] **Step 2: 실패 확인** — `npx vitest run src/public`
- [ ] **Step 3: 구현**
  - 고지 문구(spec 정책 9 그대로)
    - "받는 곳: {학생회}"
    - "목적: {행사} 참가 신청 확인과 행사 운영"
    - "항목: 이름, 학번(, 휴대폰 번호)"
    - "보유 기간: 행사가 끝나고 30일 뒤({날짜}) 지워요"
    - "동의하지 않을 수 있어요. 다만 동의하지 않으면 신청할 수 없어요."
  - 동의 체크박스는 `size-4 accent-blue-600`이다. 라벨은 "개인정보 수집·이용에 동의해요(필수)"다.
  - 입력 칸에는 `autoComplete="name"`, 학번 `inputMode="numeric"`, 휴대폰 `type="tel" autoComplete="tel"`을 준다.
  - 버튼은 `RegisterSchema.safeParse({ name, studentId, phone: collectPhone ? phone : null, agreed })`로 켠다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/public`, `npm run typecheck --workspace @vada/web`
- [ ] **Step 5: 커밋** — `공개 참가 신청 화면`

### Task 9: 내 신청 화면

**Files:**
- Create: `apps/web/src/public/MyRegistrationPage.tsx`, `MyRegistrationPage.test.tsx`
- Modify: `apps/web/src/public/PublicApp.tsx`

**Interfaces:** Consumes `lookup`, `cancelMine`, `tokenFromHash`, `PublicLayout`, `registration-text`

- [ ] **Step 1: 실패하는 테스트** — mockApi `POST /api/public/registrations/lookup`
  - 해시 토큰으로 조회한다(본문 `{ token }`).
    - "참가 신청이 완료됐어요", 행사 정보, 이름·학번(·휴대폰), 신청 시각이 보인다.
    - "이 화면 주소를 저장해 두세요…"와 주소 복사 버튼이 있다. 복사는 `navigator.clipboard.writeText` spy로 확인한다.
  - 취소: 확인 대화상자 → `POST cancel` → "신청을 취소했어요". 개인 칸은 사라진다. 저장된 토큰도 지운다.
  - `cancellable: false`이면 취소 버튼 대신 "마감 뒤에는 학생회에 문의해 주세요"를 보여 준다.
  - 해시 없음, 404: "신청 정보를 찾을 수 없어요. 취소했거나 보관 기간이 지났을 수 있어요."
  - 네트워크 실패: 다시 시도 버튼을 보여 준다.
  - localStorage가 throw해도 된다(Review Focus 4).
- [ ] **Step 2: 실패 확인** — `npx vitest run src/public/MyRegistrationPage.test.tsx`
- [ ] **Step 3: 구현**
  - 대화상자는 `components/ui/dialog`를 쓴다.
  - 주소 복사는 `window.location.href`를 복사한다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/public`
- [ ] **Step 5: 커밋** — `내 신청 확인·취소 화면`

### Task 10: 행사의 참가자 탭

**Files:**
- Create: `apps/web/src/registrations/RegistrationPanel.tsx`, `EventInfoDialog.tsx`, `RegistrationFormDialog.tsx`, `RegistrantList.tsx`, `useRegistration.ts`, `registration-view.ts`, `registration-fixtures.ts`, `RegistrationPanel.test.tsx`, `registration-view.test.ts`
- Modify: `apps/web/src/workspace/EventWorkspace.tsx`(탭), `apps/web/src/workspace/Workspace.tsx`(권한·행사 바꿈 전달), `apps/web/src/events/useEvents.ts`(`replace`), `apps/web/src/test-support/workflow-fixtures.ts`(`event()`에 새 칸)

**Interfaces:**
- Consumes
  - Task 1 타입·스키마
  - Task 8 `formatKoreanTime`, `eventTimeText`, `stateText`, `registrationMessage`(공개 폴더에서 import. 둘 다 쓰므로 `src/components`가 아니라 `public/registration-text.ts`를 그대로 쓴다. 표시용 함수라 API 호출이 없다)
- Produces
  - `useRegistration(organizationId, eventId, enabled)`: `{ data, loadError, refresh, create, update, cancel }`. `useEventFinance`와 같은 꼴이다.
  - `updateEvent(organizationId, eventId, input): Promise<{ ok: true; event } | { ok: false; message }>`
  - `useEvents().replace(event)`
  - `EventWorkspace` props에 `manageEvents: boolean; onEventChange: (event: EventSummary) => void`를 더한다.

- [ ] **Step 1: 실패하는 테스트** — `RegistrationPanel.test.tsx`(mockApi `/api/organizations/o/events/e/registration`)
  - 행사 정보 카드
    - 일시·장소가 없으면 "일시를 넣어 주세요"를 보여 준다.
    - 수정 대화상자에서 시작 `2026-08-20T10:00`, 장소를 넣고 저장한다(PATCH 본문 확인). `onEventChange`가 응답 행사로 불린다.
    - 끝 < 시작이면 저장 버튼이 꺼진다.
  - 신청 없음: "참가 신청 받기"를 보여 준다. 행사 시작이 없으면 꺼지고 이유를 적는다.
    - 만들기 대화상자의 기본값은 마감 = 행사 시작, 정원 빈칸, 휴대폰 꺼짐이다.
    - 저장하면 POST 본문을 확인한다.
  - 신청 있음
    - 상태 칩, 링크(`https://…/apply/ABCD2345`), 복사 버튼을 보여 준다.
    - "2/200명", 기간, 안내, "행사가 끝나고 30일 뒤(9월 19일) 신청자 정보를 지워요"를 보여 준다.
  - 멈추기·다시 받기: PATCH 본문에 `accepting`을 바꿔 보낸다. 409 `VERSION_CONFLICT`면 문구를 보여 주고 다시 불러온다.
  - 휴대폰 받기를 끄면 "이미 받은 번호도 지워져요" 확인을 받은 뒤 저장한다.
  - 명단
    - 순번, 이름, 학번, 신청 시각을 보여 준다.
    - 검색 `김`과 `2022`로 거른다.
    - 취소 확인 → POST cancel → 목록이 응답으로 바뀐다.
  - 지운 뒤: "보관 기간이 지나 신청자 정보를 지웠어요(신청 2명)"를 보여 준다.
  - `EventWorkspace`: `manageEvents`가 false이면 참가자 탭이 없다. true이면 탭 순서가 대화·구매·참가자·재정이다. `Workspace.test`나 새 테스트로 확인한다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/registrations src/workspace`
- [ ] **Step 3: 구현**
  - 날짜·시각 입력은 `Input type="datetime-local"`이다. 값은 그대로 한국 시각 문자열로 쓴다(`YYYY-MM-DDTHH:mm`).
  - 정원은 `Input type="number" inputMode="numeric"`이다. 빈칸이면 null이다.
  - 안내는 `Textarea`, 휴대폰은 체크박스다.
  - 링크 복사는 `navigator.clipboard.writeText(new URL(applyPath(code), window.location.origin).href)`다.
  - 명단
    - 휴대폰 폭에서는 카드 목록이다. `sm` 이상에서는 한 줄에 칸을 나란히 둔다.
    - 이름과 링크에는 `wrap-anywhere`를 준다.
  - 탭 패널: 구매·재정 탭처럼 처음 열 때 불러오고, 다시 고르면 새로 불러온다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/registrations src/workspace src/events`, `npm run typecheck`
- [ ] **Step 5: 커밋** — `행사 참가자 탭: 행사 정보·신청 설정·명단`

### Task 11: 문서와 전체 확인

**Files:**
- Modify: `docs/ERD.md`(events 칸, 새 표 둘과 관계), `AGENTS.md`(공개 경로 규칙)

- [ ] **Step 1: 문서**
  - `AGENTS.md` "새 API를 만들 때"에 한 줄을 더한다: "로그인 없이 쓰는 공개 변경 라우트는 `/api/public/` 아래에 둔다. 공통 가드가 같이 건다. 개인 링크 토큰은 경로에 넣지 않고 본문으로 받는다."
  - ERD에 `registration_forms`, `registrations`와 events 칸을 더한다.
- [ ] **Step 2: 전체 검사** — `npm run typecheck`, `npm test --workspace @vada/contracts`, `npm test --workspace @vada/api`, `npm test --workspace @vada/web`, `npm run build --workspace @vada/web`
- [ ] **Step 3: 커밋** — `참가 신청을 문서에 반영`

## 마무리(계획 밖 절차)

1. 새 컨텍스트 Opus 최종 리뷰
2. 0020 적용 승인 요청. 두 DB에서 이미 적용된 기록이 로컬 파일과 순서·해시까지 같은지 점검하는 일도 함께 승인받는다.
3. dev 브라우저 확인
   - 참가자 탭
   - 공개 신청(390px iframe)
   - 내 신청
4. main에 ff 병합 → 푸시 → CI와 운영 health 확인
5. 진행 메모와 known-issues를 정리한다.
