# M5b 결과보고서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 완료한 행사에 결과보고서(자동 수치 + 다섯 칸 글 + 발행)를 붙이고, 행사에 담당 부서·책임자를 정하며, 기록 목록에 보고서 상태와 숫자를 보인다.

**Architecture:** 마이그레이션 0026이 `events.owner_department_id·owner_id`와 `event_reports` 표를 더한다. 새 모듈 `reports`(AppOptions.reports)가 기록 목록과 결과보고서 읽기·저장·발행·발행 취소를 맡는다. 자동 수치는 `reports/facts.ts`가 행사 여럿을 한 번에 세고, 발행할 때 `event_reports.facts`에 고정한다. 결과보고서 쓰기는 M5a와 반대로 완료한 행사에서만 된다(`requireCompletedEvent`). 화면은 기록 목록에서 결과보고서 화면을 열고, 거기서 볼 수만 있는 행사 화면으로 오간다.

**Tech Stack:** Hono, drizzle-orm 0.45(PostgreSQL·PGlite), zod(`@vada/contracts`), React 19, Tailwind, vitest, node:test

**Spec:** `docs/superpowers/specs/2026-10-12-event-report-design.md`

## Global Constraints

- 본문 스키마는 contracts의 `z.strictObject`, 라우트는 `json(Schema)`를 인증보다 앞에 둔다. `c.req.json()`을 부르지 않는다.
- 실패는 `ApiError(code, status)`로 던진다. 새 코드: `EVENT_NOT_COMPLETED`·`REPORT_PUBLISHED`·`REPORT_INCOMPLETE`·`EVENT_DEPARTMENT_INVALID`·`EVENT_OWNER_INVALID`(모두 409).
- 결과보고서 칸은 다섯이고 칸마다 2000자(`REPORT_SECTION_MAX`), DB CHECK도 같은 값이다.
- 권한: 보기는 구성원 모두, 저장은 부서가 있는 구성원(`manageEvents`), 발행·발행 취소는 회장단(`manageOrganization`).
- 잠금 순서: 결과보고서 쓰기는 행사 행 `FOR SHARE` → 보고서 행 `FOR UPDATE`. 행사 정보 수정은 행사 → 부서 → 소속.
- 화면: 버튼·입력·대화상자·칩·카드는 `apps/web/src/components/ui` 부품, 모양은 Tailwind 표준 클래스, 긴 이름에는 `wrap-anywhere`. 길이 숫자를 화면에 다시 적지 않는다.
- 커밋: 제목 50자 이내 명령형 한국어, AI 서명·Co-Authored-By 없음.
- API 테스트는 이 PC에서 `--test-concurrency=2`로 돌린다(여러 파일 동시 실행은 메모리 부족).

## Review Focus

1. 남이 먼저 발행한 보고서를 열어 둔 채 고쳐 저장 → 쓴 글은 남고 "이미 발행한 결과보고서예요" 안내와 [새로 불러오기]가 보인다. (Task 6 화면 테스트)
2. 처음 쓰는 두 사람이 거의 동시에 저장(둘 다 버전 0) → 둘째는 500이 아니라 `VERSION_CONFLICT`다. (Task 4: 보고서 행을 먼저 넣고 버전 0으로 저장하는 테스트)
3. 저장하지 않은 글이 있는데 옆 메뉴나 [행사 기록 보기]로 이동 → 확인을 묻고, 취소하면 그대로 남는다. (Task 7 Workspace 테스트)
4. 발행한 행사의 완료 취소 → 일반 실패가 아니라 "결과보고서에서 먼저 발행을 취소해 주세요"가 보인다. (Task 4 API, Task 7 완료 대화상자 테스트)
5. 다섯 칸에 제어 문자를 2000자씩 채운 저장 → 413이 아니라 저장된다(가드 상한 64KiB). (Task 4)

---

### Task 1: 담당 칸·결과보고서 표·마이그레이션 0026

**Files:**
- Modify: `apps/api/src/db/schema.ts` (events 칸·FK, 새 표 `eventReports`)
- Create: `apps/api/migrations/0026_event_reports.sql`, `apps/api/migrations/meta/0026_snapshot.json`(drizzle-kit 생성), `_journal.json` 갱신
- Modify: `docs/ERD.md`
- Test: `apps/api/src/db/schema.test.ts`, `apps/api/src/db/migrations.test.ts`

**Interfaces:**
- Produces: `events.ownerDepartmentId: string | null`, `events.ownerId: string | null`, `eventReports`(칸: eventId, organizationId, status, operations, wentWell, shortfalls, improvements, handover, facts, publishedAt, publishedBy, version, createdBy, createdAt, updatedBy, updatedAt)

- [ ] **Step 1: 실패하는 테스트**

`schema.test.ts`의 events 테스트를 바꾼다.
```ts
  assert.deepEqual(config.columns.map(column => column.name), ['id', 'organization_id', 'name', 'created_by', 'created_at', 'starts_at', 'ends_at', 'place',
    'version', 'completed_at', 'completed_by', 'owner_department_id', 'owner_id'])
  // 일시·장소(M3a), 완료(M5a), 담당(M5b)만 비울 수 있다.
  assert.deepEqual(config.columns.filter(column => !column.notNull).map(column => column.name), ['starts_at', 'ends_at', 'place', 'completed_at',
    'completed_by', 'owner_department_id', 'owner_id'])
  assert.equal(config.foreignKeys.length, 5)
```
(기존 `for … of [['organization_id', organizations], …]` 검사는 그대로 둔다. 새 FK 둘은 복합 키라 첫 칸이 organization_id다. 그래서 그 반복의 `find`가 같은 FK를 찾도록 `key.reference().columns.length === 1` 조건을 더한다.)

`schema.test.ts` 끝에 더한다(맨 위 import에 `eventReports, departments, memberships`가 없으면 더한다).
```ts
test('결과보고서는 행사마다 하나이고, 같은 학생회 행사와 사용자를 가리킨다', () => {
  const config = getTableConfig(eventReports)
  assert.deepEqual(config.columns.map(column => column.name), ['event_id', 'organization_id', 'status', 'operations', 'went_well', 'shortfalls',
    'improvements', 'handover', 'facts', 'published_at', 'published_by', 'version', 'created_by', 'created_at', 'updated_by', 'updated_at'])
  assert.equal(eventReports.eventId.primary, true)
  const event = config.foreignKeys.find(key => key.getName() === 'event_reports_event_same_organization')
  assert.ok(event)
  assert.deepEqual(event.reference().columns.map(column => column.name), ['organization_id', 'event_id'])
  assert.equal(event.onDelete, 'restrict')
  for (const name of ['event_reports_status_valid', 'event_reports_published_state', 'event_reports_published_complete', 'event_reports_facts_object',
    'event_reports_operations_length', 'event_reports_handover_not_blank']) assert.ok(config.checks.some(check => check.name === name), name)
})

test('행사 담당은 같은 학생회의 부서와 소속을 가리킨다', () => {
  const config = getTableConfig(events)
  const department = config.foreignKeys.find(key => key.getName() === 'events_owner_department_same_organization')
  const owner = config.foreignKeys.find(key => key.getName() === 'events_owner_same_organization')
  assert.deepEqual(department?.reference().foreignColumns.map(column => column.name), ['organization_id', 'id'])
  assert.equal(department?.reference().foreignTable, departments)
  assert.deepEqual(owner?.reference().foreignColumns.map(column => column.name), ['organization_id', 'user_id'])
  assert.equal(owner?.reference().foreignTable, memberships)
})
```

`migrations.test.ts` 끝에 더한다.
```ts
test('0026 adds event owners and reports without touching existing events', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0026_event_reports')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test'),('x','남','x@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council'),('o2','Other');
      INSERT INTO departments (id,organization_id,name) VALUES ('d','o','기획부'),('d2','o2','남의 부서');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m','u','o','d'),('mx','x','o2','d2');
      INSERT INTO events (id,organization_id,name,created_by,version) VALUES ('e','o','체육대회','u',3),('e2','o','축제','u',1);
    `)
    await migrate(db, { migrationsFolder })
    await t.test('existing events have no owner and keep their version', async () => {
      const { rows } = await pg.query<Record<string, unknown>>("SELECT version, owner_department_id, owner_id FROM events WHERE id = 'e'")
      assert.deepEqual(rows[0], { version: 3, owner_department_id: null, owner_id: null })
    })
    await t.test('owners belong to the same council and an owner department is not deleted', async () => {
      await assert.rejects(pg.exec("UPDATE events SET owner_department_id = 'd2' WHERE id = 'e'"), { constraint: 'events_owner_department_same_organization' })
      await assert.rejects(pg.exec("UPDATE events SET owner_id = 'x' WHERE id = 'e'"), { constraint: 'events_owner_same_organization' })
      await pg.exec("UPDATE events SET owner_department_id = 'd', owner_id = 'u' WHERE id = 'e'")
      await assert.rejects(pg.exec("DELETE FROM departments WHERE id = 'd'"), { constraint: 'events_owner_department_same_organization' })
    })
    await t.test('a report is published only with every section and frozen facts', async () => {
      await pg.exec("INSERT INTO event_reports (event_id, organization_id, operations, created_by, updated_by) VALUES ('e','o','진행','u','u')")
      const publish = (facts: string) => pg.exec(`UPDATE event_reports SET status = 'published', published_at = now(), published_by = 'u', facts = ${facts}`)
      await assert.rejects(publish("'{}'"), { constraint: 'event_reports_published_complete' })
      await pg.exec("UPDATE event_reports SET went_well = '좋음', shortfalls = '아쉬움', improvements = '개선', handover = '인수'")
      await assert.rejects(publish('NULL'), { constraint: 'event_reports_published_state' })
      await assert.rejects(publish("'[]'"), { constraint: 'event_reports_facts_object' })
      await publish("'{}'")
      await assert.rejects(pg.exec("UPDATE event_reports SET handover = '   '"), { constraint: 'event_reports_handover_not_blank' })
      await assert.rejects(pg.exec("UPDATE event_reports SET handover = repeat('가', 2001)"), { constraint: 'event_reports_handover_length' })
      await assert.rejects(pg.exec("INSERT INTO event_reports (event_id, organization_id, created_by, updated_by) VALUES ('e2','o2','u','u')"),
        { constraint: 'event_reports_event_same_organization' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/db/schema.test.ts src/db/migrations.test.ts`
Expected: FAIL(칸 목록 다름, `eventReports` 없음, 0026 없음)

- [ ] **Step 3: 스키마**

`schema.ts` events의 `completedBy` 다음(칸 순서가 행사 만들기의 INSERT … SELECT와 맞아야 하므로 맨 뒤)에 더한다.
```ts
  // 행사 담당 부서와 책임자(M5b). 둘 다 고르지 않아도 된다. 책임자는 사용자 ID이고 같은 학생회 소속만 받는다(업무 담당자와 같다).
  ownerDepartmentId: text('owner_department_id'),
  ownerId: text('owner_id'),
```
events 제약 목록의 `events_completed_pair` 다음에 더한다(부서·소속 표는 아래에 있지만 제약은 나중에 만들어지므로 그대로 가리킬 수 있다).
```ts
  // 담당 부서인 부서는 지우지 않는다(organization/service.ts). 완료한 행사는 바꿀 수 없어 비울 수 없다.
  foreignKey({ name: 'events_owner_department_same_organization', columns: [table.organizationId, table.ownerDepartmentId],
    foreignColumns: [departments.organizationId, departments.id] }).onDelete('restrict'),
  foreignKey({ name: 'events_owner_same_organization', columns: [table.organizationId, table.ownerId],
    foreignColumns: [memberships.organizationId, memberships.userId] }).onDelete('restrict'),
```
파일 맨 위에 `import type { EventReportFacts } from '@vada/contracts'`를 더하고(Task 3에서 계약을 더하기 전까지는 `Record<string, unknown>`으로 두고 Task 3에서 바꾼다), 파일 끝에 더한다.
```ts
// 완료한 행사의 결과보고서(M5b). 행사마다 하나다. 쓰기는 완료한 행사에서만 하고(events/lock.ts의 requireCompletedEvent),
// 발행하면 그때의 자동 수치와 이름을 facts에 고정한다. updated_*는 마지막으로 글을 저장한 사람·때이고 발행은 따로 남긴다.
export const eventReports = pgTable('event_reports', {
  eventId: text('event_id').primaryKey(),
  organizationId: text('organization_id').notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  // 현장 운영, 잘된 점, 아쉬운 점과 원인, 다음 행사 개선안, 인수인계. 쓰지 않은 칸은 비어 있다.
  operations: text('operations'),
  wentWell: text('went_well'),
  shortfalls: text('shortfalls'),
  improvements: text('improvements'),
  handover: text('handover'),
  facts: jsonb('facts').$type<Record<string, unknown>>(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: text('published_by').references(() => users.id, { onDelete: 'restrict' }),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: 'event_reports_event_same_organization',
    columns: [table.organizationId, table.eventId],
    foreignColumns: [events.organizationId, events.id],
  }).onDelete('restrict'),
  check('event_reports_status_valid', sql`${table.status} IN ('draft','published')`),
  check('event_reports_published_state', sql`(${table.status} = 'published') = (${table.publishedAt} IS NOT NULL)
    AND (${table.publishedAt} IS NULL) = (${table.publishedBy} IS NULL) AND (${table.publishedAt} IS NULL) = (${table.facts} IS NULL)`),
  check('event_reports_published_complete', sql`${table.status} <> 'published' OR (${table.operations} IS NOT NULL AND ${table.wentWell} IS NOT NULL
    AND ${table.shortfalls} IS NOT NULL AND ${table.improvements} IS NOT NULL AND ${table.handover} IS NOT NULL)`),
  check('event_reports_operations_not_blank', sql`${table.operations} ~ '[^[:space:]]'`),
  check('event_reports_operations_length', sql`char_length(${table.operations}) <= 2000`),
  check('event_reports_went_well_not_blank', sql`${table.wentWell} ~ '[^[:space:]]'`),
  check('event_reports_went_well_length', sql`char_length(${table.wentWell}) <= 2000`),
  check('event_reports_shortfalls_not_blank', sql`${table.shortfalls} ~ '[^[:space:]]'`),
  check('event_reports_shortfalls_length', sql`char_length(${table.shortfalls}) <= 2000`),
  check('event_reports_improvements_not_blank', sql`${table.improvements} ~ '[^[:space:]]'`),
  check('event_reports_improvements_length', sql`char_length(${table.improvements}) <= 2000`),
  check('event_reports_handover_not_blank', sql`${table.handover} ~ '[^[:space:]]'`),
  check('event_reports_handover_length', sql`char_length(${table.handover}) <= 2000`),
  check('event_reports_facts_object', sql`jsonb_typeof(${table.facts}) = 'object'`),
  check('event_reports_version_positive', sql`${table.version} >= 1`),
])
```

Run: `cd apps/api; npx drizzle-kit generate --name event_reports`
Expected: `migrations/0026_event_reports.sql`에 `CREATE TABLE "event_reports"`(CHECK 포함), `ALTER TABLE "events" ADD COLUMN` 둘, FK `ADD CONSTRAINT` 여섯(보고서 사용자 셋·보고서 행사·행사 담당 둘)만 있다. 다른 표를 바꾸면 멈추고 원인을 찾는다. `.sql`이 LF인지 확인한다.

- [ ] **Step 4: ERD**

`docs/ERD.md`
- 첫 그림 관계에 `departments |o..o{ events : "행사 담당 부서"`, `memberships |o..o{ events : "행사 책임자"`를 더하고 events 블록에 두 줄을 더한다.
```
        text owner_department_id FK "담당 부서, 선택"
        text owner_id FK "책임자 사용자, 선택"
```
- `events` 설명 끝에 "담당 부서·책임자(M5b)는 같은 학생회 부서·소속만 가리킨다. 담당 부서인 부서는 지우지 않는다."를 더한다.
- 문서 끝에 "## 결과보고서" 절을 더한다: `events ||..o| eventReports : "결과보고서"`, `users ||..o{ eventReports : "쓰기·발행 기록"`과 칸 블록, 설명("완료한 행사에서만 쓴다. 발행하면 자동 수치와 이름을 facts에 고정하고, 발행이면 다섯 칸이 모두 있다(CHECK). 발행한 보고서가 있으면 완료를 취소하지 않는다.").

- [ ] **Step 5: 통과 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/db/schema.test.ts src/db/migrations.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/db apps/api/migrations docs/ERD.md
git commit -m "행사 담당 칸과 결과보고서 표 더하기(0026)"
```

---

### Task 2: 행사 담당 부서·책임자 API

**Files:**
- Modify: `packages/contracts/src/events.ts`, `packages/contracts/src/index.ts`
- Modify: `apps/api/src/events/events.ts` (`serializeEvent`, `eventSummaries`, `eventSummary`, PATCH)
- Modify: `apps/api/src/organization/service.ts` (deleteDepartment)
- Modify(본문에 두 칸): `apps/api/src/settlement/fee-income.test.ts`, `apps/api/src/events/completion.test.ts`, `apps/api/src/events/completion-lock.test.ts`, `apps/api/src/registrations/attendance.test.ts`, `apps/api/src/registrations/registrations.test.ts`, `apps/api/src/registrations/test-setup.ts`, `apps/api/src/registrations/public.test.ts`, `apps/api/src/tasks/tasks.test.ts`, `apps/api/src/events/events.test.ts`, `apps/api/scripts/demo-data.ts`
- Modify(웹 타입): `apps/web/src/registrations/EventInfoDialog.tsx`, EventSummary 고정값(`test-support/workflow-fixtures.ts`, `events/EventList.test.tsx`, `events/useEvents.test.tsx`, `tasks/EventTasks.test.tsx`, `tasks/task-view.test.ts`, `workspace/Workspace.test.tsx`)
- Test: `apps/api/src/events/events.test.ts`, `apps/api/src/organization/organization.test.ts`, `packages/contracts/src/input.test.ts`

**Interfaces:**
- Produces:
  - `UpdateEventSchema`에 `ownerDepartmentId: string | null`, `ownerMembershipId: string | null`
  - `EventSummary.ownerDepartment: { id: string; name: string } | null`, `EventSummary.owner: { membershipId: string; name: string } | null`
  - `eventSummaries(db: Reader, organizationId: string, eventId?: string): Promise<EventSummary[]>`(만든 순 역순), `eventSummary(db: Reader, organizationId: string, eventId: string): Promise<EventSummary>`(없으면 NOT_FOUND) — `events/events.ts`에서 내보낸다

- [ ] **Step 1: 실패하는 테스트**

`events.test.ts` 끝에 더한다(import에 `setupPurchases`(`../purchases/test-setup.js`), `refused`(`../registrations/test-setup.js`)).
```ts
test('행사 담당: 부서가 있는 구성원이 담당 부서·책임자를 정하고 비운다. 다른 학생회·없는·미배정은 고를 수 없다', async () => {
  const env = await setupPurchases()
  try {
    const info = (version: number, ownerDepartmentId: string | null, ownerMembershipId: string | null) =>
      ({ version, startsAt: null, endsAt: null, place: null, ownerDepartmentId, ownerMembershipId })
    const patch = (body: unknown) => env.request('PATCH', '/events/e', body)
    env.as('p')
    for (const id of ['dx', 'nope']) await refused(patch(info(1, id, null)), 409, 'EVENT_DEPARTMENT_INVALID', id)
    for (const id of ['mn', 'mx', 'nope']) await refused(patch(info(1, null, id)), 409, 'EVENT_OWNER_INVALID', id)
    const { event } = await env.ok<EventResponse>(patch(info(1, 'dp', 'mq')))
    assert.deepEqual([event.ownerDepartment, event.owner, event.version], [{ id: 'dp', name: '기획부' }, { membershipId: 'mq', name: '기획2' }, 2])
    const listed = (await env.ok<EventsResponse>(env.request('GET', '/events'))).events.find(item => item.id === 'e')!
    assert.deepEqual([listed.ownerDepartment, listed.owner], [event.ownerDepartment, event.owner])
    assert.deepEqual((await env.ok<EventsResponse>(env.request('GET', '/events'))).events.find(item => item.id === 'e2')?.owner, null)
    // 책임자가 미배정이 되어도 그대로 둘 수 있고, 다른 미배정은 새로 고를 수 없다.
    await env.pg.exec("UPDATE memberships SET department_id = NULL WHERE id = 'mq'")
    assert.equal((await env.ok<EventResponse>(patch(info(2, 'dp', 'mq')))).event.owner?.membershipId, 'mq')
    await refused(patch(info(3, null, 'mn')), 409, 'EVENT_OWNER_INVALID')
    const cleared = (await env.ok<EventResponse>(patch(info(3, null, null)))).event
    assert.deepEqual([cleared.ownerDepartment, cleared.owner], [null, null])
    // 본문 경계: 키 누락, 빈 ID, 제어 문자, 너무 긴 ID, 숫자
    for (const body of [{ version: 4, startsAt: null, endsAt: null, place: null }, info(4, '', null), info(4, null, 'a\u0000'),
      info(4, 'a'.repeat(65), null), { ...info(4, null, null), ownerMembershipId: 1 }]) {
      await refused(patch(body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    // 완료한 행사는 담당도 바꾸지 않는다(M5a 잠금).
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e'`)
    await refused(patch(info(4, 'dp', null)), 409, 'EVENT_COMPLETED')
  } finally { await env.pg.close() }
})
```

`organization.test.ts`의 부서 지우기 테스트에서 `DEPARTMENT_IN_USE`(제출 기록) 확인 다음에 더한다.
```ts
    // 행사의 담당 부서(M5b)도 지우지 않는다. 담당을 바꾸면 지운다.
    const owner = await send('POST', '/organizations/org1/departments', { name: '축제부' })
    const festival = ((await owner.json()) as { departments: { id: string; name: string }[] }).departments.find(item => item.name === '축제부')!
    await pg.exec(`UPDATE events SET owner_department_id = '${festival.id}' WHERE id = 'e1'`)
    const owned = await remove(festival.id)
    assert.equal(owned.status, 409)
    assert.deepEqual(await owned.json(), { error: 'DEPARTMENT_IN_USE' })
    await pg.exec("UPDATE events SET owner_department_id = NULL WHERE id = 'e1'")
    assert.equal((await remove(festival.id)).status, 200)
```
(부서 만들기 응답 모양이 다르면 그 파일의 `promo`를 만드는 줄을 따른다.)

`packages/contracts/src/input.test.ts` 끝에 더한다(import에 `UpdateEventSchema`).
```ts
test('행사 정보는 담당 부서·책임자를 ID나 null로 꼭 받는다', () => {
  const base = { version: 1, startsAt: null, endsAt: null, place: null }
  assert.equal(UpdateEventSchema.safeParse({ ...base, ownerDepartmentId: 'd', ownerMembershipId: null }).success, true)
  for (const body of [base, { ...base, ownerDepartmentId: null }, { ...base, ownerDepartmentId: '', ownerMembershipId: null },
    { ...base, ownerDepartmentId: null, ownerMembershipId: 'a'.repeat(65) }]) {
    assert.equal(UpdateEventSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/events/events.test.ts src/organization/organization.test.ts`
Run: `npm test --workspace @vada/contracts`
Expected: FAIL

- [ ] **Step 3: 계약**

`packages/contracts/src/events.ts`의 `UpdateEventSchema`를 바꾼다(`token` import를 더한다).
```ts
const id = token(64)
// 행사 정보 수정. 끝은 시작이 있어야 하고 시작보다 늦다. 비울 때도 null로 꼭 보낸다.
// 담당 부서·책임자(M5b)는 같은 학생회 부서, 부서가 있는 구성원(memberships.id)만 받는다. 서버가 책임자를 사용자로 바꿔 저장한다.
export const UpdateEventSchema = z.strictObject({
  version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX),
  startsAt: koreanDateTime.nullable(),
  endsAt: koreanDateTime.nullable(),
  place: text(EVENT_PLACE_MAX).nullable(),
  ownerDepartmentId: id.nullable(),
  ownerMembershipId: id.nullable(),
}).refine(value => value.endsAt === null || (value.startsAt !== null && value.endsAt > value.startsAt))
```
`index.ts`의 `EventSummary` 끝(`completedAt` 다음)에 더한다.
```ts
  // 행사 담당 부서와 책임자(M5b). 정하지 않았으면 null이다. 책임자는 소속 ID와 이름이다.
  ownerDepartment: { id: string; name: string } | null
  owner: { membershipId: string; name: string } | null
```

- [ ] **Step 4: 행사 응답과 수정** — `apps/api/src/events/events.ts`

import에 `alias`(drizzle-orm/pg-core), `departments, users`(schema)를 더하고 `serializeEvent`를 바꾼다.
```ts
type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
const ownerMemberships = alias(memberships, 'event_owner_memberships')
const ownerUsers = alias(users, 'event_owner_users')
type OwnerNames = { departmentName: string | null; ownerMembershipId: string | null; ownerName: string | null }
const noOwner: OwnerNames = { departmentName: null, ownerMembershipId: null, ownerName: null }

// 일시는 한국 시각 문자열로 준다. 담당 부서·책임자(M5b)는 이름과 함께 준다.
export const serializeEvent = (event: typeof events.$inferSelect, owner: OwnerNames): EventSummary => ({
  id: event.id, organizationId: event.organizationId, name: event.name, createdBy: event.createdBy, createdAt: event.createdAt.toISOString(),
  startsAt: event.startsAt && koreanOf(event.startsAt), endsAt: event.endsAt && koreanOf(event.endsAt), place: event.place, version: event.version,
  completedAt: event.completedAt?.toISOString() ?? null,
  ownerDepartment: event.ownerDepartmentId && owner.departmentName !== null ? { id: event.ownerDepartmentId, name: owner.departmentName } : null,
  owner: owner.ownerMembershipId !== null && owner.ownerName !== null ? { membershipId: owner.ownerMembershipId, name: owner.ownerName } : null,
})
// 행사 목록(만든 순 역순)과 바꾼 뒤의 응답, 결과보고서가 같이 쓴다. eventId를 주면 그 행사 하나다.
export async function eventSummaries(db: Reader, organizationId: string, eventId?: string): Promise<EventSummary[]> {
  const rows = await db.select({ event: events, departmentName: departments.name, ownerMembershipId: ownerMemberships.id, ownerName: ownerUsers.name })
    .from(events)
    .leftJoin(departments, and(eq(departments.organizationId, events.organizationId), eq(departments.id, events.ownerDepartmentId)))
    .leftJoin(ownerMemberships, and(eq(ownerMemberships.organizationId, events.organizationId), eq(ownerMemberships.userId, events.ownerId)))
    .leftJoin(ownerUsers, eq(ownerUsers.id, events.ownerId))
    .where(and(eq(events.organizationId, organizationId), eventId === undefined ? undefined : eq(events.id, eventId)))
    .orderBy(desc(events.createdAt), desc(events.id))
  return rows.map(({ event, ...owner }) => serializeEvent(event, owner))
}
export async function eventSummary(db: Reader, organizationId: string, eventId: string) {
  const [summary] = await eventSummaries(db, organizationId, eventId)
  if (!summary) throw new ApiError('NOT_FOUND', 404)
  return summary
}
```
- 목록: `return c.json({ events: await eventSummaries(db, c.req.param('organizationId')) } satisfies EventsResponse)`
- 만들기: INSERT … SELECT의 `completedBy` 다음에 `ownerDepartmentId: sql<string | null>\`null::text\`.as('owner_department_id'), ownerId: sql<string | null>\`null::text\`.as('owner_id'),`를 더하고 응답은 `serializeEvent(event, noOwner)`. 주석은 "일시·장소(M3a)·완료(M5a)·담당(M5b)은 빈 값, 버전은 1로 채운다".
- 수정(PATCH): 신청 마감 검사 다음, update 앞에 더한다.
```ts
      // 담당 부서·책임자(M5b). 업무 추가와 같은 순서로 부서(FOR KEY SHARE) → 소속(FOR SHARE)을 잠근다(행사 → 부서 → 소속).
      if (input.ownerDepartmentId !== null) {
        const [department] = await tx.select({ id: departments.id }).from(departments)
          .where(and(eq(departments.organizationId, organizationId), eq(departments.id, input.ownerDepartmentId))).for('key share')
        if (!department) throw new ApiError('EVENT_DEPARTMENT_INVALID', 409)
      }
      let ownerId: string | null = null
      if (input.ownerMembershipId !== null) {
        const [member] = await tx.select({ userId: memberships.userId, departmentId: memberships.departmentId }).from(memberships)
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, input.ownerMembershipId))).for('share')
        // 이미 책임자인 사람은 그 뒤 미배정이 되었어도 그대로 둘 수 있다.
        if (!member || (member.departmentId === null && member.userId !== current.ownerId)) throw new ApiError('EVENT_OWNER_INVALID', 409)
        ownerId = member.userId
      }
```
  update의 set에 `ownerDepartmentId: input.ownerDepartmentId, ownerId`를 더하고, 거래가 `return eventSummary(tx, organizationId, eventId)`를 돌려준다(응답은 `{ event }`). 라우트 위 주석은 "행사 정보(일시·장소·담당) 수정"으로 고친다.
- 완료·완료 취소: 거래 안 update 뒤 `return eventSummary(tx, organizationId, eventId)`로 바꾸고 응답은 `{ event }`.

- [ ] **Step 5: 부서 지우기** — `apps/api/src/organization/service.ts`

import에 `events`(schema). 제출 기록 검사 다음에 더한다.
```ts
      // 행사의 담당 부서(M5b)도 지우지 않는다. 완료한 행사는 바꿀 수 없어 비울 수 없고, 비우려면 행사 행을 잠가야 해
      // 업무 추가(행사 → 부서)와 잠금 순서가 엇갈린다. 그사이 담당으로 정해지면 아래 지우기가 23503을 내고 같은 오류가 된다.
      const [owned] = await tx.select({ id: events.id }).from(events)
        .where(and(eq(events.organizationId, organizationId), eq(events.ownerDepartmentId, departmentId))).limit(1)
      if (owned) throw new ApiError('DEPARTMENT_IN_USE', 409)
```

- [ ] **Step 6: 본문 고정값**

PATCH `/events/…` 본문마다 `ownerDepartmentId: null, ownerMembershipId: null`을 더한다: Files 목록의 테스트 파일들과 `completion-lock.test.ts`의 첫 PATCH·`PATCH ${eventRoot}` 탐침, `events.test.ts`의 `info`와 그 테스트의 직접 쓴 본문(`{ version: 2, startsAt: null, … }` 둘), `demo-data.ts`의 행사 일시 PATCH(Task 8에서 담당으로 바꾼다).

웹: `EventInfoDialog.tsx`의 `input`에 지금 담당을 그대로 보낸다(Task 5에서 고르기를 더한다).
```ts
  const input: UpdateEventRequest = { version: event.version, startsAt: startsAt || null, endsAt: endsAt || null, place: place.trim() ? place : null,
    ownerDepartmentId: event.ownerDepartment?.id ?? null, ownerMembershipId: event.owner?.membershipId ?? null }
```
EventSummary 고정값마다 `completedAt: null` 뒤에 `ownerDepartment: null, owner: null`을 더한다(`npm run typecheck`가 알려 준 곳).

- [ ] **Step 7: 통과 확인**

Run: `npm run typecheck`
Run: `npm test --workspace @vada/contracts`
Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/events/events.test.ts src/events/completion.test.ts src/events/completion-lock.test.ts src/organization/organization.test.ts src/registrations/registrations.test.ts src/registrations/public.test.ts src/registrations/attendance.test.ts src/registrations/payments.test.ts src/tasks/tasks.test.ts src/settlement/fee-income.test.ts`
Run: `npm test --workspace @vada/web -- src/registrations src/events src/workspace`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add packages/contracts/src apps/api/src apps/api/scripts apps/web/src
git commit -m "행사 담당 부서·책임자 정하기"
```

---

### Task 3: 기록 목록과 결과보고서 읽기 API

**Files:**
- Create: `packages/contracts/src/reports.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/db/schema.ts`(facts 타입)
- Modify: `apps/api/src/settlement/service.ts`(`financeNumbersByEvent`의 scope 타입)
- Create: `apps/api/src/reports/facts.ts`, `apps/api/src/reports/service.ts`, `apps/api/src/reports/routes.ts`, `apps/api/src/reports/reports.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/src/events/completion-lock.test.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: Task 2의 `eventSummaries`, `eventSummary`
- Produces:
  - contracts: `REPORT_SECTION_MAX`, `REPORT_SECTIONS`, `ReportSection`, `REPORT_SECTION_LABELS`, `ReportStatus`, `SaveEventReportSchema`, `PublishEventReportSchema`, `UnpublishEventReportSchema`, `SaveEventReportRequest`, `PublishEventReportRequest`, `EventReportFacts`, `ReportPerson`, `EventReportView`, `EventReportResponse`, `EventRecord`, `RecordsResponse`
  - `factsByEvent(db: Reader, organizationId: string, list: EventSummary[], now: Date): Promise<Map<string, EventReportFacts>>`
  - `createReportService(db: ReportDatabase)` → `{ get(scope, eventId), records(scope), … }`, `createReportRoutes(db: ReportDatabase, session: SessionReader)`
  - `AppOptions.reports`

- [ ] **Step 1: 계약** — `packages/contracts/src/reports.ts`

```ts
import { z } from 'zod'
import type { EventSummary } from './index.js'
import { text } from './input.js'
import { PURCHASE_INTEGER_MAX } from './purchases.js'

// 결과보고서 칸의 상한(M5b). DB CHECK(0026)와 같은 값이다.
export const REPORT_SECTION_MAX = 2000
// 사람이 쓰는 다섯 칸. 화면 순서다.
export const REPORT_SECTIONS = ['operations', 'wentWell', 'shortfalls', 'improvements', 'handover'] as const
export type ReportSection = typeof REPORT_SECTIONS[number]
export const REPORT_SECTION_LABELS: Record<ReportSection, string> = { operations: '현장 운영', wentWell: '잘된 점', shortfalls: '아쉬운 점과 원인',
  improvements: '다음 행사 개선안', handover: '인수인계' }
export type ReportStatus = 'draft' | 'published'

const section = text(REPORT_SECTION_MAX).nullable()
// 다섯 칸을 한 번에 저장한다. 빈 칸은 null이다. 보고서가 없으면 버전 0이다.
export const SaveEventReportSchema = z.strictObject({ version: z.number().int().min(0).max(PURCHASE_INTEGER_MAX), operations: section,
  wentWell: section, shortfalls: section, improvements: section, handover: section })
// 발행·발행 취소. 화면이 본 보고서 버전을 보낸다.
export const PublishEventReportSchema = z.strictObject({ version: z.number().int().min(1).max(PURCHASE_INTEGER_MAX) })
export const UnpublishEventReportSchema = PublishEventReportSchema
export type SaveEventReportRequest = z.infer<typeof SaveEventReportSchema>
export type PublishEventReportRequest = z.infer<typeof PublishEventReportSchema>

// 결과보고서의 자동 수치와 이름. 작성 중이면 지금 센 값, 발행했으면 발행 때 고정한 값이다.
// 발행한 보고서에 그대로 저장되므로, 칸을 더하면 옛 보고서에는 그 칸이 없을 수 있다.
export interface EventReportFacts {
  event: { name: string; startsAt: string | null; endsAt: string | null; place: string | null }
  // 담당 부서·책임자 이름. 정하지 않았으면 null이다.
  owner: { department: string | null; person: string | null }
  // 신청: 취소하지 않은 신청(보관 기간이 지나 정보를 지운 신청 포함), 참석: 참석을 확인한 신청. 참가 신청을 받지 않았으면 null이다.
  registrations: { registered: number; attended: number } | null
  // 예산: 행사 예산(미정이면 null), 집행: 취소하지 않은 지출 합(재정 탭의 실제 지출)
  finance: { budget: number | null; spent: number }
  // 지연: 마감일이 있고, 마감일(한국 날짜)을 넘겨 끝냈거나 센 날까지 끝내지 않은 업무
  tasks: { total: number; done: number; late: number }
  // 요청: 제출한 품목(반려·취소 포함), 승인: 승인 상태인 품목
  purchases: { requested: number; approved: number }
}
export interface ReportPerson { id: string; name: string }
export interface EventReportView {
  status: ReportStatus
  operations: string | null
  wentWell: string | null
  shortfalls: string | null
  improvements: string | null
  handover: string | null
  version: number
  created: { by: ReportPerson; at: string }
  // 마지막으로 글을 저장한 사람과 때
  updated: { by: ReportPerson; at: string }
  published: { by: ReportPerson; at: string } | null
}
export interface EventReportResponse {
  event: EventSummary
  // 아직 쓰지 않았으면 null이다.
  report: EventReportView | null
  facts: EventReportFacts
  // 수치를 센 시각(ISO). 발행했으면 발행 시각이다.
  factsAt: string
}
export interface EventRecord {
  event: EventSummary
  report: { status: ReportStatus; publishedAt: string | null } | null
  // 발행했으면 발행 때 값, 아니면 지금 센 값
  facts: EventReportFacts
}
// 완료한 행사, 최근 완료 순
export interface RecordsResponse { records: EventRecord[] }
```
`index.ts` 끝에 내보내기를 더한다.
```ts
export { REPORT_SECTION_MAX, REPORT_SECTIONS, REPORT_SECTION_LABELS, SaveEventReportSchema, PublishEventReportSchema,
  UnpublishEventReportSchema } from './reports.js'
export type { ReportSection, ReportStatus, SaveEventReportRequest, PublishEventReportRequest, EventReportFacts, ReportPerson, EventReportView,
  EventReportResponse, EventRecord, RecordsResponse } from './reports.js'
```
`schema.ts`의 `facts` 타입을 `jsonb('facts').$type<EventReportFacts>()`로 바꾸고 맨 위에 `import type { EventReportFacts } from '@vada/contracts'`.

- [ ] **Step 2: 실패하는 테스트** — `apps/api/src/reports/reports.test.ts`

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventReportResponse, RecordsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createEventRoutes } from '../events/events.js'
import { link, origin, setupPurchases } from '../purchases/test-setup.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { refused } from '../registrations/test-setup.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createReportRoutes } from './routes.js'

// 학생회 a: 기획부 p·q, 총무부(구매 승인) f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e·e2(a), ex(b).
type Env = Awaited<ReturnType<typeof setupPurchases>>
// setupPurchases의 앱에는 결과보고서가 없어 같은 DB로 결과보고서·행사 앱을 따로 만든다. 사용자는 env.as로 같이 바꾼다.
function reportsOf(env: Env) {
  const session = async () => env.state.userId ? { user: { id: env.state.userId } } : null
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, reports: createReportRoutes(env.db, session),
    events: createEventRoutes(env.db, session), settlement: createSettlementRoutes(env.db, session, origin),
    registrations: createRegistrationRoutes(env.db, session), tasks: createTaskRoutes(env.db, session) })
  return (method: string, path: string, body?: unknown) => app.request(`/api/organizations/a${path}`, body === undefined
    ? { method } : { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
const complete = (env: Env, event = 'e') => env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by)
  VALUES ('${event}','a', now(), 'f') ON CONFLICT (event_id) DO UPDATE SET settled_at = now(), settled_by = 'f';
  UPDATE events SET completed_at = now(), completed_by = 'l', version = version + 1 WHERE id = '${event}'`)

test('결과보고서 수치: 신청·참석, 예산·집행, 업무 완료·지연, 구매 요청·승인을 행사 기록에서 센다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    // 신청 셋(하나 취소, 하나는 보관 기간이 지나 정보를 지움), 참석 하나
    await env.pg.exec(`
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, created_by) VALUES ('form','a','e','2999-08-19T23:59+09','p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, checked_in_at, checked_in_by)
        VALUES ('r1','a','form','${'a'.repeat(64)}','김학생','20260001', now(), 'p');
      INSERT INTO registrations(id, organization_id, form_id, purged_at) VALUES ('r2','a','form', now());
      INSERT INTO registrations(id, organization_id, form_id, purged_at, cancelled_at) VALUES ('r3','a','form', now(), now());
    `)
    // 예산 10만 원, 지출 둘(하나 취소)
    await env.pg.exec(`
      INSERT INTO event_finances(event_id, organization_id, budget) VALUES ('e','a',100000);
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by)
        VALUES ('x1','a','e','쿠팡','물품',46000,'2026-10-01','council_card','f','f'),('x2','a','e','쿠팡','물품',9000,'2026-10-01','council_card','f','f');
      UPDATE expenses SET voided_at = now(), voided_by = 'f', void_reason = '잘못 기록' WHERE id = 'x2';
    `)
    // 업무 넷: 제때 끝냄, 늦게 끝냄, 마감 지나고 안 끝냄, 마감 전(먼 미래)이고 안 끝냄. 마감일 당일에 끝내면 지연이 아니다.
    await env.pg.exec(`
      INSERT INTO tasks(id, organization_id, event_id, title, status, due_on, completed_at, created_by) VALUES
        ('t1','a','e','대관','done','2026-09-01','2026-09-01T23:00+09','p'),
        ('t2','a','e','현수막','done','2026-09-01','2026-09-02T00:30+09','p'),
        ('t3','a','e','정산','todo','2000-01-01',NULL,'p'),
        ('t4','a','e','후기','doing','2999-01-01',NULL,'p');
    `)
    // 구매: 승인 하나, 대기 하나, 작성 중 하나
    await env.approved([link(1)])
    env.as('p')
    await env.submitted([link(2)])
    await env.drafts([link(3)])
    env.as('n')
    const { report, facts, event } = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.equal(report, null)
    assert.equal(event.id, 'e')
    assert.deepEqual(facts, {
      event: { name: '체육대회', startsAt: null, endsAt: null, place: null }, owner: { department: null, person: null },
      registrations: { registered: 2, attended: 1 }, finance: { budget: 100000, spent: 46000 }, tasks: { total: 4, done: 2, late: 2 },
      purchases: { requested: 2, approved: 1 },
    })
    // 참가 신청이 없고 예산도 지출도 없는 행사
    const empty = await env.ok<EventReportResponse>(send('GET', '/events/e2/report'))
    assert.deepEqual([empty.facts.registrations, empty.facts.finance, empty.facts.tasks, empty.facts.purchases],
      [null, { budget: null, spent: 0 }, { total: 0, done: 0, late: 0 }, { requested: 0, approved: 0 }])
    // 다른 학생회 행사, 없는 행사, 미인증, 다른 학생회 사용자
    await refused(send('GET', '/events/ex/report'), 404, 'NOT_FOUND')
    await refused(send('GET', '/events/nope/report'), 404, 'NOT_FOUND')
    env.as(null)
    assert.equal((await send('GET', '/events/e/report')).status, 401)
    env.as('x')
    await refused(send('GET', '/events/e/report'), 403, 'FORBIDDEN')
  } finally { await env.pg.close() }
})

test('기록 목록: 완료한 행사만 최근 완료 순으로, 담당과 수치를 함께 준다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await env.pg.exec(`UPDATE events SET owner_department_id = 'dp', owner_id = 'q' WHERE id = 'e2'`)
    await complete(env, 'e2')
    await complete(env, 'e')
    await env.pg.exec(`UPDATE events SET completed_at = now() - interval '1 day' WHERE id = 'e2'`)
    env.as('n')
    const { records } = await env.ok<RecordsResponse>(send('GET', '/records'))
    assert.deepEqual(records.map(record => record.event.id), ['e', 'e2'])
    assert.deepEqual(records.map(record => record.report), [null, null])
    assert.deepEqual(records[1]!.facts.owner, { department: '기획부', person: '기획2' })
    assert.deepEqual(records[1]!.event.ownerDepartment, { id: 'dp', name: '기획부' })
    // 완료하지 않은 행사와 다른 학생회 행사는 없다.
    await env.pg.exec(`UPDATE events SET completed_at = NULL, completed_by = NULL WHERE id = 'e'`)
    assert.deepEqual((await env.ok<RecordsResponse>(send('GET', '/records'))).records.map(record => record.event.id), ['e2'])
    env.as('x')
    await refused(send('GET', '/records'), 403, 'FORBIDDEN')
  } finally { await env.pg.close() }
})
```
`apps/api/package.json`의 test 목록에서 `src/events/completion-lock.test.ts` 다음에 ` src/reports/reports.test.ts`를 더한다.

- [ ] **Step 3: 실패 확인**

Run: `cd apps/api; npx tsx --test src/reports/reports.test.ts`
Expected: FAIL(모듈 없음)

- [ ] **Step 4: 집행 정의 같이 쓰기** — `apps/api/src/settlement/service.ts`

`financeNumbersByEvent`의 둘째 인자를 `scope: Pick<SettlementScope, 'organizationId'>`로 바꾼다(학생회만 본다). 주석에 "결과보고서(M5b)도 집행을 이 정의로 센다."를 더한다.

- [ ] **Step 5: 수치** — `apps/api/src/reports/facts.ts`

```ts
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { koreanOf, type EventReportFacts, type EventSummary } from '@vada/contracts'
import { eventFinances, purchaseItems, registrationForms, registrations, tasks } from '../db/schema.js'
import { financeNumbersByEvent } from '../settlement/service.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 결과보고서의 자동 수치(M5b). 기록 목록이 행사 여럿을 한 번에 센다. now는 업무 지연을 가르는 날(한국 날짜)의 기준이다.
// 완료한 행사의 기록을 바꾸는 쓰기는 모두 행사 행을 잠그고 완료를 보고 멈추므로(M5a) 여기서는 잠그지 않는다.
export async function factsByEvent(db: Reader, organizationId: string, list: EventSummary[], now: Date) {
  const facts = new Map<string, EventReportFacts>(list.map(event => [event.id, {
    event: { name: event.name, startsAt: event.startsAt, endsAt: event.endsAt, place: event.place },
    owner: { department: event.ownerDepartment?.name ?? null, person: event.owner?.name ?? null },
    registrations: null, finance: { budget: null, spent: 0 }, tasks: { total: 0, done: 0, late: 0 }, purchases: { requested: 0, approved: 0 },
  }]))
  const ids = [...facts.keys()]
  if (!ids.length) return facts
  const of = (id: string) => facts.get(id)!
  // 신청서가 있으면 신청이 없어도 0명이다(LEFT JOIN의 빈 줄은 신청 ID가 없어 세지 않는다).
  const signups = await db.select({ eventId: registrationForms.eventId,
    registered: sql<number>`(count(${registrations.id}) filter (where ${registrations.cancelledAt} is null))::int`,
    attended: sql<number>`count(${registrations.checkedInAt})::int` }).from(registrationForms)
    .leftJoin(registrations, eq(registrations.formId, registrationForms.id))
    .where(and(eq(registrationForms.organizationId, organizationId), inArray(registrationForms.eventId, ids)))
    .groupBy(registrationForms.eventId)
  for (const row of signups) of(row.eventId).registrations = { registered: row.registered, attended: row.attended }
  const budgets = await db.select({ eventId: eventFinances.eventId, budget: eventFinances.budget }).from(eventFinances)
    .where(and(eq(eventFinances.organizationId, organizationId), inArray(eventFinances.eventId, ids)))
  for (const row of budgets) of(row.eventId).finance.budget = row.budget
  for (const [id, numbers] of await financeNumbersByEvent(db, { organizationId }, ids)) of(id).finance.spent = numbers.spent
  const today = koreanOf(now).slice(0, 10)
  const work = await db.select({ eventId: tasks.eventId, total: sql<number>`count(*)::int`,
    done: sql<number>`(count(*) filter (where ${tasks.status} = 'done'))::int`,
    late: sql<number>`(count(*) filter (where ${tasks.dueOn} is not null and case when ${tasks.status} = 'done'
      then (${tasks.completedAt} at time zone 'Asia/Seoul')::date > ${tasks.dueOn} else ${tasks.dueOn} < ${today}::date end))::int` })
    .from(tasks).where(and(eq(tasks.organizationId, organizationId), inArray(tasks.eventId, ids))).groupBy(tasks.eventId)
  for (const row of work) of(row.eventId).tasks = { total: row.total, done: row.done, late: row.late }
  const buying = await db.select({ eventId: purchaseItems.eventId,
    requested: sql<number>`(count(*) filter (where ${purchaseItems.status} <> 'draft'))::int`,
    approved: sql<number>`(count(*) filter (where ${purchaseItems.status} = 'approved'))::int` }).from(purchaseItems)
    .where(and(eq(purchaseItems.organizationId, organizationId), inArray(purchaseItems.eventId, ids))).groupBy(purchaseItems.eventId)
  for (const row of buying) of(row.eventId).purchases = { requested: row.requested, approved: row.approved }
  return facts
}
```

- [ ] **Step 6: 읽기 서비스** — `apps/api/src/reports/service.ts`

```ts
import { and, eq, inArray } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { EventRecord, EventReportResponse, EventReportView, RecordsResponse } from '@vada/contracts'
import { eventReports, users } from '../db/schema.js'
import { eventSummaries, eventSummary } from '../events/events.js'
import { factsByEvent } from './facts.js'

type Db = PgDatabase<PgQueryResultHKT>
export type ReportDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
export interface ReportScope { organizationId: string; userId: string }
const creators = alias(users, 'report_creators')
const updaters = alias(users, 'report_updaters')
const publishers = alias(users, 'report_publishers')

async function reportOf(db: Reader, organizationId: string, eventId: string): Promise<EventReportView | null> {
  const [row] = await db.select({ report: eventReports, creatorName: creators.name, updaterName: updaters.name, publisherName: publishers.name })
    .from(eventReports)
    .innerJoin(creators, eq(creators.id, eventReports.createdBy))
    .innerJoin(updaters, eq(updaters.id, eventReports.updatedBy))
    .leftJoin(publishers, eq(publishers.id, eventReports.publishedBy))
    .where(and(eq(eventReports.organizationId, organizationId), eq(eventReports.eventId, eventId)))
  if (!row) return null
  const { report } = row
  return { status: report.status, operations: report.operations, wentWell: report.wentWell, shortfalls: report.shortfalls,
    improvements: report.improvements, handover: report.handover, version: report.version,
    created: { by: { id: report.createdBy, name: row.creatorName }, at: report.createdAt.toISOString() },
    updated: { by: { id: report.updatedBy, name: row.updaterName }, at: report.updatedAt.toISOString() },
    published: report.publishedAt && report.publishedBy ? { by: { id: report.publishedBy, name: row.publisherName ?? '' }, at: report.publishedAt.toISOString() } : null }
}

// 응답 하나로 행사·보고서·수치를 준다. 바꾸는 요청도 같은 모양으로 돌려준다. 발행했으면 고정한 수치다.
export async function reportResponse(db: Reader, organizationId: string, eventId: string): Promise<EventReportResponse> {
  const event = await eventSummary(db, organizationId, eventId)
  const report = await reportOf(db, organizationId, eventId)
  if (report?.published) {
    const [frozen] = await db.select({ facts: eventReports.facts }).from(eventReports)
      .where(and(eq(eventReports.organizationId, organizationId), eq(eventReports.eventId, eventId)))
    if (frozen?.facts) return { event, report, facts: frozen.facts, factsAt: report.published.at }
  }
  const now = new Date()
  return { event, report, facts: (await factsByEvent(db, organizationId, [event], now)).get(eventId)!, factsAt: now.toISOString() }
}

export function createReportService(db: ReportDatabase) {
  return {
    get: (scope: ReportScope, eventId: string) => reportResponse(db, scope.organizationId, eventId),
    // 완료한 행사, 최근 완료 순. 발행한 보고서는 고정한 수치를, 나머지는 지금 센 수치를 준다.
    async records(scope: ReportScope): Promise<RecordsResponse> {
      const completed = (await eventSummaries(db, scope.organizationId)).filter(event => event.completedAt !== null)
        .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!) || b.id.localeCompare(a.id))
      if (!completed.length) return { records: [] }
      const reports = await db.select({ eventId: eventReports.eventId, status: eventReports.status, publishedAt: eventReports.publishedAt,
        facts: eventReports.facts }).from(eventReports)
        .where(and(eq(eventReports.organizationId, scope.organizationId), inArray(eventReports.eventId, completed.map(event => event.id))))
      const byEvent = new Map(reports.map(row => [row.eventId, row]))
      const live = await factsByEvent(db, scope.organizationId, completed, new Date())
      return { records: completed.map((event): EventRecord => {
        const report = byEvent.get(event.id)
        return { event, report: report ? { status: report.status, publishedAt: report.publishedAt?.toISOString() ?? null } : null,
          facts: report?.status === 'published' && report.facts ? report.facts : live.get(event.id)! }
      }) }
    },
  }
}
```

- [ ] **Step 7: 라우트와 연결** — `apps/api/src/reports/routes.ts`

```ts
import { Hono, type Context } from 'hono'
import { token, type EventReportResponse, type RecordsResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { ApiError } from '../http/errors.js'
import { createReportService, type ReportDatabase, type ReportScope } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 행사로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 기록(완료한 행사)과 결과보고서(M5b). 구성원 누구나 본다.
export function createReportRoutes(db: ReportDatabase, session: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createReportService(db)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/events/:eventId/report'
  const scope = (c: Context<MembershipEnv>): ReportScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  const eventId = (c: Context<MembershipEnv>) => idOf(c.req.param('eventId'))
  routes.get('/organizations/:organizationId/records', auth, member, async c => c.json(await service.records(scope(c)) satisfies RecordsResponse))
  routes.get(base, auth, member, async c => c.json(await service.get(scope(c), eventId(c)) satisfies EventReportResponse))
  return routes
}
```
`app.ts`: `import type { createReportRoutes } from './reports/routes.js'`, `AppOptions`에 `reports?: ReturnType<typeof createReportRoutes>`, 구조 분해에 `reports`, `if (reports) app.route('/api', reports)`(tasks 다음).
`serve.ts`: `import { createReportRoutes } from './reports/routes.js'`, `const reports = createReportRoutes(db, (headers) => auth.api.getSession({ headers }))`, `createApp({ …, tasks, reports, organization, webhook })`.
`boundary.test.ts`·`completion-lock.test.ts`의 `modules`에 `reports: createReportRoutes(db, session)`(import 포함)를 더한다. 두 테스트는 `satisfies Required<…>`라 빠지면 타입 오류다.

- [ ] **Step 8: 통과 확인**

Run: `npm run typecheck`
Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/reports/reports.test.ts src/http/boundary.test.ts src/events/completion-lock.test.ts src/settlement/settlement.test.ts src/budget/budget.test.ts`
Expected: PASS

- [ ] **Step 9: 커밋**

```bash
git add packages/contracts/src apps/api/src apps/api/package.json
git commit -m "기록 목록과 결과보고서 읽기 API"
```

---

### Task 4: 결과보고서 저장·발행·발행 취소 API

**Files:**
- Modify: `apps/api/src/events/lock.ts` (`requireCompletedEvent`)
- Modify: `apps/api/src/reports/service.ts`, `apps/api/src/reports/routes.ts`, `apps/api/src/reports/reports.test.ts`
- Modify: `apps/api/src/events/events.ts` (완료 취소의 `REPORT_PUBLISHED`)
- Modify: `apps/api/src/http/guard.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/src/events/completion-lock.test.ts`, `AGENTS.md`
- Test: `packages/contracts/src/input.test.ts`

**Interfaces:**
- Consumes: Task 3의 `reportResponse`, `ReportScope`, `ReportDatabase`
- Produces: `requireCompletedEvent(tx: Reader, organizationId: string, eventId: string): Promise<void>`, 서비스의 `save(scope, eventId, input)`, `publish(scope, eventId, input)`, `unpublish(scope, eventId, input)`

- [ ] **Step 1: 실패하는 테스트**

`reports.test.ts` 끝에 더한다.
```ts
const draft = { operations: '10:00 시작, 17:00 정리', wentWell: '조를 미리 정했다', shortfalls: null, improvements: null, handover: null }
const full = { ...draft, shortfalls: '물이 모자랐다 — 원인: 인원 예측', improvements: '물은 1인 1병으로', handover: '대관은 6주 전에' }

test('결과보고서 저장: 부서가 있는 구성원이 완료한 행사에만 쓰고, 버전으로 겹침을 막는다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    env.as('p')
    await refused(send('POST', '/events/e/report', { version: 0, ...draft }), 409, 'EVENT_NOT_COMPLETED')
    await complete(env)
    const created = await env.ok<EventReportResponse>(send('POST', '/events/e/report', { version: 0, ...draft }))
    assert.deepEqual([created.report?.status, created.report?.version, created.report?.operations, created.report?.shortfalls, created.report?.created.by,
      created.report?.updated.by, created.report?.published], ['draft', 1, '10:00 시작, 17:00 정리', null, { id: 'p', name: '기획' }, { id: 'p', name: '기획' }, null])
    await refused(send('POST', '/events/e/report', { version: 0, ...draft }), 409, 'VERSION_CONFLICT')
    env.as('q')
    const updated = await env.ok<EventReportResponse>(send('POST', '/events/e/report', { version: 1, ...draft, wentWell: '  앞뒤 공백은 지운다  ' }))
    assert.deepEqual([updated.report?.version, updated.report?.wentWell, updated.report?.created.by.id, updated.report?.updated.by.id], [2, '앞뒤 공백은 지운다', 'p', 'q'])
    await refused(send('POST', '/events/e/report', { version: 1, ...draft }), 409, 'VERSION_CONFLICT')
    // 미배정·다른 학생회·미인증, 다른 학생회 행사·없는 행사
    for (const user of ['n', 'x']) { env.as(user); await refused(send('POST', '/events/e/report', { version: 2, ...draft }), 403, 'FORBIDDEN', user) }
    env.as(null)
    assert.equal((await send('POST', '/events/e/report', { version: 2, ...draft })).status, 401)
    env.as('p')
    await refused(send('POST', '/events/ex/report', { version: 0, ...draft }), 404, 'NOT_FOUND')
    await refused(send('POST', '/events/nope/report', { version: 0, ...draft }), 404, 'NOT_FOUND')
    // 처음 쓰는 두 사람이 겹치면 둘째는 버전 충돌이다(500이 아니다).
    await complete(env, 'e2')
    await env.pg.exec(`INSERT INTO event_reports(event_id, organization_id, operations, created_by, updated_by) VALUES ('e2','a','먼저 씀','q','q')`)
    await refused(send('POST', '/events/e2/report', { version: 0, ...draft }), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('결과보고서 본문: 칸마다 2000자, 빈 글·공백만·NUL·홀로 쓰인 서러게이트·모르는 키·틀린 버전을 거절한다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await complete(env)
    env.as('p')
    const body = (overrides: Record<string, unknown>) => ({ version: 0, ...draft, ...overrides })
    for (const invalid of [{ version: 0 }, body({ handover: undefined }), body({ operations: '' }), body({ operations: ' \n\t ' }),
      body({ operations: 'a'.repeat(2001) }), body({ operations: '😀'.repeat(2001) }), body({ operations: 'a\u0000b' }), body({ operations: '\ud800' }),
      body({ extra: 1 }), body({ version: -1 }), body({ version: 1.5 }), body({ version: '0' }), body({ wentWell: 1 })]) {
      await refused(send('POST', '/events/e/report', invalid), 400, 'INVALID_INPUT', JSON.stringify(invalid).slice(0, 60))
    }
    // 상한 그대로는 저장한다. 제어 문자로 다섯 칸을 채워도 본문 상한(64KiB) 안이다.
    const control = '\u0001'.repeat(2000)
    const longest = await send('POST', '/events/e/report', { version: 0, operations: control, wentWell: control, shortfalls: control, improvements: control,
      handover: '😀'.repeat(2000) })
    assert.equal(longest.status, 200)
  } finally { await env.pg.close() }
})

test('발행: 회장단이 다섯 칸을 다 쓴 보고서를 발행하면 수치·이름이 고정되고, 발행 취소하면 다시 센다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await env.pg.exec(`UPDATE events SET owner_department_id = 'dp' WHERE id = 'e'`)
    await complete(env)
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'REPORT_INCOMPLETE')
    env.as('p')
    await env.ok(send('POST', '/events/e/report', { version: 0, ...draft }))
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'REPORT_INCOMPLETE')
    await env.ok(send('POST', '/events/e/report', { version: 1, ...full }))
    env.as('p')
    await refused(send('POST', '/events/e/report/publish', { version: 2 }), 403, 'FORBIDDEN')
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'VERSION_CONFLICT')
    await refused(send('POST', '/events/e/report/unpublish', { version: 2 }), 409, 'INVALID_STATE')
    const published = await env.ok<EventReportResponse>(send('POST', '/events/e/report/publish', { version: 2 }))
    assert.deepEqual([published.report?.status, published.report?.version, published.report?.published?.by], ['published', 3, { id: 'l', name: '회장' }])
    assert.equal(published.factsAt, published.report?.published?.at)
    assert.equal(published.facts.owner.department, '기획부')
    await refused(send('POST', '/events/e/report/publish', { version: 3 }), 409, 'INVALID_STATE')
    // 발행한 보고서는 고치지 않는다. 부서 이름을 바꿔도 고정한 이름은 그대로다.
    await refused(send('POST', '/events/e/report', { version: 3, ...full }), 409, 'REPORT_PUBLISHED')
    await env.pg.exec(`UPDATE departments SET name = '새 기획부' WHERE id = 'dp'`)
    assert.equal((await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).facts.owner.department, '기획부')
    assert.equal((await env.ok<RecordsResponse>(send('GET', '/records'))).records[0]!.facts.owner.department, '기획부')
    assert.deepEqual((await env.ok<RecordsResponse>(send('GET', '/records'))).records[0]!.report?.status, 'published')
    env.as('p')
    await refused(send('POST', '/events/e/report/unpublish', { version: 3 }), 403, 'FORBIDDEN')
    env.as('l')
    const back = await env.ok<EventReportResponse>(send('POST', '/events/e/report/unpublish', { version: 3 }))
    assert.deepEqual([back.report?.status, back.report?.version, back.report?.published, back.report?.handover, back.facts.owner.department],
      ['draft', 4, null, '대관은 6주 전에', '새 기획부'])
    await refused(send('POST', '/events/e/report/unpublish', { version: 4 }), 409, 'INVALID_STATE')
    for (const path of ['/events/e/report/publish', '/events/e/report/unpublish']) {
      for (const invalid of [{}, { version: 0 }, { version: 1.5 }, { version: '4' }, { version: 4, extra: true }]) {
        await refused(send('POST', path, invalid), 400, 'INVALID_INPUT', `${path} ${JSON.stringify(invalid)}`)
      }
    }
  } finally { await env.pg.close() }
})

test('발행한 보고서가 있으면 완료를 취소하지 않는다. 작성 중 보고서는 완료 취소 뒤에도 남는다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await complete(env)
    env.as('p')
    await env.ok(send('POST', '/events/e/report', { version: 0, ...full }))
    env.as('l')
    await env.ok(send('POST', '/events/e/report/publish', { version: 1 }))
    await refused(send('POST', '/events/e/completion/cancel', { version: 2 }), 409, 'REPORT_PUBLISHED')
    await env.ok(send('POST', '/events/e/report/unpublish', { version: 2 }))
    await env.ok(send('POST', '/events/e/completion/cancel', { version: 2 }))
    const kept = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.deepEqual([kept.event.completedAt, kept.report?.status, kept.report?.operations], [null, 'draft', full.operations])
    await refused(send('POST', '/events/e/report', { version: 3, ...full }), 409, 'EVENT_NOT_COMPLETED')
    await refused(send('POST', '/events/e/report/publish', { version: 3 }), 409, 'EVENT_NOT_COMPLETED')
  } finally { await env.pg.close() }
})
```
`packages/contracts/src/input.test.ts` 끝(import에 `SaveEventReportSchema, PublishEventReportSchema, REPORT_SECTION_MAX`):
```ts
test('결과보고서는 다섯 칸을 모두 보내고, 빈 칸은 null이다', () => {
  const body = { version: 0, operations: null, wentWell: null, shortfalls: null, improvements: null, handover: null }
  assert.equal(SaveEventReportSchema.safeParse(body).success, true)
  assert.equal(SaveEventReportSchema.safeParse({ ...body, handover: '가'.repeat(REPORT_SECTION_MAX) }).success, true)
  for (const invalid of [{ ...body, handover: undefined }, { ...body, handover: '' }, { ...body, handover: '가'.repeat(REPORT_SECTION_MAX + 1) },
    { ...body, extra: 1 }, { ...body, version: -1 }]) assert.equal(SaveEventReportSchema.safeParse(invalid).success, false)
  assert.equal(PublishEventReportSchema.safeParse({ version: 0 }).success, false)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd apps/api; npx tsx --test src/reports/reports.test.ts`
Expected: FAIL(POST 경로 404)

- [ ] **Step 3: 잠금 함수** — `apps/api/src/events/lock.ts` 끝

```ts
// 결과보고서(M5b)는 반대로 완료한 행사에서만 쓴다. FOR SHARE라 완료 취소(FOR NO KEY UPDATE)와 하나씩 진행되고,
// 완료 취소는 그 뒤 발행한 보고서를 보고 멈춘다.
export async function requireCompletedEvent(tx: Reader, organizationId: string, eventId: string) {
  if (!(await shareEvent(tx, organizationId, eventId)).completedAt) throw new ApiError('EVENT_NOT_COMPLETED', 409)
}
```

- [ ] **Step 4: 쓰기 서비스** — `apps/api/src/reports/service.ts`

import에 `sql`(drizzle-orm), `REPORT_SECTIONS, type PublishEventReportRequest, type SaveEventReportRequest`(contracts), `requireCompletedEvent`(`../events/lock.js`), `ApiError`(`../http/errors.js`), `eventSummary`가 이미 있으면 그대로. `createReportService`의 반환 객체에 더한다.
```ts
    // 다섯 칸을 한 번에 저장한다. 처음 쓰면(버전 0) 보고서를 만들고, 겹쳐 만들면 버전 충돌이다.
    async save(scope: ReportScope, eventId: string, input: SaveEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (current?.status === 'published') throw new ApiError('REPORT_PUBLISHED', 409)
        if ((current?.version ?? 0) !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        const texts = { operations: input.operations, wentWell: input.wentWell, shortfalls: input.shortfalls, improvements: input.improvements,
          handover: input.handover }
        if (current) {
          await tx.update(eventReports).set({ ...texts, version: current.version + 1, updatedBy: scope.userId, updatedAt: sql`now()` })
            .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        } else {
          const inserted = await tx.insert(eventReports).values({ eventId, organizationId: scope.organizationId, ...texts, createdBy: scope.userId,
            updatedBy: scope.userId }).onConflictDoNothing().returning({ eventId: eventReports.eventId })
          if (!inserted.length) throw new ApiError('VERSION_CONFLICT', 409)
        }
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
    // 발행: 다섯 칸을 다 쓴 작성 중 보고서에 지금 수치와 이름을 고정한다.
    async publish(scope: ReportScope, eventId: string, input: PublishEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (!current) throw new ApiError('REPORT_INCOMPLETE', 409)
        if (current.status === 'published') throw new ApiError('INVALID_STATE', 409)
        if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        if (REPORT_SECTIONS.some(key => current[key] === null)) throw new ApiError('REPORT_INCOMPLETE', 409)
        const event = await eventSummary(tx, scope.organizationId, eventId)
        const at = new Date()
        const facts = (await factsByEvent(tx, scope.organizationId, [event], at)).get(eventId)!
        await tx.update(eventReports).set({ status: 'published', facts, publishedAt: at, publishedBy: scope.userId, version: current.version + 1 })
          .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
    // 발행 취소: 작성 중으로 되돌린다. 글은 두고 고정한 수치는 지운다(다시 발행할 때 다시 센다).
    async unpublish(scope: ReportScope, eventId: string, input: PublishEventReportRequest): Promise<EventReportResponse> {
      return db.transaction(async tx => {
        await requireCompletedEvent(tx, scope.organizationId, eventId)
        const current = await lockReport(tx, scope, eventId)
        if (current?.status !== 'published') throw new ApiError('INVALID_STATE', 409)
        if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
        await tx.update(eventReports).set({ status: 'draft', facts: null, publishedAt: null, publishedBy: null, version: current.version + 1 })
          .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId)))
        return reportResponse(tx, scope.organizationId, eventId)
      })
    },
```
파일 위쪽(`reportOf` 다음)에 더한다.
```ts
type Transaction = Parameters<Parameters<ReportDatabase['transaction']>[0]>[0]
// 보고서 행을 잠근다. 잠금 순서는 행사(requireCompletedEvent) → 보고서다.
async function lockReport(tx: Transaction, scope: ReportScope, eventId: string) {
  const [row] = await tx.select().from(eventReports)
    .where(and(eq(eventReports.organizationId, scope.organizationId), eq(eventReports.eventId, eventId))).for('update')
  return row ?? null
}
```

- [ ] **Step 5: 쓰기 라우트** — `apps/api/src/reports/routes.ts`

import에 `PublishEventReportSchema, SaveEventReportSchema, UnpublishEventReportSchema`(contracts), `requireEventManager, requireOrganizationManager`(membership), `json`(`../http/validate.js`). `return routes` 앞에 더한다.
```ts
  // 쓰기는 부서가 있는 구성원, 발행·발행 취소는 회장단이다. 모두 완료한 행사에서만 된다.
  const writer = requireEventManager()
  const leader = requireOrganizationManager()
  routes.post(base, json(SaveEventReportSchema), auth, member, writer, async c =>
    c.json(await service.save(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/publish`, json(PublishEventReportSchema), auth, member, leader, async c =>
    c.json(await service.publish(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
  routes.post(`${base}/unpublish`, json(UnpublishEventReportSchema), auth, member, leader, async c =>
    c.json(await service.unpublish(scope(c), eventId(c), c.req.valid('json')) satisfies EventReportResponse))
```

- [ ] **Step 6: 완료 취소** — `apps/api/src/events/events.ts`

import에 `eventReports`. 완료 취소 거래의 `INVALID_STATE` 검사 다음에 더한다.
```ts
      // 발행한 결과보고서(M5b)가 있으면 먼저 발행을 취소한다. 발행·발행 취소는 이 행사 행을 FOR SHARE로 잡으므로 그사이 바뀌지 않는다.
      const [report] = await tx.select({ status: eventReports.status }).from(eventReports)
        .where(and(eq(eventReports.organizationId, organizationId), eq(eventReports.eventId, eventId)))
      if (report?.status === 'published') throw new ApiError('REPORT_PUBLISHED', 409)
```

- [ ] **Step 7: 본문 상한** — `apps/api/src/http/guard.ts`

```ts
// 본문이 큰 경로. 상한은 여기 한 곳에서 정하고 라우트에서 다시 다루지 않는다.
// 학생회비 명단은 학번·이름 수천 줄을 한 번에 받는다. 결과보고서 저장(M5b)은 2000자 다섯 칸이고, 제어 문자는 JSON에서 6바이트가 된다.
const largeBodies: { pattern: RegExp; max: number }[] = [
  { pattern: /^\/api\/organizations\/[^/]+\/dues-roster$/, max: 1_048_576 },
  { pattern: /^\/api\/organizations\/[^/]+\/events\/[^/]+\/report$/, max: 65_536 },
]
```
`boundary.test.ts`의 둘째 테스트를 바꾼다.
```ts
test('본문 상한은 가드 한 곳에서 경로마다 정한다: 학생회비 명단은 1 MiB, 결과보고서 저장은 64 KiB이다', () => {
  assert.equal(bodyLimitOf('/api/organizations/a/dues-roster'), 1_048_576)
  assert.equal(bodyLimitOf('/api/organizations/a/events/e/report'), 65_536)
  for (const path of ['/api/organizations/a/dues-roster/delete', '/api/organizations/a/expenses', '/api/public/registrations/lookup',
    '/api/organizations/a/b/dues-roster', '/api/organizations//dues-roster', '/api/organizations/a/events/e/report/publish',
    '/api/organizations/a/events/e/report/unpublish', '/api/organizations/a/events//report', '/api/organizations/a/events/e/reports']) {
    assert.equal(bodyLimitOf(path), MAX_BODY_BYTES, path)
  }
})
```

- [ ] **Step 8: 잠금 전수 테스트와 저장소 규칙**

`completion-lock.test.ts`
```ts
// 완료한 행사에서 하는 일: 완료·완료 취소(M5a)와 결과보고서(M5b). 결과보고서는 반대로 완료한 행사에서만 쓴다(reports.test.ts).
const completedOnly = new Set([`POST ${eventRoot}/completion`, `POST ${eventRoot}/completion/cancel`,
  `POST ${eventRoot}/report`, `POST ${eventRoot}/report/publish`, `POST ${eventRoot}/report/unpublish`])
```
(`completionRoutes`를 이 이름으로 바꾸고 쓰는 곳도 바꾼다.) "완료를 취소하면" 앞에 더한다.
```ts
    // 완료한 행사에서도 결과보고서는 쓴다.
    assert.equal((await send('POST', at('/report'), { version: 0, operations: '진행', wentWell: null, shortfalls: null, improvements: null,
      handover: null })).status, 200)
```
`AGENTS.md`의 행사 잠금 줄 끝에 더한다: "결과보고서(M5b)는 반대로 완료한 행사에서만 쓰고(`requireCompletedEvent`), 그 라우트는 `completion-lock.test.ts`의 `completedOnly`에 둔다."

- [ ] **Step 9: 통과 확인**

Run: `npm test --workspace @vada/contracts`
Run: `cd apps/api; npx tsx --test --test-concurrency=2 src/reports/reports.test.ts src/http/boundary.test.ts src/events/completion-lock.test.ts src/events/completion.test.ts`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add packages/contracts/src apps/api/src AGENTS.md
git commit -m "결과보고서 저장·발행·발행 취소 API"
```

---

### Task 5: 화면 — 행사 담당 고르기

**Files:**
- Modify: `apps/web/src/registrations/EventInfoDialog.tsx`, `apps/web/src/registrations/RegistrationPanel.tsx`, `apps/web/src/public/registration-text.ts`, `apps/web/src/organization/Members.tsx`
- Create: `apps/web/src/registrations/EventInfoDialog.test.tsx`
- Test: `apps/web/src/registrations/RegistrationPanel.test.tsx`, `apps/web/src/organization/Members.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `EventSummary.ownerDepartment·owner`, `UpdateEventRequest.ownerDepartmentId·ownerMembershipId`

- [ ] **Step 1: 실패하는 테스트** — `EventInfoDialog.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EventSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import EventInfoDialog from './EventInfoDialog'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const directory = { viewer: null, departments: [{ id: 'dp', name: '기획부', isLeadership: false, handlesFinance: false },
  { id: 'dl', name: '회장단', isLeadership: true, handlesFinance: false }],
  members: [{ id: 'mp', name: '정민재', title: null, departmentId: 'dp' }, { id: 'mn', name: '강하늘', title: null, departmentId: null }] }
function setup(target: EventSummary = event()) {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/members', () => json(directory))
  const onSaved = vi.fn()
  render(<EventInfoDialog open organizationId="o" event={target} onClose={vi.fn()} onSaved={onSaved} onStale={vi.fn()} />)
  return { api, onSaved }
}

test('담당 부서와 책임자를 고른다. 책임자는 부서가 있는 구성원만 보이고, 고르면 빈 담당 부서를 채운다', async () => {
  const { api, onSaved } = setup()
  api.on('PATCH', '/api/organizations/o/events/e', call => json({ event: { ...event(), version: 2, ...(call.body as object) } }))
  const owner = await screen.findByLabelText('책임자(선택)') as HTMLSelectElement
  await vi.waitFor(() => expect(owner.disabled).toBe(false))
  expect([...owner.options].map(option => option.text)).toEqual(['없음', '정민재'])
  fireEvent.change(owner, { target: { value: 'mp' } })
  expect((screen.getByLabelText('담당 부서(선택)') as HTMLSelectElement).value).toBe('dp')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(api.calls.find(call => call.method === 'PATCH')?.body).toEqual({ version: 1, startsAt: null, endsAt: null, place: null,
    ownerDepartmentId: 'dp', ownerMembershipId: 'mp' })
})

test('미배정이 된 지금 책임자는 고른 채로 남는다', async () => {
  setup({ ...event(), ownerDepartment: null, owner: { membershipId: 'mn', name: '강하늘' } })
  const owner = await screen.findByLabelText('책임자(선택)') as HTMLSelectElement
  await vi.waitFor(() => expect(owner.value).toBe('mn'))
  expect([...owner.options].map(option => option.text)).toContain('강하늘 (미배정)')
})

test('고를 수 없는 책임자면 서버 이유를 보인다', async () => {
  const { api } = setup()
  api.on('PATCH', '/api/organizations/o/events/e', () => json({ error: 'EVENT_OWNER_INVALID' }, 409))
  const owner = await screen.findByLabelText('책임자(선택)') as HTMLSelectElement
  await vi.waitFor(() => expect(owner.disabled).toBe(false))
  fireEvent.change(owner, { target: { value: 'mp' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('부서가 있는 구성원만 책임자로 정할 수 있어요. 목록을 새로 불러와 다시 골라 주세요.')).toBeTruthy()
})
```
(`workflow-fixtures`의 `event()`가 organizationId `o`, id `e`가 아니면 그 값으로 경로를 바꾼다.)

`RegistrationPanel.test.tsx` — 기존 그리기 헬퍼로 `event={{ ...event, ownerDepartment: { id: 'dp', name: '기획부' }, owner: { membershipId: 'mp', name: '정민재' } }}`를 그리면 `'담당 기획부 · 책임자 정민재'`가 보이고, 담당이 없으면 `/담당/` 글이 없다는 테스트.

`Members.test.tsx` — 기존 `DEPARTMENT_IN_USE` 테스트의 기대 문구를 `'구매 요청 기록이 있거나 행사를 맡은 부서는 지울 수 없어요. 이름을 바꿔 쓰세요.'`로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/registrations src/organization`
Expected: 새 테스트 FAIL

- [ ] **Step 3: 오류 문구** — `public/registration-text.ts`의 messages에 더한다.

```ts
  EVENT_DEPARTMENT_INVALID: '없는 부서예요. 목록을 새로 불러와 다시 골라 주세요.',
  EVENT_OWNER_INVALID: '부서가 있는 구성원만 책임자로 정할 수 있어요. 목록을 새로 불러와 다시 골라 주세요.',
```
`organization/Members.tsx`: `DEPARTMENT_IN_USE: '구매 요청 기록이 있거나 행사를 맡은 부서는 지울 수 없어요. 이름을 바꿔 쓰세요.',`

- [ ] **Step 4: 대화상자** — `EventInfoDialog.tsx`

import에 `NativeSelect`, `useOrganizationMembers`(`../organization/useOrganizationMembers`). `Form` 안:
```tsx
  const [departmentId, setDepartmentId] = useState(event.ownerDepartment?.id ?? '')
  const [ownerId, setOwnerId] = useState(event.owner?.membershipId ?? '')
  // 부서·책임자 고르기에 쓴다. 대화상자를 연 동안만 불러온다.
  const directory = useOrganizationMembers(organizationId, true)
  const staff = directory.data?.members.filter(member => member.departmentId !== null) ?? []
  // 미배정이 된 지금 책임자는 목록에 없으므로 따로 넣어 고른 채로 둔다.
  const keptOwner = directory.data && event.owner && !staff.some(member => member.id === event.owner?.membershipId) ? event.owner : null
  function chooseOwner(value: string) {
    setOwnerId(value)
    const department = staff.find(member => member.id === value)?.departmentId
    if (!departmentId && department) setDepartmentId(department)
  }
  const input: UpdateEventRequest = { version: event.version, startsAt: startsAt || null, endsAt: endsAt || null, place: place.trim() ? place : null,
    ownerDepartmentId: departmentId || null, ownerMembershipId: ownerId || null }
```
설명은 "일시·장소는 참가 신청 화면에 보여요. 시각은 한국 시각이에요."로 바꾸고, 장소 다음에 더한다.
```tsx
      {directory.loadError ? <StateMessage kind="notice">구성원 목록을 불러오지 못해 담당은 고를 수 없어요.</StateMessage>
        : <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex flex-col gap-1.5">담당 부서(선택)
            <NativeSelect value={departmentId} disabled={!directory.data} onChange={item => setDepartmentId(item.target.value)}>
              <option value="">{directory.data ? '없음' : '불러오는 중…'}</option>
              {directory.data?.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </NativeSelect></Label>
          <Label className="flex flex-col gap-1.5">책임자(선택)
            <NativeSelect value={ownerId} disabled={!directory.data} onChange={item => chooseOwner(item.target.value)}>
              <option value="">{directory.data ? '없음' : '불러오는 중…'}</option>
              {staff.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
              {keptOwner && <option value={keptOwner.membershipId}>{keptOwner.name} (미배정)</option>}
            </NativeSelect></Label>
        </div>}
```
저장에 실패한 코드가 `EVENT_DEPARTMENT_INVALID`·`EVENT_OWNER_INVALID`면 `directory.refresh()`를 부른다(목록이 오래됐다). `useOrganizationMembers`가 `refresh`를 내보내지 않으면 내보낸다.

- [ ] **Step 5: 행사 정보 카드** — `RegistrationPanel.tsx`

장소 줄 다음에 더한다.
```tsx
      {(event.ownerDepartment || event.owner) && <p className="text-sm wrap-anywhere text-gray-700">{ownerText(event)}</p>}
```
파일 위에 더한다.
```ts
// "담당 기획부 · 책임자 정민재". 정한 것만 적는다.
const ownerText = (event: EventSummary) => [event.ownerDepartment && `담당 ${event.ownerDepartment.name}`, event.owner && `책임자 ${event.owner.name}`]
  .filter(Boolean).join(' · ')
```

- [ ] **Step 6: 통과 확인**

Run: `npm test --workspace @vada/web -- src/registrations src/organization`
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src
git commit -m "행사 정보에서 담당 부서·책임자 고르기"
```

---

### Task 6: 화면 — 결과보고서

**Files:**
- Create: `apps/web/src/records/record-view.ts`, `apps/web/src/records/record-view.test.ts`, `apps/web/src/records/useEventReport.ts`, `apps/web/src/records/EventReport.tsx`, `apps/web/src/records/EventReport.test.tsx`, `apps/web/src/records/record-fixtures.ts`

**Interfaces:**
- Consumes: Task 3·4의 contracts(`EventReportResponse`, `EventReportFacts`, `SaveEventReportSchema`, `REPORT_SECTIONS`, `REPORT_SECTION_LABELS`)
- Produces:
  - `record-view.ts`: `reportStateOf(report: { status: ReportStatus } | null): 'none' | 'draft' | 'published'`, `reportStateLabels`, `reportStateTones`, `sectionHints`, `dayOf(iso: string): string`, `eventDayText(startsAt: string | null): string`, `ownerText(owner: EventReportFacts['owner']): string | null`, `factStats(facts: EventReportFacts): Stat[]`, `recordChips(facts: EventReportFacts): string[]`, `reportMessage(code: string | null): string`, `staleReportCodes: Set<string>`
  - `useEventReport(organizationId: string, eventId: string)` → `{ data, loadError, revision, refresh, save(input), publish(version), unpublish(version) }`, 결과는 `{ ok: true } | { ok: false; code: string | null; message: string }`
  - `<EventReport organizationId eventId canWrite canPublish onOpenEvent onDirtyChange onEvent />`

- [ ] **Step 1: 실패하는 테스트**

`record-fixtures.ts`
```ts
import type { EventReportFacts, EventReportResponse, EventReportView } from '@vada/contracts'
import { event } from '../test-support/workflow-fixtures'

export const facts = (overrides: Partial<EventReportFacts> = {}): EventReportFacts => ({
  event: { name: '체육대회', startsAt: '2026-09-26T10:00', endsAt: '2026-09-26T17:00', place: '대운동장' },
  owner: { department: '기획부', person: '정민재' }, registrations: { registered: 26, attended: 22 }, finance: { budget: 700000, spent: 512700 },
  tasks: { total: 3, done: 3, late: 1 }, purchases: { requested: 4, approved: 3 }, ...overrides })
const person = { id: 'u1', name: '정민재' }
export const reportView = (overrides: Partial<EventReportView> = {}): EventReportView => ({
  status: 'draft', operations: '10:00 시작', wentWell: null, shortfalls: null, improvements: null, handover: null, version: 1,
  created: { by: person, at: '2026-10-01T05:00:00.000Z' }, updated: { by: person, at: '2026-10-01T05:00:00.000Z' }, published: null, ...overrides })
export const reportResponse = (overrides: Partial<EventReportResponse> = {}): EventReportResponse => ({
  event: { ...event(), completedAt: '2026-09-30T01:00:00.000Z', version: 2 }, report: reportView(), facts: facts(),
  factsAt: '2026-10-12T01:00:00.000Z', ...overrides })
export const full = { operations: '10:00 시작', wentWell: '조를 미리 정했다', shortfalls: '물이 모자랐다', improvements: '물은 1인 1병', handover: '대관은 6주 전' }
```

`record-view.test.ts`
```ts
import { expect, test } from 'vitest'
import { eventDayText, factStats, ownerText, recordChips } from './record-view'
import { facts } from './record-fixtures'

test('숫자 넷을 읽는 글로 바꾼다. 비율은 반올림한다', () => {
  expect(factStats(facts()).map(stat => [stat.label, stat.value, stat.note])).toEqual([
    ['신청 → 참석', '26명 → 22명', '참석률 85%'], ['예산 → 집행', '700,000원 → 512,700원', '집행률 73%'],
    ['업무', '완료 3/3건', '지연 1건'], ['구매', '요청 4건 · 승인 3건', undefined]])
})
test('신청을 받지 않았거나 예산이 없거나 업무가 없을 때', () => {
  const stats = factStats(facts({ registrations: null, finance: { budget: null, spent: 64000 }, tasks: { total: 0, done: 0, late: 0 } }))
  expect(stats.map(stat => [stat.value, stat.note])).toEqual([['신청 안 받음', undefined], ['집행 64,000원', '예산 미정'], ['업무 없음', undefined],
    ['요청 4건 · 승인 3건', undefined]])
  expect(factStats(facts({ finance: { budget: 0, spent: 0 } }))[1]!.note).toBeUndefined()
})
test('기록 목록 칩과 담당·날짜 글', () => {
  expect(recordChips(facts())).toEqual(['참석 22명 (신청 26명)', '예산 집행 73%', '완료 업무 3건'])
  expect(recordChips(facts({ registrations: null, finance: { budget: null, spent: 0 }, tasks: { total: 0, done: 0, late: 0 } }))).toEqual([])
  expect(ownerText({ department: '기획부', person: '정민재' })).toBe('담당 기획부 · 책임자 정민재')
  expect(ownerText({ department: null, person: '정민재' })).toBe('책임자 정민재')
  expect(ownerText({ department: null, person: null })).toBeNull()
  expect(eventDayText('2026-03-06T10:00')).toBe('2026. 3. 6.')
  expect(eventDayText(null)).toBe('날짜 미정')
})
```

`EventReport.test.tsx`
```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EventReportResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import EventReport from './EventReport'
import { full, reportResponse, reportView } from './record-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/events/e/report'
function setup(body: EventReportResponse, rights: { canWrite?: boolean; canPublish?: boolean } = {}) {
  const api = mockApi()
  api.on('GET', path, () => json(body))
  const onOpenEvent = vi.fn()
  const onDirtyChange = vi.fn()
  render(<EventReport organizationId="o" eventId="e" canWrite={rights.canWrite ?? true} canPublish={rights.canPublish ?? false}
    onOpenEvent={onOpenEvent} onDirtyChange={onDirtyChange} onEvent={vi.fn()} />)
  return { api, onOpenEvent, onDirtyChange }
}
const field = (label: string) => screen.getByRole('textbox', { name: label }) as HTMLTextAreaElement

test('쓰는 사람은 다섯 칸을 쓰고 저장한다. 고친 글이 있으면 알리고, 저장하면 서버 응답으로 바뀐다', async () => {
  const { api, onDirtyChange } = setup(reportResponse())
  api.on('POST', path, call => json(reportResponse({ report: reportView({ ...(call.body as object), version: 2 }) })))
  expect(await screen.findByRole('textbox', { name: '현장 운영' })).toBeTruthy()
  expect(screen.getByText('26명 → 22명')).toBeTruthy()
  expect(screen.getByText('담당 기획부 · 책임자 정민재')).toBeTruthy()
  const save = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement
  expect(save.disabled).toBe(true)
  fireEvent.change(field('잘된 점'), { target: { value: '조를 미리 정했다' } })
  expect(screen.getByText('저장하지 않은 글이 있어요.')).toBeTruthy()
  expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(save)
  await vi.waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1, operations: '10:00 시작', wentWell: '조를 미리 정했다',
    shortfalls: null, improvements: null, handover: null })
  expect(await screen.findByText('다섯 칸 중 2칸을 썼어요.')).toBeTruthy()
})

test('칸이 너무 길면 그 칸에 알리고 저장을 끈다', async () => {
  setup(reportResponse())
  fireEvent.change(await screen.findByRole('textbox', { name: '인수인계' }), { target: { value: '가'.repeat(2001) } })
  expect(screen.getByText('글이 너무 길어요. 줄여 주세요.')).toBeTruthy()
  expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true)
})

test('회장단은 다섯 칸을 다 쓰고 저장한 보고서만 발행하고, 발행을 확인한다', async () => {
  const { api } = setup(reportResponse({ report: reportView({ ...full, version: 3 }) }), { canPublish: true })
  api.on('POST', `${path}/publish`, () => json(reportResponse({ report: reportView({ ...full, version: 4, status: 'published',
    published: { by: { id: 'l', name: '이서연' }, at: '2026-10-12T01:00:00.000Z' } }) })))
  const publish = await screen.findByRole('button', { name: '발행' }) as HTMLButtonElement
  expect(publish.disabled).toBe(false)
  fireEvent.change(field('인수인계'), { target: { value: '바꾸는 중' } })
  expect(publish.disabled).toBe(true)
  fireEvent.change(field('인수인계'), { target: { value: full.handover } })
  fireEvent.click(publish)
  const dialog = await screen.findByRole('dialog', { name: '결과보고서를 발행할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '발행' }))
  expect(await screen.findByRole('button', { name: '발행 취소' })).toBeTruthy()
  expect(api.calls.find(call => call.path.endsWith('/publish'))?.body).toEqual({ version: 3 })
  expect(screen.queryByRole('textbox', { name: '현장 운영' })).toBeNull()
  expect(screen.getByText('조를 미리 정했다')).toBeTruthy()
  expect(screen.getByText('발행할 때 센 숫자예요.', { exact: false })).toBeTruthy()
})

test('빈 칸이 있으면 발행을 끈다', async () => {
  setup(reportResponse(), { canPublish: true })
  expect((await screen.findByRole('button', { name: '발행' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('다섯 칸 중 1칸을 썼어요.')).toBeTruthy()
})

test('미배정은 읽기만 한다. 쓰지 않은 칸은 아직 쓰지 않았다고 보인다', async () => {
  setup(reportResponse(), { canWrite: false })
  expect(await screen.findByText('10:00 시작')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getAllByText('아직 쓰지 않았어요.')).toHaveLength(4)
  expect(screen.queryByRole('button', { name: '저장' })).toBeNull()
})

test('남이 먼저 발행했으면 쓴 글을 지우지 않고 이유와 새로 불러오기를 보인다', async () => {
  const { api } = setup(reportResponse())
  api.on('POST', path, () => json({ error: 'REPORT_PUBLISHED' }, 409))
  fireEvent.change(await screen.findByRole('textbox', { name: '잘된 점' }), { target: { value: '내가 쓴 글' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('이미 발행한 결과보고서예요. 고치려면 회장단이 발행을 취소해야 해요.')).toBeTruthy()
  expect(field('잘된 점').value).toBe('내가 쓴 글')
  fireEvent.click(screen.getByRole('button', { name: '새로 불러오기' }))
  await vi.waitFor(() => expect(api.calls.filter(call => call.method === 'GET')).toHaveLength(2))
})

test('행사 기록 보기를 누르면 행사 화면을 연다. 완료를 취소한 행사면 안내하고 읽기만 한다', async () => {
  const { onOpenEvent } = setup(reportResponse({ event: { ...reportResponse().event, completedAt: null } }))
  expect(await screen.findByText('완료를 취소한 행사예요. 다시 완료하면 이어서 쓸 수 있어요.')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '행사 기록 보기' }))
  expect(onOpenEvent).toHaveBeenCalled()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/records`
Expected: FAIL(모듈 없음)

- [ ] **Step 3: 표시용 글** — `records/record-view.ts`

```ts
import { dateFromKorean, type EventReportFacts, type ReportSection, type ReportStatus } from '@vada/contracts'
import type { Stat } from '@/components/StatGrid'
import type { Tone } from '@/components/ui/badge'
import { won } from '../public/registration-text'

export type ReportState = 'none' | ReportStatus
export const reportStateOf = (report: { status: ReportStatus } | null): ReportState => report?.status ?? 'none'
export const reportStateLabels: Record<ReportState, string> = { none: '작성 전', draft: '작성 중', published: '발행' }
export const reportStateTones: Record<ReportState, Tone> = { none: 'neutral', draft: 'warning', published: 'success' }
// 쓰는 화면에서 칸마다 보이는 도움말(REC-02A)
export const sectionHints: Record<ReportSection, string> = {
  operations: '실제 진행 순서, 인력 배치, 돌발 상황과 대응',
  wentWell: '다음에도 그대로 하면 좋을 것',
  shortfalls: '아쉬웠던 점과 그 원인',
  improvements: '다음 행사에서 실제로 할 수 있는 행동',
  handover: '다시 쓸 자료, 협력처·연락처, 주의할 점',
}
// ISO 시각 → "2026. 10. 12."(한국 날짜)
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
// 한국 시각 "2026-03-06T10:00" → "2026. 3. 6."
export const eventDayText = (startsAt: string | null) => startsAt ? dayOf(dateFromKorean(startsAt).toISOString()) : '날짜 미정'
// "담당 기획부 · 책임자 정민재". 정한 것만 적고, 아무것도 없으면 null이다.
export function ownerText(owner: EventReportFacts['owner']) {
  const parts = [owner.department && `담당 ${owner.department}`, owner.person && `책임자 ${owner.person}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
const percent = (part: number, whole: number) => `${Math.round(part / whole * 100)}%`
// 결과보고서 숫자 카드(신청→참석, 예산→집행, 업무, 구매)
export function factStats(facts: EventReportFacts): Stat[] {
  const { registrations, finance, tasks, purchases } = facts
  return [
    registrations ? { label: '신청 → 참석', value: `${registrations.registered}명 → ${registrations.attended}명`,
      note: registrations.registered > 0 ? `참석률 ${percent(registrations.attended, registrations.registered)}` : undefined }
      : { label: '신청 → 참석', value: '신청 안 받음' },
    finance.budget === null ? { label: '예산 → 집행', value: `집행 ${won(finance.spent)}`, note: '예산 미정' }
      : { label: '예산 → 집행', value: `${won(finance.budget)} → ${won(finance.spent)}`,
        note: finance.budget > 0 ? `집행률 ${percent(finance.spent, finance.budget)}` : undefined },
    tasks.total ? { label: '업무', value: `완료 ${tasks.done}/${tasks.total}건`, note: tasks.late ? `지연 ${tasks.late}건` : '지연 없음' }
      : { label: '업무', value: '업무 없음' },
    { label: '구매', value: `요청 ${purchases.requested}건 · 승인 ${purchases.approved}건` },
  ]
}
// 기록 목록 카드의 숫자 칩(REC-01). 셀 것이 없으면 뺀다.
export function recordChips({ registrations, finance, tasks }: EventReportFacts) {
  return [
    registrations && `참석 ${registrations.attended}명 (신청 ${registrations.registered}명)`,
    finance.budget ? `예산 집행 ${percent(finance.spent, finance.budget)}` : finance.spent ? `집행 ${won(finance.spent)}` : null,
    tasks.total ? `완료 업무 ${tasks.done}건` : null,
  ].filter((chip): chip is string => Boolean(chip))
}
const messages: Record<string, string> = {
  EVENT_NOT_COMPLETED: '완료하지 않은 행사예요. 회장단이 행사를 완료하면 결과보고서를 쓸 수 있어요.',
  REPORT_PUBLISHED: '이미 발행한 결과보고서예요. 고치려면 회장단이 발행을 취소해야 해요.',
  REPORT_INCOMPLETE: '다섯 칸을 모두 써야 발행할 수 있어요.',
  INVALID_STATE: '이미 바뀌었어요. 새로 불러와 주세요.',
  VERSION_CONFLICT: '다른 사람이 먼저 저장했어요. 쓴 글을 복사해 두고 새로 불러와 주세요.',
  FORBIDDEN: '권한이 없어요. 쓰기는 부서가 있는 구성원, 발행은 회장단이 해요.',
  NOT_FOUND: '행사를 찾을 수 없어요.',
  INVALID_INPUT: '입력한 내용을 다시 확인해 주세요.',
}
export const reportMessage = (code: string | null) => (code && messages[code]) || '처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'
// 화면이 오래된 경우다. [새로 불러오기]를 보인다.
export const staleReportCodes = new Set(['VERSION_CONFLICT', 'REPORT_PUBLISHED', 'INVALID_STATE', 'EVENT_NOT_COMPLETED', 'REPORT_INCOMPLETE'])
```

- [ ] **Step 4: 불러오기·보내기** — `records/useEventReport.ts`

```ts
import { useCallback, useEffect, useState } from 'react'
import type { EventReportResponse, SaveEventReportRequest } from '@vada/contracts'
import { reportMessage } from './record-view'

export type ReportResult = { ok: true } | { ok: false; code: string | null; message: string }
const isReport = (body: unknown): body is EventReportResponse => typeof body === 'object' && body !== null
  && typeof (body as EventReportResponse).event === 'object' && typeof (body as EventReportResponse).facts === 'object'

// 결과보고서 화면을 열면 불러온다. 바꾸는 요청은 같은 모양의 응답을 받아 그대로 바꾼다. revision은 받을 때마다 오른다.
export function useEventReport(organizationId: string, eventId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/events/${encodeURIComponent(eventId)}/report`
  const [data, setData] = useState<EventReportResponse | null>(null)
  const [revision, setRevision] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const accept = useCallback((body: EventReportResponse) => { setData(body); setRevision(value => value + 1) }, [])
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isReport(body)) throw new Error('Report lookup failed')
        if (!controller.signal.aborted) accept(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt, accept])
  async function send(path: string, body: unknown): Promise<ReportResult> {
    try {
      const response = await fetch(`${url}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (response.ok && isReport(result)) { accept(result); return { ok: true } }
      const code = (result as { error?: unknown } | null)?.error
      return { ok: false, code: typeof code === 'string' ? code : null, message: reportMessage(typeof code === 'string' ? code : null) }
    } catch {
      // 응답을 못 받았어도 서버는 바꿨을 수 있다. 새로 불러오게 한다.
      return { ok: false, code: 'UNKNOWN', message: '결과를 확인하지 못했어요. 쓴 글을 복사해 두고 새로 불러와 주세요.' }
    }
  }
  return { data, revision, loadError, refresh: () => setAttempt(value => value + 1),
    save: (input: SaveEventReportRequest) => send('', input),
    publish: (version: number) => send('/publish', { version }),
    unpublish: (version: number) => send('/unpublish', { version }) }
}
export type EventReportHook = ReturnType<typeof useEventReport>
```

- [ ] **Step 5: 화면** — `records/EventReport.tsx`

```tsx
import { useEffect, useId, useState } from 'react'
import { REPORT_SECTION_LABELS, REPORT_SECTIONS, SaveEventReportSchema, type EventReportResponse, type EventSummary,
  type ReportSection } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { StatGrid } from '@/components/StatGrid'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { eventTimeText, formatKoreanTime } from '../public/registration-text'
import { koreanOf } from '@vada/contracts'
import { dayOf, factStats, ownerText, reportStateLabels, reportStateOf, reportStateTones, sectionHints, staleReportCodes } from './record-view'
import { useEventReport, type EventReportHook } from './useEventReport'

type Props = {
  organizationId: string
  eventId: string
  // 부서가 있는 구성원이 쓰고, 회장단이 발행한다.
  canWrite: boolean
  canPublish: boolean
  onOpenEvent: () => void
  // 저장하지 않은 글이 있는지. 다른 화면으로 갈 때 묻는 데 쓴다.
  onDirtyChange: (dirty: boolean) => void
  // 받은 행사로 행사 목록을 바꾼다(다른 곳에서 완료를 취소했을 수 있다).
  onEvent: (event: EventSummary) => void
}

// 완료한 행사의 결과보고서(REC-02·02A). 발행 전에는 쓰는 화면, 발행 뒤에는 읽는 화면이다. 휴대폰은 한 단이다.
export default function EventReport({ organizationId, eventId, onEvent, ...props }: Props) {
  const state = useEventReport(organizationId, eventId)
  useEffect(() => { if (state.data) onEvent(state.data.event) }, [state.data, onEvent])
  if (!state.data) {
    return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl">
      {state.loadError ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">결과보고서를 불러오지 못했어요.</StateMessage>
        <Button variant="outline" size="sm" onClick={state.refresh}>다시 불러오기</Button></div>
        : <StateMessage kind="loading">결과보고서 불러오는 중…</StateMessage>}
    </div></div>
  }
  // 받을 때마다 새로 그려 입력 칸을 받은 글로 맞춘다. 실패한 저장은 받지 않으므로 쓴 글이 남는다.
  return <Loaded key={state.revision} data={state.data} state={state} {...props} />
}

type LoadedProps = Omit<Props, 'organizationId' | 'eventId' | 'onEvent'> & { data: EventReportResponse; state: EventReportHook }
const blank = (value: string) => value.trim() ? value : null

function Loaded({ data, state, canWrite, canPublish, onOpenEvent, onDirtyChange }: LoadedProps) {
  const { report, facts, event } = data
  const completed = event.completedAt !== null
  const published = report?.status === 'published'
  const editable = canWrite && completed && !published
  const saved = Object.fromEntries(REPORT_SECTIONS.map(key => [key, report?.[key] ?? null])) as Record<ReportSection, string | null>
  const [form, setForm] = useState(() => Object.fromEntries(REPORT_SECTIONS.map(key => [key, saved[key] ?? ''])) as Record<ReportSection, string>)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; stale: boolean } | null>(null)
  const [confirming, setConfirming] = useState<'publish' | 'unpublish' | null>(null)
  const prefix = useId()
  const dirty = editable && REPORT_SECTIONS.some(key => (blank(form[key])?.trim() ?? null) !== saved[key])
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])
  const input = { version: report?.version ?? 0, ...Object.fromEntries(REPORT_SECTIONS.map(key => [key, blank(form[key])])) }
  // 버튼은 서버와 같은 스키마로 켠다.
  const valid = SaveEventReportSchema.safeParse(input).success
  const written = REPORT_SECTIONS.filter(key => saved[key] !== null).length
  const state_ = reportStateOf(report)
  async function run(action: () => Promise<{ ok: true } | { ok: false; code: string | null; message: string }>) {
    setBusy(true)
    setMessage(null)
    const result = await action()
    setBusy(false)
    setConfirming(null)
    if (!result.ok) setMessage({ text: result.message, stale: result.code === 'UNKNOWN' || (result.code !== null && staleReportCodes.has(result.code)) })
  }
  const status = dirty ? '저장하지 않은 글이 있어요.' : published ? '발행했어요.' : `다섯 칸 중 ${written}칸을 썼어요.`
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-4">
      {!completed && <Alert tone="warning">완료를 취소한 행사예요. 다시 완료하면 이어서 쓸 수 있어요.</Alert>}
      <section aria-label="결과보고서 요약" className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={reportStateTones[state_]}>{reportStateLabels[state_]}</Badge>
          <Button variant="link" size="sm" className="ml-auto h-auto p-0" onClick={onOpenEvent}>행사 기록 보기</Button>
        </div>
        <p className="text-sm wrap-anywhere text-gray-700">{[eventTimeText(facts.event.startsAt, facts.event.endsAt) ?? '날짜 미정', facts.event.place]
          .filter(Boolean).join(' · ')}</p>
        <p className="text-sm wrap-anywhere text-gray-700">{ownerText(facts.owner) ?? '담당 미정'}</p>
        <p className="text-xs text-gray-500">{[event.completedAt && `완료 ${dayOf(event.completedAt)}`,
          report?.published ? `발행 ${dayOf(report.published.at)} · ${report.published.by.name}`
            : report && `마지막 저장 ${formatKoreanTime(koreanOf(new Date(report.updated.at)))} · ${report.updated.by.name}`].filter(Boolean).join(' · ')}</p>
      </section>
      <StatGrid label="행사 결과 숫자" className="grid-cols-2 sm:grid-cols-4" stats={factStats(facts)} />
      <p className="-mt-2 text-xs text-gray-500">{published ? '발행할 때 센 숫자예요.' : '행사 기록에서 지금 센 숫자예요. 발행하면 그때 숫자로 고정돼요.'}{' '}
        지연은 마감일을 넘겨 끝냈거나 아직 끝내지 않은 업무예요.</p>
      {REPORT_SECTIONS.map(key => {
        const label = REPORT_SECTION_LABELS[key]
        const tooLong = editable && !SaveEventReportSchema.shape[key].safeParse(blank(form[key])).success
        return <section key={key} aria-labelledby={`${prefix}-${key}`} className={cn(cardClass, 'flex flex-col gap-2 p-4')}>
          <h3 id={`${prefix}-${key}`} className="text-sm font-semibold text-gray-900">{label}</h3>
          {editable ? <>
            <p className="text-xs text-gray-500">{sectionHints[key]}</p>
            <Textarea aria-label={label} rows={5} value={form[key]} onChange={item => setForm(current => ({ ...current, [key]: item.target.value }))} />
            {tooLong && <p className="text-xs text-destructive">글이 너무 길어요. 줄여 주세요.</p>}
          </> : saved[key] ? <p className="text-sm whitespace-pre-line wrap-anywhere text-gray-700">{saved[key]}</p>
            : <p className="text-sm text-gray-400">아직 쓰지 않았어요.</p>}
        </section>
      })}
    </div></div>
    {(editable || (canPublish && published)) && <footer className="shrink-0 border-t bg-white px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {message && <div className="flex flex-wrap items-center gap-2"><StateMessage kind="error">{message.text}</StateMessage>
          {message.stale && <Button variant="outline" size="sm" onClick={state.refresh}>새로 불러오기</Button>}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-gray-600">{status}</p>
          {editable && <Button variant={canPublish ? 'outline' : 'default'} disabled={busy || !dirty || !valid}
            onClick={() => void run(() => state.save(input as Parameters<EventReportHook['save']>[0]))}>{busy ? '저장하는 중…' : '저장'}</Button>}
          {canPublish && completed && !published && <Button disabled={busy || dirty || written < REPORT_SECTIONS.length || !report}
            onClick={() => setConfirming('publish')}>발행</Button>}
          {canPublish && published && <Button variant="outline" disabled={busy} onClick={() => setConfirming('unpublish')}>발행 취소</Button>}
        </div>
      </div>
    </footer>}
    <Dialog open={confirming !== null} onOpenChange={open => { if (!open && !busy) setConfirming(null) }}>
      <DialogContent>
        {confirming === 'publish' ? <>
          <DialogHeader><DialogTitle>결과보고서를 발행할까요?</DialogTitle>
            <DialogDescription>발행하면 지금 숫자와 이름이 고정되고, 고치려면 발행을 취소해야 해요.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>닫기</Button>
            <Button disabled={busy} onClick={() => void run(() => state.publish(report!.version))}>발행</Button></DialogFooter>
        </> : <>
          <DialogHeader><DialogTitle>발행을 취소할까요?</DialogTitle>
            <DialogDescription>다시 고칠 수 있게 되고, 숫자는 발행할 때 다시 세요.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirming(null)}>닫기</Button>
            <Button disabled={busy} onClick={() => void run(() => state.unpublish(report!.version))}>발행 취소</Button></DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>
}
```
(변수 이름 `state_`는 구현할 때 `reportState`처럼 읽기 좋은 이름으로 바꾼다. `koreanOf` import는 위 contracts import와 합친다.)

- [ ] **Step 6: 통과 확인**

Run: `npm test --workspace @vada/web -- src/records`
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/records
git commit -m "결과보고서 화면 쓰기·발행·읽기"
```

---

### Task 7: 화면 — 기록 목록과 연결

**Files:**
- Create: `apps/web/src/records/useRecords.ts`, `apps/web/src/records/Records.tsx`(기존 `events/Records.tsx`를 옮겨 다시 쓴다), `apps/web/src/records/Records.test.tsx`
- Delete: `apps/web/src/events/Records.tsx`
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/EventWorkspace.tsx`, `apps/web/src/events/EventCompletionControl.tsx`, `apps/web/src/events/completion.ts`
- Test: `apps/web/src/workspace/Workspace.test.tsx`, `apps/web/src/events/EventCompletionControl.test.tsx`

**Interfaces:**
- Consumes: Task 6의 `EventReport`, `record-view` 함수들
- Produces: `<Records organizationId onOpen />`, `useRecords(organizationId)` → `{ data: RecordsResponse | null, loadError, refresh }`, `EventWorkspace`의 `onOpenReport?: () => void`

- [ ] **Step 1: 실패하는 테스트**

`Records.test.tsx`
```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import Records from './Records'
import { facts } from './record-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const done = { ...event(), name: '새내기 배움터', completedAt: '2026-03-11T01:00:00.000Z' }

test('완료한 행사마다 결과보고서 상태, 날짜·담당, 숫자, 완료한 날을 보이고 누르면 연다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/records', () => json({ records: [
    { event: done, report: { status: 'published', publishedAt: '2026-03-13T01:00:00.000Z' }, facts: facts({ event: { ...facts().event, startsAt: '2026-03-06T10:00' } }) },
    { event: { ...done, id: 'e9', name: '개강총회' }, report: null, facts: facts({ owner: { department: null, person: null }, registrations: null }) },
  ] }))
  const onOpen = vi.fn()
  render(<Records organizationId="o" onOpen={onOpen} />)
  const list = await screen.findByRole('list', { name: '완료한 행사' })
  const [first, second] = within(list).getAllByRole('article')
  expect(within(first!).getByText('발행')).toBeTruthy()
  expect(within(first!).getByText('2026. 3. 6. · 기획부')).toBeTruthy()
  expect(within(first!).getByText('참석 22명 (신청 26명)')).toBeTruthy()
  expect(within(first!).getByText('완료 2026. 3. 11.')).toBeTruthy()
  expect(within(second!).getByText('작성 전')).toBeTruthy()
  fireEvent.click(within(second!).getByRole('button', { name: '개강총회' }))
  expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'e9' }))
})

test('없으면 빈 상태, 못 받으면 다시 불러오기를 보인다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/records', () => json({ records: [] }))
  render(<Records organizationId="o" onOpen={vi.fn()} />)
  expect(await screen.findByText('완료한 행사가 아직 없어요')).toBeTruthy()
})
```
(카드가 `<article>`이라 역할 `article`로 찾는다.)

`Workspace.test.tsx`
- `setup`의 응답에 더한다: `url.endsWith('/records') ? { records: recordList }`, `url.endsWith('/report') ? reportBody` — `setup` 다섯째·여섯째 인자 `recordList: unknown[] = []`, `reportBody: unknown = null`을 더하고, 기존 M5a 테스트 "완료한 행사는 옆 메뉴 행사 목록에 없고, 기록에서 열면 …"을 바꾼다.
```tsx
test('완료한 행사는 옆 메뉴 행사 목록에 없고, 기록에서 결과보고서를 열고 행사 기록 보기로 볼 수만 있는 행사 화면에 간다', async () => {
  const report = reportResponse({ event: done, facts: facts({ event: { ...facts().event, name: '새내기 배움터' } }) })
  setup(membersBody, undefined, undefined, [event, done], [{ event: done, report: null, facts: report.facts }], report)
  render(<Workspace {...props} />)
  const list = await screen.findByRole('navigation', { name: '행사 목록' })
  await within(list).findByRole('button', { name: '체육대회' })
  expect(within(list).queryByRole('button', { name: '새내기 배움터' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '기록' }))
  const records = await screen.findByRole('list', { name: '완료한 행사' })
  fireEvent.click(within(records).getByRole('button', { name: '새내기 배움터' }))
  expect(await screen.findByRole('region', { name: '결과보고서 요약' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: '새내기 배움터' })).toBeTruthy()
  expect(within(screen.getByRole('banner')).getByText('기록')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '행사 기록 보기' }))
  expect(await screen.findByText('완료한 행사라 볼 수만 있어요.')).toBeTruthy()
  expect(within(screen.getByRole('banner')).getByText('완료')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '결과보고서' }))
  expect(await screen.findByRole('region', { name: '결과보고서 요약' })).toBeTruthy()
})

test('저장하지 않은 결과보고서가 있으면 다른 메뉴로 갈 때 묻고, 취소하면 남는다', async () => {
  const report = reportResponse({ event: done })
  setup(membersBody, undefined, undefined, [event, done], [{ event: done, report: null, facts: report.facts }], report)
  render(<Workspace {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '기록' }))
  fireEvent.click(within(await screen.findByRole('list', { name: '완료한 행사' })).getByRole('button', { name: '새내기 배움터' }))
  fireEvent.change(await screen.findByRole('textbox', { name: '잘된 점' }), { target: { value: '쓰는 중' } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: /내 업무/ }))
  expect(confirm).toHaveBeenCalledWith('저장하지 않은 결과보고서가 있어요. 이동하면 쓴 글이 사라져요. 이동할까요?')
  expect((screen.getByRole('textbox', { name: '잘된 점' }) as HTMLTextAreaElement).value).toBe('쓰는 중')
  confirm.mockReturnValue(true)
  fireEvent.click(screen.getByRole('button', { name: /내 업무/ }))
  expect(await screen.findByRole('heading', { level: 1, name: '내 업무' })).toBeTruthy()
})
```
(맨 위 import에 `reportResponse, facts`(`../records/record-fixtures`). "완료한 행사가 없으면 기록은 빈 상태를 보인다"는 `/records`가 빈 목록이라 그대로 통과해야 한다.)

`EventCompletionControl.test.tsx`
```tsx
test('발행한 결과보고서가 있으면 완료 취소의 이유를 보인다', async () => {
  const target = { ...ended(), version: 2, completedAt: '2026-10-12T01:00:00.000Z' }
  const { api, onStale } = setup(target)
  api.on('POST', `${path}/cancel`, () => json({ error: 'REPORT_PUBLISHED' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '완료 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '완료를 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '완료 취소' }))
  expect(await within(dialog).findByText('결과보고서를 발행한 행사예요. 결과보고서에서 먼저 발행을 취소해 주세요.')).toBeTruthy()
  expect(onStale).not.toHaveBeenCalled()
})
```
그리고 완료 대화상자 설명을 확인하는 기존 기대가 있으면 새 문구("기록에서 결과보고서를 써요.")를 더한다.

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- src/records src/workspace src/events`
Expected: 새 테스트 FAIL

- [ ] **Step 3: 기록 목록** — `records/useRecords.ts`, `records/Records.tsx`

```ts
import { useEffect, useState } from 'react'
import type { RecordsResponse } from '@vada/contracts'

const isRecords = (body: unknown): body is RecordsResponse => typeof body === 'object' && body !== null && Array.isArray((body as RecordsResponse).records)
// 기록 화면을 열 때마다 불러온다(완료·발행이 다른 곳에서 바뀔 수 있다).
export function useRecords(organizationId: string) {
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/records`
  const [data, setData] = useState<RecordsResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoadError(false)
    void (async () => {
      try {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        const body: unknown = await response.json()
        if (!response.ok || !isRecords(body)) throw new Error('Records lookup failed')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    })()
    return () => controller.abort()
  }, [url, attempt])
  return { data, loadError, refresh: () => setAttempt(value => value + 1) }
}
```
```tsx
import { Archive } from 'lucide-react'
import type { EventSummary } from '@vada/contracts'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayOf, eventDayText, recordChips, reportStateLabels, reportStateOf, reportStateTones } from './record-view'
import { useRecords } from './useRecords'

type Props = { organizationId: string; onOpen: (event: EventSummary) => void }

// 완료한 행사 목록(REC-01). 최근 완료 순이다. 누르면 결과보고서가 열린다. 숫자는 결과보고서와 같다(발행했으면 발행 때 값).
export default function Records({ organizationId, onOpen }: Props) {
  const { data, loadError, refresh } = useRecords(organizationId)
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto flex max-w-3xl flex-col gap-3">
    {loadError && !data ? <div className="flex flex-col items-start gap-2"><StateMessage kind="error">기록을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" size="sm" onClick={refresh}>다시 불러오기</Button></div>
      : !data ? <StateMessage kind="loading">기록 불러오는 중…</StateMessage>
      : data.records.length ? <ul className="flex flex-col gap-2" aria-label="완료한 행사">{data.records.map(({ event, report, facts }) => {
        const state = reportStateOf(report)
        const owner = facts.owner.department ?? facts.owner.person
        const chips = recordChips(facts)
        return <li key={event.id}><article className={cn(cardClass, 'flex flex-col gap-1.5 p-4')}>
          <div><Badge tone={reportStateTones[state]}>{reportStateLabels[state]}</Badge></div>
          <h2 className="text-sm">
            <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
              onClick={() => onOpen(event)}>{event.name}</Button>
          </h2>
          <p className="text-xs wrap-anywhere text-gray-500">{[eventDayText(facts.event.startsAt), owner].filter(Boolean).join(' · ')}</p>
          {chips.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="숫자">{chips.map(chip => <li key={chip}><Badge tone="neutral">{chip}</Badge></li>)}</ul>}
          <p className="text-xs text-gray-400">완료 {dayOf(event.completedAt!)}</p>
        </article></li>
      })}</ul>
      : <Card><EmptyState icon={Archive} title="완료한 행사가 아직 없어요" description="정산한 행사를 회장단이 완료하면 여기에 모여요." /></Card>}
  </div></div>
}
```
`events/Records.tsx`를 지운다.

- [ ] **Step 4: Workspace** — `workspace/Workspace.tsx`

- `import Records from '../records/Records'`, `import EventReport from '../records/EventReport'`. `type View`에 `'report'`.
- 상태: `const [reportEvent, setReportEvent] = useState<EventSummary | null>(null)`, `const [reportDirty, setReportDirty] = useState(false)`, `const reportCurrent = reportEvent && (events.events?.find(item => item.id === reportEvent.id) ?? reportEvent)`
- `canLeave`를 바꾼다.
```ts
  function canLeave() {
    if (leaveRisk && !window.confirm('끼룩이가 품목을 담는 중이에요. 이동해도 담는 중인 품목은 서버에서 계속 만들어질 수 있어요. 이동할까요?')) return false
    // 결과보고서(M5b)에 저장하지 않은 글이 있으면 묻는다.
    return !reportDirty || window.confirm('저장하지 않은 결과보고서가 있어요. 이동하면 쓴 글이 사라져요. 이동할까요?')
  }
```
  `beforeunload` 효과는 `leaveRisk || reportDirty`일 때 건다.
- `select`: 다른 화면에서 올 때도 `canLeave()`를 본다(결과보고서에서 오는 경우).
```ts
    if (view !== 'events') { if (!canLeave()) return; setEventTab('chat'); setSelected(event); setView('events') }
```
- `function openReport(event: EventSummary) { if ((view !== 'report' || reportEvent?.id !== event.id) && canLeave()) { setReportEvent(event); setView('report') }; setNavOpen(false) }`
- 옆 메뉴 `recordsActive={view === 'records' || view === 'report' || (view === 'events' && Boolean(current?.completedAt))}`
- 머리: section은 `view === 'records' || view === 'report' || current?.completedAt ? '기록'`, title은 `view === 'report' ? reportCurrent?.name ?? '결과보고서'`.
- 본문:
```tsx
          : view === 'records' ? <Records organizationId={membership.organization.id} onOpen={openReport} />
          : view === 'report' && reportCurrent ? <EventReport key={reportCurrent.id} organizationId={membership.organization.id} eventId={reportCurrent.id}
            canWrite={membership.permissions.manageEvents} canPublish={membership.permissions.manageOrganization}
            onOpenEvent={() => select(reportCurrent)} onDirtyChange={setReportDirty} onEvent={events.replace} />
```
- `EventWorkspace`에 `onOpenReport={current.completedAt ? () => openReport(current) : undefined}`.

`events.replace`가 매번 새 함수면 `EventReport`의 효과가 그릴 때마다 돈다. `useEvents`의 `replace`를 `useCallback`으로 감싼다(`setEvents`만 쓴다).

- [ ] **Step 5: 볼 수만 있는 행사 화면** — `workspace/EventWorkspace.tsx`

Props에 `// 완료한 행사의 결과보고서를 연다(M5b).\n  onOpenReport?: () => void`. 안내 줄을 바꾼다.
```tsx
    {readOnly && <div className="flex shrink-0 items-center gap-2 border-b bg-gray-50 px-4 py-2 sm:px-6">
      <p className="min-w-0 flex-1 text-xs text-gray-600">완료한 행사라 볼 수만 있어요.</p>
      {onOpenReport && <Button variant="link" size="sm" className="h-auto p-0" onClick={onOpenReport}>결과보고서</Button>}
    </div>}
```

- [ ] **Step 6: 완료 대화상자** — `events/completion.ts`, `events/EventCompletionControl.tsx`

`completionErrors`에 `REPORT_PUBLISHED: '결과보고서를 발행한 행사예요. 결과보고서에서 먼저 발행을 취소해 주세요.'`(오래된 경우가 아니므로 `staleCompletionCodes`에는 넣지 않는다). 완료 대화상자 설명을 "완료하면 대화·업무·구매·참가자·재정을 바꿀 수 없고, 행사가 "기록"으로 옮겨져요. 기록에서 결과보고서를 써요. 회장단은 완료를 취소할 수 있어요."로 바꾼다.

- [ ] **Step 7: 통과 확인**

Run: `npm test --workspace @vada/web`
Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src
git commit -m "기록 목록에서 결과보고서 열기"
```

---

### Task 8: 시연 데이터

**Files:**
- Modify: `apps/api/scripts/demo-data.ts`, `apps/api/scripts/demo-data.test.ts`

- [ ] **Step 1: 실패하는 테스트** — `demo-data.test.ts`

- 시각 칼럼 목록에 `'event_reports.created_at', 'event_reports.updated_at', 'event_reports.published_at'`을 더한다.
- 완료 확인 다음에 더한다.
```ts
    // 다섯 행사 모두 담당이 있다(M5b).
    assert.equal(await count(pg, `SELECT count(*)::int AS n FROM events WHERE organization_id = '${DEMO_ORGANIZATION_ID}'
      AND owner_department_id IS NOT NULL AND owner_id IS NOT NULL`), 5)
    // 결과보고서: 새내기 배움터는 발행, 개강총회는 세 칸만 쓴 작성 중이다. 발행한 보고서는 신청·참석과 업무 지연을 고정했다.
    const reports = await pg.query<{ name: string; status: string; facts: { registrations: unknown; tasks: { late: number } } | null; written: number }>(
      `SELECT e.name, r.status, r.facts, (CASE WHEN r.operations IS NULL THEN 0 ELSE 1 END + CASE WHEN r.went_well IS NULL THEN 0 ELSE 1 END
        + CASE WHEN r.shortfalls IS NULL THEN 0 ELSE 1 END + CASE WHEN r.improvements IS NULL THEN 0 ELSE 1 END
        + CASE WHEN r.handover IS NULL THEN 0 ELSE 1 END) AS written FROM event_reports r JOIN events e ON e.id = r.event_id ORDER BY e.name`)
    assert.deepEqual(reports.rows.map(row => [row.name, row.status, row.written]), [['2026 새내기 배움터', 'published', 5], ['2학기 개강총회', 'draft', 3]])
    assert.deepEqual(reports.rows[0]!.facts?.registrations, { registered: 42, attended: 39 })
    assert.equal(reports.rows[0]!.facts?.tasks.late, 1)
```

- [ ] **Step 2: 실패 확인** — `cd apps/api; npx tsx --test scripts/demo-data.test.ts` → FAIL

- [ ] **Step 3: 구현** — `demo-data.ts`

- 앱에 `reports: createReportRoutes(db, session)`(import 포함).
- `resetDemo`: `DELETE FROM events` 앞에 `await run(sql\`DELETE FROM event_reports WHERE organization_id = ${org}\`)`.
- `plan`의 행사마다 `owner: [DepartmentKey, PersonKey]`를 더한다: orientation `['leadership', 'vice']`, opening `['planning', 'planner']`, sports `['planning', 'planner2']`, snack `['planning', 'planner2']`, festival `['promotion', 'promoter']`. 행사 일시 PATCH 본문에 `ownerDepartmentId: departmentIds[item.owner[0]], ownerMembershipId: \`${userIdOf(item.owner[1])}-membership\``.
- `taskPlan` 앞쪽에 더한다(완료 전 지난 행사의 업무). 타입에 `late?: number`(마감일보다 며칠 늦게 끝냈는지).
```ts
    { event: 'orientation', title: '숙소·버스 예약', department: 'leadership', assignee: 'vice', due: addDays(calendar.orientation, -21), status: 'done' },
    { event: 'orientation', title: '참가 신청 공지', department: 'promotion', assignee: 'promoter', due: addDays(calendar.orientation, -16), status: 'done' },
    { event: 'orientation', title: '조 편성표 만들기', department: 'planning', assignee: 'planner', due: addDays(calendar.orientation, -4), status: 'done', late: 2 },
    { event: 'orientation', title: '진행 대본 쓰기', department: 'planning', assignee: 'planner2', due: addDays(calendar.orientation, -2), status: 'done' },
    { event: 'opening', title: '대강당 대관', department: 'leadership', assignee: 'vice', due: addDays(calendar.opening, -10), status: 'done' },
    { event: 'opening', title: '다과 구매 요청', department: 'planning', assignee: 'planner', due: addDays(calendar.opening, -7), status: 'done' },
    { event: 'opening', title: '개강총회 안내 게시', department: 'promotion', assignee: 'promoter', due: addDays(calendar.opening, -5), status: 'done' },
```
- `shapeTasks(db, calendar)` 다음에 늦게 끝낸 업무의 완료 시각을 옮긴다.
```ts
  // 늦게 끝낸 업무: 마감일보다 late일 뒤 17시에 끝냈다. 처리 기록의 완료도 같이 옮긴다.
  for (const item of taskPlan.filter(task => task.late)) {
    const doneAt = kst(addDays(item.due, item.late!), '17:00').toISOString()
    await db.execute(sql`UPDATE tasks SET completed_at = ${doneAt}::timestamptz WHERE organization_id = ${org} AND title = ${item.title}`)
    await db.execute(sql`UPDATE task_events ev SET created_at = t.completed_at FROM tasks t WHERE t.id = ev.task_id AND t.organization_id = ${org}
      AND t.title = ${item.title} AND ev.changes -> 'status' ->> 'to' = 'done'`)
  }
```
- 행사 완료(14) 다음에 더한다.
```ts
  // 15. 결과보고서(M5b). 새내기 배움터는 기획부장이 다섯 칸을 쓰고 부회장이 발행했다. 개강총회는 세 칸만 쓴 작성 중이다.
  // 체육대회는 정산만 했다. 기획자가 완료하고 보고서를 써 볼 수 있다.
  log('결과보고서')
  const orientationReport = await call<EventReportResponse>('planner', 'POST', eventPath('orientation', '/report'), { version: 0,
    operations: '10:00 공학관 앞 버스 출발 → 11:30 수련원 도착·방 배정 → 13:00 조별 레크리에이션 → 18:00 저녁·학과 소개 → 20:00 선배와의 대화.\n둘째 날 10:00 정리 → 12:00 출발.\n운영진 12명: 조장 8명, 진행 2명, 안전·물품 2명.',
    wentWell: '조장을 미리 정하고 조별 단톡방을 열어 두어 첫날 어색함이 적었다.\n숙박비·버스비를 행사 사흘 전에 보내 현장에서 돈 문제가 없었다.',
    shortfalls: '버스 한 대가 30분 늦었다 — 원인: 출발 시각만 알리고 기사님 연락처를 받아 두지 않았다.\n신청자 42명 가운데 3명이 오지 않았다 — 원인: 전날 확인 연락을 하지 않았다.\n조 편성표가 이틀 늦게 나왔다 — 원인: 신청 마감 뒤 명단 정리를 한 사람이 맡았다.',
    improvements: '버스 업체에 기사님 연락처를 받아 출발 1시간 전에 위치를 확인한다.\n출발 전날 참가자에게 확인 문자를 보낸다.\n조 편성은 신청 마감 다음 날까지 둘이 나눠 끝낸다.',
    handover: '숙소: 가평 청소년수련원(행사 6주 전 예약, 계약금 30%).\n버스: 한빛관광버스 45인승 2대, 왕복 110만 원.\n조 편성표·진행 대본은 학생회 드라이브 "새내기 배움터" 폴더에 있다.\n주의: 수련원은 22시 뒤 소음 금지.' })
  await call('vice', 'POST', eventPath('orientation', '/report/publish'), { version: orientationReport.report!.version })
  await call('planner2', 'POST', eventPath('opening', '/report'), { version: 0,
    operations: '18:00 개회 → 학생회 소개 → 2학기 행사 일정 안내 → 19:30 다과·자유 교류 → 20:30 정리.',
    wentWell: '다과를 미리 나눠 담아 두어 줄이 길지 않았다.',
    shortfalls: '마이크 하나가 끊겨 진행이 5분 멈췄다 — 원인: 리허설 때 예비 마이크를 확인하지 않았다.', improvements: null, handover: null })
  await shapeReports(db, calendar, eventIds)
```
`shapeCompletion` 다음에 더한다.
```ts
// 결과보고서 시각: 완료 다음 날 14시에 쓰고, 새내기 배움터는 완료 이틀 뒤 10시에 발행했다.
async function shapeReports(db: Db, calendar: Calendar, eventIds: Record<string, string>) {
  const completedOn: Record<string, string> = { orientation: addDays(calendar.orientation, 5), opening: addDays(calendar.opening, 4) }
  for (const [key, day] of Object.entries(completedOn)) {
    const written = kst(addDays(day, 1), '14:00')
    await db.update(eventReports).set({ createdAt: written, updatedAt: written }).where(eq(eventReports.eventId, eventIds[key]!))
  }
  await db.update(eventReports).set({ publishedAt: kst(addDays(completedOn.orientation!, 2), '10:00') })
    .where(eq(eventReports.eventId, eventIds.orientation!))
}
```
(`eventReports`·`EventReportResponse` import를 더한다. 발행한 보고서의 고정 수치는 시각을 옮겨도 그대로다.)

- [ ] **Step 4: 통과 확인** — `cd apps/api; npx tsx --test scripts/demo-data.test.ts` → PASS

- [ ] **Step 5: 커밋**

```bash
git add apps/api/scripts
git commit -m "시연 데이터에 행사 담당과 결과보고서 더하기"
```

---

### Task 9: 전체 검사·DB 적용·dev 확인·리뷰·배포

- [ ] **Step 1: 전체 검사**

Run: `npm run typecheck`
Run: `npm test --workspace @vada/contracts`
Run: `npm test --workspace @vada/web`
Run: `cd apps/api; npx tsx --test --test-concurrency=2 <package.json의 test 목록>`(약 10분, 백그라운드)
Expected: 모두 PASS. 실패는 고친 뒤 다시 돌린다. 메모리가 모자라면 브랜치를 푸시하고 `gh workflow run ci.yml --ref m5b-event-report`로 CI에서 돌린다.

- [ ] **Step 2: 적용 스크립트** — `.superpowers/apply-0026.mts`

`.superpowers/apply-0025.mts`를 본떠 만든다. 다른 점:
- 최신 로컬 마이그레이션이 `0026_event_reports`인지 본다.
- 점검: `events`의 `owner_department_id`·`owner_id` 칸 수(0 또는 2), 표 `event_reports`가 있는지, 제약 `events_owner_department_same_organization`·`events_owner_same_organization`·`event_reports_event_same_organization` 수, 행사 수.
- `--apply` 조건: 적용 기록이 순서·해시까지 로컬과 같고 0026만 남았으며 두 칸·표가 없을 때. 적용 뒤 칸 2·표 1·제약 3·행사 수 그대로·보고서 0이면 `MIGRATION_0026_APPLIED`.
- 접속 주소·값·오류 원문은 출력하지 않는다.

- [ ] **Step 3: DB 적용**

새 칸·표를 읽는 코드라 배포 전에 두 DB에 적용한다. 먼저 점검(읽기 전용)을 돌리고, `--apply`는 승인 확인 창을 거친다. 막히면 사용자에게 한 줄을 입력해 달라고 한다.
```
! cd C:/Users/82108/vada-m1/apps/api; npx tsx ../../.superpowers/apply-0026.mts dev; npx tsx ../../.superpowers/apply-0026.mts dev --apply; npx tsx ../../.superpowers/apply-0026.mts preview; npx tsx ../../.superpowers/apply-0026.mts preview --apply
```
두 DB 모두 `MIGRATION_0026_APPLIED`를 확인한다.

- [ ] **Step 4: dev 브라우저 확인**

API는 `apps/api`에서 `npx tsx src/serve.ts`, 웹은 `npm run dev --workspace @vada/web`. Chrome에서 "M1 검증 학생회":
- 행사 정보에서 담당 부서·책임자 고르기 → 참가자 탭 카드에 "담당 … · 책임자 …"
- 기록 → "완료 확인 (확인용)" → 결과보고서: 숫자 카드, 다섯 칸 쓰기·저장, 고친 글이 있을 때 옆 메뉴 이동 확인, 회장단 발행 → 읽는 화면·[발행 취소]
- 발행한 행사의 [행사 기록 보기] → [완료 취소] → "결과보고서에서 먼저 발행을 취소해 주세요"
- 발행 취소 → 기록 목록 칩이 "작성 중"
- 375px·800px에서 결과보고서 아래 줄·기록 카드가 넘치지 않는지(같은 출처 390px iframe으로 잰다)
- 와이어프레임 REC-01 `30:3292`, REC-02 `30:3504`, REC-02A `30:3988`과 비교
- 확인용 데이터는 dev에 남기고 known-issues 메모에 적는다.

- [ ] **Step 5: 새 컨텍스트 Opus 최종 리뷰**

superpowers:requesting-code-review로 브랜치 전체(main 대비)를 리뷰한다. spec·plan 경로를 넘기고, 리뷰 에이전트에게 테스트를 돌리지 말라고 적는다. Critical·Important는 고치고, Minor는 고칠지 판단해 known-issues 메모에 남긴다.

- [ ] **Step 6: 병합·배포**

```bash
git checkout main
git merge --ff-only m5b-event-report
git push origin main
```
CI 결과와 `https://vada-m1.onrender.com/api/health`, `/`의 `last-modified`를 확인한다.

- [ ] **Step 7: 기록**

- 진행 위치 메모(project-m2-roadmap)에 M5b 배포와 다음 후보를 적는다.
- `project-report-known-issues` 메모에 미룬 문제·dev 확인용 데이터를 적는다.
- 시연 데이터 다시 넣기(배포 DB 초기화)는 사용자 승인을 받아 `npx tsx scripts/manage-demo-data.ts preview` → `--apply`.
