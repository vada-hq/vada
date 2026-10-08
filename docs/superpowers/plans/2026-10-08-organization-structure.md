# 학생회 조직 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생회가 DB 작업 없이 스스로 만들어지고, 회장단이 구성원을 부서에 배정하고 구매 승인 부서를 정한다.

**Architecture:**
- **회장단:** 부서 테이블에 있는 특별한 부서(`is_leadership`)다. 권한은 소속 부서로 계산하며 두 가지뿐이다(조직 관리, 구매 승인). 규칙은 `access/membership.ts` 한 곳에 두고, 소속 응답(`permissions`)과 구매·배송의 재정 검사가 같이 쓴다.
- **API:** 새 모듈 `organization`이 학생회 만들기, 구성원 목록, 부서·배정·직책 변경을 맡는다. 회장단 전용 변경은 회장단 행을 잠근 트랜잭션에서 하고, 목록 전체를 돌려준다.
- **화면:** 사이드바에 "구성원" 메뉴와 목록형 구성원 화면을 더한다. 소속이 없을 때의 코드 입력 아래에 학생회 만들기 입구를 둔다.

**Tech Stack:** Hono 4.13, drizzle-orm·drizzle-kit, PostgreSQL(Neon)·PGlite(테스트), zod 4.6.5, React 19.3, Tailwind 4, vitest 5(web), node:test + tsx(api·contracts)

**Spec:** `docs/superpowers/specs/2026-10-08-organization-structure-design.md`

## Global Constraints

- 작업 브랜치는 `organization-structure`다. Task마다 이 브랜치에 커밋한다. main 병합과 푸시는 Task 9에서 0010 적용이 끝난 뒤 묻지 않고 한다(사용자 결정, 2026-10-07).
- DB 마이그레이션 적용(dev, m1-preview)과 기존 데이터 변경(회장단 지정)은 사용자 승인 후에만 한다. 승인 전에는 읽기 전용 점검만 한다.
- `.env`는 읽거나 출력하지 않는다. 프로그램 안에서 불러 쓰는 것은 괜찮다. 로그와 응답에 비밀 값, 요청 본문, DB 값, 오류 원문을 넣지 않는다.
- 테스트는 변경과 관련된 파일만 돌린다. 전체 스위트와 웹 빌드는 Task 8에서만 돌린다. 타입 검사는 바꾼 워크스페이스만 Task마다 돌린다.
- 웹 테스트는 메모리가 부족해 `--no-file-parallelism`으로 돌린다.
- 새 의존성을 추가하지 않는다.
- 오류 응답 형식은 `{ "error": "<CODE>" }`다. 새 코드는 모두 409다. `LAST_LEADER`, `DEPARTMENT_NAME_TAKEN`, `DEPARTMENT_NOT_EMPTY`, `DEPARTMENT_IN_USE`, `LEADERSHIP_FIXED`.
- 새 API는 AGENTS.md 규칙을 따른다.
  - 본문 스키마는 contracts에 `z.strictObject`로 둔다.
  - 라우트에서는 `json()`을 인증보다 앞에 두고, 실패는 `ApiError`로 던진다.
  - 변경 라우트는 `/api/organizations/` 아래에 둔다. 경계 테스트의 `schemaPending`에는 아무것도 추가하지 않는다.
- 상한: 학생회 이름 50자, 부서 이름 20자, 직책 20자, 만들 때 부서 20개, 부서·소속 ID `token(64)`. DB CHECK도 같은 값이다(이름 제약은 Task 10의 0011).
- 회장단 기본 이름은 `회장단`이다. 학생회를 만들 때의 기본 부서는 총무부(구매 승인)·기획부·홍보부·복지부다.
- 0011(이름 제약)은 배포 후 Task 10에서 만든다. 적용 스크립트가 폴더의 미적용 마이그레이션을 모두 적용하기 때문이다.
- 화면 규칙(AGENTS.md):
  - `components/ui` 부품을 쓰고, 모양은 Tailwind 클래스로만 준다. 임의 값은 쓰지 않는다.
  - 체크박스만 기본 모양에 `size-4 accent-blue-600`이다.
  - 사람·부서 이름에는 `wrap-anywhere`를 준다.
- 화면 문구는 아래와 글자까지 같게 쓴다.
  - 코드 입력 아래: "학생회를 처음 시작하나요?", 버튼 "새 학생회 만들기"
  - 학생회 만들기:
    - 제목 "새 학생회 만들기", 안내 "학생회가 이미 VADA를 쓰고 있다면 초대 링크로 참여하세요."
    - 입력 "학생회 이름"(예시 "예: 제12대 소프트웨어융합대학 학생회")
    - 묶음 "부서", 고정 줄 "회장단"·"항상 있어요"
    - 줄 입력 이름 "부서 {n} 이름", 빼기 버튼 이름 "{부서} 빼기", 표시 "구매 승인", 버튼 "부서 추가"
    - 안내 "구매 승인 부서는 나중에 바꿀 수 있어요.", 중복 "부서 이름이 겹쳐요."
    - 버튼 "취소", "학생회 만들기"(요청 중 "만드는 중…")
    - 실패 "학생회를 만들지 못했어요. 다시 시도해 주세요."
  - 사이드바: 메뉴 묶음 이름 "학생회 메뉴", 메뉴 "구성원", 표시 "미배정 {n}", 사용자 칸 "{부서} · {직책}", 표시 "구매 승인"
  - 구성원 화면:
    - 제목 "구성원 {n}명", 버튼 "초대"(대화상자 제목 "구성원 초대")
    - 묶음 "미배정"·"{n}명", 표시 "조직 관리"·"구매 승인"·"배정이 필요해요"
    - 편집 버튼 이름 "{부서} 편집", 고르는 칸 이름 "{이름} 부서", 직책 버튼 "직책"(이름 "{이름} 직책")
    - 회장단 한 명 안내 "회장단이 한 명뿐이에요. 자리를 비울 때를 대비해 한 명 더 두세요."
    - 혼자 "아직 혼자예요"·"링크를 보내 구성원을 모으세요."
    - 부서 추가 입력 이름 "새 부서 이름", 버튼 "부서 추가"
    - 로딩 "구성원 불러오는 중…", 실패 "구성원을 불러오지 못했어요."·"다시 시도"
  - 이동 확인: 제목 "부서를 옮길까요?", 버튼 "취소"·"옮기기"
    - 본문 예 "김민준을 기획부로 옮기면 구매 승인을 할 수 없게 돼요. 직책은 지워져요."
  - 부서 편집:
    - 제목 "부서 편집"/"회장단 편집"
    - 설명 "구매 승인을 켜면 이 부서 사람도 구매요청을 승인해요."/"회장단은 지울 수 없고 이름만 바꿀 수 있어요."
    - 입력 "이름", 체크 "구매 승인", 버튼 "부서 삭제"·"취소"·"저장"
  - 직책: 제목 "{이름} 직책", 설명 "비우고 저장하면 직책을 지워요.", 입력 "직책"(예시 "예: 회장, 국장, 총무"), 버튼 "취소"·"저장"
  - 오류:
    - `LAST_LEADER` "회장단은 최소 한 명 있어야 해요. 다른 사람을 먼저 회장단으로 옮겨 주세요."
    - `DEPARTMENT_NAME_TAKEN` "같은 이름의 부서가 있어요."
    - `DEPARTMENT_NOT_EMPTY` "구성원이 있는 부서는 지울 수 없어요. 먼저 다른 부서로 옮겨 주세요."
    - `DEPARTMENT_IN_USE` "구매요청 기록이 있어 지울 수 없어요. 이름을 바꿔 쓰세요."
    - `FORBIDDEN` "회장단만 바꿀 수 있어요."
    - `NOT_FOUND` "이미 바뀌었어요. 목록을 새로 불러왔어요."
    - 그 밖 "저장하지 못했어요. 다시 시도해 주세요."
  - 소속 목록(소속은 있으나 화면이 없는 경우)의 재정 표시: "(구매 승인)"
- 주석은 기존처럼 한국어로, "왜"만 짧게 쓴다.
- 커밋 제목은 한국어로 50자 이내, 명령형으로 쓴다. AI 서명과 Co-Authored-By는 붙이지 않는다.

## Review Focus

1. **회장단이 자기 자리를 넘기는 인수인계:** 다른 사람을 회장단으로 옮긴 뒤 본인을 다른 부서로 옮긴다. 마지막 한 명이면 거부된다. 넘긴 뒤에는 응답의 `viewer`가 일반 구성원 권한이고, 화면은 구성원 화면에 머문 채 소속을 다시 불러온다. → Task 4(API), Task 6·7(소속 다시 불러오기)
2. **오래된 화면에서 저장:** 그사이 다른 회장단이 지운 부서로 옮기거나 지워진 소속을 고치면 404 → "이미 바뀌었어요" 안내와 목록 새로고침이다. 그사이 회장단에서 빠졌다면 403 → "회장단만 바꿀 수 있어요" 안내와 새로고침이다. → Task 4, Task 5
3. **이름의 앞뒤 공백과 겹침:** `' 기획부 '`는 `기획부`와 같은 이름으로 거부된다. 만들기 화면도 같은 판단으로 버튼을 끈다. `회장단`은 만들 때 부서 이름으로 쓸 수 없다. → Task 2, Task 4, Task 7
4. **경로의 이상한 ID:** 부서·소속 ID에 `%00`이나 65자를 넣어도 500이 아니라 404다. → Task 4
5. **회장단 승인 권한이 재정 기능 전체에 적용:** 구매요청 검토·결정과 배송 조회에서 회장단이 허용된다. 구매 승인을 끈 부서는 바로 403이다. → Task 3

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `apps/api/src/db/schema.ts` | `departments.is_leadership`·회장단 제약, `memberships.title` (Task 1), 이름 제약 (Task 10) |
| `apps/api/migrations/0010_organization_structure.sql` | 새 칸·제약과 기존 학생회의 빈 회장단 |
| `apps/api/scripts/test-data.ts`, `manage-test-data.ts` | 검증 학생회에 회장단 추가, `leadership` 배정 |
| `packages/contracts/src/organizations.ts` | 학생회·부서·배정·직책 요청 스키마와 상한 |
| `packages/contracts/src/index.ts` | `MembershipSummary` 권한·직책, 구성원 응답 타입 |
| `apps/api/src/access/membership.ts` | 권한 규칙(`permissionsOf`, `approvesPurchases`)과 소속 조회 |
| `apps/api/src/organization/service.ts` | 만들기·목록·조직 변경(잠금, 규칙, 오류 코드) |
| `apps/api/src/organization/routes.ts` | 라우트, 경로 ID 검사 |
| `apps/web/src/organization/members-view.ts` | 묶음·정렬, 이동 확인 문장(조사 처리) |
| `apps/web/src/organization/useOrganizationMembers.ts` | 구성원 목록 불러오기와 변경 요청 |
| `apps/web/src/organization/Members.tsx` | 구성원 화면과 대화상자 |
| `apps/web/src/organization/CreateOrganization.tsx` | 학생회 만들기 화면 |
| `apps/web/src/workspace/*` | 구성원 메뉴, 화면 전환, 권한 표시 |
| `apps/web/src/App.tsx`, `access/*` | 만들기 입구, 소속 다시 불러오기 |

---

### Task 1: DB 스키마, 마이그레이션 0010, 검증 데이터

**Files:**
- Modify: `apps/api/src/db/schema.ts` (departments, memberships)
- Create: `apps/api/migrations/0010_organization_structure.sql`, `apps/api/migrations/meta/0010_snapshot.json` (drizzle-kit), Modify: `apps/api/migrations/meta/_journal.json`
- Modify: `apps/api/src/db/migrations.test.ts`, `apps/api/src/db/schema.test.ts`
- Modify: `apps/api/scripts/test-data.ts`, `apps/api/scripts/test-data.test.ts`, `apps/api/scripts/manage-test-data.ts`

**Interfaces:**
- Produces: `departments.isLeadership: boolean`(DB `is_leadership`), `memberships.title: string | null`(DB `title`), 부분 고유 색인 `departments_one_leadership`, CHECK `departments_leadership_not_finance`·`memberships_title_not_blank`·`memberships_title_length`. `assignDepartment(db, userId, 'planning' | 'finance' | 'leadership')`.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/db/migrations.test.ts` 맨 끝에 추가:

```ts
test('0010 gives every council one empty leadership and keeps existing members', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-organization-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0010_organization_structure')
    assert.ok(index > 0, '0010 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u1','Planner','p@example.test'),('u2','Treasurer','t@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Planning',false),('d2','org1','Finance',true),('d3','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','u1','org1','d1'),('m2','u2','org1','d2');
    `)
    await migrate(db, { migrationsFolder: folder })

    await t.test('each council gets exactly one empty leadership named 회장단', async () => {
      const rows = await pg.query(`
        SELECT d.organization_id, d.name, d.handles_finance, (SELECT count(*)::int FROM memberships m WHERE m.department_id = d.id) AS members
        FROM departments d WHERE d.is_leadership ORDER BY d.organization_id`)
      assert.deepEqual(rows.rows, [
        { organization_id: 'org1', name: '회장단', handles_finance: false, members: 0 },
        { organization_id: 'org2', name: '회장단', handles_finance: false, members: 0 },
      ])
    })
    await t.test('existing departments and memberships are unchanged', async () => {
      const departments = await pg.query('SELECT id, is_leadership, handles_finance FROM departments WHERE NOT is_leadership ORDER BY id')
      assert.deepEqual(departments.rows, [
        { id: 'd1', is_leadership: false, handles_finance: false },
        { id: 'd2', is_leadership: false, handles_finance: true },
        { id: 'd3', is_leadership: false, handles_finance: false },
      ])
      const members = await pg.query('SELECT id, department_id, title FROM memberships ORDER BY id')
      assert.deepEqual(members.rows, [{ id: 'm1', department_id: 'd1', title: null }, { id: 'm2', department_id: 'd2', title: null }])
    })
    await t.test('a second leadership and a leadership with the finance flag are rejected', async () => {
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name,is_leadership) VALUES ('l2','org1','Leaders 2',true)"),
        { code: '23505', constraint: 'departments_one_leadership' })
      await assert.rejects(pg.query("UPDATE departments SET handles_finance = true WHERE organization_id = 'org1' AND is_leadership"),
        { code: '23514', constraint: 'departments_leadership_not_finance' })
    })
    await t.test('titles are optional, not blank and at most 20 characters', async () => {
      await pg.query("UPDATE memberships SET title = '회장' WHERE id = 'm1'")
      await pg.query("UPDATE memberships SET title = $1 WHERE id = 'm1'", ['😀'.repeat(20)])
      await pg.query("UPDATE memberships SET title = NULL WHERE id = 'm1'")
      await assert.rejects(pg.query("UPDATE memberships SET title = '  ' WHERE id = 'm1'"), { code: '23514', constraint: 'memberships_title_not_blank' })
      await assert.rejects(pg.query("UPDATE memberships SET title = $1 WHERE id = 'm1'", ['가'.repeat(21)]), { code: '23514', constraint: 'memberships_title_length' })
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})
```

`apps/api/src/db/schema.test.ts` 첫 테스트의 `assert.equal(departments.handlesFinance.default, false)` 아래에 추가:

```ts
  assert.equal(departments.isLeadership.default, false)
  assert.equal(departments.isLeadership.notNull, true)
  assert.equal(memberships.title.notNull, false)
```

`apps/api/scripts/test-data.test.ts`:
- 첫 테스트의 `assert.equal((await pg.query('SELECT * FROM departments')).rows.length, 2)`를 다음으로 바꾼다.

```ts
    assert.equal((await pg.query('SELECT * FROM departments')).rows.length, 3)
    assert.deepEqual((await pg.query('SELECT id, name FROM departments WHERE is_leadership')).rows, [{ id: 'm1-test-leadership', name: '회장단' }])
```

- 파일 끝에 추가:

```ts
test('0010이 회장단을 먼저 만든 DB에서도 그 회장단을 쓰고, 회장단에 배정한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO organizations (id,name) VALUES ('m1-test-council','M1 검증 학생회');
      INSERT INTO departments (id,organization_id,name,is_leadership) VALUES ('backfilled','m1-test-council','회장단',true);
      INSERT INTO users (id,name,email) VALUES ('u4','Leader','leader@example.test');
      INSERT INTO accounts (id,user_id,provider_id,account_id) VALUES ('a4','u4','google','sub4');
    `)
    await seedTestCouncil(db)
    assert.deepEqual((await pg.query('SELECT id FROM departments WHERE is_leadership')).rows, [{ id: 'backfilled' }])
    await assignDepartment(db, 'u4', 'leadership')
    const saved = await pg.query("SELECT department_id FROM memberships WHERE user_id = 'u4'")
    assert.deepEqual(saved.rows, [{ department_id: 'backfilled' }])
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인**

Run (`apps/api`에서): `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts scripts/test-data.test.ts`
Expected: FAIL. 0010 테스트는 "0010 마이그레이션이 있어야 한다", schema 테스트는 `isLeadership` 없음, test-data는 부서 수 2 ≠ 3과 `leadership` 배정 실패.

- [ ] **Step 3: 스키마 수정**

`apps/api/src/db/schema.ts`의 `departments` 정의 전체를 다음으로 바꾼다.

```ts
export const departments = pgTable('departments', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  handlesFinance: boolean('handles_finance').notNull().default(false),
  // 학생회를 이끄는 자리(회장단). 학생회마다 하나이고, 조직 관리와 구매 승인을 한다.
  isLeadership: boolean('is_leadership').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // 소속의 복합 외래 키가 학생회와 부서를 함께 참조한다.
  unique('departments_organization_id_unique').on(table.organizationId, table.id),
  uniqueIndex('departments_one_leadership').on(table.organizationId).where(sql`${table.isLeadership}`),
  // 회장단은 늘 구매를 승인하므로 구매 승인 표시를 따로 두지 않는다.
  check('departments_leadership_not_finance', sql`NOT (${table.isLeadership} AND ${table.handlesFinance})`),
])
```

`memberships` 정의에서 `departmentId` 줄과 제약 배열을 다음으로 바꾼다.

```ts
  // 초대로 들어온 구성원은 부서가 없다(미배정). 회장단이 배정한다.
  departmentId: text('department_id'),
  // 표시용 직책(회장, 국장, 총무 등). 권한과 무관하고 부서를 옮기면 지운다.
  title: text('title'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('memberships_organization_user_unique').on(table.organizationId, table.userId),
  foreignKey({
    name: 'memberships_department_same_organization',
    columns: [table.organizationId, table.departmentId],
    foreignColumns: [departments.organizationId, departments.id],
  }).onDelete('restrict'),
  check('memberships_title_not_blank', sql`${table.title} ~ '[^[:space:]]'`),
  check('memberships_title_length', sql`char_length(${table.title}) <= 20`),
])
```

- [ ] **Step 4: 마이그레이션 생성과 회장단 채우기**

Run: `npm run db:generate --workspace @vada/api -- --name organization_structure`
Expected: `apps/api/migrations/0010_organization_structure.sql`이 생기고, 내용에 `ADD COLUMN "is_leadership" boolean DEFAULT false NOT NULL`, `ADD COLUMN "title" text`, `CREATE UNIQUE INDEX "departments_one_leadership"`, 세 CHECK가 있다.

생성된 파일 맨 끝에 다음을 덧붙인다(앞 문장 끝에 `--> statement-breakpoint`를 붙인다).

```sql
--> statement-breakpoint
-- 기존 학생회마다 빈 회장단을 만든다. 회장단에 넣을 사람은 배포 뒤 정한다.
INSERT INTO "departments" ("id", "organization_id", "name", "is_leadership") SELECT gen_random_uuid()::text, "id", '회장단', true FROM "organizations";
```

Run: `git diff --stat` 와 `file apps/api/migrations/0010_organization_structure.sql`
Expected: 새 SQL 파일이 CRLF가 아니다(`with CRLF line terminators`가 없다).

- [ ] **Step 5: 검증 데이터 스크립트 수정**

`apps/api/scripts/test-data.ts` 전체를 다음으로 바꾼다.

```ts
import { randomUUID } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { accounts, departments, memberships, organizations } from '../src/db/schema.js'

type Database = Pick<PgDatabase<PgQueryResultHKT>, 'transaction'>
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
const council = { id: 'm1-test-council', name: 'M1 검증 학생회' }
const departmentData = {
  planning: { id: 'm1-test-planning', organizationId: council.id, name: '기획부', handlesFinance: false },
  finance: { id: 'm1-test-finance', organizationId: council.id, name: '재정부', handlesFinance: true },
} as const
const leadershipData = { id: 'm1-test-leadership', organizationId: council.id, name: '회장단', isLeadership: true }

// 0010 마이그레이션이 이미 회장단을 만든 DB에서는 그 회장단을 그대로 쓴다.
async function leadershipOf(tx: Transaction) {
  const [leadership] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, council.id), eq(departments.isLeadership, true)))
  return leadership
}

export async function seedTestCouncil(db: Database) {
  await db.transaction(async tx => {
    await tx.insert(organizations).values(council).onConflictDoNothing()
    const [existing] = await tx.select().from(organizations).where(eq(organizations.id, council.id))
    if (existing?.name !== council.name) throw new Error('Test council conflicts with existing data')
    for (const department of Object.values(departmentData)) {
      await tx.insert(departments).values(department).onConflictDoNothing()
      const [saved] = await tx.select().from(departments).where(eq(departments.id, department.id))
      if (saved?.organizationId !== council.id || saved.name !== department.name || saved.handlesFinance !== department.handlesFinance) {
        throw new Error('Test department conflicts with existing data')
      }
    }
    if (!await leadershipOf(tx)) await tx.insert(departments).values(leadershipData)
  })
}

export async function assignDepartment(db: Database, userId: string, department: 'planning' | 'finance' | 'leadership') {
  if (!userId.trim() || !(department === 'leadership' || department in departmentData)) throw new Error('Invalid assignment')
  await db.transaction(async tx => {
    const [account] = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'google'))).limit(1)
    if (!account) throw new Error('An existing Google user is required')
    let targetId: string
    if (department === 'leadership') {
      const leadership = await leadershipOf(tx)
      if (!leadership) throw new Error('Seeded test department is required')
      targetId = leadership.id
    } else {
      const target = departmentData[department]
      const [savedDepartment] = await tx.select().from(departments).where(eq(departments.id, target.id))
      if (savedDepartment?.organizationId !== council.id || savedDepartment.name !== target.name || savedDepartment.handlesFinance !== target.handlesFinance) {
        throw new Error('Seeded test department is required')
      }
      targetId = target.id
    }
    await tx.insert(memberships).values({ id: randomUUID(), userId, organizationId: council.id, departmentId: targetId })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] })
    // 초대로 들어와 미배정인 소속에만 부서를 넣는다. 이미 정해진 부서는 바꾸지 않는다.
    await tx.update(memberships).set({ departmentId: targetId })
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId), isNull(memberships.departmentId)))
    const [membership] = await tx.select().from(memberships)
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId)))
    if (membership?.departmentId !== targetId) throw new Error('Existing department assignment cannot be overwritten')
  })
}
```

`apps/api/scripts/manage-test-data.ts`에서 다음 세 곳을 바꾼다.

```ts
  const isAssign = args.length === 4 && args[0] === 'assign' && Boolean(args[1]?.trim())
    && (args[2] === 'planning' || args[2] === 'finance' || args[2] === 'leadership') && args[3] === '--apply'
```

```ts
    console.error('사용법: seed --apply 또는 assign <user-id> <planning|finance|leadership> --apply')
```

```ts
    else await assignDepartment(db, args[1]!, args[2] as 'planning' | 'finance' | 'leadership')
```

- [ ] **Step 6: 통과 확인**

Run (`apps/api`에서): `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts scripts/test-data.test.ts`
Expected: PASS.

Run: `npm run typecheck --workspace @vada/api`
Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add apps/api/src/db/schema.ts apps/api/migrations apps/api/src/db/migrations.test.ts apps/api/src/db/schema.test.ts apps/api/scripts
git commit -m "회장단 부서와 직책 칸을 DB에 추가" -m "학생회마다 회장단 하나를 두고, 기존 학생회에는 빈 회장단을 만든다."
```

---

### Task 2: 조직 요청 스키마(contracts)

**Files:**
- Create: `packages/contracts/src/organizations.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/contracts/src/input.test.ts`

**Interfaces:**
- Produces:
  - 상수 `ORGANIZATION_NAME_MAX = 50`, `DEPARTMENT_NAME_MAX = 20`, `MEMBER_TITLE_MAX = 20`, `CREATE_DEPARTMENTS_MAX = 20`, `LEADERSHIP_DEFAULT_NAME = '회장단'`
  - 스키마 `CreateOrganizationSchema`, `CreateDepartmentSchema`, `UpdateDepartmentSchema`, `DeleteDepartmentSchema`, `AssignDepartmentSchema`, `UpdateMemberTitleSchema`
  - 요청 타입 `CreateOrganizationRequest`, `UpdateDepartmentRequest`
  - 응답 타입 `DepartmentSummary { id; name; isLeadership; handlesFinance }`, `MemberSummary { id; name; title: string | null; departmentId: string | null }`, `OrganizationMembersResponse { viewer: MembershipSummary; departments; members }`, `CreateOrganizationResponse { membership: MembershipSummary }`

- [ ] **Step 1: 실패하는 테스트 작성**

`packages/contracts/src/input.test.ts` 맨 위 import에 추가:

```ts
import { CREATE_DEPARTMENTS_MAX, DEPARTMENT_NAME_MAX, MEMBER_TITLE_MAX, ORGANIZATION_NAME_MAX, AssignDepartmentSchema, CreateDepartmentSchema,
  CreateOrganizationSchema, DeleteDepartmentSchema, UpdateDepartmentSchema, UpdateMemberTitleSchema } from './organizations.js'
```

파일 끝에 추가:

```ts
test('학생회 만들기: 이름·부서를 정규화하고, 상한·중복·회장단 이름은 거부한다', () => {
  const body = { name: ' 제12대 학생회 ', departments: [{ name: ' 총무부 ', handlesFinance: true }, { name: '기획부', handlesFinance: false }] }
  assert.deepEqual(CreateOrganizationSchema.parse(body), { name: '제12대 학생회', departments: [{ name: '총무부', handlesFinance: true }, { name: '기획부', handlesFinance: false }] })
  assert.equal(CreateOrganizationSchema.safeParse({ ...body, departments: [] }).success, true)
  assert.equal(CreateOrganizationSchema.safeParse({ ...body, name: '😀'.repeat(ORGANIZATION_NAME_MAX) }).success, true)
  const bad: unknown[] = [
    { ...body, name: '😀'.repeat(ORGANIZATION_NAME_MAX + 1) }, { ...body, name: '   ' }, { ...body, name: 'a\u0000' }, { ...body, name: '\uD800' },
    { ...body, departments: [{ name: '기획부', handlesFinance: false }, { name: ' 기획부', handlesFinance: false }] },
    { ...body, departments: [{ name: '회장단', handlesFinance: false }] },
    { ...body, departments: [{ name: '가'.repeat(DEPARTMENT_NAME_MAX + 1), handlesFinance: false }] },
    { ...body, departments: Array.from({ length: CREATE_DEPARTMENTS_MAX + 1 }, (_, i) => ({ name: `부서${i}`, handlesFinance: false })) },
    { ...body, departments: [{ name: '기획부' }] }, { ...body, extra: 1 }, { name: '학생회' },
  ]
  for (const value of bad) assert.equal(CreateOrganizationSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(CreateOrganizationSchema), true)
})

test('부서·배정·직책 스키마: 정규화, null 허용 범위, 상한, 모르는 키', () => {
  assert.deepEqual(CreateDepartmentSchema.parse({ name: ' 홍보부 ' }), { name: '홍보부' })
  assert.deepEqual(UpdateDepartmentSchema.parse({ name: '사무국', handlesFinance: true }), { name: '사무국', handlesFinance: true })
  assert.deepEqual(DeleteDepartmentSchema.parse({}), {})
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: null }), { departmentId: null })
  assert.deepEqual(AssignDepartmentSchema.parse({ departmentId: ' d1 ' }), { departmentId: 'd1' })
  assert.deepEqual(UpdateMemberTitleSchema.parse({ title: ' 국장 ' }), { title: '국장' })
  assert.deepEqual(UpdateMemberTitleSchema.parse({ title: null }), { title: null })
  assert.equal(UpdateMemberTitleSchema.safeParse({ title: '😀'.repeat(MEMBER_TITLE_MAX) }).success, true)
  const cases: [{ safeParse: (value: unknown) => { success: boolean } }, unknown][] = [
    [CreateDepartmentSchema, { name: '가'.repeat(DEPARTMENT_NAME_MAX + 1) }], [CreateDepartmentSchema, { name: ' ' }], [CreateDepartmentSchema, {}],
    [CreateDepartmentSchema, { name: '홍보부', extra: 1 }],
    [UpdateDepartmentSchema, { name: '사무국' }], [UpdateDepartmentSchema, { name: '사무국', handlesFinance: 'yes' }],
    [DeleteDepartmentSchema, { id: 'd1' }],
    [AssignDepartmentSchema, {}], [AssignDepartmentSchema, { departmentId: '' }], [AssignDepartmentSchema, { departmentId: 'd'.repeat(65) }],
    [AssignDepartmentSchema, { departmentId: 'd\u0001' }],
    [UpdateMemberTitleSchema, { title: '' }], [UpdateMemberTitleSchema, { title: '😀'.repeat(MEMBER_TITLE_MAX + 1) }],
    [UpdateMemberTitleSchema, { title: '\uD800' }], [UpdateMemberTitleSchema, {}],
  ]
  for (const [schema, value] of cases) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
  for (const schema of [CreateDepartmentSchema, UpdateDepartmentSchema, DeleteDepartmentSchema, AssignDepartmentSchema, UpdateMemberTitleSchema]) {
    assert.equal(isStrictObject(schema), true)
  }
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL. `./organizations.js`를 찾지 못한다.

- [ ] **Step 3: 구현**

`packages/contracts/src/organizations.ts`:

```ts
import { z } from 'zod'
import { text, token } from './input.js'

// 학생회·부서 이름과 직책의 상한. DB CHECK(0010 직책, 0011 이름)와 같은 값이다.
export const ORGANIZATION_NAME_MAX = 50
export const DEPARTMENT_NAME_MAX = 20
export const MEMBER_TITLE_MAX = 20
export const CREATE_DEPARTMENTS_MAX = 20
// 학생회를 만들면 자동으로 생기는 회장단의 이름. 나중에 바꿀 수 있다(비상대책위원회 등).
export const LEADERSHIP_DEFAULT_NAME = '회장단'

const departmentName = text(DEPARTMENT_NAME_MAX)
// 만들 때 부서 이름은 서로 겹치거나 회장단과 같으면 안 된다. text()가 앞뒤 공백을 지운 뒤 비교한다.
export const CreateOrganizationSchema = z.strictObject({
  name: text(ORGANIZATION_NAME_MAX),
  departments: z.array(z.strictObject({ name: departmentName, handlesFinance: z.boolean() })).max(CREATE_DEPARTMENTS_MAX),
}).refine(({ departments }) => {
  const names = departments.map(department => department.name)
  return new Set(names).size === names.length && !names.includes(LEADERSHIP_DEFAULT_NAME)
}, { path: ['departments'] })
export const CreateDepartmentSchema = z.strictObject({ name: departmentName })
// 편집 대화상자가 이름과 구매 승인을 함께 보낸다. 회장단은 handlesFinance가 늘 false다.
export const UpdateDepartmentSchema = z.strictObject({ name: departmentName, handlesFinance: z.boolean() })
export const DeleteDepartmentSchema = z.strictObject({})
// null은 미배정이다.
export const AssignDepartmentSchema = z.strictObject({ departmentId: token(64).nullable() })
// null은 직책 지우기다.
export const UpdateMemberTitleSchema = z.strictObject({ title: text(MEMBER_TITLE_MAX).nullable() })

export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationSchema>
export type UpdateDepartmentRequest = z.infer<typeof UpdateDepartmentSchema>
```

`packages/contracts/src/index.ts`:
- 다섯째 줄(`invites.js` export) 아래에 추가:

```ts
export { ORGANIZATION_NAME_MAX, DEPARTMENT_NAME_MAX, MEMBER_TITLE_MAX, CREATE_DEPARTMENTS_MAX, LEADERSHIP_DEFAULT_NAME,
  CreateOrganizationSchema, CreateDepartmentSchema, UpdateDepartmentSchema, DeleteDepartmentSchema, AssignDepartmentSchema,
  UpdateMemberTitleSchema, type CreateOrganizationRequest, type UpdateDepartmentRequest } from './organizations.js'
```

- `JoinOrganizationResponse` 인터페이스 아래에 추가:

```ts
export interface CreateOrganizationResponse {
  membership: MembershipSummary
}

export interface DepartmentSummary { id: string; name: string; isLeadership: boolean; handlesFinance: boolean }
// 구성원에게는 이름만 보인다. 이메일은 주지 않는다.
export interface MemberSummary { id: string; name: string; title: string | null; departmentId: string | null }
// 회장단 전용 변경도 이 응답을 돌려준다. 화면은 받은 값으로 목록을 통째로 바꾼다.
export interface OrganizationMembersResponse {
  viewer: MembershipSummary
  departments: DepartmentSummary[]
  members: MemberSummary[]
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test --workspace @vada/contracts` 와 `npm run typecheck --workspace @vada/contracts`
Expected: PASS, 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add packages/contracts/src
git commit -m "학생회·부서·배정·직책 요청 스키마 추가"
```

---

### Task 3: 권한 계산과 소속 응답

**Files:**
- Modify: `packages/contracts/src/index.ts` (`MembershipSummary`)
- Modify: `apps/api/src/access/membership.ts`, `apps/api/src/purchases/service.ts`, `apps/api/src/deliveries/service.ts`, `apps/api/src/deliveries/routes.ts`
- Test: `apps/api/src/access/access.test.ts`, `apps/api/src/purchases/purchases.test.ts`, `apps/api/src/deliveries/routes.test.ts`
- Modify (타입만): `apps/web/src/test-support/workflow-fixtures.ts`, `apps/web/src/workspace/Workspace.test.tsx`, `apps/web/src/access/Memberships.test.tsx`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `departments.isLeadership`, `memberships.title`.
- Produces:
  - `MembershipPermissions { manageOrganization: boolean; approvePurchases: boolean }`
  - `MembershipSummary`에 `department.isLeadership`, `title: string | null`, `permissions: MembershipPermissions` 추가
  - `permissionsOf(department: { isLeadership: boolean; handlesFinance: boolean } | null): MembershipPermissions`
  - `approvesPurchases: SQL<boolean>`(departments와 조인한 쿼리용)
  - `queryMemberships(db, userId, organizationId?): Promise<MembershipSummary[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/access/access.test.ts`에서 소속 기대값 다섯 곳을 새 모양으로 바꾼다.
- 49행:

```ts
      assert.deepEqual(await response.json(), { memberships: [{ id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Finance', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }] })
```

- 57~58행:

```ts
      const body = await response.json() as { membership: { department: { handlesFinance: boolean }; permissions: { manageOrganization: boolean; approvePurchases: boolean } } }
      assert.equal(body.membership.department.handlesFinance, true)
      assert.deepEqual(body.membership.permissions, { manageOrganization: false, approvePurchases: true })
```

- 68행:

```ts
      assert.deepEqual(await response.json(), { membership: { id: 'm3', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null, title: null, permissions: { manageOrganization: false, approvePurchases: false } } })
```

- 135행:

```ts
      assert.deepEqual({ ...membership, id: 'x' }, { id: 'x', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null, title: null, permissions: { manageOrganization: false, approvePurchases: false } })
```

- 143행:

```ts
      assert.deepEqual((await response.json()).membership, { id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Planning', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } })
```

- 파일 끝에 추가:

```ts
test('회장단 소속은 조직 관리와 구매 승인 권한을 받고, 직책을 함께 준다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('leader','Leader','l@example.test'),('treasurer','Treasurer','t@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222');
      INSERT INTO departments (id,organization_id,name,is_leadership,handles_finance) VALUES ('lead','org1','회장단',true,false),('fin','org1','총무부',false,true);
      INSERT INTO memberships (id,user_id,organization_id,department_id,title) VALUES ('m1','leader','org1','lead','회장'),('m2','treasurer','org1','fin',NULL);
    `)
    let userId = 'leader'
    const routes = createAccessRoutes(db, async () => ({ user: { id: userId } }))
    assert.deepEqual(await (await routes.request('/organizations/org1/membership')).json(), { membership: {
      id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' },
      department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true }, title: '회장',
      permissions: { manageOrganization: true, approvePurchases: true } } })
    userId = 'treasurer'
    const { membership } = await (await routes.request('/organizations/org1/membership')).json() as { membership: { permissions: unknown } }
    assert.deepEqual(membership.permissions, { manageOrganization: false, approvePurchases: true })
  } finally {
    await pg.close()
  }
})
```

`apps/api/src/purchases/purchases.test.ts` 끝에 추가:

```ts
test('회장단은 구매 승인 부서가 아니어도 제출된 요청을 보고 결정한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('l','Leader','l@test.local'),('r','Requester','r@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO departments(id,organization_id,name,is_leadership,handles_finance) VALUES ('lead','a','회장단',true,false),('p','a','Planning',false,false);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('l','l','a','lead'),('r','r','a','p');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','a','Festival','r');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','a','e');
      INSERT INTO purchase_requests(id,organization_id,event_id,requester_id,department_id,idempotency_key,status) VALUES ('req','a','e','r','p','k','submitted');
    `)
    let userId = 'l'
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      purchases: createPurchaseRoutes(db, async () => ({ user: { id: userId } }), async () => { throw new Error('unused') }) })
    const inbox = '/api/organizations/a/events/e/purchase-requests/finance'
    const list = await app.request(inbox)
    assert.equal(list.status, 200)
    assert.deepEqual((await list.json()).requests.map((request: { id: string }) => request.id), ['req'])
    const decision = await app.request(`${inbox}/req/decision`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ version: 1, decision: 'approved' }) })
    assert.equal(decision.status, 200)
    assert.equal((await pg.query<{ status: string }>("SELECT status FROM purchase_requests WHERE id = 'req'")).rows[0]?.status, 'approved')
    userId = 'r'
    assert.equal((await app.request(inbox)).status, 403)
  } finally {
    await pg.close()
  }
})
```

`apps/api/src/deliveries/routes.test.ts` 끝에 추가:

```ts
test('회장단은 재정 전용 배송 조회를 쓸 수 있다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('l','Leader','l@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO departments(id,organization_id,name,is_leadership) VALUES ('lead','a','회장단',true);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('l','l','a','lead');
    `)
    const lookup = { status: 'in_transit' as const, providerStatus: 'IN_TRANSIT', lastEventAt: null, checkedAt: '2026-10-08T00:00:00.000Z' }
    const provider = { carriers: async () => ({ carriers: [], nextCursor: null }), lookup: async () => lookup }
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      deliveries: createDeliveryRoutes(db, async () => ({ user: { id: 'l' } }), provider) })
    const response = await app.request('/api/organizations/a/delivery-lookups', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ carrierId: 'kr.cjlogistics', trackingNumber: '1234' }) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), lookup)
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인**

Run (`apps/api`에서): `npx tsx --test src/access/access.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts`
Expected: FAIL. 소속 응답에 `title`·`permissions`가 없고, 회장단의 재정 요청이 403이다.

- [ ] **Step 3: 계약 수정**

`packages/contracts/src/index.ts`의 `MembershipSummary`를 다음으로 바꾼다.

```ts
export interface MembershipPermissions {
  manageOrganization: boolean
  approvePurchases: boolean
}

export interface MembershipSummary {
  id: string
  organization: { id: string; name: string; inviteCode: string }
  // 초대로 들어와 아직 부서가 없으면 null(미배정)이다. 회장단도 부서 중 하나다.
  department: { id: string; name: string; handlesFinance: boolean; isLeadership: boolean } | null
  // 표시용 직책. 권한과 무관하다.
  title: string | null
  // 서버가 부서로 계산한 권한. 화면은 이 값만 보고 메뉴를 보인다.
  permissions: MembershipPermissions
}
```

- [ ] **Step 4: 권한 규칙과 소속 조회**

`apps/api/src/access/membership.ts`의 import부터 `queryMemberships` 끝까지를 다음으로 바꾼다(`requireMembership`은 그대로).

```ts
import { and, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { createMiddleware } from 'hono/factory'
import type { MembershipPermissions, MembershipSummary } from '@vada/contracts'
import type { SessionEnv } from '../auth/require-session.js'
import { departments, memberships, organizations } from '../db/schema.js'

type MembershipDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
export type MembershipEnv = { Variables: SessionEnv['Variables'] & { membership: MembershipSummary } }

// 권한 규칙은 여기 한 곳에 둔다. 회장단은 조직을 관리하고, 회장단과 구매 승인 부서는 구매를 승인한다.
export function permissionsOf(department: { isLeadership: boolean; handlesFinance: boolean } | null): MembershipPermissions {
  return {
    manageOrganization: department?.isLeadership ?? false,
    approvePurchases: Boolean(department?.isLeadership || department?.handlesFinance),
  }
}
// 구매·배송의 재정 검사가 같은 규칙을 SQL로 쓴다. departments를 소속과 조인한 쿼리에 넣는다.
export const approvesPurchases = sql<boolean>`(${departments.isLeadership} or ${departments.handlesFinance})`

export async function queryMemberships(db: MembershipDatabase, userId: string, organizationId?: string): Promise<MembershipSummary[]> {
  const rows = await db.select({
    id: memberships.id,
    organization: { id: organizations.id, name: organizations.name, inviteCode: organizations.inviteCode },
    department: { id: departments.id, name: departments.name, handlesFinance: departments.handlesFinance, isLeadership: departments.isLeadership },
    title: memberships.title,
  }).from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    // 초대로 들어온 구성원은 부서가 없다(미배정). 부서가 없어도 소속은 유지한다.
    .leftJoin(departments, and(eq(departments.id, memberships.departmentId), eq(departments.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.userId, userId), organizationId === undefined ? undefined : eq(memberships.organizationId, organizationId)))
    .orderBy(organizations.id)
  return rows.map(row => ({ ...row, permissions: permissionsOf(row.department) }))
}
```

- [ ] **Step 5: 구매·배송 재정 검사**

`apps/api/src/purchases/service.ts`:
- import에 `import { approvesPurchases } from '../access/membership.js'`를 더한다.
- `requireFinance`의 where를 다음으로 바꾼다.

```ts
    .where(and(eq(memberships.userId, scope.userId), eq(memberships.organizationId, scope.organizationId), approvesPurchases)).for('share')
```

`apps/api/src/deliveries/service.ts`:
- import에 `import { approvesPurchases } from '../access/membership.js'`를 더한다.
- `access`의 첫 줄을 다음으로 바꾼다.

```ts
  const query = db.select({ finance: approvesPurchases }).from(memberships)
```

`apps/api/src/deliveries/routes.ts`의 `finance` 미들웨어 첫 줄을 다음으로 바꾼다.

```ts
    if (!c.get('membership').permissions.approvePurchases) return c.json({ error: 'FORBIDDEN' }, 403)
```

- [ ] **Step 6: 웹 고정값 타입 맞추기**

`apps/web/src/test-support/workflow-fixtures.ts`의 `membership`:

```ts
export const membership = (finance = false): MembershipSummary => ({ id: finance ? 'mf' : 'mp',
  organization: { id: 'o', name: '테스트 학생회', inviteCode: 'ABCD2345' },
  department: { id: finance ? 'df' : 'd', name: finance ? '재정부' : '기획부', handlesFinance: finance, isLeadership: false },
  title: null, permissions: { manageOrganization: false, approvePurchases: finance } })
```

`apps/web/src/workspace/Workspace.test.tsx`:
- 1행 import 아래에 `import type { MembershipSummary } from '@vada/contracts'`를 더한다.
- 9행 `membership`을 다음 두 줄로 바꾼다.

```ts
const membership: MembershipSummary = { id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }
const financeMembership: MembershipSummary = { ...membership, department: { id: 'd1', name: '기획부', handlesFinance: true, isLeadership: false }, permissions: { manageOrganization: false, approvePurchases: true } }
```

- 93행과 114행의 `{ ...membership, department: { ...membership.department, handlesFinance: true } }`를 `financeMembership`으로 바꾼다.

`apps/web/src/access/Memberships.test.tsx`:
- import 아래에 다음을 더한다.

```ts
const planner = { id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }
```

- 8·28·32행의 소속 객체 리터럴을 `planner`로 바꾼다.
- 44행의 객체는 `{ ...planner, department: null }`로 바꾼다.

`apps/web/src/App.test.tsx` 8행 `renderMemberships([...])` 안의 객체를 다음으로 바꾼다.

```ts
{ id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }
```

- [ ] **Step 7: 통과 확인**

Run (`apps/api`에서): `npx tsx --test src/access/access.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts`
Expected: PASS.

Run: `npm run typecheck`
Expected: 세 워크스페이스 모두 오류 없음.

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/workspace/Workspace.test.tsx src/access/Memberships.test.tsx src/App.test.tsx src/App.integration.test.tsx`
Expected: PASS. 화면 코드는 아직 `department.handlesFinance`를 보고, 고정값은 두 값을 함께 맞췄다.

- [ ] **Step 8: 커밋**

```bash
git add packages/contracts/src/index.ts apps/api/src/access apps/api/src/purchases apps/api/src/deliveries apps/web/src/test-support apps/web/src/workspace/Workspace.test.tsx apps/web/src/access/Memberships.test.tsx apps/web/src/App.test.tsx
git commit -m "회장단도 구매를 승인하도록 권한 규칙 모으기" -m "권한을 부서로 한 곳에서 계산하고, 소속 응답에 권한과 직책을 싣는다."
```

---

### Task 4: 조직 API(organization 모듈)

**Files:**
- Create: `apps/api/src/organization/service.ts`, `apps/api/src/organization/routes.ts`, `apps/api/src/organization/organization.test.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/serve.ts`, `apps/api/src/http/boundary.test.ts`, `apps/api/src/http/on-error.ts`(`sqlState` export), `apps/api/package.json`(test 목록)

**Interfaces:**
- Consumes: Task 2 스키마·타입, Task 3 `queryMemberships`, `requireMembership`.
- Produces: `createOrganizationRoutes(db, getSession)`, `AppOptions.organization`. 라우트 7개(스펙 표 그대로).

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/organization/organization.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../app.js'
import { createOrganizationRoutes } from './routes.js'

const origin = 'http://127.0.0.1:5180'
type Body = Record<string, unknown>

async function setup() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
  await pg.exec(`
    INSERT INTO users (id,name,email) VALUES ('lead','김바다','lead@example.test'),('treasurer','김민준','treasurer@example.test'),
      ('newbie','정하늘','newbie@example.test'),('other','다른 학생회','other@example.test'),('loner','혼자','loner@example.test');
    INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
    INSERT INTO departments (id,organization_id,name,is_leadership,handles_finance) VALUES
      ('lead1','org1','회장단',true,false),('fin1','org1','총무부',false,true),('plan1','org1','기획부',false,false),
      ('lead2','org2','회장단',true,false),('plan2','org2','기획부',false,false);
    INSERT INTO memberships (id,user_id,organization_id,department_id,title) VALUES
      ('m-lead','lead','org1','lead1','회장'),('m-treasurer','treasurer','org1','fin1','총무'),('m-newbie','newbie','org1',NULL,NULL),
      ('m-other','other','org2','lead2',NULL);
  `)
  let userId: string | null = 'lead'
  let sessionReads = 0
  const session = async () => { sessionReads++; return userId ? { user: { id: userId } } : null }
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, organization: createOrganizationRoutes(db, session) })
  const send = (method: string, path: string, body: unknown) => app.request(`/api${path}`, { method,
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { pg, send, get: (path: string) => app.request(`/api${path}`), as: (id: string | null) => { userId = id }, sessionReads: () => sessionReads }
}

test('학생회를 만들면 만든 사람이 회장단이 되고, 고른 부서가 생긴다', async () => {
  const { pg, send, as } = await setup()
  try {
    as('loner')
    const response = await send('POST', '/organizations/create', { name: ' 제12대 학생회 ',
      departments: [{ name: ' 총무부 ', handlesFinance: true }, { name: '기획부', handlesFinance: false }] })
    assert.equal(response.status, 201)
    const { membership } = await response.json()
    assert.equal(membership.organization.name, '제12대 학생회')
    assert.match(membership.organization.inviteCode, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.deepEqual({ ...membership.department, id: 'x' }, { id: 'x', name: '회장단', isLeadership: true, handlesFinance: false })
    assert.equal(membership.title, null)
    assert.deepEqual(membership.permissions, { manageOrganization: true, approvePurchases: true })
    const rows = await pg.query('SELECT name, is_leadership, handles_finance FROM departments WHERE organization_id = $1 ORDER BY name', [membership.organization.id])
    assert.deepEqual(rows.rows, [
      { name: '기획부', is_leadership: false, handles_finance: false },
      { name: '총무부', is_leadership: false, handles_finance: true },
      { name: '회장단', is_leadership: true, handles_finance: false },
    ])
    const empty = await send('POST', '/organizations/create', { name: '빈 학생회', departments: [] })
    assert.equal(empty.status, 201)
    const created = await empty.json()
    const count = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM departments WHERE organization_id = $1', [created.membership.organization.id])
    assert.equal(count.rows[0]?.n, 1)
    as(null)
    assert.equal((await send('POST', '/organizations/create', { name: '학생회', departments: [] })).status, 401)
  } finally {
    await pg.close()
  }
})

test('형식이 틀린 본문은 인증 전에 400이다', async () => {
  const { pg, send, sessionReads } = await setup()
  try {
    const long = (max: number) => '😀'.repeat(max + 1)
    const cases: [string, string, Body[]][] = [
      ['POST', '/organizations/create', [{}, { name: '', departments: [] }, { name: '   ', departments: [] }, { name: long(50), departments: [] },
        { name: 'a\u0000', departments: [] }, { name: '\uD800', departments: [] }, { name: '학생회', departments: [], extra: 1 },
        { name: '학생회', departments: [{ name: '기획부', handlesFinance: false }, { name: '기획부', handlesFinance: false }] },
        { name: '학생회', departments: [{ name: '회장단', handlesFinance: false }] }]],
      ['POST', '/organizations/org1/departments', [{}, { name: '' }, { name: '  ' }, { name: long(20) }, { name: 'a\u0000' }, { name: '\uD800' }, { name: '홍보부', extra: 1 }]],
      ['PATCH', '/organizations/org1/departments/plan1', [{ name: '기획국' }, { name: '', handlesFinance: false }, { name: long(20), handlesFinance: false },
        { name: '기획국', handlesFinance: false, extra: 1 }]],
      ['POST', '/organizations/org1/departments/plan1/delete', [{ extra: 1 }]],
      ['POST', '/organizations/org1/members/m-newbie/department', [{}, { departmentId: '' }, { departmentId: 'd'.repeat(65) }, { departmentId: 'd\u0001' },
        { departmentId: null, extra: 1 }]],
      ['POST', '/organizations/org1/members/m-newbie/title', [{}, { title: '' }, { title: '  ' }, { title: long(20) }, { title: 'a\u0000' }, { title: '\uD800' },
        { title: null, extra: 1 }]],
    ]
    const before = sessionReads()
    for (const [method, path, bodies] of cases) {
      for (const body of bodies) {
        const response = await send(method, path, body)
        assert.equal(response.status, 400, `${method} ${path} ${JSON.stringify(body)}`)
        assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
      }
    }
    assert.equal(sessionReads(), before)
  } finally {
    await pg.close()
  }
})

test('구성원 목록은 같은 학생회 소속만 보고, 이메일은 없다', async () => {
  const { pg, get, as } = await setup()
  try {
    as(null)
    assert.equal((await get('/organizations/org1/members')).status, 401)
    as('other')
    assert.equal((await get('/organizations/org1/members')).status, 403)
    as('newbie')
    const response = await get('/organizations/org1/members')
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.equal(text.includes('@example.test'), false)
    const body = JSON.parse(text)
    assert.deepEqual(body.viewer.permissions, { manageOrganization: false, approvePurchases: false })
    assert.deepEqual(body.departments.map((department: { id: string }) => department.id), ['fin1', 'lead1', 'plan1'])
    assert.deepEqual(body.members, [
      { id: 'm-lead', name: '김바다', title: '회장', departmentId: 'lead1' },
      { id: 'm-newbie', name: '정하늘', title: null, departmentId: null },
      { id: 'm-treasurer', name: '김민준', title: '총무', departmentId: 'fin1' },
    ])
  } finally {
    await pg.close()
  }
})

test('회장단이 아니면 조직을 바꿀 수 없다', async () => {
  const { pg, send, as } = await setup()
  try {
    const changes: [string, string, Body][] = [
      ['POST', '/organizations/org1/departments', { name: '홍보부' }],
      ['PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: false }],
      ['POST', '/organizations/org1/departments/plan1/delete', {}],
      ['POST', '/organizations/org1/members/m-newbie/department', { departmentId: 'plan1' }],
      ['POST', '/organizations/org1/members/m-newbie/title', { title: '국장' }],
    ]
    for (const user of ['treasurer', 'newbie', 'other']) {
      as(user)
      for (const [method, path, body] of changes) assert.equal((await send(method, path, body)).status, 403, `${user} ${method} ${path}`)
    }
    as(null)
    for (const [method, path, body] of changes) assert.equal((await send(method, path, body)).status, 401, `${method} ${path}`)
    const departments = await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM departments WHERE organization_id = 'org1'")
    assert.equal(departments.rows[0]?.n, 3)
  } finally {
    await pg.close()
  }
})

test('회장단은 부서를 추가·변경·삭제하고, 규칙에 어긋나면 409다', async () => {
  const { pg, send } = await setup()
  try {
    const added = await send('POST', '/organizations/org1/departments', { name: ' 홍보부 ' })
    assert.equal(added.status, 200)
    const addedBody = await added.json()
    const promo = addedBody.departments.find((department: { name: string }) => department.name === '홍보부')
    assert.deepEqual({ ...promo, id: 'x' }, { id: 'x', name: '홍보부', isLeadership: false, handlesFinance: false })
    assert.deepEqual(addedBody.viewer.permissions, { manageOrganization: true, approvePurchases: true })
    for (const name of ['기획부', ' 기획부 ', '회장단']) {
      const response = await send('POST', '/organizations/org1/departments', { name })
      assert.equal(response.status, 409, name)
      assert.deepEqual(await response.json(), { error: 'DEPARTMENT_NAME_TAKEN' })
    }
    const renamed = await send('PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: true })
    assert.equal(renamed.status, 200)
    assert.deepEqual((await renamed.json()).departments.find((department: { id: string }) => department.id === 'plan1'),
      { id: 'plan1', name: '기획국', isLeadership: false, handlesFinance: true })
    assert.equal((await send('PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: false })).status, 200)
    assert.deepEqual(await (await send('PATCH', '/organizations/org1/departments/plan1', { name: '총무부', handlesFinance: false })).json(),
      { error: 'DEPARTMENT_NAME_TAKEN' })
    assert.equal((await send('PATCH', '/organizations/org1/departments/lead1', { name: '비상대책위원회', handlesFinance: false })).status, 200)
    const fixed = await send('PATCH', '/organizations/org1/departments/lead1', { name: '비상대책위원회', handlesFinance: true })
    assert.equal(fixed.status, 409)
    assert.deepEqual(await fixed.json(), { error: 'LEADERSHIP_FIXED' })
    for (const id of ['plan2', 'missing', '%00', 'd'.repeat(65)]) {
      assert.equal((await send('PATCH', `/organizations/org1/departments/${id}`, { name: '새 이름', handlesFinance: false })).status, 404, id)
      assert.equal((await send('POST', `/organizations/org1/departments/${id}/delete`, {})).status, 404, id)
    }
    const remove = (id: string) => send('POST', `/organizations/org1/departments/${id}/delete`, {})
    assert.deepEqual(await (await remove('lead1')).json(), { error: 'LEADERSHIP_FIXED' })
    assert.deepEqual(await (await remove('fin1')).json(), { error: 'DEPARTMENT_NOT_EMPTY' })
    await pg.exec(`
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e1','org1','Festival','lead');
      INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,department_id,idempotency_key) VALUES ('r1','org1','e1','lead','plan1','k1');
    `)
    const inUse = await remove('plan1')
    assert.equal(inUse.status, 409)
    assert.deepEqual(await inUse.json(), { error: 'DEPARTMENT_IN_USE' })
    const deleted = await remove(promo.id)
    assert.equal(deleted.status, 200)
    assert.equal((await deleted.json()).departments.some((department: { id: string }) => department.id === promo.id), false)
  } finally {
    await pg.close()
  }
})

test('배정은 직책을 지우고, 마지막 회장단은 옮길 수 없으며, 넘긴 뒤에는 관리할 수 없다', async () => {
  const { pg, send } = await setup()
  try {
    const assign = (membershipId: string, departmentId: string | null) =>
      send('POST', `/organizations/org1/members/${membershipId}/department`, { departmentId })
    const title = (membershipId: string, value: string | null) => send('POST', `/organizations/org1/members/${membershipId}/title`, { title: value })
    const memberOf = async (response: Response, id: string) => (await response.json()).members.find((member: { id: string }) => member.id === id)
    assert.deepEqual(await memberOf(await assign('m-newbie', 'plan1'), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: null, departmentId: 'plan1' })
    assert.deepEqual(await memberOf(await title('m-newbie', ' 국장 '), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: '국장', departmentId: 'plan1' })
    assert.equal((await memberOf(await assign('m-newbie', 'plan1'), 'm-newbie')).title, '국장')
    assert.deepEqual(await memberOf(await assign('m-newbie', 'fin1'), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: null, departmentId: 'fin1' })
    assert.equal((await memberOf(await assign('m-newbie', null), 'm-newbie')).departmentId, null)
    assert.equal((await memberOf(await title('m-lead', null), 'm-lead')).title, null)
    for (const [membershipId, departmentId] of [['m-newbie', 'plan2'], ['m-newbie', 'missing'], ['m-other', 'plan1'], ['missing', 'plan1'], ['%00', 'plan1']] as const) {
      assert.equal((await assign(membershipId, departmentId)).status, 404, `${membershipId} ${departmentId}`)
    }
    assert.equal((await title('m-other', '회장')).status, 404)
    const last = await assign('m-lead', 'plan1')
    assert.equal(last.status, 409)
    assert.deepEqual(await last.json(), { error: 'LAST_LEADER' })
    assert.equal((await assign('m-newbie', 'lead1')).status, 200)
    const handover = await assign('m-lead', 'plan1')
    assert.equal(handover.status, 200)
    const body = await handover.json()
    assert.deepEqual(body.viewer.permissions, { manageOrganization: false, approvePurchases: false })
    assert.equal(body.viewer.department.id, 'plan1')
    assert.equal((await send('POST', '/organizations/org1/departments', { name: '홍보부' })).status, 403)
    const leaders = await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM memberships WHERE department_id = 'lead1'")
    assert.equal(leaders.rows[0]?.n, 1)
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인**

Run (`apps/api`에서): `npx tsx --test src/organization/organization.test.ts`
Expected: FAIL. `./routes.js`를 찾지 못한다.

- [ ] **Step 3: SQLSTATE 도우미 공개**

`apps/api/src/http/on-error.ts`의 `function sqlState(error: unknown)`를 `export function sqlState(error: unknown)`로 바꾼다.

- [ ] **Step 4: 서비스 구현**

`apps/api/src/organization/service.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { and, asc, count, eq, ne } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { LEADERSHIP_DEFAULT_NAME, type CreateOrganizationRequest, type MembershipSummary, type OrganizationMembersResponse,
  type UpdateDepartmentRequest } from '@vada/contracts'
import { queryMemberships } from '../access/membership.js'
import { departments, memberships, organizations, purchaseRequests, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { sqlState } from '../http/on-error.js'

type Db = PgDatabase<PgQueryResultHKT>
export type OrganizationDatabase = Pick<Db, 'select' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<OrganizationDatabase['transaction']>[0]>[0]

async function members(db: Reader, organizationId: string, userId: string): Promise<OrganizationMembersResponse> {
  const [viewer] = await queryMemberships(db, userId, organizationId)
  if (!viewer) throw new ApiError('FORBIDDEN', 403)
  const departmentRows = await db.select({ id: departments.id, name: departments.name, isLeadership: departments.isLeadership,
    handlesFinance: departments.handlesFinance }).from(departments)
    .where(eq(departments.organizationId, organizationId)).orderBy(asc(departments.id))
  // 구성원에게는 이름만 보인다. 이메일은 주지 않는다.
  const memberRows = await db.select({ id: memberships.id, name: users.name, title: memberships.title, departmentId: memberships.departmentId })
    .from(memberships).innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, organizationId)).orderBy(asc(memberships.id))
  return { viewer, departments: departmentRows, members: memberRows }
}

// 같은 학생회의 조직 변경을 한 번에 하나씩 처리한다. 잠근 뒤 요청자가 여전히 회장단인지 확인한다.
async function lockAsLeader(tx: Transaction, organizationId: string, userId: string) {
  const [leadership] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.isLeadership, true))).for('update')
  if (!leadership) throw new ApiError('FORBIDDEN', 403)
  const [leader] = await tx.select({ id: memberships.id }).from(memberships)
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId), eq(memberships.departmentId, leadership.id)))
  if (!leader) throw new ApiError('FORBIDDEN', 403)
  return leadership.id
}

async function departmentIn(tx: Reader, organizationId: string, departmentId: string) {
  const [department] = await tx.select({ id: departments.id, isLeadership: departments.isLeadership }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
  if (!department) throw new ApiError('NOT_FOUND', 404)
  return department
}

async function assertNameFree(tx: Reader, organizationId: string, name: string, exceptId?: string) {
  const [taken] = await tx.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, organizationId), eq(departments.name, name), exceptId === undefined ? undefined : ne(departments.id, exceptId)))
  if (taken) throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
}

export function createOrganizationService(db: OrganizationDatabase) {
  async function mutate(organizationId: string, userId: string, change: (tx: Transaction, leadershipId: string) => Promise<void>) {
    try {
      return await db.transaction(async tx => {
        const leadershipId = await lockAsLeader(tx, organizationId, userId)
        await change(tx, leadershipId)
        return members(tx, organizationId, userId)
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      // 미리 조회한 뒤 다른 요청과 겹쳐 생긴 제약 위반은 같은 오류 코드로 바꾼다.
      const state = sqlState(error)
      if (state === '23505') throw new ApiError('DEPARTMENT_NAME_TAKEN', 409)
      if (state === '23503') throw new ApiError('DEPARTMENT_IN_USE', 409)
      throw error
    }
  }

  return {
    // 와이어프레임 ORG-01·02를 줄였다. 학생회, 회장단, 부서, 만든 사람의 회장단 소속을 한 번에 만든다.
    async create(userId: string, input: CreateOrganizationRequest): Promise<MembershipSummary> {
      const organizationId = randomUUID()
      const leadershipId = randomUUID()
      await db.transaction(async tx => {
        await tx.insert(organizations).values({ id: organizationId, name: input.name })
        await tx.insert(departments).values([
          { id: leadershipId, organizationId, name: LEADERSHIP_DEFAULT_NAME, isLeadership: true },
          ...input.departments.map(department => ({ id: randomUUID(), organizationId, name: department.name, handlesFinance: department.handlesFinance })),
        ])
        await tx.insert(memberships).values({ id: randomUUID(), userId, organizationId, departmentId: leadershipId })
      })
      const [membership] = await queryMemberships(db, userId, organizationId)
      if (!membership) throw new Error('Membership missing after create')
      return membership
    },
    list: (organizationId: string, userId: string) => members(db, organizationId, userId),
    createDepartment: (organizationId: string, userId: string, name: string) => mutate(organizationId, userId, async tx => {
      await assertNameFree(tx, organizationId, name)
      await tx.insert(departments).values({ id: randomUUID(), organizationId, name })
    }),
    updateDepartment: (organizationId: string, userId: string, departmentId: string, input: UpdateDepartmentRequest) =>
      mutate(organizationId, userId, async tx => {
        const department = await departmentIn(tx, organizationId, departmentId)
        if (department.isLeadership && input.handlesFinance) throw new ApiError('LEADERSHIP_FIXED', 409)
        await assertNameFree(tx, organizationId, input.name, departmentId)
        await tx.update(departments).set({ name: input.name, handlesFinance: input.handlesFinance })
          .where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
      }),
    deleteDepartment: (organizationId: string, userId: string, departmentId: string) => mutate(organizationId, userId, async tx => {
      const department = await departmentIn(tx, organizationId, departmentId)
      if (department.isLeadership) throw new ApiError('LEADERSHIP_FIXED', 409)
      const [member] = await tx.select({ id: memberships.id }).from(memberships).where(eq(memberships.departmentId, departmentId)).limit(1)
      if (member) throw new ApiError('DEPARTMENT_NOT_EMPTY', 409)
      // 지우면 과거 요청의 부서가 사라지므로, 기록이 있는 부서는 지우지 않는다.
      const [request] = await tx.select({ id: purchaseRequests.id }).from(purchaseRequests).where(eq(purchaseRequests.departmentId, departmentId)).limit(1)
      if (request) throw new ApiError('DEPARTMENT_IN_USE', 409)
      await tx.delete(departments).where(and(eq(departments.organizationId, organizationId), eq(departments.id, departmentId)))
    }),
    assignDepartment: (organizationId: string, userId: string, membershipId: string, departmentId: string | null) =>
      mutate(organizationId, userId, async (tx, leadershipId) => {
        const [member] = await tx.select({ departmentId: memberships.departmentId }).from(memberships)
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId)))
        if (!member) throw new ApiError('NOT_FOUND', 404)
        if (departmentId !== null) await departmentIn(tx, organizationId, departmentId)
        if (member.departmentId === departmentId) return
        if (member.departmentId === leadershipId) {
          const [leaders] = await tx.select({ n: count() }).from(memberships).where(eq(memberships.departmentId, leadershipId))
          if ((leaders?.n ?? 0) <= 1) throw new ApiError('LAST_LEADER', 409)
        }
        // 직책은 대개 그 부서에 묶여 있어서 부서를 옮기면 지운다.
        await tx.update(memberships).set({ departmentId, title: null })
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId)))
      }),
    updateTitle: (organizationId: string, userId: string, membershipId: string, title: string | null) => mutate(organizationId, userId, async tx => {
      const updated = await tx.update(memberships).set({ title })
        .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, membershipId))).returning({ id: memberships.id })
      if (!updated.length) throw new ApiError('NOT_FOUND', 404)
    }),
  }
}
```

- [ ] **Step 5: 라우트 구현**

`apps/api/src/organization/routes.ts`:

```ts
import { Hono } from 'hono'
import { AssignDepartmentSchema, CreateDepartmentSchema, CreateOrganizationSchema, DeleteDepartmentSchema, UpdateDepartmentSchema,
  UpdateMemberTitleSchema, token, type CreateOrganizationResponse, type OrganizationMembersResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { createOrganizationService, type OrganizationDatabase } from './service.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

export function createOrganizationRoutes(db: OrganizationDatabase, getSession: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const service = createOrganizationService(db)
  const auth = requireSession(getSession)
  const member = requireMembership(db)
  const root = '/organizations/:organizationId'
  routes.post('/organizations/create', json(CreateOrganizationSchema), auth, async c => {
    const membership = await service.create(c.get('userId'), c.req.valid('json'))
    return c.json({ membership } satisfies CreateOrganizationResponse, 201)
  })
  routes.get(`${root}/members`, auth, member, async c =>
    c.json(await service.list(c.req.param('organizationId'), c.get('userId')) satisfies OrganizationMembersResponse))
  routes.post(`${root}/departments`, json(CreateDepartmentSchema), auth, member, async c =>
    c.json(await service.createDepartment(c.req.param('organizationId'), c.get('userId'), c.req.valid('json').name)))
  routes.patch(`${root}/departments/:departmentId`, json(UpdateDepartmentSchema), auth, member, async c =>
    c.json(await service.updateDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('departmentId')), c.req.valid('json'))))
  routes.post(`${root}/departments/:departmentId/delete`, json(DeleteDepartmentSchema), auth, member, async c =>
    c.json(await service.deleteDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('departmentId')))))
  routes.post(`${root}/members/:membershipId/department`, json(AssignDepartmentSchema), auth, member, async c =>
    c.json(await service.assignDepartment(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('membershipId')),
      c.req.valid('json').departmentId)))
  routes.post(`${root}/members/:membershipId/title`, json(UpdateMemberTitleSchema), auth, member, async c =>
    c.json(await service.updateTitle(c.req.param('organizationId'), c.get('userId'), idOf(c.req.param('membershipId')), c.req.valid('json').title)))
  return routes
}
```

- [ ] **Step 6: 앱·서버·경계 테스트에 연결**

`apps/api/src/app.ts`:
- `import type { createDeliveryWebhook } ...` 아래에 `import type { createOrganizationRoutes } from './organization/routes.js'`를 더한다.
- `AppOptions`의 `webhook?` 위에 `organization?: ReturnType<typeof createOrganizationRoutes>`를 더한다.
- `createApp`의 구조 분해에 `organization`을 더하고, `if (access) app.route('/api', access)` 아래에 `if (organization) app.route('/api', organization)`을 더한다.

`apps/api/src/serve.ts`:
- import에 `import { createOrganizationRoutes } from './organization/routes.js'`를 더한다.
- `const access = ...` 아래에 `const organization = createOrganizationRoutes(db, (headers) => auth.api.getSession({ headers }))`를 더한다.
- `createApp({ ... })` 인자에 `organization`을 더한다.

`apps/api/src/http/boundary.test.ts`:
- import에 `import { createOrganizationRoutes } from '../organization/routes.js'`를 더한다.
- `modules`의 `access: createAccessRoutes(db, session),` 뒤에 `organization: createOrganizationRoutes(db, session),`를 더한다.

`apps/api/package.json`의 `test` 스크립트에서 `src/access/access.test.ts` 뒤에 ` src/organization/organization.test.ts`를 더한다.

- [ ] **Step 7: 통과 확인**

Run (`apps/api`에서): `npx tsx --test src/organization/organization.test.ts src/http/boundary.test.ts src/access/access.test.ts`
Expected: PASS. 경계 테스트가 새 변경 라우트 6개를 출처·형식·크기·모르는 키로 검사한다.

Run: `npm run typecheck --workspace @vada/api`
Expected: 오류 없음.

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/organization apps/api/src/app.ts apps/api/src/serve.ts apps/api/src/http/boundary.test.ts apps/api/src/http/on-error.ts apps/api/package.json
git commit -m "학생회 만들기와 조직 관리 API 추가" -m "회장단만 부서·배정·직책을 바꾸고, 조직 변경은 회장단 행을 잠가 한 번에 하나씩 처리한다."
```

---

### Task 5: 구성원 화면

**Files:**
- Create: `apps/web/src/organization/members-view.ts`, `apps/web/src/organization/members-view.test.ts`
- Create: `apps/web/src/organization/useOrganizationMembers.ts`
- Create: `apps/web/src/organization/Members.tsx`, `apps/web/src/organization/Members.test.tsx`

**Interfaces:**
- Consumes: Task 2·3의 `OrganizationMembersResponse`, `DepartmentSummary`, `MemberSummary`, `MembershipPermissions`, 스키마.
- Produces:
  - `groupMembers(departments, members): MemberGroup[]`, `sortDepartments(departments)`, `moveWarning(member, from, to): string | null`
  - `useOrganizationMembers(organizationId: string, enabled: boolean)` → `{ data, loadError, saving, mutate(method, path, body): Promise<string | null>, refresh() }`
  - 타입 `OrganizationMembers = ReturnType<typeof useOrganizationMembers>`
  - `Members({ inviteCode, state })` 기본 내보내기

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/organization/members-view.test.ts`:

```ts
import { expect, test } from 'vitest'
import { groupMembers, moveWarning } from './members-view'

const lead = { id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false }
const fin = { id: 'fin', name: '총무실', isLeadership: false, handlesFinance: true }
const plan = { id: 'plan', name: '기획부', isLeadership: false, handlesFinance: false }

test('권한이 바뀌는 이동만 문장을 만들고, 받침에 맞는 조사를 붙인다', () => {
  const member = { id: 'm', name: '김바다', title: '회장', departmentId: 'lead' }
  expect(moveWarning(member, lead, plan)).toBe('김바다를 기획부로 옮기면 조직 관리와 구매 승인을 할 수 없게 돼요. 직책은 지워져요.')
  expect(moveWarning({ ...member, name: '김민준', title: null }, fin, lead)).toBe('김민준을 회장단으로 옮기면 조직 관리를 할 수 있게 돼요.')
  expect(moveWarning({ ...member, title: null }, null, fin)).toBe('김바다를 총무실로 옮기면 구매 승인을 할 수 있게 돼요.')
  expect(moveWarning({ ...member, title: null }, fin, null)).toBe('김바다를 미배정으로 옮기면 구매 승인을 할 수 없게 돼요.')
  expect(moveWarning({ ...member, title: null }, plan, null)).toBeNull()
  expect(moveWarning({ ...member, title: null }, fin, { ...plan, handlesFinance: true })).toBeNull()
})

test('묶음은 미배정, 회장단, 가나다순이고 안에서는 직책이 있는 사람이 먼저다', () => {
  const members = [
    { id: '1', name: '하늘', title: null, departmentId: 'plan' }, { id: '2', name: '가람', title: null, departmentId: 'plan' },
    { id: '3', name: '나래', title: '부장', departmentId: 'plan' }, { id: '4', name: '다솜', title: null, departmentId: null },
  ]
  const groups = groupMembers([plan, fin, lead], members)
  expect(groups.map(group => group.department?.name ?? '미배정')).toEqual(['미배정', '회장단', '기획부', '총무실'])
  expect(groups[2]!.members.map(member => member.name)).toEqual(['나래', '가람', '하늘'])
  expect(groupMembers([plan], []).map(group => group.key)).toEqual(['plan'])
})
```

`apps/web/src/organization/Members.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DepartmentSummary, MemberSummary, MembershipSummary, OrganizationMembersResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import Members from './Members'
import { useOrganizationMembers } from './useOrganizationMembers'

const base = '/api/organizations/o'
const departments: DepartmentSummary[] = [
  { id: 'fin', name: '총무부', isLeadership: false, handlesFinance: true },
  { id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false },
  { id: 'plan', name: '기획부', isLeadership: false, handlesFinance: false },
]
const members: MemberSummary[] = [
  { id: 'm-lead', name: '김바다', title: '회장', departmentId: 'lead' },
  { id: 'm-fin', name: '김민준', title: '총무', departmentId: 'fin' },
  { id: 'm-new', name: '정하늘', title: null, departmentId: null },
  { id: 'm-plan', name: '박민수', title: null, departmentId: 'plan' },
]
const viewer = (manage: boolean): MembershipSummary => ({ id: manage ? 'm-lead' : 'm-plan',
  organization: { id: 'o', name: '테스트 학생회', inviteCode: 'ABCD2345' },
  department: manage ? { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true } : { id: 'plan', name: '기획부', handlesFinance: false, isLeadership: false },
  title: manage ? '회장' : null, permissions: { manageOrganization: manage, approvePurchases: manage } })
const response = (manage = true, overrides: Partial<OrganizationMembersResponse> = {}): OrganizationMembersResponse =>
  ({ viewer: viewer(manage), departments, members, ...overrides })
const withMember = (id: string, change: Partial<MemberSummary>) => members.map(member => member.id === id ? { ...member, ...change } : member)

function Harness() {
  const state = useOrganizationMembers('o', true)
  return <Members inviteCode="ABCD2345" state={state} />
}
let api: ReturnType<typeof mockApi>
beforeEach(() => { api = mockApi() })
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
const groupNames = () => screen.getAllByRole('region').map(region => region.getAttribute('aria-label'))

test('회장단은 미배정·회장단·가나다순 부서 묶음과 편집칸을 본다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  render(<Harness />)
  expect(await screen.findByRole('heading', { name: '구성원 4명' })).toBeTruthy()
  expect(groupNames()).toEqual(['미배정', '회장단', '기획부', '총무부'])
  expect(within(screen.getByRole('region', { name: '미배정' })).getByText('배정이 필요해요')).toBeTruthy()
  const leadership = within(screen.getByRole('region', { name: '회장단' }))
  expect(leadership.getByText('조직 관리')).toBeTruthy()
  expect(leadership.getByText('구매 승인')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: '총무부' })).getByText('구매 승인')).toBeTruthy()
  expect(screen.getByText(/김바다/).textContent).toBe('김바다 · 회장')
  expect((screen.getByLabelText('정하늘 부서') as HTMLSelectElement).value).toBe('')
  expect(screen.getByRole('button', { name: '총무부 편집' })).toBeTruthy()
  expect(screen.getByText('회장단이 한 명뿐이에요. 자리를 비울 때를 대비해 한 명 더 두세요.')).toBeTruthy()
})

test('일반 구성원은 같은 목록을 보되 편집칸이 없다', async () => {
  api.on('GET', `${base}/members`, () => json(response(false)))
  render(<Harness />)
  await screen.findByRole('heading', { name: '구성원 4명' })
  expect(groupNames()).toEqual(['미배정', '회장단', '기획부', '총무부'])
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByText('배정이 필요해요')).toBeNull()
  expect(screen.queryByRole('button', { name: '회장단 편집' })).toBeNull()
  expect(screen.queryByLabelText('새 부서 이름')).toBeNull()
  expect(screen.queryByText(/한 명뿐이에요/)).toBeNull()
})

test('권한이 그대로인 이동은 바로 저장한다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-new/department`, () => json(response(true, { members: withMember('m-new', { departmentId: 'plan' }) })))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('정하늘 부서'), { target: { value: 'plan' } })
  await waitFor(() => expect(groupNames()).toEqual(['회장단', '기획부', '총무부']))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ departmentId: 'plan' }])
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('권한이 바뀌는 이동은 한 번 확인하고, 취소하면 보내지 않는다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-fin/department`, () => json(response(true, { members: withMember('m-fin', { departmentId: 'plan', title: null }) })))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('김민준 부서'), { target: { value: 'plan' } })
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('김민준을 기획부로 옮기면 구매 승인을 할 수 없게 돼요. 직책은 지워져요.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
  expect((screen.getByLabelText('김민준 부서') as HTMLSelectElement).value).toBe('fin')
  fireEvent.change(screen.getByLabelText('김민준 부서'), { target: { value: 'plan' } })
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '옮기기' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: '기획부' })).getByText('김민준')).toBeTruthy())
})

test('마지막 회장단을 옮기려 하면 안내하고 원래 값을 유지한다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-lead/department`, () => json({ error: 'LAST_LEADER' }, 409))
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('김바다 부서'), { target: { value: 'plan' } })
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '옮기기' }))
  expect((await screen.findByRole('alert')).textContent).toBe('회장단은 최소 한 명 있어야 해요. 다른 사람을 먼저 회장단으로 옮겨 주세요.')
  expect((screen.getByLabelText('김바다 부서') as HTMLSelectElement).value).toBe('lead')
})

test('그사이 회장단에서 빠졌으면 안내하고 목록을 다시 불러온다', async () => {
  let manage = true
  api.on('GET', `${base}/members`, () => json(response(manage)))
  api.on('POST', `${base}/members/m-new/department`, () => { manage = false; return json({ error: 'FORBIDDEN' }, 403) })
  render(<Harness />)
  fireEvent.change(await screen.findByLabelText('정하늘 부서'), { target: { value: 'plan' } })
  expect((await screen.findByRole('alert')).textContent).toBe('회장단만 바꿀 수 있어요.')
  await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull())
})

test('직책은 대화상자에서 고치고, 비우면 지운다', async () => {
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/members/m-plan/title`, call =>
    json(response(true, { members: withMember('m-plan', { title: (call.body as { title: string | null }).title }) })))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '박민수 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: ' 국장 ' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByText(/박민수/).textContent).toBe('박민수 · 국장')
  fireEvent.click(screen.getByRole('button', { name: '박민수 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: '' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.getByText(/박민수/).textContent).toBe('박민수'))
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ title: '국장' }, { title: null }])
})

test('회장단은 부서를 추가·편집하고, 지울 수 없는 부서는 대화상자 안에서 안내한다', async () => {
  const promo = (handlesFinance: boolean) => response(true, { departments: [...departments, { id: 'promo', name: '홍보부', isLeadership: false, handlesFinance }] })
  api.on('GET', `${base}/members`, () => json(response()))
  api.on('POST', `${base}/departments`, call => (call.body as { name: string }).name === '기획부' ? json({ error: 'DEPARTMENT_NAME_TAKEN' }, 409) : json(promo(false)))
  api.on('PATCH', `${base}/departments/promo`, () => json(promo(true)))
  api.on('POST', `${base}/departments/promo/delete`, () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  render(<Harness />)
  const input = await screen.findByLabelText('새 부서 이름')
  fireEvent.change(input, { target: { value: '기획부' } })
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect((await screen.findByRole('alert')).textContent).toBe('같은 이름의 부서가 있어요.')
  fireEvent.change(input, { target: { value: ' 홍보부 ' } })
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect(await screen.findByRole('region', { name: '홍보부' })).toBeTruthy()
  expect((screen.getByLabelText('새 부서 이름') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: '홍보부 편집' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByLabelText('구매 승인'))
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: '홍보부' })).getByText('구매 승인')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: '홍보부 편집' }))
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '부서 삭제' }))
  expect(await within(screen.getByRole('dialog')).findByText('구매요청 기록이 있어 지울 수 없어요. 이름을 바꿔 쓰세요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method !== 'GET').map(call => [call.method, call.path, call.body])).toEqual([
    ['POST', `${base}/departments`, { name: '기획부' }], ['POST', `${base}/departments`, { name: '홍보부' }],
    ['PATCH', `${base}/departments/promo`, { name: '홍보부', handlesFinance: true }], ['POST', `${base}/departments/promo/delete`, {}],
  ])
})

test('회장단 편집에는 구매 승인과 삭제가 없다', async () => {
  api.on('GET', `${base}/members`, () => json(response(true, { members: [members[0]!, { id: 'm-new', name: '정하늘', title: null, departmentId: 'lead' }] })))
  render(<Harness />)
  fireEvent.click(await screen.findByRole('button', { name: '회장단 편집' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('회장단은 지울 수 없고 이름만 바꿀 수 있어요.')).toBeTruthy()
  expect(within(dialog).queryByLabelText('구매 승인')).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '부서 삭제' })).toBeNull()
})

test('혼자이면 초대 링크를 목록 위에 보여 준다', async () => {
  api.on('GET', `${base}/members`, () => json(response(true, { members: [members[0]!] })))
  render(<Harness />)
  expect(await screen.findByText('아직 혼자예요')).toBeTruthy()
  expect(screen.getByLabelText('초대 코드')).toBeTruthy()
  expect(groupNames()).toEqual(['회장단', '기획부', '총무부'])
})

test('목록을 못 불러오면 다시 시도할 수 있다', async () => {
  let fail = true
  api.on('GET', `${base}/members`, () => fail ? json({ error: 'UNAVAILABLE' }, 503) : json(response()))
  render(<Harness />)
  expect((await screen.findByRole('alert')).textContent).toBe('구성원을 불러오지 못했어요.')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '구성원 4명' })).toBeTruthy()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/organization`
Expected: FAIL. `./members-view`, `./Members`를 찾지 못한다.

- [ ] **Step 3: 묶음·문장 도우미**

`apps/web/src/organization/members-view.ts`:

```ts
import type { DepartmentSummary, MemberSummary, MembershipPermissions } from '@vada/contracts'

export type MemberGroup = { key: string; department: DepartmentSummary | null; members: MemberSummary[] }
const collator = new Intl.Collator('ko')
const byTitleThenName = (a: MemberSummary, b: MemberSummary) =>
  Number(b.title !== null) - Number(a.title !== null) || collator.compare(a.name, b.name)

// 회장단을 맨 앞에, 나머지는 가나다순으로 둔다. 고르는 칸의 순서도 같다.
export function sortDepartments(departments: DepartmentSummary[]) {
  return [...departments].sort((a, b) => Number(b.isLeadership) - Number(a.isLeadership) || collator.compare(a.name, b.name))
}

// 미배정, 회장단, 나머지 부서 순서다. 묶음 안에서는 직책이 있는 사람이 먼저이고, 그다음 이름순이다.
export function groupMembers(departments: DepartmentSummary[], members: MemberSummary[]): MemberGroup[] {
  const unassigned = members.filter(member => member.departmentId === null).sort(byTitleThenName)
  return [
    ...(unassigned.length ? [{ key: 'unassigned', department: null, members: unassigned }] : []),
    ...sortDepartments(departments).map(department => ({ key: department.id, department,
      members: members.filter(member => member.departmentId === department.id).sort(byTitleThenName) })),
  ]
}

// 확인 대화상자를 띄울지 정할 때만 쓴다. 실제 권한은 서버가 정한다.
function permissionsOf(department: DepartmentSummary | null): MembershipPermissions {
  return { manageOrganization: department?.isLeadership ?? false, approvePurchases: Boolean(department?.isLeadership || department?.handlesFinance) }
}

// 마지막 글자에 받침이 있으면 앞의 조사를 붙인다. '으로'는 ㄹ 받침 뒤에서도 '로'를 쓴다.
function withParticle(word: string, afterBatchim: string, otherwise: string, rieulTakesOtherwise = false) {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const final = code >= 0 && code <= 11171 ? code % 28 : 0
  return word + (final !== 0 && !(rieulTakesOtherwise && final === 8) ? afterBatchim : otherwise)
}

// 권한이 바뀌는 이동만 확인한다. 권한은 없음 < 구매 승인 < 조직 관리·구매 승인 순서라, 얻거나 잃는 쪽 하나만 생긴다.
export function moveWarning(member: MemberSummary, from: DepartmentSummary | null, to: DepartmentSummary | null): string | null {
  const before = permissionsOf(from)
  const after = permissionsOf(to)
  const changed = [before.manageOrganization !== after.manageOrganization && '조직 관리', before.approvePurchases !== after.approvePurchases && '구매 승인']
    .filter((item): item is string => Boolean(item))
  if (!changed.length) return null
  const gains = (after.approvePurchases && !before.approvePurchases) || (after.manageOrganization && !before.manageOrganization)
  const sentence = `${withParticle(member.name, '을', '를')} ${withParticle(to?.name ?? '미배정', '으로', '로', true)} 옮기면 `
    + `${withParticle(changed.join('와 '), '을', '를')} 할 수 ${gains ? '있게' : '없게'} 돼요.`
  return member.title ? `${sentence} 직책은 지워져요.` : sentence
}
```

- [ ] **Step 4: 데이터 훅**

`apps/web/src/organization/useOrganizationMembers.ts`:

```ts
import { useEffect, useRef, useState } from 'react'
import type { OrganizationMembersResponse } from '@vada/contracts'

const isMembers = (body: unknown): body is OrganizationMembersResponse => typeof body === 'object' && body !== null
  && Array.isArray((body as OrganizationMembersResponse).members) && Array.isArray((body as OrganizationMembersResponse).departments)

// enabled가 거짓이면 불러오지 않는다. 회장단이 아니면 구성원 화면을 열 때만 불러온다.
export function useOrganizationMembers(organizationId: string, enabled: boolean) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}`
  const [data, setData] = useState<OrganizationMembersResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const active = useRef(true)
  useEffect(() => () => { active.current = false }, [])

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    setLoadError(false)
    async function load() {
      try {
        const response = await fetch(`${base}/members`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('Members lookup failed')
        const body: unknown = await response.json()
        if (!isMembers(body)) throw new Error('Invalid response')
        if (!controller.signal.aborted) setData(body)
      } catch {
        if (!controller.signal.aborted) setLoadError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [base, enabled, attempt])

  // 회장단 전용 변경은 목록 전체를 돌려준다. 실패하면 오류 코드를, 성공하면 null을 돌려준다.
  async function mutate(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<string | null> {
    setSaving(true)
    try {
      const response = await fetch(`${base}${path}`, { method, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        // 권한이 사라졌거나 대상이 없어졌으면 화면이 오래된 것이다. 목록을 새로 불러온다.
        if (response.status === 403 || response.status === 404) setAttempt(value => value + 1)
        const code = (result as { error?: unknown } | null)?.error
        return response.status < 500 && typeof code === 'string' ? code : 'FAILED'
      }
      if (!isMembers(result)) return 'FAILED'
      if (active.current) setData(result)
      return null
    } catch {
      return 'FAILED'
    } finally {
      if (active.current) setSaving(false)
    }
  }

  return { data, loadError, saving, mutate, refresh: () => setAttempt(value => value + 1) }
}
export type OrganizationMembers = ReturnType<typeof useOrganizationMembers>
```

- [ ] **Step 5: 구성원 화면**

`apps/web/src/organization/Members.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { Pencil, Plus, UserPlus, Users } from 'lucide-react'
import { CreateDepartmentSchema, UpdateDepartmentSchema, UpdateMemberTitleSchema,
  type DepartmentSummary, type MemberSummary, type UpdateDepartmentRequest } from '@vada/contracts'
import InviteShare from '../access/InviteShare'
import { Avatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { groupMembers, moveWarning, sortDepartments } from './members-view'
import type { OrganizationMembers } from './useOrganizationMembers'

const messages: Record<string, string> = {
  LAST_LEADER: '회장단은 최소 한 명 있어야 해요. 다른 사람을 먼저 회장단으로 옮겨 주세요.',
  DEPARTMENT_NAME_TAKEN: '같은 이름의 부서가 있어요.',
  DEPARTMENT_NOT_EMPTY: '구성원이 있는 부서는 지울 수 없어요. 먼저 다른 부서로 옮겨 주세요.',
  DEPARTMENT_IN_USE: '구매요청 기록이 있어 지울 수 없어요. 이름을 바꿔 쓰세요.',
  FORBIDDEN: '회장단만 바꿀 수 있어요.',
  NOT_FOUND: '이미 바뀌었어요. 목록을 새로 불러왔어요.',
}
const failure = '저장하지 못했어요. 다시 시도해 주세요.'
type Move = { member: MemberSummary; to: DepartmentSummary | null; text: string }

// 와이어프레임 ORG-03A·B의 조직도 대신 부서별 목록이다. 휴대폰에서도 쓰고, 끌기 없이 고르는 칸으로 배정한다.
export default function Members({ inviteCode, state }: { inviteCode: string; state: OrganizationMembers }) {
  const { data, loadError, saving, mutate, refresh } = state
  const [message, setMessage] = useState('')
  const [move, setMove] = useState<Move | null>(null)
  const [editing, setEditing] = useState<DepartmentSummary | null>(null)
  const [titling, setTitling] = useState<MemberSummary | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [newName, setNewName] = useState('')
  if (!data) return <div className="p-4 sm:p-6">{loadError
    ? <Card className="flex flex-col gap-3 p-6"><StateMessage kind="error">구성원을 불러오지 못했어요.</StateMessage>
      <Button variant="outline" className="self-start" onClick={refresh}>다시 시도</Button></Card>
    : <StateMessage kind="loading">구성원 불러오는 중…</StateMessage>}</div>
  const current = data
  const manage = current.viewer.permissions.manageOrganization
  const departments = sortDepartments(current.departments)
  const leaders = current.members.filter(member => departments.some(department => department.isLeadership && department.id === member.departmentId)).length
  const newDepartment = CreateDepartmentSchema.safeParse({ name: newName })

  // 성공하면 true다. 실패하면 문구를 보여 주고, 목록은 서버 값 그대로 두어 고르는 칸이 원래 값으로 돌아간다.
  async function run(method: 'POST' | 'PATCH', path: string, body: unknown) {
    setMessage('')
    const code = await mutate(method, path, body)
    if (code) setMessage(messages[code] ?? failure)
    return code === null
  }
  function assign(member: MemberSummary, to: DepartmentSummary | null) {
    void run('POST', `/members/${encodeURIComponent(member.id)}/department`, { departmentId: to?.id ?? null })
  }
  function choose(member: MemberSummary, value: string) {
    const to = departments.find(department => department.id === value) ?? null
    const from = departments.find(department => department.id === member.departmentId) ?? null
    const text = moveWarning(member, from, to)
    if (text) setMove({ member, to, text })
    else assign(member, to)
  }
  async function addDepartment(event: FormEvent) {
    event.preventDefault()
    if (newDepartment.success && await run('POST', '/departments', newDepartment.data)) setNewName('')
  }
  function openDialog(open: () => void) { setMessage(''); open() }

  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">구성원 {current.members.length}명</h2>
        <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}><UserPlus />초대</Button>
      </div>
      {manage && leaders === 1 && <Alert tone="warning">회장단이 한 명뿐이에요. 자리를 비울 때를 대비해 한 명 더 두세요.</Alert>}
      {current.members.length === 1 && <Card className="flex flex-col gap-4 p-6">
        <EmptyState icon={Users} title="아직 혼자예요" description="링크를 보내 구성원을 모으세요." className="py-4" />
        <InviteShare code={inviteCode} />
      </Card>}
      {message && !editing && !titling && <StateMessage kind="error">{message}</StateMessage>}
      {groupMembers(current.departments, current.members).map(group => {
        const name = group.department?.name ?? '미배정'
        return <Card key={group.key} className="overflow-hidden">
          <section aria-label={name}>
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <h3 className="text-sm font-semibold wrap-anywhere text-gray-900">{name}</h3>
              <span className="text-xs text-gray-400">{group.members.length}명</span>
              {group.department?.isLeadership && <Badge tone="info">조직 관리</Badge>}
              {(group.department?.isLeadership || group.department?.handlesFinance) && <Badge tone="info">구매 승인</Badge>}
              {!group.department && manage && <Badge tone="warning">배정이 필요해요</Badge>}
              {group.department && manage && <Button variant="ghost" size="icon" className="ml-auto" aria-label={`${name} 편집`}
                onClick={() => openDialog(() => setEditing(group.department))}><Pencil /></Button>}
            </div>
            {group.members.length > 0 && <ul className="divide-y">
              {group.members.map(member => <li key={member.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Avatar />
                  <p className="min-w-0 text-sm wrap-anywhere text-gray-800">{member.name}
                    {member.title && <span className="text-gray-500"> · {member.title}</span>}</p>
                </div>
                {manage && <div className="flex items-center gap-2">
                  <NativeSelect aria-label={`${member.name} 부서`} className="sm:w-40" value={member.departmentId ?? ''} disabled={saving}
                    onChange={event => choose(member, event.target.value)}>
                    <option value="">미배정</option>
                    {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </NativeSelect>
                  <Button variant="outline" size="sm" aria-label={`${member.name} 직책`} disabled={saving}
                    onClick={() => openDialog(() => setTitling(member))}>직책</Button>
                </div>}
              </li>)}
            </ul>}
          </section>
        </Card>
      })}
      {manage && <form className="flex gap-2" onSubmit={event => { void addDepartment(event) }}>
        <Input aria-label="새 부서 이름" placeholder="새 부서 이름" value={newName} onChange={event => setNewName(event.target.value)} />
        <Button type="submit" variant="outline" disabled={!newDepartment.success || saving}><Plus />부서 추가</Button>
      </form>}
    </div>
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>구성원 초대</DialogTitle>
          <DialogDescription>링크나 코드를 공유하면 학생회에 참여할 수 있어요. 참여한 사람은 미배정으로 등록돼요.</DialogDescription></DialogHeader>
        <InviteShare code={inviteCode} />
      </DialogContent>
    </Dialog>
    <Dialog open={move !== null} onOpenChange={open => { if (!open) setMove(null) }}>
      <DialogContent>
        <DialogHeader><DialogTitle>부서를 옮길까요?</DialogTitle><DialogDescription>{move?.text}</DialogDescription></DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setMove(null)}>취소</Button>
          <Button onClick={() => { if (move) assign(move.member, move.to); setMove(null) }}>옮기기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {editing && <DepartmentDialog key={editing.id} department={editing} saving={saving} error={message}
      memberCount={current.members.filter(member => member.departmentId === editing.id).length} onClose={() => setEditing(null)}
      onSave={input => { void run('PATCH', `/departments/${encodeURIComponent(editing.id)}`, input).then(done => { if (done) setEditing(null) }) }}
      onDelete={() => { void run('POST', `/departments/${encodeURIComponent(editing.id)}/delete`, {}).then(done => { if (done) setEditing(null) }) }} />}
    {titling && <TitleDialog key={titling.id} member={titling} saving={saving} error={message} onClose={() => setTitling(null)}
      onSave={title => { void run('POST', `/members/${encodeURIComponent(titling.id)}/title`, { title }).then(done => { if (done) setTitling(null) }) }} />}
  </div>
}

function DepartmentDialog({ department, memberCount, saving, error, onSave, onDelete, onClose }: {
  department: DepartmentSummary; memberCount: number; saving: boolean; error: string
  onSave: (input: UpdateDepartmentRequest) => void; onDelete: () => void; onClose: () => void
}) {
  const [name, setName] = useState(department.name)
  const [finance, setFinance] = useState(department.handlesFinance)
  const parsed = UpdateDepartmentSchema.safeParse({ name, handlesFinance: finance })
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{department.isLeadership ? '회장단 편집' : '부서 편집'}</DialogTitle>
        <DialogDescription>{department.isLeadership ? '회장단은 지울 수 없고 이름만 바꿀 수 있어요.' : '구매 승인을 켜면 이 부서 사람도 구매요청을 승인해요.'}</DialogDescription>
      </DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); if (parsed.success) onSave(parsed.data) }}>
        <Label className="flex flex-col gap-2">이름<Input value={name} onChange={event => setName(event.target.value)} /></Label>
        {!department.isLeadership && <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="size-4 accent-blue-600" checked={finance} onChange={event => setFinance(event.target.checked)} />구매 승인</label>}
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          {!department.isLeadership && memberCount === 0 && <Button type="button" variant="destructive" className="mr-auto" disabled={saving}
            onClick={onDelete}>부서 삭제</Button>}
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!parsed.success || saving}>저장</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

function TitleDialog({ member, saving, error, onSave, onClose }: {
  member: MemberSummary; saving: boolean; error: string; onSave: (title: string | null) => void; onClose: () => void
}) {
  const [title, setTitle] = useState(member.title ?? '')
  // 비우고 저장하면 직책을 지운다.
  const parsed = UpdateMemberTitleSchema.safeParse({ title: title.trim() ? title : null })
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{member.name} 직책</DialogTitle><DialogDescription>비우고 저장하면 직책을 지워요.</DialogDescription></DialogHeader>
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); if (parsed.success) onSave(parsed.data.title) }}>
        <Label className="flex flex-col gap-2">직책<Input value={title} placeholder="예: 회장, 국장, 총무" onChange={event => setTitle(event.target.value)} /></Label>
        {error && <StateMessage kind="error">{error}</StateMessage>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={!parsed.success || saving}>저장</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
```

- [ ] **Step 6: 통과 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/organization`
Expected: PASS(테스트 13개).

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/organization
git commit -m "부서별 구성원 화면 추가" -m "조직도 대신 목록과 고르는 칸으로 배정한다. 권한이 바뀌는 이동만 한 번 확인한다."
```

---

### Task 6: 사이드바와 화면 전환

**Files:**
- Modify: `apps/web/src/workspace/Workspace.tsx`, `apps/web/src/workspace/WorkspaceSidebar.tsx`, `apps/web/src/workspace/WorkspaceHeader.tsx`
- Test: `apps/web/src/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes: Task 5 `Members`, `useOrganizationMembers`, Task 3 `MembershipSummary.permissions`·`title`.
- Produces:
  - `Workspace`의 새 props `initialView?: 'events' | 'members'`, `onMembershipsChanged?: () => void`
  - `WorkspaceSidebar`의 새 props `membersActive: boolean`, `unassignedCount: number | null`, `onMembers: () => void`
  - `WorkspaceHeader`의 새 prop `section: string`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/workspace/Workspace.test.tsx`:
- `financeMembership` 아래에 추가:

```ts
const leaderMembership: MembershipSummary = { ...membership, department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true }, title: '회장', permissions: { manageOrganization: true, approvePurchases: true } }
const membersBody = { viewer: membership, departments: [{ id: 'd1', name: '기획부', isLeadership: false, handlesFinance: false }],
  members: [{ id: 'm1', name: '테스터', title: null, departmentId: 'd1' }] }
```

- `setup()`을 다음으로 바꾼다.

```ts
function setup(members: unknown = membersBody) {
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/events')
    ? { events: [event, { ...event, id: 'e2', name: '축제' }] }
    : url.endsWith('/members') ? members
    : url.endsWith('/messages') ? { messages: [], nextCursor: null } : { requests: [], nextCursor: null } }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
```

- `'an unassigned member sees 미배정 and no finance badge'` 테스트의 `expect(screen.queryByText('재정 담당')).toBeNull()`을 `expect(screen.queryByText('구매 승인')).toBeNull()`으로 바꾼다.
- 파일 끝에 추가:

```tsx
const membersButton = () => within(screen.getByRole('navigation', { name: '학생회 메뉴' })).getByRole('button')

test('구성원 메뉴는 구성원 화면을 열고, 행사를 고르면 행사 화면으로 돌아간다', async () => {
  const fetcher = setup()
  render(<Workspace {...props} />)
  expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/members'))).toBe(false)
  fireEvent.click(membersButton())
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 1, name: '구성원' })).toBeTruthy()
  expect(membersButton().getAttribute('aria-current')).toBe('page')
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  expect(screen.getByRole('heading', { level: 1, name: '체육대회' })).toBeTruthy()
})

test('회장단은 미배정 수와 구매 승인 표시를 보고, 구매요청 검토 보기를 쓴다', async () => {
  setup({ viewer: leaderMembership, departments: [{ id: 'lead', name: '회장단', isLeadership: true, handlesFinance: false }],
    members: [{ id: 'm1', name: '테스터', title: '회장', departmentId: 'lead' }, { id: 'm2', name: '새내기', title: null, departmentId: null }] })
  render(<Workspace {...props} memberships={[leaderMembership]} />)
  expect(await within(screen.getByRole('navigation', { name: '학생회 메뉴' })).findByText('미배정 1')).toBeTruthy()
  expect(screen.getByText('구매 승인')).toBeTruthy()
  expect(screen.getByText('회장단 · 회장')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  expect(await screen.findByRole('button', { name: '재정부 제출 요청 보기' })).toBeTruthy()
})

test('구성원 목록의 본인 정보가 다르면 소속을 다시 불러온다', async () => {
  setup({ ...membersBody, viewer: { ...membership, department: null } })
  const onMembershipsChanged = vi.fn()
  render(<Workspace {...props} onMembershipsChanged={onMembershipsChanged} />)
  fireEvent.click(membersButton())
  await waitFor(() => expect(onMembershipsChanged).toHaveBeenCalledOnce())
})

test('방금 만든 학생회는 구성원 화면부터 연다', async () => {
  setup()
  render(<Workspace {...props} initialOrganizationId="o1" initialView="members" />)
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/workspace/Workspace.test.tsx`
Expected: FAIL. "학생회 메뉴" 묶음이 없다.

- [ ] **Step 3: 머리글**

`apps/web/src/workspace/WorkspaceHeader.tsx`:
- `type Props`를 `{ councilName: string; section: string; title: string; onMenu: () => void }`로 바꾼다.
- 함수 인자에 `section`을 더하고, `<span className="shrink-0 text-gray-600">행사</span>`를 `<span className="shrink-0 text-gray-600">{section}</span>`로 바꾼다.

- [ ] **Step 4: 사이드바**

`apps/web/src/workspace/WorkspaceSidebar.tsx`:
- import를 `import { LogOut, UserPlus, Users } from 'lucide-react'`로 바꾸고 `import { NavItem } from '@/components/ui/nav-item'`을 더한다.
- `type Props`를 다음으로 바꾼다.

```ts
type Props = AccountProps & { membership: MembershipSummary; memberships: MembershipSummary[]; onMembershipChange: (id: string) => void
  membersActive: boolean; unassignedCount: number | null; onMembers: () => void; children: ReactNode }
```

- 함수 인자에 `membersActive, unassignedCount, onMembers`를 더한다.
- `</section>`(내 소속 묶음 끝) 바로 뒤에 추가:

```tsx
    <nav aria-label="학생회 메뉴" className="shrink-0 border-b border-gray-100 px-2 py-2">
      <NavItem active={membersActive} className="flex items-center gap-2" onClick={onMembers}>
        <Users aria-hidden className="size-4" />구성원
        {unassignedCount ? <Badge tone="warning" className="ml-auto">미배정 {unassignedCount}</Badge> : null}
      </NavItem>
    </nav>
```

- footer의 부서 줄을 다음으로 바꾼다.

```tsx
        <p className="flex flex-wrap items-center gap-1 text-xs text-gray-400">{membership.department?.name ?? '미배정'}{membership.title && ` · ${membership.title}`}
          {membership.permissions.approvePurchases && <Badge tone="info">구매 승인</Badge>}</p>
```

- [ ] **Step 5: 작업 공간**

`apps/web/src/workspace/Workspace.tsx`:
- import에 다음을 더한다.

```ts
import Members from '../organization/Members'
import { useOrganizationMembers } from '../organization/useOrganizationMembers'
```

- `type Props`와 `Workspace` 함수를 다음으로 바꾼다.

```tsx
type View = 'events' | 'members'
type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string; initialView?: View; onMembershipsChanged?: () => void }
export default function Workspace({ initialOrganizationId, initialView, ...props }: Props) {
  // 초대로 방금 참여했거나 방금 만든 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
  const membership = props.memberships.find(item => item.id === membershipId) ?? props.memberships[0]
  if (!membership) return null
  return <CouncilWorkspace key={`${membership.id}:${membership.organization.id}`} {...props} membership={membership} onMembershipChange={setMembershipId}
    initialView={membership.organization.id === initialOrganizationId ? initialView : undefined} />
}

// 본인 소속이 서버와 다른지 본다. 부서·직책·권한이 바뀌었을 때만 소속을 다시 불러온다.
function sameMembership(a: MembershipSummary, b: MembershipSummary) {
  return a.department?.id === b.department?.id && a.department?.name === b.department?.name && a.title === b.title
    && a.permissions.manageOrganization === b.permissions.manageOrganization && a.permissions.approvePurchases === b.permissions.approvePurchases
}
```

- `CouncilWorkspace`의 시그니처와 앞부분을 다음으로 바꾼다.

```tsx
function CouncilWorkspace({ membership, onMembershipChange, initialView, onMembershipsChanged, ...props }: Omit<Props, 'initialOrganizationId'> & { membership: MembershipSummary; onMembershipChange: (id: string) => void }) {
  const events = useEvents(membership.organization.id)
  const [view, setView] = useState<View>(initialView ?? 'events')
  // 회장단은 사이드바에 미배정 수를 보여 주려고 처음부터 불러온다. 다른 사람은 구성원 화면을 열 때 불러온다.
  const members = useOrganizationMembers(membership.organization.id, membership.permissions.manageOrganization || view === 'members')
  const viewer = members.data?.viewer
  // 구성원 화면에서 본인 부서가 바뀌면 소속을 다시 불러와 사이드바와 재정 화면이 새 권한을 따르게 한다.
  useEffect(() => {
    if (viewer && !sameMembership(viewer, membership)) onMembershipsChanged?.()
  }, [viewer, membership, onMembershipsChanged])
```

- `select` 함수를 다음으로 바꾸고 `openMembers`를 더한다.

```tsx
  function select(event: EventSummary) {
    // 구성원 화면에서는 입력 중인 구매요청이 없으므로 묻지 않고 행사 화면으로 간다.
    if (view === 'members') { setSelected(event); setView('events') }
    else if (event.id !== selected?.id && canLeave()) setSelected(event)
    setNavOpen(false)
  }
  function openMembers() {
    if (view !== 'members' && canLeave()) { setView('members'); members.refresh() }
    setNavOpen(false)
  }
```

- `sidebar`의 `WorkspaceSidebar`에 props를 더하고, `EventList`의 `selectedId`를 바꾼다.

```tsx
  const unassigned = membership.permissions.manageOrganization && members.data ? members.data.members.filter(member => member.departmentId === null).length : null
  const sidebar = <WorkspaceSidebar {...props} onLogout={() => { if (canLeave()) props.onLogout() }} membership={membership}
    onMembershipChange={id => { if (canLeave()) onMembershipChange(id) }}
    membersActive={view === 'members'} unassignedCount={unassigned} onMembers={openMembers}>
    <EventList events={events.events} loading={events.loading} error={events.loadError} saving={events.saving}
      selectedId={view === 'events' ? selected?.id : undefined} onSelect={select} onRefresh={events.refresh} onCreate={() => { setNavOpen(false); setCreateOpen(true) }} />
  </WorkspaceSidebar>
```

- 머리글과 본문을 다음으로 바꾼다.

```tsx
      <WorkspaceHeader councilName={membership.organization.name} section={view === 'members' ? '구성원' : '행사'}
        title={view === 'members' ? '구성원' : selected?.name ?? '행사'} onMenu={() => setNavOpen(true)} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'members' ? <Members inviteCode={membership.organization.inviteCode} state={members} />
          : selected ? <EventWorkspace key={selected.id} event={selected} handlesFinance={membership.permissions.approvePurchases} onLeaveRiskChange={setLeaveRisk} />
          : <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><Card>
            <EmptyState icon={CalendarDays} title="행사를 선택해 주세요" description="왼쪽에서 행사를 선택하거나 새 행사를 만들어 대화를 시작하세요." />
          </Card></div>}
      </main>
```

- [ ] **Step 6: 통과 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/workspace src/organization src/App.test.tsx src/App.integration.test.tsx`
Expected: PASS.

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add apps/web/src/workspace
git commit -m "사이드바에 구성원 메뉴와 구매 승인 표시 추가" -m "회장단은 미배정 수를 보고, 재정 화면은 권한으로 보인다. 본인 부서가 바뀌면 소속을 다시 불러온다."
```

---

### Task 7: 학생회 만들기와 소속 다시 불러오기

**Files:**
- Create: `apps/web/src/organization/CreateOrganization.tsx`, `apps/web/src/organization/CreateOrganization.test.tsx`
- Modify: `apps/web/src/access/InviteCodeForm.tsx`, `apps/web/src/access/Memberships.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/access/Memberships.test.tsx`, `apps/web/src/App.integration.test.tsx`

**Interfaces:**
- Consumes: Task 2 `CreateOrganizationSchema`, `LEADERSHIP_DEFAULT_NAME`, `CreateOrganizationResponse`, Task 6 `Workspace`의 `initialView`·`onMembershipsChanged`.
- Produces:
  - `CreateOrganization({ onCreated(organizationId), onCancel })`
  - `InviteCodeForm`의 선택 prop `onCreate?: () => void`
  - `Memberships`의 `renderMemberships(memberships, refresh)`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/organization/CreateOrganization.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import { membership } from '../test-support/workflow-fixtures'
import CreateOrganization from './CreateOrganization'

let api: ReturnType<typeof mockApi>
beforeEach(() => { api = mockApi() })
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
const submit = () => screen.getByRole('button', { name: '학생회 만들기' }) as HTMLButtonElement

test('기본 부서를 채워 두고, 이름을 적어야 만들 수 있다', () => {
  render(<CreateOrganization onCreated={vi.fn()} onCancel={vi.fn()} />)
  expect(screen.getByText('학생회가 이미 VADA를 쓰고 있다면 초대 링크로 참여하세요.')).toBeTruthy()
  expect(screen.getByText('항상 있어요')).toBeTruthy()
  expect([1, 2, 3, 4].map(n => (screen.getByLabelText(`부서 ${n} 이름`) as HTMLInputElement).value)).toEqual(['총무부', '기획부', '홍보부', '복지부'])
  expect(screen.getAllByText('구매 승인')).toHaveLength(1)
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '  ' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '제12대 학생회' } })
  expect(submit().disabled).toBe(false)
})

test('겹치는 이름이나 회장단은 막고, 빈 줄과 뺀 줄은 보내지 않는다', async () => {
  const onCreated = vi.fn()
  api.on('POST', '/api/organizations/create', () => json({ membership: { ...membership(), organization: { id: 'new', name: '제12대 학생회', inviteCode: 'ABCD2345' } } }, 201))
  render(<CreateOrganization onCreated={onCreated} onCancel={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: ' 제12대 학생회 ' } })
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: ' 총무부' } })
  expect(screen.getByText('부서 이름이 겹쳐요.')).toBeTruthy()
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: '회장단' } })
  expect(submit().disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('부서 2 이름'), { target: { value: '사무국' } })
  fireEvent.click(screen.getByRole('button', { name: '총무부 빼기' }))
  expect(screen.queryByText('구매 승인')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '부서 추가' }))
  expect(document.activeElement).toBe(screen.getByLabelText('부서 4 이름'))
  fireEvent.click(submit())
  await waitFor(() => expect(onCreated).toHaveBeenCalledWith('new'))
  expect(api.calls.map(call => call.body)).toEqual([{ name: '제12대 학생회', departments: [
    { name: '사무국', handlesFinance: false }, { name: '홍보부', handlesFinance: false }, { name: '복지부', handlesFinance: false }] }])
})

test('실패하면 입력을 그대로 두고 다시 시도할 수 있다', async () => {
  api.on('POST', '/api/organizations/create', () => json({ error: 'UNAVAILABLE' }, 503))
  const onCancel = vi.fn()
  render(<CreateOrganization onCreated={vi.fn()} onCancel={onCancel} />)
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '제12대 학생회' } })
  fireEvent.click(submit())
  expect((await screen.findByRole('alert')).textContent).toBe('학생회를 만들지 못했어요. 다시 시도해 주세요.')
  expect((screen.getByLabelText('학생회 이름') as HTMLInputElement).value).toBe('제12대 학생회')
  expect(submit().disabled).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(onCancel).toHaveBeenCalledOnce()
})
```

`apps/web/src/access/Memberships.test.tsx`:
- 28행 `expect(renderMemberships).toHaveBeenCalledWith([planner])`를 `expect(renderMemberships).toHaveBeenCalledWith([planner], expect.any(Function))`로 바꾼다. 이제 두 번째 인자로 `refresh`를 넘긴다.
- 끝에 추가:

```tsx
test('refresh는 화면을 그대로 둔 채 소속을 다시 불러온다', async () => {
  const responses = [[planner], [{ ...planner, title: '국장' }]]
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({ ok: true, json: async () => ({ memberships: responses.shift() }) })))
  let refresh = () => {}
  render(<Memberships renderMemberships={(memberships, reload) => { refresh = reload; return <p>직책: {memberships[0]?.title ?? '없음'}</p> }} />)
  expect(await screen.findByText('직책: 없음')).toBeTruthy()
  act(() => refresh())
  expect(screen.queryByText('소속 확인 중…')).toBeNull()
  expect(await screen.findByText('직책: 국장')).toBeTruthy()
})
```

이 파일 맨 위 `@testing-library/react` import에 `act`가 없으면 더한다.

`apps/web/src/App.integration.test.tsx` 끝에 추가:

```tsx
test('소속이 없으면 학생회를 만들고, 구성원 화면에서 초대를 시작한다', async () => {
  const leader = { ...membership(), department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true },
    permissions: { manageOrganization: true, approvePurchases: true } }
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('POST', '/api/organizations/create', () => {
    api.on('GET', '/api/me/memberships', () => json({ memberships: [leader] }))
    return json({ membership: leader }, 201)
  })
  api.on('GET', '/api/organizations/o/members', () => json({ viewer: leader,
    departments: [leader.department, { id: 'fin', name: '총무부', isLeadership: false, handlesFinance: true }],
    members: [{ id: 'mp', name: '기획 테스터', title: null, departmentId: 'lead' }] }))
  render(<App />)
  await screen.findByLabelText('초대 코드')
  expect(screen.getByText('학생회를 처음 시작하나요?')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 학생회 만들기' }))
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '테스트 학생회' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
  expect(screen.getByText('아직 혼자예요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ name: '테스트 학생회', departments: [
    { name: '총무부', handlesFinance: true }, { name: '기획부', handlesFinance: false }, { name: '홍보부', handlesFinance: false },
    { name: '복지부', handlesFinance: false }] }])
})

test('만들기를 취소하면 코드 입력으로 돌아간다', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '새 학생회 만들기' }))
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(await screen.findByLabelText('초대 코드')).toBeTruthy()
})
```

- [ ] **Step 2: 실패 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/organization/CreateOrganization.test.tsx src/access/Memberships.test.tsx src/App.integration.test.tsx`
Expected: FAIL. `./CreateOrganization`이 없고, "새 학생회 만들기" 버튼이 없으며, `renderMemberships`가 두 번째 인자를 받지 않는다.

- [ ] **Step 3: 만들기 화면**

`apps/web/src/organization/CreateOrganization.tsx`:

```tsx
import { useRef, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { CreateOrganizationSchema, LEADERSHIP_DEFAULT_NAME, type CreateOrganizationRequest, type CreateOrganizationResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Row = { key: number; name: string; handlesFinance: boolean }
// 확인한 학생회 세 곳에 공통으로 많았던 부서. 돈을 맡는 총무부만 구매를 승인한다.
const defaults: Row[] = [
  { key: 0, name: '총무부', handlesFinance: true }, { key: 1, name: '기획부', handlesFinance: false },
  { key: 2, name: '홍보부', handlesFinance: false }, { key: 3, name: '복지부', handlesFinance: false },
]

// 와이어프레임 ORG-01·02를 한 화면으로 줄였다. 학교·유형·연도는 M1에서 쓰지 않아 받지 않는다.
export default function CreateOrganization({ onCreated, onCancel }: { onCreated: (organizationId: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [rows, setRows] = useState(defaults)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const nextKey = useRef(defaults.length)
  // 빈 줄은 보내지 않는다. 버튼 활성화는 서버와 같은 스키마로 판단한다.
  const departments = rows.filter(row => row.name.trim()).map(({ name: department, handlesFinance }) => ({ name: department, handlesFinance }))
  const parsed = CreateOrganizationSchema.safeParse({ name, departments })
  const names = departments.map(department => department.name.trim())
  const duplicate = new Set(names).size !== names.length || names.includes(LEADERSHIP_DEFAULT_NAME)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!parsed.success || saving) return
    setSaving(true)
    setFailed(false)
    try {
      const body: CreateOrganizationRequest = parsed.data
      const response = await fetch('/api/organizations/create', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (response.status !== 201) throw new Error('Create failed')
      const result = await response.json() as CreateOrganizationResponse
      if (!result.membership?.organization?.id) throw new Error('Invalid response')
      onCreated(result.membership.organization.id)
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  return <form aria-label="새 학생회 만들기" className="flex flex-col gap-5" onSubmit={event => { void submit(event) }}>
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">새 학생회 만들기</h2>
      <Alert tone="info">학생회가 이미 VADA를 쓰고 있다면 초대 링크로 참여하세요.</Alert>
    </div>
    <Label className="flex flex-col gap-2">학생회 이름
      <Input value={name} placeholder="예: 제12대 소프트웨어융합대학 학생회" onChange={event => setName(event.target.value)} />
    </Label>
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium text-gray-700">부서</legend>
      <p className="flex items-center gap-2 rounded-sm bg-gray-50 px-3 py-2 text-sm text-gray-700">회장단<span className="text-xs text-gray-400">항상 있어요</span></p>
      {rows.map((row, index) => <div key={row.key} className="flex items-center gap-2">
        <Input aria-label={`부서 ${index + 1} 이름`} value={row.name} autoFocus={row.key >= defaults.length}
          onChange={event => setRows(rows.map(item => item.key === row.key ? { ...item, name: event.target.value } : item))} />
        {row.handlesFinance && <Badge tone="info">구매 승인</Badge>}
        <Button type="button" variant="ghost" size="icon" aria-label={`${row.name.trim() || `부서 ${index + 1}`} 빼기`}
          onClick={() => setRows(rows.filter(item => item.key !== row.key))}><X /></Button>
      </div>)}
      <Button type="button" variant="outline" size="sm" className="self-start"
        onClick={() => setRows([...rows, { key: nextKey.current++, name: '', handlesFinance: false }])}><Plus />부서 추가</Button>
      {duplicate && <StateMessage kind="error">부서 이름이 겹쳐요.</StateMessage>}
      <p className="text-xs text-gray-400">구매 승인 부서는 나중에 바꿀 수 있어요.</p>
    </fieldset>
    {failed && <StateMessage kind="error">학생회를 만들지 못했어요. 다시 시도해 주세요.</StateMessage>}
    <div className="flex gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>취소</Button>
      <Button type="submit" className="flex-1" disabled={!parsed.success || saving}>{saving ? '만드는 중…' : '학생회 만들기'}</Button>
    </div>
  </form>
}
```

- [ ] **Step 4: 코드 입력의 만들기 입구**

`apps/web/src/access/InviteCodeForm.tsx`:
- `type Props`를 `{ initialCode: string; onSubmit: (code: string) => void; onCreate?: () => void }`로 바꾸고, 함수 인자에 `onCreate`를 더한다.
- `return <form ...>...</form>`을 fragment로 감싸고, `</form>` 뒤에 다음을 더한다.

```tsx
    {onCreate && <div className="flex flex-col items-center gap-1 border-t pt-4 text-center">
      <p className="text-sm text-gray-500">학생회를 처음 시작하나요?</p>
      <Button type="button" variant="link" onClick={onCreate}>새 학생회 만들기</Button>
    </div>}
```

- [ ] **Step 5: 소속 다시 불러오기와 재정 표시**

`apps/web/src/access/Memberships.tsx`:
- `renderMemberships` 타입 앞에 주석을 달고 타입을 바꾼다.

```ts
  // refresh는 화면을 그대로 둔 채 소속만 다시 불러온다(본인 부서가 바뀌었을 때).
  renderMemberships?: (memberships: MembershipSummary[], refresh: () => void) => ReactNode
```

- 효과 안의 `setResult(null)` 줄을 지운다. 첫 화면은 원래 `null`이고, 다시 불러오는 동안에는 이전 소속을 그대로 보여 준다.
- `if (failed) return renderFallback(...)`을 `if (failed && !result) return renderFallback(...)`로 바꾼다. 다시 불러오기가 실패하면 이전 소속을 그대로 둔다.
- `renderMemberships(result.memberships)`를 `renderMemberships(result.memberships, () => setAttempt(value => value + 1))`로 바꾼다.
- 소속 목록의 재정 표시를 다음으로 바꾼다.

```tsx
        {membership.permissions.approvePurchases && <span className="text-xs text-gray-500"> (구매 승인)</span>}
```

- [ ] **Step 6: App 연결**

`apps/web/src/App.tsx`:
- import에 `import CreateOrganization from './organization/CreateOrganization'`을 더한다.
- `type Invite` 아래에 추가:

```ts
// 참여나 만들기로 방금 연 학생회. 만든 학생회는 구성원 화면부터 연다.
type Opened = { organizationId: string; view: 'events' | 'members' }
```

- `const [joinedOrganizationId, setJoinedOrganizationId] = useState<string>()`를 다음 두 줄로 바꾼다.

```ts
  const [opened, setOpened] = useState<Opened>()
  const [creating, setCreating] = useState(false)
```

- `finishInvite`의 `setJoinedOrganizationId(organizationId)`를 `setOpened({ organizationId, view: 'events' })`로 바꾼다.
- `<Memberships ...>`를 다음으로 바꾼다.

```tsx
        : <Memberships key={`${session.user.id}:${opened?.organizationId ?? ''}`}
          renderMemberships={(memberships, refresh) => <Workspace memberships={memberships} initialOrganizationId={opened?.organizationId}
            initialView={opened?.view} onMembershipsChanged={refresh} user={session.user} logoutBusy={busy} onLogout={() => { void logout() }} />}
          renderEmpty={() => creating
            ? <CreateOrganization onCancel={() => setCreating(false)}
              onCreated={organizationId => { setCreating(false); setOpened({ organizationId, view: 'members' }) }} />
            : <InviteCodeForm initialCode={typedCode} onCreate={() => setCreating(true)}
              onSubmit={code => { setTypedCode(code); setInvite({ code, from: 'form' }) }} />}
          renderFallback={card} />}
```

- [ ] **Step 7: 통과 확인**

Run: `npm test --workspace @vada/web -- --no-file-parallelism src/organization src/access src/App.test.tsx src/App.integration.test.tsx src/workspace`
Expected: PASS.

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음.

- [ ] **Step 8: 커밋**

```bash
git add apps/web/src/organization apps/web/src/access apps/web/src/App.tsx apps/web/src/App.integration.test.tsx
git commit -m "소속이 없을 때 학생회를 만들 수 있게 하기" -m "코드 입력 아래에 입구를 두고, 만든 뒤에는 구성원 화면에서 초대를 시작한다."
```

---

### Task 8: 문서, 전체 검사, 최종 리뷰

**Files:**
- Modify: `docs/ERD.md`, `docs/purchase-model.md`

- [ ] **Step 1: ERD 갱신**

`docs/ERD.md`의 "인증·조직·대화" 그림에서:
- `departments` 블록의 `boolean handles_finance "재정 업무 권한"` 아래에 `boolean is_leadership "회장단 표시"`를 더한다.
- `memberships` 블록의 `department_id` 줄 아래에 `text title "직책, 표시용"`을 더한다.
- `handles_finance` 설명을 `"구매 승인 부서"`로 바꾼다.

아래 설명 목록의 `memberships` 항목 앞에 다음 항목을 더한다.

```markdown
- `departments`: 학생회마다 회장단(`is_leadership`)이 정확히 하나다(부분 고유 색인 `departments_one_leadership`). 회장단은 구매 승인 표시(`handles_finance`)를 갖지 않는다(CHECK). 권한은 부서로 계산한다. 회장단은 조직 관리와 구매 승인, `handles_finance` 부서는 구매 승인을 한다(`access/membership.ts`). 회장단은 지울 수 없고 이름은 바꿀 수 있다. 구성원이나 구매요청 기록이 있는 부서는 지우지 않는다(서버).
```

`memberships` 항목 끝에 다음 문장을 더한다.

```markdown
직책(`title`)은 표시용 글이다. 공백만인 값과 20자 초과를 금지한다. 부서를 옮기면 서버가 지운다. 마지막 회장단은 다른 곳으로 옮길 수 없다(서버).
```

- [ ] **Step 2: 구매 모델 정책 갱신**

`docs/purchase-model.md`의 정책 결정 1번 하위 항목 두 줄을 다음으로 바꾼다.

```markdown
   - 가입할 때 부서는 고르지 않는다. 부서 편성은 [학생회 조직 설계](superpowers/specs/2026-10-08-organization-structure-design.md)에서 정했다(2026-10-08). 회장단이 구성원 화면에서 배정한다.
   - 부서 없는 부원도 구매 요청을 할 수 있다(2026-10-08 확정). 정산 단위가 행사 × 비목이라 요청 부서는 표시용이다. 설계는 [가입·초대 설계](superpowers/specs/2026-10-07-invite-join-design.md)에 있다.
```

- [ ] **Step 3: 전체 검사**

Run: `npm test --workspace @vada/api`
Expected: 모든 테스트 PASS.

Run: `npm test --workspace @vada/contracts`
Expected: PASS.

Run: `npm test --workspace @vada/web -- --no-file-parallelism`
Expected: 모든 테스트 PASS.

Run: `npm run typecheck` 와 `npm run build --workspace @vada/web`
Expected: 오류 없음, 빌드 성공.

- [ ] **Step 4: 커밋**

```bash
git add docs/ERD.md docs/purchase-model.md
git commit -m "ERD와 구매 정책에 학생회 조직 결정 반영"
```

- [ ] **Step 5: 최종 리뷰**

executing-plans의 Final Review 절차를 따른다(가장 성능이 좋은 모델의 리뷰어, 이 계획의 Review Focus와 ledger의 Ruling 포함). Critical·Important는 한 번의 수정 단계에서 TDD로 고친다.

---

### Task 9: 0010 적용, 병합, 운영 확인 (DB 적용과 데이터 변경은 승인 필요)

**Files:**
- Create (git 제외 임시 폴더): `.superpowers/apply-0010.mts`, `.superpowers/assign-leader.mts`

새 코드는 `departments.is_leadership`과 `memberships.title`을 읽는다. 그래서 반드시 **두 DB 적용 → main 병합·푸시** 순서로 한다.

- [ ] **Step 1: 점검·적용 스크립트 작성**

`.superpowers/apply-0010.mts`. 0009 때 쓴 스크립트와 같은 방식이며, 접속 주소와 오류 원문은 출력하지 않는다.

```ts
// 일회용: dev 또는 preview DB에 마이그레이션 0010을 점검(기본)하거나 적용(--apply)한다. 접속 주소와 오류 원문은 출력하지 않는다.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const root = 'C:/Users/82108/vada-m1'
const target = process.argv[2]
if (target !== 'dev' && target !== 'preview') { console.log('usage: dev|preview [--apply]'); process.exit(1) }
const env = parseEnv(readFileSync(`${root}/.env`, 'utf8'))
const devUrl = env.DATABASE_URL?.trim()
const previewUrl = env.M1_PREVIEW_DATABASE_URL?.trim()
if (!devUrl || !previewUrl) { console.log('STOP: database URL missing'); process.exit(1) }
const endpoint = (url: string) => new URL(url).hostname.split('.')[0]!.replace('-pooler', '')
if (endpoint(devUrl) === endpoint(previewUrl)) { console.log('STOP: dev and preview point at the same endpoint'); process.exit(1) }

const migrations = `${root}/apps/api/migrations`
const journal = JSON.parse(readFileSync(`${migrations}/meta/_journal.json`, 'utf8')) as { entries: { tag: string; when: number }[] }
// 커밋된 파일은 LF다. 작업 폴더만 CRLF가 된 파일도 커밋 내용 기준으로 비교한다.
const local = journal.entries.map(e => ({ tag: e.tag, when: e.when, hash: createHash('sha256').update(readFileSync(`${migrations}/${e.tag}.sql`, 'utf8').replace(/\r\n/g, '\n')).digest('hex') }))
if (local.at(-1)?.tag !== '0010_organization_structure') { console.log('STOP: 0010 is not the latest local migration'); process.exit(1) }

const sql = postgres(target === 'dev' ? devUrl : previewUrl, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 20, onnotice: () => {} })
async function inspect(label: string) {
  const applied = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id`
  const inOrder = applied.every((row, i) => local[i] !== undefined && row.hash === local[i]!.hash && Number(row.created_at) === local[i]!.when)
  const [column] = await sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'departments' AND column_name = 'is_leadership'`
  const hasColumn = column!.n === 1
  const [counts] = await sql`SELECT (SELECT count(*)::int FROM organizations) AS organizations, (SELECT count(*)::int FROM departments) AS departments,
    (SELECT count(*)::int FROM departments WHERE name = '회장단') AS named, (SELECT count(*)::int FROM memberships) AS memberships,
    (SELECT count(*)::int FROM purchase_requests) AS requests`
  let leaderships = 0
  if (hasColumn) leaderships = (await sql`SELECT count(DISTINCT organization_id)::int AS n FROM departments WHERE is_leadership`)[0]!.n as number
  const state = { applied: applied.length, inOrder, hasColumn, organizations: counts!.organizations as number, departments: counts!.departments as number,
    named: counts!.named as number, memberships: counts!.memberships as number, requests: counts!.requests as number, leaderships }
  console.log(`[${target} ${label}] applied ${state.applied}/${local.length} (in order: ${state.inOrder}) | is_leadership ${state.hasColumn ? 'present' : 'absent'} | organizations ${state.organizations} | departments ${state.departments} (named 회장단 ${state.named}, leaderships ${state.leaderships}) | memberships ${state.memberships} | purchase_requests ${state.requests}`)
  return state
}

try {
  const before = await inspect('before')
  if (process.argv.includes('--apply')) {
    if (!before.inOrder || before.applied !== local.length - 1 || before.hasColumn || before.named !== 0) {
      console.log('STOP: expected exactly 0010 pending, no is_leadership column and no department named 회장단')
      process.exitCode = 1
    } else {
      await migrate(drizzle(sql), { migrationsFolder: migrations })
      const after = await inspect('after')
      const ok = after.applied === local.length && after.inOrder && after.hasColumn && after.leaderships === after.organizations
        && after.departments === before.departments + before.organizations && after.organizations === before.organizations
        && after.memberships === before.memberships && after.requests === before.requests
      console.log(ok ? 'MIGRATION_0010_APPLIED' : 'CHECK_FAILED_AFTER_MIGRATE')
      if (!ok) process.exitCode = 1
    }
  }
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  console.log('FAILED', /^[A-Z0-9_]+$/.test(code) ? code : '')
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
```

- [ ] **Step 2: 두 DB 읽기 전용 점검**

Run: `npx tsx .superpowers/apply-0010.mts dev` 다음 `npx tsx .superpowers/apply-0010.mts preview`
Expected: 둘 다 `applied 10/11 (in order: true) | is_leadership absent | … (named 회장단 0, leaderships 0)`가 나온다. `FAILED CONNECT_TIMEOUT`이면 학교 와이파이가 5432 포트를 막은 것이다. 사용자에게 네트워크를 바꿔 달라고 요청한다.

- [ ] **Step 3: 승인 받기**

두 DB의 점검 결과(적용 수, 학생회·부서·소속·구매요청 수)를 보여 주고, AskUserQuestion으로 적용 여부를 묻는다. 승인 전에는 다음 단계로 가지 않는다.

- [ ] **Step 4: 적용**

Run: `npx tsx .superpowers/apply-0010.mts dev --apply` 다음 `npx tsx .superpowers/apply-0010.mts preview --apply`
Expected: 둘 다 `MIGRATION_0010_APPLIED`.

- [ ] **Step 5: 병합·푸시**

```bash
git switch main
git merge --ff-only organization-structure
git push origin main
```

Expected: 푸시 성공. Render가 자동 배포한다. 배포된 JS 파일 이름이 로컬 빌드(`apps/web/dist/assets/index-*.js`)와 같아질 때까지 확인한다.

- [ ] **Step 6: 운영 확인**

`https://vada-m1.onrender.com`에서 사용자에게 다음을 요청하고, 결과를 함께 확인한다.
- 사이드바 "구성원" 메뉴, 구성원 화면 목록.
- 기존 재정부의 구매요청 검토가 그대로 되는지.

- [ ] **Step 7: 기존 학생회의 회장단 지정 (승인 필요)**

사용자에게 학생회별로 회장단에 넣을 사람의 Google 이메일을 묻는다. `.superpowers/assign-leader.mts`는 dev 또는 preview에서 학생회 ID와 이메일로 그 사람의 소속을 회장단으로 옮긴다.
- 기본은 점검만 한다. `--apply`가 있을 때만 바꾼다.
- 결과는 `FOUND`·`ASSIGNED`·`NOT_FOUND`만 출력하고, 이름·이메일·ID는 출력하지 않는다.
- 승인 뒤 실행하고 `ASSIGNED`를 확인한다.

```ts
// 일회용: 기존 학생회에서 이메일로 찾은 소속을 그 학생회의 회장단으로 옮긴다. 기본은 점검만 한다.
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import postgres from 'postgres'

const [target, organizationId, email] = process.argv.slice(2)
if ((target !== 'dev' && target !== 'preview') || !organizationId || !email) { console.log('usage: dev|preview <organization-id> <email> [--apply]'); process.exit(1) }
const env = parseEnv(readFileSync('C:/Users/82108/vada-m1/.env', 'utf8'))
const url = (target === 'dev' ? env.DATABASE_URL : env.M1_PREVIEW_DATABASE_URL)?.trim()
if (!url) { console.log('STOP: database URL missing'); process.exit(1) }
const sql = postgres(url, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 20, onnotice: () => {} })
try {
  const [row] = await sql`SELECT m.id AS membership_id, d.id AS leadership_id FROM memberships m
    JOIN users u ON u.id = m.user_id JOIN departments d ON d.organization_id = m.organization_id AND d.is_leadership
    WHERE m.organization_id = ${organizationId} AND lower(u.email) = lower(${email})`
  if (!row) { console.log('NOT_FOUND'); process.exitCode = 1 }
  else if (!process.argv.includes('--apply')) console.log('FOUND')
  else {
    await sql`UPDATE memberships SET department_id = ${row.leadership_id}, title = NULL WHERE id = ${row.membership_id}`
    console.log('ASSIGNED')
  }
} catch (error) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  console.log('FAILED', /^[A-Z0-9_]+$/.test(code) ? code : '')
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
```

학생회 ID는 사용자가 운영 화면 주소나 기억으로 알려 주지 않으면, 학생회 수와 이름 목록을 보여 주는 대신 사용자에게 먼저 묻는다(DB 값 출력 최소화).

---

### Task 10: 이름 제약 0011 (배포 후)

**Files:**
- Modify: `apps/api/src/db/schema.ts`(organizations·departments 제약)
- Create: `apps/api/migrations/0011_organization_names.sql`(drizzle-kit), Modify: `meta`
- Modify: `apps/api/src/db/migrations.test.ts`, `docs/ERD.md`
- Create (git 제외): `.superpowers/apply-0011.mts`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/db/migrations.test.ts` 끝에 추가:

```ts
test('0011 enforces council and department name rules', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-names-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0011_organization_names')
    assert.ok(index > 0, '0011 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name) VALUES ('d1','org1','기획부'),('d2','org2','기획부');
    `)
    await migrate(db, { migrationsFolder: folder })

    await t.test('the same department name is allowed only across councils', async () => {
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d3','org1','기획부')"),
        { code: '23505', constraint: 'departments_organization_name_unique' })
    })
    await t.test('blank and too long names are rejected', async () => {
      await assert.rejects(pg.query("INSERT INTO organizations (id,name) VALUES ('org3','  ')"), { code: '23514', constraint: 'organizations_name_not_blank' })
      await assert.rejects(pg.query("INSERT INTO organizations (id,name) VALUES ('org3',$1)", ['가'.repeat(51)]), { code: '23514', constraint: 'organizations_name_length' })
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',' ')"), { code: '23514', constraint: 'departments_name_not_blank' })
      await assert.rejects(pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',$1)", ['가'.repeat(21)]), { code: '23514', constraint: 'departments_name_length' })
      await pg.query("INSERT INTO departments (id,organization_id,name) VALUES ('d4','org1',$1)", ['😀'.repeat(20)])
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})
```

Run (`apps/api`에서): `npx tsx --test src/db/migrations.test.ts`
Expected: FAIL. "0011 마이그레이션이 있어야 한다".

- [ ] **Step 2: 스키마 제약과 마이그레이션 생성**

`apps/api/src/db/schema.ts`:
- `organizations`의 제약 배열에 다음을 더한다.

```ts
  check('organizations_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('organizations_name_length', sql`char_length(${table.name}) <= 50`),
```

- `departments`의 제약 배열에 다음을 더한다.

```ts
  // 같은 학생회 안에서 부서 이름이 겹치면 고르는 칸에서 구분할 수 없다.
  unique('departments_organization_name_unique').on(table.organizationId, table.name),
  check('departments_name_not_blank', sql`${table.name} ~ '[^[:space:]]'`),
  check('departments_name_length', sql`char_length(${table.name}) <= 20`),
```

Run: `npm run db:generate --workspace @vada/api -- --name organization_names`
Expected: `0011_organization_names.sql`에 CHECK 4개와 UNIQUE 1개가 있다.

Run (`apps/api`에서): `npm test`
Expected: 전체 PASS(다른 테스트에 같은 학생회의 같은 부서 이름이나 상한을 넘는 이름이 없다).

- [ ] **Step 3: ERD와 커밋**

`docs/ERD.md`의 `departments` 항목 끝에 "학생회·부서 이름은 공백만이거나 상한(50·20자)을 넘을 수 없고, 같은 학생회 안에서 부서 이름이 겹치지 않는다."를 더한다.

```bash
git add apps/api/src/db/schema.ts apps/api/migrations apps/api/src/db/migrations.test.ts docs/ERD.md
git commit -m "학생회·부서 이름 제약을 DB에 추가" -m "새 API가 같은 규칙을 지키고 있어 배포 뒤 기존 행만 확인하면 된다."
git push origin main
```

푸시해도 서버 시작 시 마이그레이션을 적용하지 않으므로 운영은 바뀌지 않는다.

- [ ] **Step 4: 위반 점검·승인·적용**

`.superpowers/apply-0011.mts`는 `apply-0010.mts`와 같은 틀이다.
- 최신 태그는 `0011_organization_names`이다.
- 점검 항목은 세 가지다.
  - 공백만이거나 51자 이상인 학생회 이름 수.
  - 공백만이거나 21자 이상인 부서 이름 수.
  - 같은 학생회에서 겹치는 부서 이름 묶음 수.
- 적용 조건은 0011 하나만 미적용이고 위반이 모두 0인 경우다.

두 DB를 점검해 결과를 보여 주고, 승인을 받아 적용한다. 둘 다 `MIGRATION_0011_APPLIED`를 확인한다.
