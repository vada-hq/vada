# 학생회 가입·초대 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학생회 사람이 초대 링크나 8자리 초대 코드로, DB 작업 없이 스스로 학생회에 들어온다.

**Architecture:** 학생회마다 DB 함수가 만든 8자리 초대 코드가 하나 있고, 초대 링크(`/join/코드`)는 이 코드를 담은 주소다. 기존 access 모듈에 코드를 확인하는 `GET /api/invites/:code`와 참여하는 `POST /api/organizations/join`을 더한다. 참여하면 부서 없는 "미배정" 소속이 생긴다. 그래서 소속 조회는 부서를 left join으로 읽고, 부서를 쓰는 곳은 부서가 비어 있는 경우를 처리한다. 화면은 링크로 들어오면 바로 학생회 확인으로, 소속이 없으면 코드 입력으로 시작한다. 카카오톡 내장 브라우저에서 열리면 기본 브라우저로 넘긴다.

**Tech Stack:** Hono 4.13, drizzle-orm·drizzle-kit, PostgreSQL(Neon)·PGlite(테스트), zod 4.6.5, React 19, vitest(web), node:test + tsx(api·contracts)

**Spec:** `docs/superpowers/specs/2026-10-07-invite-join-design.md`

## Global Constraints

- 작업 브랜치는 `invite-join`이다. Task마다 이 브랜치에 커밋한다(사용자 결정). main 병합과 푸시는 Task 9에서 묻지 않고 한다(사용자 결정, 2026-10-07).
- DB 마이그레이션 적용(dev, m1-preview)은 사용자 승인 후에만 한다. 승인 전에는 읽기 전용 점검만 한다.
- `.env`는 읽거나 출력하지 않는다. 프로그램 안에서 불러 쓰는 것은 괜찮다. 로그와 응답에 비밀 값, 요청 본문, 초대 코드, DB 값, 오류 원문을 넣지 않는다.
- 테스트는 변경과 관련된 파일만 돌린다. 전체 스위트와 웹 빌드는 Task 8에서만 돌린다. 타입 검사는 바꾼 워크스페이스만 Task마다 돌린다.
- 웹 테스트는 메모리가 부족해 `--no-file-parallelism`으로 돌린다.
- 새 의존성을 추가하지 않는다.
- 오류 응답 형식은 `{ "error": "<CODE>" }`로 유지한다. 이번에 쓰는 코드는 `NOT_FOUND`(404), `INVALID_INPUT`(400), `UNAUTHENTICATED`(401), `FORBIDDEN`(403)이다.
- 새 API는 AGENTS.md 규칙을 따른다. 본문 스키마는 contracts에 `z.strictObject`로 두고, 라우트에서는 `json()`을 인증보다 앞에 둔다. 실패는 `ApiError`로 던진다. 변경 라우트는 `/api/organizations/` 아래에 두고, 경계 테스트의 `schemaPending`에는 아무것도 추가하지 않는다.
- 초대 코드 형식은 8자리이고, 글자는 `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` 중에서 고른다. DB CHECK 정규식은 `^[2-9A-HJ-NP-Z]{8}$`다.
- 입력 코드는 `token(16)`을 통과한 뒤 공백과 하이픈을 지우고 대문자로 바꾼다(`InviteCodeSchema`).
- 초대 링크 형식은 `{origin}/join/{code}`다.
- 화면 문구는 아래와 글자까지 같게 쓴다.
  - 로그인 화면(초대 링크): "학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요."
  - 로그인 화면(카카오톡): "카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요."
  - 코드 입력:
    - 제목 "초대 코드를 입력해 주세요"
    - 안내 "학생회에서 받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있어요."
    - 입력칸 이름 "초대 코드", 버튼 "학생회 확인"
  - 학생회 확인:
    - "{학생회 이름}에 참여할까요?"
    - "참여하면 미배정 구성원으로 등록돼요."
    - 버튼 "참여하기"(요청 중 "참여하는 중…", 실패 뒤 "다시 시도"), "참여하지 않기"
  - 초대 오류와 로딩:
    - "초대 코드가 올바르지 않아요. 다시 확인해 주세요."
    - "초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요."
    - "참여하지 못했어요. 연결을 확인하고 다시 시도해 주세요."
    - 버튼 "VADA로 가기"(링크로 들어온 경우), "다시 입력"(코드를 입력한 경우), "다시 시도"
    - 로딩 "초대 확인 중…"
  - 복사:
    - 버튼 "초대 링크 복사", "코드 복사"
    - 완료 "초대 링크를 복사했어요", "초대 코드를 복사했어요"
    - 실패 "복사하지 못했어요. 아래에서 직접 복사해 주세요."
    - 입력칸 이름 "초대 링크", "초대 코드"
  - 부서 없음 "미배정". 소속 없음(기본) "아직 참여한 학생회가 없어요".
- 주석은 기존처럼 한국어로, "왜"만 짧게 쓴다.
- 커밋 제목은 한국어로 50자 이내, 명령형으로 쓴다. AI 서명과 Co-Authored-By는 붙이지 않는다.

## Review Focus

1. **사람이 직접 친 코드:** 소문자, 앞뒤·중간 공백, 하이픈이 섞인 코드(` abcd-2345 `)도 같은 학생회로 연결된다. → Task 3(계약·API), Task 6(화면)
2. **이미 참여한 사람이 초대 링크를 다시 엶:** 링크를 공유한 사람이 자기 링크를 눌러 보는 경우다. [참여하기] 없이 바로 그 학생회로 가고, 부서는 그대로이며, 참여 요청(POST)이 나가지 않는다. → Task 3, Task 6
3. **[참여하기]를 빠르게 두 번 누르거나 두 탭에서 동시에 참여:** 소속은 하나만 생기고 두 요청 모두 성공한다. 요청 중에는 버튼이 꺼진다. → Task 3, Task 6
4. **깨진 초대 주소:** `/join/%E0%A4%A`나 `%00` 같은 주소에서 화면이 멈추지 않고 "올바르지 않아요"와 [VADA로 가기]를 보여 준다. 서버는 500이 아니라 404로 답한다. → Task 3, Task 5, Task 6
5. **클립보드를 못 쓰는 환경:** HTTP 접속, 권한 거부, API 없음인 경우다. 링크와 코드를 직접 복사할 수 있게 보여 준다. → Task 7

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `apps/api/src/db/schema.ts` (수정) | `organizations.invite_code`, 부서 칸 NOT NULL 해제 |
| `apps/api/migrations/0009_organization_invite_code.sql` (생성) | 코드 생성 함수, 칸 추가, NOT NULL 해제 |
| `packages/contracts/src/invites.ts` (신규) | `InviteCodeSchema`, `JoinOrganizationSchema`, `InvitePreviewResponse` |
| `packages/contracts/src/index.ts` (수정) | `MembershipSummary`, `PurchaseSummary.departmentId`, `JoinOrganizationResponse`, 내보내기 |
| `apps/api/src/access/membership.ts` (수정) | 소속 조회에 초대 코드, 부서 left join |
| `apps/api/src/access/access.ts` (수정) | 초대 확인·참여 라우트 |
| `apps/api/src/deliveries/routes.ts` (수정) | 미배정이면 재정 아님 |
| `apps/api/scripts/test-data.ts` (수정) | 미배정 소속에 부서 넣기 |
| `apps/api/src/web.ts` (수정) | `/join/:code`에도 화면 제공 |
| `apps/web/src/shared/in-app-browser.ts` (신규) | 카카오톡 내장 브라우저 감지와 기본 브라우저 열기 |
| `apps/web/src/access/invite-path.ts` (신규) | 초대 경로 읽기·만들기 |
| `apps/web/src/access/InviteCodeForm.tsx` (신규) | 코드 입력(INV-00) |
| `apps/web/src/access/JoinOrganization.tsx` (신규) | 학생회 확인·참여(INV-01) |
| `apps/web/src/access/InviteShare.tsx` (신규) | 링크·코드 복사(ORG-03C의 일부) |
| `apps/web/src/access/Memberships.tsx` (수정) | 소속 없음 내용 주입, 미배정 표시 |
| `apps/web/src/App.tsx` (수정) | 초대 상태, 로그인 복귀 경로, 안내 문구 |
| `apps/web/src/main.tsx` (수정) | 카카오톡이면 기본 브라우저로 넘김 |
| `apps/web/src/workspace/Workspace.tsx`, `Sidebar.tsx`, `Workspace.css` (수정) | 방금 참여한 학생회 먼저 열기, 미배정 표시, 복사 영역 |
| `AGENTS.md`, `docs/ERD.md` (수정) | 마이그레이션 순서 규칙, 바뀐 칸 |

---

### Task 1: DB — 초대 코드와 비워 둘 수 있는 부서

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `packages/contracts/src/index.ts`
- Create: `apps/api/migrations/0009_organization_invite_code.sql`, `apps/api/migrations/meta/0009_snapshot.json`(생성기), `apps/api/migrations/meta/_journal.json`(생성기)
- Test: `apps/api/src/db/schema.test.ts`, `apps/api/src/db/migrations.test.ts`, `apps/api/src/db/purchases.test.ts`

**Interfaces:**
- Produces:
  - `organizations.inviteCode`: text, NOT NULL, 기본값 `vada_invite_code()`, 고유 제약 `organizations_invite_code_unique`, CHECK `organizations_invite_code_format`
  - `memberships.departmentId: string | null`, `purchaseRequests.departmentId: string | null`
  - 계약 `PurchaseSummary.departmentId: string | null`
  - 마이그레이션 태그 `0009_organization_invite_code`

- [ ] **Step 1: 실패하는 스키마 테스트 작성**

`apps/api/src/db/schema.test.ts` 4번째 줄 import에 `purchaseRequests`를 더한다.

```ts
import { accounts, chatRooms, departments, events, memberships, messages, organizations, purchaseRequests, sessions, users, verifications } from './schema.js'
```

`a user has at most one membership in each organization` 테스트의 마지막 줄을 바꾼다.

```ts
  // 초대로 들어온 구성원은 부서 없이 소속만 생긴다(미배정).
  assert.equal(memberships.departmentId.notNull, false)
```

파일 끝에 테스트를 더한다.

```ts
test('councils keep one invite code each; departments may be unassigned', () => {
  assert.equal(organizations.inviteCode.notNull, true)
  assert.equal(organizations.inviteCode.hasDefault, true)
  const config = getTableConfig(organizations)
  assert.deepEqual(config.uniqueConstraints.map(key => key.name), ['organizations_invite_code_unique'])
  assert.ok(config.checks.some(item => item.name === 'organizations_invite_code_format'))
  assert.equal(purchaseRequests.departmentId.notNull, false)
})
```

- [ ] **Step 2: 기존 행 비교 테스트가 새 칸 때문에 깨지지 않게 고치기**

`apps/api/src/db/migrations.test.ts`와 `apps/api/src/db/purchases.test.ts`는 마이그레이션 전후의 `SELECT *` 결과를 통째로 비교한다. 0009가 `organizations`에 칸을 더하면 두 테스트가 실패한다. 두 파일의 import 아래에 같은 함수를 둔다.

```ts
// 나중 마이그레이션이 더한 칸(예: organizations.invite_code)은 빼고, 원래 있던 칸의 값만 비교한다.
const sameColumns = (rows: Record<string, unknown>[], before: Record<string, unknown>[]) =>
  rows.map((row, index) => Object.fromEntries(Object.keys(before[index] ?? row).map(key => [key, row[key]])))
```

`migrations.test.ts`의 `all existing rows survive the upgrade` 안을 바꾼다.

```ts
      const after = await Promise.all(oldTables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
      assert.deepEqual(after.map((result, index) => sameColumns(result.rows, before[index]!.rows)), before.map(result => result.rows))
```

`purchases.test.ts`의 `const after = ...` 두 줄을 바꾼다.

```ts
    const after = await Promise.all(tables.map(table => pg.query<Record<string, unknown>>(`SELECT * FROM ${table} ORDER BY id`)))
    assert.deepEqual(after.map((result, index) => sameColumns(result.rows, before[index]!.rows)), before.map(result => result.rows))
```

- [ ] **Step 3: 실패하는 마이그레이션 테스트 작성**

`apps/api/src/db/migrations.test.ts` 끝에 더한다. 위쪽 import(`mkdtempSync`, `readFileSync`, `writeFileSync`, `mkdirSync`, `copyFileSync`, `rmSync`, `tmpdir`, `join`)는 이미 있다.

```ts
test('0009 gives every council an invite code and lets departments be empty', async (t) => {
  const pg = new PGlite()
  const previous = mkdtempSync(join(tmpdir(), 'vada-invite-migration-'))
  try {
    const folder = fileURLToPath(new URL('../../migrations', import.meta.url))
    const journal = JSON.parse(readFileSync(join(folder, 'meta/_journal.json'), 'utf8'))
    const index = journal.entries.findIndex((entry: { tag: string }) => entry.tag === '0009_organization_invite_code')
    assert.ok(index > 0, '0009 마이그레이션이 있어야 한다')
    const oldJournal = { ...journal, entries: journal.entries.slice(0, index) }
    mkdirSync(join(previous, 'meta'))
    writeFileSync(join(previous, 'meta/_journal.json'), JSON.stringify(oldJournal))
    for (const entry of oldJournal.entries) copyFileSync(join(folder, `${entry.tag}.sql`), join(previous, `${entry.tag}.sql`))
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u1','Planner','p@example.test'),('u2','New','n@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name) VALUES ('d1','org1','Planning'),('d2','org2','Planning');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','u1','org1','d1');
    `)
    await migrate(db, { migrationsFolder: folder })
    const codes = (await pg.query<{ invite_code: string }>('SELECT invite_code FROM organizations ORDER BY id')).rows.map(row => row.invite_code)

    await t.test('existing councils get distinct codes in the agreed format', () => {
      assert.equal(codes.length, 2)
      for (const code of codes) assert.match(code, /^[2-9A-HJ-NP-Z]{8}$/)
      assert.notEqual(codes[0], codes[1])
    })
    await t.test('existing membership keeps its department', async () => {
      const result = await pg.query<{ department_id: string }>("SELECT department_id FROM memberships WHERE id = 'm1'")
      assert.equal(result.rows[0]?.department_id, 'd1')
    })
    await t.test('new councils get a code; duplicate and malformed codes are rejected', async () => {
      await pg.query("INSERT INTO organizations (id,name) VALUES ('org3','Council 3')")
      const created = await pg.query<{ invite_code: string }>("SELECT invite_code FROM organizations WHERE id = 'org3'")
      assert.match(created.rows[0]!.invite_code, /^[2-9A-HJ-NP-Z]{8}$/)
      await assert.rejects(pg.query("INSERT INTO organizations (id,name,invite_code) VALUES ('org4','Council 4',$1)", [codes[0]]),
        { code: '23505', constraint: 'organizations_invite_code_unique' })
      for (const bad of ['abcd2345', 'ABCD0123', 'ABCD234', 'ABCD23456']) {
        await assert.rejects(pg.query("INSERT INTO organizations (id,name,invite_code) VALUES ('org5','Council 5',$1)", [bad]),
          { code: '23514', constraint: 'organizations_invite_code_format' })
      }
    })
    await t.test('membership and purchase request may have no department, but a set one must match the council', async () => {
      await pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m2','u2','org1',NULL)")
      await assert.rejects(pg.query("INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m3','u2','org2','d1')"),
        { code: '23503', constraint: 'memberships_department_same_organization' })
      await pg.exec(`
        INSERT INTO events (id,organization_id,name,created_by) VALUES ('e1','org1','Festival','u2');
        INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,department_id,idempotency_key) VALUES ('r1','org1','e1','u2',NULL,'k1');
      `)
      const request = await pg.query<{ department_id: string | null }>("SELECT department_id FROM purchase_requests WHERE id = 'r1'")
      assert.equal(request.rows[0]?.department_id, null)
    })
  } finally {
    await pg.close()
    rmSync(previous, { recursive: true, force: true })
  }
})
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `cd apps/api && npx tsx --test src/db/schema.test.ts src/db/migrations.test.ts src/db/purchases.test.ts`
Expected: FAIL. 실패 지점은 셋이다.
- 스키마 테스트: `organizations.inviteCode`가 없어 `notNull`을 읽지 못한다(TypeError).
- 스키마 테스트: `memberships.departmentId.notNull`이 아직 true다.
- 마이그레이션 테스트: "0009 마이그레이션이 있어야 한다"에서 실패한다.

Step 2에서 고친 행 비교는 이 시점에도 통과한다.

- [ ] **Step 5: 스키마 바꾸기**

`apps/api/src/db/schema.ts`의 `organizations`를 바꾼다.

```ts
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // 초대 링크(/join/코드)와 직접 입력에 같이 쓰는 8자리 코드. 0009 마이그레이션의 DB 함수가 만든다.
  inviteCode: text('invite_code').notNull().default(sql`vada_invite_code()`),
}, (table) => [
  unique('organizations_invite_code_unique').on(table.inviteCode),
  check('organizations_invite_code_format', sql`${table.inviteCode} ~ '^[2-9A-HJ-NP-Z]{8}$'`),
])
```

`memberships`의 `departmentId` 줄을 바꾼다.

```ts
  // 초대로 들어온 구성원은 부서가 없다(미배정). 부서 편성은 ERD 재설계 때 정한다.
  departmentId: text('department_id'),
```

`purchaseRequests`의 `departmentId` 줄을 바꾼다.

```ts
  // 요청자가 미배정이면 비어 있다.
  departmentId: text('department_id'),
```

- [ ] **Step 6: 계약의 구매 요청 부서를 비워 둘 수 있게 바꾸기**

`packages/contracts/src/index.ts`의 `PurchaseSummary`에서 바꾼다.

```ts
  // 요청자가 미배정이면 null이다.
  departmentId: string | null
```

- [ ] **Step 7: 마이그레이션 생성**

Run: `npm run db:generate --workspace @vada/api -- --name=organization_invite_code`
Expected: 생성기가 세 가지를 바꾼다.
- `apps/api/migrations/0009_organization_invite_code.sql`과 `apps/api/migrations/meta/0009_snapshot.json`을 만든다.
- `meta/_journal.json`에 `"tag": "0009_organization_invite_code"` 항목을 더한다.
- 생성기가 이름 변경 여부를 묻는다면, 새 칸 추가(create column)를 고른다.

- [ ] **Step 8: 코드 생성 함수를 마이그레이션 맨 앞에 넣기**

생성된 SQL은 함수 없이 `DEFAULT vada_invite_code()`를 쓴다. 생성기가 만든 문장은 그대로 두고, 파일 맨 앞에 아래 문장을 붙인다. 완성된 파일은 다음과 같다. 생성기가 만든 문장의 순서는 달라도 괜찮지만, 함수는 반드시 맨 앞에 와야 한다.

```sql
-- 초대 코드 8자리. 헷갈리는 0·1·I·O를 뺀 32자에서, 글자마다 새 UUID의 첫 바이트(무작위)로 고른다.
CREATE FUNCTION vada_invite_code() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', get_byte(uuid_send(gen_random_uuid()), 0) % 32 + 1, 1), '')
  FROM generate_series(1, 8)
$$;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_requests" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "invite_code" text DEFAULT vada_invite_code() NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_invite_code_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_invite_code_format" CHECK ("organizations"."invite_code" ~ '^[2-9A-HJ-NP-Z]{8}$');
```

Run: `git add apps/api/migrations && git ls-files --eol apps/api/migrations/0009_organization_invite_code.sql`
Expected: `i/lf w/lf`로 시작한다. CRLF면 파일을 LF로 다시 저장한다. 적용 기록의 해시는 파일 내용으로 계산하므로 줄바꿈이 바뀌면 안 된다.

- [ ] **Step 9: 테스트가 통과하는지 확인**

Run: `cd apps/api && npx tsx --test src/db/schema.test.ts src/db/migrations.test.ts src/db/purchases.test.ts`
Expected: PASS(실패 0)

Run: `npm run typecheck --workspace @vada/api && npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 10: 커밋**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/schema.test.ts apps/api/src/db/migrations.test.ts apps/api/src/db/purchases.test.ts apps/api/migrations packages/contracts/src/index.ts
git commit -m "학생회 초대 코드와 미배정 부서를 DB에 추가"
```

---

### Task 2: 소속 응답에 초대 코드와 미배정 부서 담기

**Files:**
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/access/membership.ts`, `apps/api/src/deliveries/routes.ts`
- Modify (화면): `apps/web/src/access/Memberships.tsx`, `apps/web/src/workspace/Sidebar.tsx`, `apps/web/src/workspace/Workspace.tsx`
- Test: `apps/api/src/access/access.test.ts`, `apps/api/src/purchases/purchases.test.ts`, `apps/api/src/deliveries/routes.test.ts`, `apps/web/src/access/Memberships.test.tsx`, `apps/web/src/workspace/Workspace.test.tsx`
- Modify (테스트 데이터): `apps/web/src/test-support/workflow-fixtures.ts`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: Task 1의 `organizations.inviteCode`, 비워 둘 수 있는 `memberships.departmentId`
- Produces:
  - `MembershipSummary`는 `{ id: string; organization: { id: string; name: string; inviteCode: string }; department: { id: string; name: string; handlesFinance: boolean } | null }`이다.
  - `queryMemberships(db, userId, organizationId?)`가 이 모양을 돌려준다.

- [ ] **Step 1: 실패하는 API 테스트 작성**

`apps/api/src/access/access.test.ts`의 `pg.exec` 데이터를 바꾼다. 코드를 직접 넣어 응답을 정확히 비교한다.

```ts
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('planner','Planner','p@example.test'),('finance','Finance','f@example.test'),('outsider','Outsider','o@example.test'),('newbie','Newbie','n@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Finance',false),('d2','org1','Operations',true),('d3','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','planner','org1','d1'),('m2','finance','org1','d2'),('m3','newbie','org1',NULL);
    `)
```

`client-supplied identity cannot override the session`의 기대값을 바꾼다.

```ts
      assert.deepEqual(await response.json(), { memberships: [{ id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Finance', handlesFinance: false } }] })
```

`membership removal takes effect ...` 바로 앞에 하위 테스트를 더한다.

```ts
    await t.test('unassigned member keeps access with a null department', async () => {
      userId = 'newbie'
      const response = await routes.request('/organizations/org1/membership')
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { membership: { id: 'm3', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null } })
      assert.equal((await routes.request('/organizations/org2/membership')).status, 403)
    })
```

`apps/api/src/purchases/purchases.test.ts` 끝에 더한다.

```ts
test('미배정 구성원도 구매 요청 초안을 만들고, 재정 기능은 쓰지 못한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('n','New','n@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('n','n','a',NULL);
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','a','Festival','n');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','a','e');
      INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('m','room','n','테이블 2개');
    `)
    const generate: DraftGenerator = async input => ({
      purpose: '행사 접수', neededBy: '2026-10-09', sourceMessageIds: ['m'], warnings: [],
      items: input.links.map(productUrl => ({ productUrl, productName: '테이블', selectedOption: '화이트',
        optionRequired: true, quantity: 2, packagingUnit: null, estimatedUnitPrice: 11590,
        productSnapshot: { price: 11590 }, productFetchedAt: new Date('2026-09-29T00:00:00Z') })),
    })
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      purchases: createPurchaseRoutes(db, async () => ({ user: { id: 'n' } }), generate) })
    const path = '/api/organizations/a/events/e/purchase-requests'
    const response = await app.request(`${path}/drafts`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotencyKey: 'unassigned', links: [link] }) })
    assert.equal(response.status, 201)
    assert.equal((await response.json()).request.departmentId, null)
    assert.equal((await app.request(`${path}/finance`)).status, 403)
  } finally {
    await pg.close()
  }
})
```

`apps/api/src/deliveries/routes.test.ts` 끝에 더한다.

```ts
test('미배정 구성원은 재정 전용 배송 기능을 쓰지 못한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('n','New','n@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('n','n','a',NULL);
    `)
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: 'http://127.0.0.1:5180',
      deliveries: createDeliveryRoutes(db, async () => ({ user: { id: 'n' } }), {} as never) })
    const response = await app.request('/api/organizations/a/delivery-carriers')
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'FORBIDDEN' })
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 2: 테스트 결과 확인**

Run: `cd apps/api && npx tsx --test src/access/access.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts`
Expected: 결과는 셋으로 나뉜다.
- access: `inviteCode`가 응답에 없고, 미배정 구성원이 403을 받아 FAIL이다.
- purchases 새 테스트: 소속 조회가 inner join이라 403을 받아 FAIL이다(기대값 201).
- deliveries 새 테스트: 같은 이유로 403이라 지금은 통과한다. Step 4에서 left join으로 바꾸면 500으로 실패한다. 그 실패를 Step 5에서 고친다.

- [ ] **Step 3: 계약의 소속 모양 바꾸기**

`packages/contracts/src/index.ts`의 `MembershipSummary`를 바꾼다.

```ts
export interface MembershipSummary {
  id: string
  organization: { id: string; name: string; inviteCode: string }
  // 초대로 들어와 아직 부서가 없으면 null(미배정)이다.
  department: { id: string; name: string; handlesFinance: boolean } | null
}
```

- [ ] **Step 4: 소속 조회를 left join으로 바꾸기**

`apps/api/src/access/membership.ts`의 `queryMemberships`를 바꾼다.

```ts
export function queryMemberships(db: MembershipDatabase, userId: string, organizationId?: string) {
  return db.select({
    id: memberships.id,
    organization: { id: organizations.id, name: organizations.name, inviteCode: organizations.inviteCode },
    department: { id: departments.id, name: departments.name, handlesFinance: departments.handlesFinance },
  }).from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    // 초대로 들어온 구성원은 부서가 없다(미배정). 부서가 없어도 소속은 유지한다.
    .leftJoin(departments, and(eq(departments.id, memberships.departmentId), eq(departments.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.userId, userId), organizationId === undefined ? undefined : eq(memberships.organizationId, organizationId)))
    .orderBy(organizations.id)
}
```

Run: `cd apps/api && npx tsx --test src/access/access.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts`
Expected: access와 purchases는 PASS다. deliveries 새 테스트는 FAIL(500)이다. `department`가 null인데 `handlesFinance`를 읽기 때문이다.

- [ ] **Step 5: 배송 라우트의 재정 검사 고치기**

`apps/api/src/deliveries/routes.ts` 18번째 줄을 바꾼다.

```ts
    if (!c.get('membership').department?.handlesFinance) return c.json({ error: 'FORBIDDEN' }, 403)
```

Run: `cd apps/api && npx tsx --test src/access/access.test.ts src/purchases/purchases.test.ts src/deliveries/routes.test.ts src/http/boundary.test.ts`
Expected: PASS

- [ ] **Step 6: 실패하는 화면 테스트 작성**

`apps/web/src/access/Memberships.test.tsx`의 소속 데이터 세 곳(첫 테스트의 `fetchMock`, `renders organization content ...`의 `toHaveBeenCalledWith`, `okMemberships`)에서 `organization`에 `inviteCode: 'ABCD2345'`를 더한다. 예: `organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }`. 그리고 테스트를 더한다.

```tsx
test('a member without a department is shown as unassigned', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [{ id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: null }] }) }))
  render(<Memberships />)
  expect(await screen.findByText('검증 학생회 · 미배정')).toBeTruthy()
})
```

`apps/web/src/workspace/Workspace.test.tsx`를 바꾼다.
- 9번째 줄의 `membership` 상수에 `inviteCode: 'ABCD2345'`를 더한다.
- `switching membership ...` 테스트의 두 번째 소속을 `organization: { id: 'o2', name: '다른 학생회', inviteCode: 'EFGH6789' }`로 바꾼다.
- 아래 테스트를 더한다.

```tsx
test('an unassigned member sees 미배정 and no finance badge', () => {
  setup()
  render(<Workspace {...props} memberships={[{ ...membership, department: null }]} />)
  expect(screen.getByText('미배정')).toBeTruthy()
  expect(screen.queryByText('재정 담당')).toBeNull()
})
```

`apps/web/src/test-support/workflow-fixtures.ts`의 `membership`을 `organization: { id: 'o', name: '테스트 학생회', inviteCode: 'ABCD2345' },`로 바꾼다. `apps/web/src/App.test.tsx` 8번째 줄의 소속 목 데이터에도 `inviteCode: 'ABCD2345'`를 더한다.

Run: `cd apps/web && npx vitest run --no-file-parallelism src/access/Memberships.test.tsx src/workspace/Workspace.test.tsx`
Expected: FAIL. 두 새 테스트에서 `Cannot read properties of null (reading 'name')`이 난다.

- [ ] **Step 7: 화면이 미배정을 다루게 고치기**

`apps/web/src/access/Memberships.tsx`의 목록 두 줄을 바꾼다.

```tsx
        {membership.organization.name} · {membership.department?.name ?? '미배정'}
        {membership.department?.handlesFinance && <span className="hint"> (재정 담당)</span>}
```

`apps/web/src/workspace/Sidebar.tsx`의 세 곳을 바꾼다.

```tsx
        {memberships.map(item => <option key={item.id} value={item.id}>{item.organization.name} · {item.department?.name ?? '미배정'}</option>)}
```
```tsx
      <p>{membership.department?.name ?? '미배정'}</p>
      {membership.department?.handlesFinance && <span className="badge">재정 담당</span>}
```

`apps/web/src/workspace/Workspace.tsx` 38번째 줄에서 바꾼다.

```tsx
handlesFinance={membership.department?.handlesFinance ?? false}
```

- [ ] **Step 8: 테스트와 타입 검사 통과 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/access/Memberships.test.tsx src/workspace/Workspace.test.tsx src/App.test.tsx src/App.integration.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/api && npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add packages/contracts/src/index.ts apps/api/src/access apps/api/src/purchases/purchases.test.ts apps/api/src/deliveries apps/web/src
git commit -m "소속 응답에 초대 코드와 미배정 부서 담기"
```

---

### Task 3: 초대 코드로 학생회에 참여하는 API

**Files:**
- Create: `packages/contracts/src/invites.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/access/access.ts`
- Test: `packages/contracts/src/input.test.ts`, `apps/api/src/access/access.test.ts`, `apps/api/src/http/boundary.test.ts`(바꾸지 않고 실행만)

**Interfaces:**
- Consumes: Task 2의 `queryMemberships`, `MembershipSummary`
- Produces:
  - `INVITE_CODE_MAX = 16`
  - `InviteCodeSchema`: 문자열 → 공백·하이픈을 지운 대문자 코드
  - `JoinOrganizationSchema = z.strictObject({ code: InviteCodeSchema })`, `JoinOrganizationRequest`
  - `InvitePreviewResponse = { organization: { id: string; name: string }; joined: boolean }`
  - `JoinOrganizationResponse = { membership: MembershipSummary }`
  - 라우트 `GET /api/invites/:code`, `POST /api/organizations/join`

- [ ] **Step 1: 실패하는 계약 테스트 작성**

`packages/contracts/src/input.test.ts` 위쪽 import에 `import { INVITE_CODE_MAX, InviteCodeSchema, JoinOrganizationSchema } from './invites.js'`를 더하고, 끝에 테스트를 더한다.

```ts
test('초대 코드: 공백·하이픈·소문자를 정규화하고, 빈 값·제어 문자·상한 초과는 거부한다', () => {
  assert.equal(InviteCodeSchema.parse(' abcd-2345 '), 'ABCD2345')
  assert.equal(InviteCodeSchema.parse('abcd 2345'), 'ABCD2345')
  for (const value of ['', '   ', '-', 'A'.repeat(INVITE_CODE_MAX + 1), '😀'.repeat(9), 'ABCD\u00002345', '\uD800ABCD', 'AB\tCD', 1, null]) {
    assert.equal(InviteCodeSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.deepEqual(JoinOrganizationSchema.parse({ code: 'abcd2345' }), { code: 'ABCD2345' })
  assert.equal(JoinOrganizationSchema.safeParse({ code: 'ABCD2345', extra: 1 }).success, false)
  assert.equal(JoinOrganizationSchema.safeParse({}).success, false)
  assert.equal(isStrictObject(JoinOrganizationSchema), true)
})
```

- [ ] **Step 2: 실패하는 API 테스트 작성**

`apps/api/src/access/access.test.ts` 위쪽 import에 `import { createApp } from '../app.js'`와 `import { createEventRoutes } from '../events/events.js'`를 더하고, 끝에 테스트를 더한다.

```ts
test('초대 코드로 미배정 구성원이 되고, 잘못된 입력은 인증 전에 거절된다', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('member','Member','m@example.test'),('newbie','Newbie','n@example.test'),('other','Other','o@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Planning',false),('d2','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','member','org1','d1'),('m2','other','org2','d2');
    `)
    let userId: string | null = null
    let sessionReads = 0
    const session = async () => { sessionReads++; return userId ? { user: { id: userId } } : null }
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      access: createAccessRoutes(db, session), events: createEventRoutes(db, session) })
    const join = (body: unknown, requestOrigin = origin) => app.request('/api/organizations/join', { method: 'POST',
      headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const count = async (user: string) =>
      (await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM memberships WHERE user_id = $1', [user])).rows[0]?.n

    await t.test('미인증은 401이다', async () => {
      assert.equal((await app.request('/api/invites/AAAA2222')).status, 401)
      assert.equal((await join({ code: 'AAAA2222' })).status, 401)
    })
    await t.test('본문 형식 오류는 인증보다 먼저 400이다', async () => {
      userId = 'newbie'
      const before = sessionReads
      for (const body of [{}, { code: '' }, { code: '   ' }, { code: 'A'.repeat(17) }, { code: '😀'.repeat(9) },
        { code: 'AAAA\u00002222' }, { code: '\uD800AAAA' }, { code: 'AAAA2222', extra: 1 }, { code: 1 }]) {
        const response = await join(body)
        assert.equal(response.status, 400, JSON.stringify(body))
        assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
      }
      assert.equal(sessionReads, before)
      assert.equal(await count('newbie'), 0)
    })
    await t.test('다른 사이트에서 보낸 참여 요청은 403이다', async () => {
      assert.equal((await join({ code: 'AAAA2222' }, 'https://evil.test')).status, 403)
    })
    await t.test('모르는 코드와 형식이 틀린 경로 코드는 500이 아니라 404다', async () => {
      for (const code of ['ZZZZ9999', '%00', 'A'.repeat(17), '%E0%A4%A']) {
        const response = await app.request(`/api/invites/${code}`)
        assert.equal(response.status, 404, code)
        assert.deepEqual(await response.json(), { error: 'NOT_FOUND' })
      }
      assert.equal((await join({ code: 'ZZZZ9999' })).status, 404)
    })
    await t.test('코드를 확인하면 학생회 이름만 보이고, 소문자·하이픈도 같은 코드다', async () => {
      const response = await app.request('/api/invites/aaaa-2222')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(await response.json(), { organization: { id: 'org1', name: 'Council 1' }, joined: false })
    })
    await t.test('참여하면 부서 없는 소속이 생기고 학생회 라우트를 쓸 수 있다', async () => {
      const response = await join({ code: ' aaaa2222 ' })
      assert.equal(response.status, 200)
      const { membership } = await response.json() as { membership: { id: string } }
      assert.deepEqual({ ...membership, id: 'x' }, { id: 'x', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null })
      assert.equal((await app.request('/api/organizations/org1/events')).status, 200)
      assert.deepEqual(await (await app.request('/api/invites/AAAA2222')).json(), { organization: { id: 'org1', name: 'Council 1' }, joined: true })
    })
    await t.test('이미 소속이면 새로 만들지 않고 기존 부서를 유지한다', async () => {
      userId = 'member'
      const response = await join({ code: 'AAAA2222' })
      assert.equal(response.status, 200)
      assert.deepEqual((await response.json()).membership, { id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Planning', handlesFinance: false } })
      assert.equal(await count('member'), 1)
    })
    await t.test('동시에 두 번 보내도 소속은 하나이고, 다른 학생회 소속은 그대로다', async () => {
      userId = 'other'
      const responses = await Promise.all([join({ code: 'AAAA2222' }), join({ code: 'AAAA2222' })])
      assert.deepEqual(responses.map(response => response.status), [200, 200])
      const ids = await Promise.all(responses.map(async response => (await response.json()).membership.id))
      assert.equal(ids[0], ids[1])
      const rows = await pg.query<{ organization_id: string; department_id: string | null }>(
        "SELECT organization_id, department_id FROM memberships WHERE user_id = 'other' ORDER BY organization_id")
      assert.deepEqual(rows.rows, [{ organization_id: 'org1', department_id: null }, { organization_id: 'org2', department_id: 'd2' }])
    })
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test --workspace @vada/contracts`
Expected: FAIL. `./invites.js`를 찾지 못한다.

Run: `cd apps/api && npx tsx --test src/access/access.test.ts`
Expected: FAIL. 실패 지점은 둘이다.
- "미인증은 401이다": 라우트가 없어 404가 나온다.
- "본문 형식 오류": 라우트가 없어 404가 나온다.

- [ ] **Step 4: 계약 작성**

`packages/contracts/src/invites.ts`:

```ts
import { z } from 'zod'
import { token } from './input.js'

// 와이어프레임 INV-00의 8자리 초대 코드. 사람이 입력하므로 공백·하이픈·소문자를 받아 정규화한다.
export const INVITE_CODE_MAX = 16
export const InviteCodeSchema = token(INVITE_CODE_MAX)
  .transform(value => value.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().min(1))
export const JoinOrganizationSchema = z.strictObject({ code: InviteCodeSchema })
export type JoinOrganizationRequest = z.infer<typeof JoinOrganizationSchema>
// 코드만 아는 사람에게는 학생회 이름까지만 보여 준다.
export interface InvitePreviewResponse {
  organization: { id: string; name: string }
  joined: boolean
}
```

`packages/contracts/src/index.ts`에서 두 가지를 바꾼다. 내보내기 줄을 더한다.

```ts
export { INVITE_CODE_MAX, InviteCodeSchema, JoinOrganizationSchema, type JoinOrganizationRequest, type InvitePreviewResponse } from './invites.js'
```

`MembershipsResponse` 아래에 더한다.

```ts
export interface JoinOrganizationResponse {
  membership: MembershipSummary
}
```

- [ ] **Step 5: 라우트 작성**

`apps/api/src/access/access.ts` 전체:

```ts
import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { InviteCodeSchema, JoinOrganizationSchema, type InvitePreviewResponse, type JoinOrganizationResponse,
  type MembershipSummary, type MembershipsResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { memberships, organizations } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { queryMemberships, requireMembership, type MembershipEnv } from './membership.js'

export function createAccessRoutes(db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'insert'>, getSession: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const authenticated = requireSession(getSession)
  // 형식이 틀린 코드와 없는 코드를 구분하지 않는다. 둘 다 올바르지 않은 초대다.
  async function invitedOrganization(code: string) {
    const [organization] = await db.select({ id: organizations.id, name: organizations.name })
      .from(organizations).where(eq(organizations.inviteCode, code))
    if (!organization) throw new ApiError('NOT_FOUND', 404)
    return organization
  }

  routes.get('/me/memberships', authenticated, async (c) => {
    const result: MembershipSummary[] = await queryMemberships(db, c.get('userId'))
    return c.json({ memberships: result } satisfies MembershipsResponse)
  })
  routes.get('/organizations/:organizationId/membership', authenticated, requireMembership(db), (c) => {
    return c.json({ membership: c.get('membership') })
  })
  routes.get('/invites/:code', authenticated, async (c) => {
    const code = InviteCodeSchema.safeParse(c.req.param('code'))
    if (!code.success) throw new ApiError('NOT_FOUND', 404)
    const organization = await invitedOrganization(code.data)
    const [membership] = await queryMemberships(db, c.get('userId'), organization.id)
    return c.json({ organization, joined: membership !== undefined } satisfies InvitePreviewResponse)
  })
  // 와이어프레임 INV-01: 참여하면 미배정 구성원이 된다. 부서 편성은 ERD 재설계 때 정한다.
  routes.post('/organizations/join', json(JoinOrganizationSchema), authenticated, async (c) => {
    const organization = await invitedOrganization(c.req.valid('json').code)
    const userId = c.get('userId')
    // 이미 소속이면 아무것도 바꾸지 않는다. 동시에 와도 유일 제약이 소속을 하나로 지킨다.
    await db.insert(memberships).values({ id: randomUUID(), userId, organizationId: organization.id })
      .onConflictDoNothing({ target: [memberships.organizationId, memberships.userId] })
    const [membership] = await queryMemberships(db, userId, organization.id)
    if (!membership) throw new Error('Membership missing after join')
    return c.json({ membership } satisfies JoinOrganizationResponse)
  })
  return routes
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인**

Run: `npm test --workspace @vada/contracts`
Expected: PASS

Run: `cd apps/api && npx tsx --test src/access/access.test.ts src/http/boundary.test.ts src/auth/auth.test.ts`
Expected: PASS. 경계 테스트는 고치지 않아도 새 `POST /api/organizations/join`을 검사해야 한다.

Run: `npm run typecheck --workspace @vada/api && npm run typecheck --workspace @vada/contracts`
Expected: 오류 없음

- [ ] **Step 7: 커밋**

```bash
git add packages/contracts/src apps/api/src/access
git commit -m "초대 코드로 학생회에 참여하는 API 추가"
```

---

### Task 4: 테스트 데이터 스크립트가 미배정 소속에 부서 넣기

**Files:**
- Modify: `apps/api/scripts/test-data.ts`
- Test: `apps/api/scripts/test-data.test.ts`

**Interfaces:**
- Consumes: Task 1의 비워 둘 수 있는 `memberships.departmentId`
- Produces: `assignDepartment(db, userId, 'planning' | 'finance')`가 미배정 소속에도 부서를 넣는다. 이미 다른 부서가 있으면 지금처럼 오류를 낸다.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/scripts/test-data.test.ts` 끝에 더한다.

```ts
test('초대로 들어온 미배정 소속에는 부서를 넣고, 정해진 부서는 바꾸지 않는다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
    await seedTestCouncil(db)
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u3','Joined','joined@example.test');
      INSERT INTO accounts (id,user_id,provider_id,account_id) VALUES ('a3','u3','google','sub3');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m3','u3','m1-test-council',NULL);
    `)
    await assignDepartment(db, 'u3', 'finance')
    const saved = await pg.query<{ department_id: string }>("SELECT department_id FROM memberships WHERE id = 'm3'")
    assert.equal(saved.rows[0]?.department_id, 'm1-test-finance')
    await assert.rejects(assignDepartment(db, 'u3', 'planning'))
    assert.equal((await pg.query('SELECT * FROM memberships')).rows.length, 1)
  } finally {
    await pg.close()
  }
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/api && npx tsx --test scripts/test-data.test.ts`
Expected: FAIL. "Existing department assignment cannot be overwritten"이 나온다. 미배정 소속이 이미 있어 삽입이 건너뛰어지기 때문이다.

- [ ] **Step 3: 구현**

`apps/api/scripts/test-data.ts`의 drizzle import를 `import { and, eq, isNull } from 'drizzle-orm'`로 바꾼다. `assignDepartment`의 `insert(...).onConflictDoNothing(...)` 바로 다음에 더한다.

```ts
    // 초대로 들어와 미배정인 소속에만 부서를 넣는다. 이미 정해진 부서는 바꾸지 않는다.
    await tx.update(memberships).set({ departmentId: target.id })
      .where(and(eq(memberships.organizationId, council.id), eq(memberships.userId, userId), isNull(memberships.departmentId)))
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd apps/api && npx tsx --test scripts/test-data.test.ts`
Expected: PASS(기존 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/scripts/test-data.ts apps/api/scripts/test-data.test.ts
git commit -m "테스트 데이터 스크립트가 미배정 소속에 부서 넣기"
```

---

### Task 5: 초대 링크로 들어와 로그인하기

**Files:**
- Modify: `apps/api/src/web.ts`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
- Create: `apps/web/src/shared/in-app-browser.ts`, `apps/web/src/access/invite-path.ts`
- Test: `apps/api/src/web.test.ts`, `apps/api/src/auth/auth.test.ts`, `apps/web/src/shared/in-app-browser.test.ts`, `apps/web/src/access/invite-path.test.ts`, `apps/web/src/App.test.tsx`

**Interfaces:**
- Produces:
  - `inviteCodeFromPath(pathname: string): string | null`, `invitePath(code: string): string`
  - `isKakaoInAppBrowser(userAgent: string): boolean`
  - `openOutsideKakao(userAgent: string, location: { href: string }): boolean`
  - App의 초대 상태 타입 `type Invite = { code: string; from: 'link' | 'form' }`
  - 서버가 화면을 주는 경로 `/join/:code`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/api/src/web.test.ts`에서 `assert.equal(await (await app.request('/api/auth/get-session')).text(), 'auth')` 다음에 더한다.

```ts
    const invite = await app.request('/join/ABCD2345')
    assert.equal(invite.status, 200)
    assert.equal(invite.headers.get('Cache-Control'), 'no-cache')
    assert.match(await invite.text(), /VADA/)
```

같은 테스트의 404 목록에 `'/join/'`과 `'/join/a/b'`를 더한다.

`apps/api/src/auth/auth.test.ts`의 `untrusted origin ...` 하위 테스트 앞에 더한다. 지금도 통과하는 확인용 테스트다. 화면이 이 동작에 기대므로 고정해 둔다.

```ts
    await t.test('초대 링크로 돌아오는 상대 경로 콜백을 허용한다', async () => {
      const response = await request('sign-in/social', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: baseURL },
        body: JSON.stringify({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345', disableRedirect: true }),
      })
      assert.equal(response.status, 200)
    })
```

`apps/web/src/shared/in-app-browser.test.ts`:

```ts
import { expect, test } from 'vitest'
import { isKakaoInAppBrowser, openOutsideKakao } from './in-app-browser'

const android = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.9.0'
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0'
const chrome = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

test('카카오톡 내장 브라우저면 현재 주소를 기본 브라우저로 넘긴다', () => {
  const location = { href: 'https://vada-m1.onrender.com/join/ABCD2345' }
  expect(openOutsideKakao(android, location)).toBe(true)
  expect(location.href).toBe('kakaotalk://web/openExternal?url=https%3A%2F%2Fvada-m1.onrender.com%2Fjoin%2FABCD2345')
  expect(isKakaoInAppBrowser(iphone)).toBe(true)
})

test('다른 브라우저는 그대로 둔다', () => {
  const location = { href: 'https://vada-m1.onrender.com/' }
  expect(openOutsideKakao(chrome, location)).toBe(false)
  expect(location.href).toBe('https://vada-m1.onrender.com/')
})
```

`apps/web/src/access/invite-path.test.ts`:

```ts
import { expect, test } from 'vitest'
import { inviteCodeFromPath, invitePath } from './invite-path'

test('초대 경로에서 코드를 꺼내고, 깨진 인코딩은 그대로 서버에 맡긴다', () => {
  expect(inviteCodeFromPath('/join/ABCD2345')).toBe('ABCD2345')
  expect(inviteCodeFromPath('/join/ab%20cd')).toBe('ab cd')
  expect(inviteCodeFromPath('/join/%E0%A4%A')).toBe('%E0%A4%A')
  expect(inviteCodeFromPath('/')).toBeNull()
  expect(inviteCodeFromPath('/join/')).toBeNull()
  expect(inviteCodeFromPath('/join/a/b')).toBeNull()
  expect(invitePath('AB CD')).toBe('/join/AB%20CD')
})
```

`apps/web/src/App.test.tsx` 끝에 더한다.

```tsx
test('invite link login returns to the same invite and says why', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  expect(screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345' }))
})

test('KakaoTalk in-app browser explains how to open another browser', () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(screen.getByText("카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.")).toBeTruthy()
  } finally {
    agent.mockRestore()
  }
})
```

- [ ] **Step 2: 테스트 결과 확인**

Run: `cd apps/api && npx tsx --test src/web.test.ts src/auth/auth.test.ts`
Expected: web 테스트는 FAIL이다(`/join/ABCD2345`이 404). auth 새 테스트는 PASS다(확인용).

Run: `cd apps/web && npx vitest run --no-file-parallelism src/shared/in-app-browser.test.ts src/access/invite-path.test.ts src/App.test.tsx`
Expected: FAIL. 모듈이 없고, 안내 문구도 없다.

- [ ] **Step 3: 서버가 초대 경로에도 화면을 주게 하기**

`apps/api/src/web.ts`에서 진입점 경로 줄을 바꾼다.

```ts
  // 초대 링크(/join/코드)도 화면 진입점이다. 코드 검사는 화면이 API로 한다.
  app.on(['GET', 'HEAD'], ['/', '/index.html', '/join/:code'], async (context, next) => {
```

- [ ] **Step 4: 화면 도우미 작성**

`apps/web/src/shared/in-app-browser.ts`:

```ts
// 구글은 앱에 내장된 브라우저에서의 로그인을 막는다(403 disallowed_useragent).
// 카카오톡은 기본 브라우저로 넘기는 주소를 제공하므로, 화면을 그리기 전에 넘긴다.
export const isKakaoInAppBrowser = (userAgent: string) => /KAKAOTALK/i.test(userAgent)

export function openOutsideKakao(userAgent: string, location: { href: string }) {
  if (!isKakaoInAppBrowser(userAgent)) return false
  location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`
  return true
}
```

`apps/web/src/access/invite-path.ts`:

```ts
// 초대 링크 형식은 {origin}/join/{code}다. 코드가 맞는지는 서버가 판단한다.
const pattern = /^\/join\/([^/]+)$/

export function inviteCodeFromPath(pathname: string) {
  const segment = pattern.exec(pathname)?.[1]
  if (segment === undefined) return null
  try { return decodeURIComponent(segment) } catch { return segment }
}

export const invitePath = (code: string) => `/join/${encodeURIComponent(code)}`
```

- [ ] **Step 5: 카카오톡이면 기본 브라우저로 넘기기**

`apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { openOutsideKakao } from './shared/in-app-browser'

// 카카오톡에서 연 링크는 구글 로그인이 막히므로 기본 브라우저로 넘긴다. 넘어가지 못해도 화면은 그린다.
openOutsideKakao(navigator.userAgent, window.location)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: 로그인 복귀 경로와 안내 문구**

`apps/web/src/App.tsx`를 네 군데 바꾼다.

1. import에 더한다.

```tsx
import { inviteCodeFromPath, invitePath } from './access/invite-path'
import { isKakaoInAppBrowser } from './shared/in-app-browser'
```

2. 컴포넌트 위에 타입을 두고, `message` 상태 아래에 초대 상태를 둔다.

```tsx
// 초대 링크(/join/코드)로 왔는지, 소속이 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }
```

```tsx
  const [invite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
```

3. `login()`의 `signIn.social` 호출을 바꾼다.

```tsx
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL })
```

4. 로그인 전 화면의 `<p>Google 계정으로 로그인해 주세요.</p>` 바로 앞에 더한다.

```tsx
          {invite?.from === 'link' && <p className="hint">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</p>}
          {isKakaoInAppBrowser(navigator.userAgent) && <p className="hint">카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</p>}
```

- [ ] **Step 7: 테스트가 통과하는지 확인**

Run: `cd apps/api && npx tsx --test src/web.test.ts src/auth/auth.test.ts`
Expected: PASS

Run: `cd apps/web && npx vitest run --no-file-parallelism src/shared/in-app-browser.test.ts src/access/invite-path.test.ts src/App.test.tsx`
Expected: PASS(기존 App 테스트 포함). `vi.spyOn(navigator, 'userAgent', 'get')`이 jsdom에서 실패할 수 있다. 그러면 `Object.defineProperty(navigator, 'userAgent', { value, configurable: true })`로 바꾸고 `finally`에서 지운다. 이렇게 바꾸면 ledger에 Ruling으로 남긴다.

Run: `npm run typecheck --workspace @vada/web && npm run typecheck --workspace @vada/api`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add apps/api/src/web.ts apps/api/src/web.test.ts apps/api/src/auth/auth.test.ts apps/web/src
git commit -m "초대 링크로 들어와 로그인하는 길 만들기"
```

---

### Task 6: 초대 코드 입력과 학생회 참여 화면

**Files:**
- Create: `apps/web/src/access/InviteCodeForm.tsx`, `apps/web/src/access/JoinOrganization.tsx`
- Modify: `apps/web/src/access/Memberships.tsx`, `apps/web/src/App.tsx`, `apps/web/src/workspace/Workspace.tsx`
- Test: `apps/web/src/App.integration.test.tsx`, `apps/web/src/access/Memberships.test.tsx`, `apps/web/src/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes:
  - Task 3: `InviteCodeSchema`, `InvitePreviewResponse`, `JoinOrganizationResponse`
  - Task 5: `inviteCodeFromPath`, `invitePath`, `isKakaoInAppBrowser`, `Invite`
- Produces:
  - `InviteCodeForm({ initialCode: string; onSubmit: (code: string) => void })`
  - `JoinOrganization({ code: string; leaveLabel: string; onJoined: (organizationId: string) => void; onLeave: () => void })`
  - `Memberships`의 새 prop `renderEmpty?: () => ReactNode`
  - `Workspace`의 새 prop `initialOrganizationId?: string`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/App.integration.test.tsx`를 바꾼다.
- import를 `import { deferredResponse, json, mockApi } from './test-support/mock-api'`로 바꾼다.
- `beforeEach` 첫 줄에 `window.history.replaceState(null, '', '/')`를 더한다.
- 파일 끝에 아래 테스트를 더한다.

```tsx
const preview = (joined = false) => json({ organization: { id: 'o', name: '테스트 학생회' }, joined })

test('code entry joins a council as unassigned and opens its workspace', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  api.on('POST', '/api/organizations/join', () => {
    api.on('GET', '/api/me/memberships', () => json({ memberships: [{ ...membership(), department: null }] }))
    return json({ membership: { ...membership(), department: null } })
  })
  render(<App />)
  const input = await screen.findByLabelText('초대 코드')
  expect(screen.getByRole('button', { name: '학생회 확인' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: ' abcd-2345 ' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 확인' }))
  expect(await screen.findByText('테스트 학생회에 참여할까요?')).toBeTruthy()
  expect(screen.getByText('참여하면 미배정 구성원으로 등록돼요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '참여하기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(screen.getByText('미배정')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ code: 'ABCD2345' }])
})

test('a wrong code can be corrected from the form', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('GET', '/api/invites/ZZZZ9999', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'zzzz9999' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 확인' }))
  expect((await screen.findByRole('alert')).textContent).toContain('초대 코드가 올바르지 않아요')
  fireEvent.click(screen.getByRole('button', { name: '다시 입력' }))
  expect(((await screen.findByLabelText('초대 코드')) as HTMLInputElement).value).toBe('ZZZZ9999')
})

test('an existing member opening an invite link goes straight to the workspace', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview(true))
  render(<App />)
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('a broken invite link explains the problem and returns to VADA', async () => {
  window.history.replaceState(null, '', '/join/%E0%A4%A')
  api.on('GET', '/api/invites/%25E0%25A4%25A', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('초대 코드가 올바르지 않아요')
  fireEvent.click(screen.getByRole('button', { name: 'VADA로 가기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
})

test('declining a link invite returns to the normal screen', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '참여하지 않기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
})

test('invite lookup failure can be retried', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ error: 'UNAVAILABLE' }, 503))
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('초대를 확인하지 못했어요')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('테스트 학생회에 참여할까요?')).toBeTruthy()
})

test('join is sent once while in flight and a failure can be retried', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  api.on('POST', '/api/organizations/join', () => json({ error: 'UNAVAILABLE' }, 503))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '참여하기' }))
  expect((await screen.findByRole('alert')).textContent).toContain('참여하지 못했어요')
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/join', () => pending.promise)
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(screen.getByRole('button', { name: '참여하는 중…' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '참여하는 중…' }))
  pending.resolve(json({ membership: membership() }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(2)
})
```

`apps/web/src/access/Memberships.test.tsx`를 바꾼다.
- `empty memberships show unassigned, not a signup form` 테스트를 아래로 바꾼다.
- `fetch failure is distinct ...` 테스트의 `'소속 미지정'` 두 곳을 `'아직 참여한 학생회가 없어요'`로 바꾼다.

```tsx
test('empty memberships show the injected content, or a plain message without it', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ memberships: [] }) }))
  const view = render(<Memberships renderEmpty={() => <p>코드 입력 자리</p>} />)
  expect(await screen.findByText('코드 입력 자리')).toBeTruthy()
  view.unmount()
  render(<Memberships />)
  expect(await screen.findByText('아직 참여한 학생회가 없어요')).toBeTruthy()
})
```

`apps/web/src/workspace/Workspace.test.tsx` 끝에 더한다.

```tsx
test('a newly joined council is opened first', async () => {
  const fetcher = setup()
  render(<Workspace {...props} memberships={[membership, { ...membership, id: 'm2', organization: { id: 'o2', name: '다른 학생회', inviteCode: 'EFGH6789' } }]} initialOrganizationId="o2" />)
  expect((screen.getByLabelText('학생회 선택') as HTMLSelectElement).value).toBe('m2')
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/organizations/o2/events', expect.anything()))
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/App.integration.test.tsx src/access/Memberships.test.tsx src/workspace/Workspace.test.tsx`
Expected: FAIL. 코드 입력칸, 학생회 확인 화면, `renderEmpty`, `initialOrganizationId`가 아직 없다.

- [ ] **Step 3: 코드 입력 화면**

`apps/web/src/access/InviteCodeForm.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { InviteCodeSchema } from '@vada/contracts'

type Props = { initialCode: string; onSubmit: (code: string) => void }

// 와이어프레임 INV-00. 소속이 없을 때 보이는 첫 화면이다.
export default function InviteCodeForm({ initialCode, onSubmit }: Props) {
  const [value, setValue] = useState(initialCode)
  const parsed = InviteCodeSchema.safeParse(value)
  function submit(event: FormEvent) {
    event.preventDefault()
    if (parsed.success) onSubmit(parsed.data)
  }
  return <form aria-label="초대 코드 입력" onSubmit={submit}>
    <h2>초대 코드를 입력해 주세요</h2>
    <p className="hint">학생회에서 받은 초대 코드를 입력하면 학생회 정보를 확인할 수 있어요.</p>
    <label>초대 코드<input value={value} onChange={event => setValue(event.target.value)}
      autoComplete="off" autoCapitalize="characters" spellCheck={false} /></label>
    <button type="submit" disabled={!parsed.success}>학생회 확인</button>
  </form>
}
```

- [ ] **Step 4: 학생회 확인·참여 화면**

`apps/web/src/access/JoinOrganization.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { InvitePreviewResponse, JoinOrganizationResponse } from '@vada/contracts'
import StateMessage from '../shared/ui/StateMessage'

type Props = { code: string; leaveLabel: string; onJoined: (organizationId: string) => void; onLeave: () => void }
type View = { kind: 'loading' } | { kind: 'invalid' } | { kind: 'failed' }
  | { kind: 'ready'; organization: InvitePreviewResponse['organization'] }

// 와이어프레임 INV-01. 학생회를 확인하고 참여한다. 부서는 고르지 않고 미배정으로 등록된다.
export default function JoinOrganization({ code, leaveLabel, onJoined, onLeave }: Props) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [joinFailed, setJoinFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setView({ kind: 'loading' })
    async function load() {
      try {
        const response = await fetch(`/api/invites/${encodeURIComponent(code)}`,
          { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (controller.signal.aborted) return
        if (response.status === 404) return setView({ kind: 'invalid' })
        if (!response.ok) throw new Error('Invite lookup failed')
        const preview = await response.json() as InvitePreviewResponse
        if (controller.signal.aborted) return
        // 이미 참여한 학생회면 묻지 않고 바로 연다.
        if (preview.joined) onJoined(preview.organization.id)
        else setView({ kind: 'ready', organization: preview.organization })
      } catch {
        if (!controller.signal.aborted) setView({ kind: 'failed' })
      }
    }
    void load()
    return () => controller.abort()
  }, [code, attempt])

  async function join() {
    setJoining(true)
    setJoinFailed(false)
    try {
      const response = await fetch('/api/organizations/join', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      if (response.status === 404) return setView({ kind: 'invalid' })
      if (!response.ok) throw new Error('Join failed')
      const { membership } = await response.json() as JoinOrganizationResponse
      onJoined(membership.organization.id)
    } catch {
      setJoinFailed(true)
    } finally {
      setJoining(false)
    }
  }

  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid') return <section aria-label="학생회 참여">
    <StateMessage kind="error">초대 코드가 올바르지 않아요. 다시 확인해 주세요.</StateMessage>
    <button onClick={onLeave}>{leaveLabel}</button>
  </section>
  if (view.kind === 'failed') return <section aria-label="학생회 참여">
    <StateMessage kind="error">초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>
    <button onClick={() => setAttempt(value => value + 1)}>다시 시도</button>
    <button className="button-quiet" onClick={onLeave}>{leaveLabel}</button>
  </section>
  return <section aria-label="학생회 참여">
    <h2>{view.organization.name}에 참여할까요?</h2>
    <p className="hint">참여하면 미배정 구성원으로 등록돼요.</p>
    {joinFailed && <StateMessage kind="error">참여하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</StateMessage>}
    <button disabled={joining} onClick={() => { void join() }}>{joining ? '참여하는 중…' : joinFailed ? '다시 시도' : '참여하기'}</button>
    <button className="button-quiet" disabled={joining} onClick={onLeave}>참여하지 않기</button>
  </section>
}
```

- [ ] **Step 5: 소속이 없을 때 내용을 받게 하기**

`apps/web/src/access/Memberships.tsx`를 바꾼다. `Props`와 함수 시그니처는 다음과 같다.

```tsx
type Props = {
  renderMemberships?: (memberships: MembershipSummary[]) => ReactNode
  renderFallback?: (content: ReactNode) => ReactNode
  // 소속이 없을 때 보여 줄 내용. 앱에서는 초대 코드 입력이다.
  renderEmpty?: () => ReactNode
}
export default function Memberships({ renderMemberships, renderFallback = content => content, renderEmpty }: Props) {
```

`if (result.memberships.length && renderMemberships) ...` 바로 다음에 더한다.

```tsx
  if (!result.memberships.length && renderEmpty) return renderFallback(renderEmpty())
```

소속 없음 문구를 바꾼다. 기존 `<><h2>소속 미지정</h2><p className="hint">테스트 담당자에게 …</p></>`를 아래로 바꾼다.

```tsx
<h2>아직 참여한 학생회가 없어요</h2>
```

- [ ] **Step 6: 방금 참여한 학생회를 먼저 열기**

`apps/web/src/workspace/Workspace.tsx`의 `Props`와 `Workspace`를 바꾼다.

```tsx
type Props = AccountProps & { memberships: MembershipSummary[]; initialOrganizationId?: string }
export default function Workspace({ initialOrganizationId, ...props }: Props) {
  // 초대로 방금 참여한 학생회가 있으면 그 학생회를 먼저 연다.
  const [membershipId, setMembershipId] = useState(() =>
    (props.memberships.find(item => item.organization.id === initialOrganizationId) ?? props.memberships[0])?.id)
```

- [ ] **Step 7: App 연결**

`apps/web/src/App.tsx` 전체를 아래로 바꾼다. `logout()`은 기존과 같다.

```tsx
import { useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import Memberships from './access/Memberships'
import InviteCodeForm from './access/InviteCodeForm'
import JoinOrganization from './access/JoinOrganization'
import { inviteCodeFromPath, invitePath } from './access/invite-path'
import Workspace from './workspace/Workspace'
import StateMessage from './shared/ui/StateMessage'
import { isKakaoInAppBrowser } from './shared/in-app-browser'
import './styles/tokens.css'
import './styles/base.css'
import './App.css'

// 초대 링크(/join/코드)로 왔는지, 소속이 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  const [typedCode, setTypedCode] = useState('')
  const [joinedOrganizationId, setJoinedOrganizationId] = useState<string>()

  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }

  function finishInvite(organizationId: string) {
    leaveInvite()
    setJoinedOrganizationId(organizationId)
  }

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out failed')
    } catch {
      setMessage('로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (!isPending && !error && session) {
    const card = (content: ReactNode) => <main className="auth-card"><p className="eyebrow">학생회를 위한 공간</p><h1>VADA M1</h1><h2>로그인 완료</h2>
      <p>{session.user.name}</p><p className="email">{session.user.email}</p>{content}
      <button disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</button>
    </main>
    return <>
      {message && <StateMessage kind="error" className="app-notice">{message}</StateMessage>}
      {invite ? card(<JoinOrganization key={invite.code} code={invite.code}
        leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'} onJoined={finishInvite} onLeave={leaveInvite} />)
        : <Memberships key={`${session.user.id}:${joinedOrganizationId ?? ''}`}
          renderMemberships={memberships => <Workspace memberships={memberships} initialOrganizationId={joinedOrganizationId}
            user={session.user} logoutBusy={busy} onLogout={() => { void logout() }} />}
          renderEmpty={() => <InviteCodeForm initialCode={typedCode}
            onSubmit={code => { setTypedCode(code); setInvite({ code, from: 'form' }) }} />}
          renderFallback={card} />}
    </>
  }

  return (
    <main className="auth-card">
      <p className="eyebrow">학생회를 위한 공간</p>
      <h1>VADA M1</h1>
      {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? (
        <>
          <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
          <button onClick={() => { void refetch() }}>다시 확인</button>
        </>
      ) : (
        <>
          {invite?.from === 'link' && <p className="hint">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</p>}
          {isKakaoInAppBrowser(navigator.userAgent) && <p className="hint">카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</p>}
          <p>Google 계정으로 로그인해 주세요.</p>
          <button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</button>
        </>
      )}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </main>
  )
}
```

- [ ] **Step 8: 테스트가 통과하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/App.integration.test.tsx src/App.test.tsx src/access/Memberships.test.tsx src/workspace/Workspace.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add apps/web/src
git commit -m "초대 코드 입력과 학생회 참여 화면 추가"
```

---

### Task 7: 사이드바에서 초대 링크와 코드 복사

**Files:**
- Create: `apps/web/src/access/InviteShare.tsx`, `apps/web/src/access/InviteShare.test.tsx`
- Modify: `apps/web/src/workspace/Sidebar.tsx`, `apps/web/src/workspace/Workspace.css`, `apps/web/src/workspace/Workspace.test.tsx`

**Interfaces:**
- Consumes: Task 2의 `MembershipSummary.organization.inviteCode`, Task 5의 링크 형식 `/join/{code}`
- Produces: `InviteShare({ code: string })`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/web/src/access/InviteShare.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import InviteShare from './InviteShare'

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, 'clipboard') })
const clipboard = (writeText: (value: string) => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
const link = () => `${window.location.origin}/join/ABCD2345`

test('copies the invite link and the code separately', async () => {
  const writeText = vi.fn(async (_value: string) => {})
  clipboard(writeText)
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }))
  expect((await screen.findByRole('status')).textContent).toBe('초대 링크를 복사했어요')
  expect(writeText).toHaveBeenLastCalledWith(link())
  fireEvent.click(screen.getByRole('button', { name: '코드 복사' }))
  expect((await screen.findByText('초대 코드를 복사했어요'))).toBeTruthy()
  expect(writeText).toHaveBeenLastCalledWith('ABCD2345')
})

test('shows the link and code to copy by hand when copying is refused', async () => {
  clipboard(vi.fn(async () => { throw new Error('denied') }))
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '초대 링크 복사' }))
  expect((await screen.findByRole('alert')).textContent).toContain('복사하지 못했어요')
  expect((screen.getByLabelText('초대 링크') as HTMLInputElement).value).toBe(link())
  expect((screen.getByLabelText('초대 코드') as HTMLInputElement).value).toBe('ABCD2345')
})

test('a browser without the clipboard API falls back the same way', async () => {
  render(<InviteShare code="ABCD2345" />)
  fireEvent.click(screen.getByRole('button', { name: '코드 복사' }))
  expect(await screen.findByLabelText('초대 코드')).toBeTruthy()
})
```

`apps/web/src/workspace/Workspace.test.tsx`의 `an unassigned member sees 미배정 ...` 테스트 끝에 더한다.

```tsx
  expect(screen.getByRole('button', { name: '초대 링크 복사' })).toBeTruthy()
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/access/InviteShare.test.tsx src/workspace/Workspace.test.tsx`
Expected: FAIL. `./InviteShare`가 없고, 사이드바에 복사 버튼도 없다.

- [ ] **Step 3: 구현**

`apps/web/src/access/InviteShare.tsx`:

```tsx
import { useState } from 'react'
import StateMessage from '../shared/ui/StateMessage'

// 와이어프레임 ORG-03C. 링크와 코드는 같은 초대 권한이다.
export default function InviteShare({ code }: { code: string }) {
  const link = `${window.location.origin}/join/${code}`
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)
  const [failed, setFailed] = useState(false)
  async function copy(kind: 'link' | 'code') {
    try {
      // HTTP 접속이나 오래된 브라우저에는 클립보드 API가 없다.
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(kind === 'link' ? link : code)
      setCopied(kind)
      setFailed(false)
    } catch {
      setCopied(null)
      setFailed(true)
    }
  }
  return <section className="sidebar-invite" aria-label="학생회 초대">
    <button className="button-quiet" onClick={() => { void copy('link') }}>초대 링크 복사</button>
    <button className="button-quiet" onClick={() => { void copy('code') }}>코드 복사</button>
    {copied && <StateMessage kind="notice">{`${copied === 'link' ? '초대 링크를' : '초대 코드를'} 복사했어요`}</StateMessage>}
    {failed && <>
      <StateMessage kind="error">복사하지 못했어요. 아래에서 직접 복사해 주세요.</StateMessage>
      <label>초대 링크<input readOnly value={link} onFocus={event => event.currentTarget.select()} /></label>
      <label>초대 코드<input readOnly value={code} onFocus={event => event.currentTarget.select()} /></label>
    </>}
  </section>
}
```

`apps/web/src/workspace/Sidebar.tsx`에 import `import InviteShare from '../access/InviteShare'`를 더하고, 재정 배지 줄 바로 다음(`</section>` 앞)에 더한다.

```tsx
      <InviteShare code={membership.organization.inviteCode} />
```

`apps/web/src/workspace/Workspace.css`의 `.sidebar-membership p` 줄 다음에 더한다.

```css
.sidebar-invite { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
.sidebar-invite [role="status"], .sidebar-invite [role="alert"], .sidebar-invite label { flex-basis: 100%; margin: 0; }
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd apps/web && npx vitest run --no-file-parallelism src/access/InviteShare.test.tsx src/workspace/Workspace.test.tsx src/App.integration.test.tsx`
Expected: PASS

Run: `npm run typecheck --workspace @vada/web`
Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add apps/web/src
git commit -m "사이드바에서 초대 링크와 코드 복사"
```

---

### Task 8: 문서 반영과 전체 검사

**Files:**
- Modify: `AGENTS.md`, `docs/ERD.md`

- [ ] **Step 1: AGENTS.md 마이그레이션 규칙**

`## 마이그레이션`의 "제약을 추가하는 마이그레이션은 …" 줄 다음에 더한다.

```markdown
- 새 컬럼을 읽는 코드는 반대로, 두 DB에 마이그레이션을 먼저 적용한 뒤 배포한다. 코드가 먼저 나가면 없는 컬럼을 읽다가 해당 요청이 모두 실패한다.
```

- [ ] **Step 2: ERD.md**

`docs/ERD.md`를 다섯 군데 바꾼다.

1. `organizations` 블록에 `text invite_code UK "초대 코드 8자리"`를 더한다.

```
    organizations {
        text id PK
        text name "학생회 이름"
        text invite_code UK "초대 코드 8자리"
    }
```

2. `memberships` 블록의 `text department_id FK`를 `text department_id FK "미배정이면 null"`로 바꾼다.
3. `- \`memberships\`: …` 줄 끝에 "부서는 비어 있을 수 있다(초대로 들어온 미배정 구성원). 비어 있으면 복합 외래 키를 검사하지 않는다."를 더한다. 그 위에 다음 줄을 더한다.

```markdown
- `organizations`: `invite_code`는 학생회마다 하나인 8자리 초대 코드다. 헷갈리는 0·1·I·O를 뺀 대문자·숫자로 이루어진다. DB 함수 `vada_invite_code()`가 기본값을 만들고, CHECK가 형식을 지킨다.
```

4. `purchase_requests` 블록의 `text department_id FK`를 `text department_id FK "미배정 요청자면 null"`로 바꾼다.
5. `- \`purchase_requests\`: …` 줄의 "요청 부서는 기록된 ID를 유지하며 소속 변경에 따라 바뀌지 않는다." 다음에 "요청자가 미배정이면 부서는 비어 있다."를 더한다.

- [ ] **Step 3: 전체 검사**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test --workspace @vada/api`
Expected: 실패 0

Run: `npm test --workspace @vada/contracts`
Expected: 실패 0

Run: `cd apps/web && npx vitest run --no-file-parallelism`
Expected: 실패 0

Run: `npm run build --workspace @vada/web`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add AGENTS.md docs/ERD.md
git commit -m "가입·초대 규칙을 문서에 반영"
```

---

### Task 9: 마이그레이션 적용, 병합, 운영 확인 (DB 적용은 승인 필요)

**Files:**
- Create (git 제외 임시 폴더): `.superpowers/apply-0009.mts`

새 코드는 페이지를 열 때마다 `invite_code`를 읽는다. 그래서 반드시 **두 DB 적용 → main 병합·푸시** 순서로 한다. 푸시하면 Render가 바로 배포하므로 순서를 바꾸지 않는다.

- [ ] **Step 1: 점검·적용 스크립트 작성**

`.superpowers/apply-0009.mts`. 0008 때 쓴 스크립트와 같은 방식이며, 접속 주소와 오류 원문은 출력하지 않는다.

```ts
// 일회용: dev 또는 preview DB에 마이그레이션 0009를 점검(기본)하거나 적용(--apply)한다. 접속 주소와 오류 원문은 출력하지 않는다.
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
if (local.at(-1)?.tag !== '0009_organization_invite_code') { console.log('STOP: 0009 is not the latest local migration'); process.exit(1) }

const sql = postgres(target === 'dev' ? devUrl : previewUrl, { max: 1, ssl: { rejectUnauthorized: true }, connect_timeout: 20, onnotice: () => {} })
async function inspect(label: string) {
  const applied = await sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at, id`
  const inOrder = applied.every((row, i) => local[i] !== undefined && row.hash === local[i]!.hash && Number(row.created_at) === local[i]!.when)
  const [column] = await sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'invite_code'`
  const hasCode = column!.n === 1
  const [counts] = await sql`SELECT (SELECT count(*)::int FROM organizations) AS organizations, (SELECT count(*)::int FROM memberships) AS memberships, (SELECT count(*)::int FROM purchase_requests) AS requests`
  let valid = 0, unique = 0
  if (hasCode) {
    const [codes] = await sql`SELECT count(*) FILTER (WHERE invite_code ~ '^[2-9A-HJ-NP-Z]{8}$')::int AS valid, count(DISTINCT invite_code)::int AS unique_codes FROM organizations`
    valid = codes!.valid as number
    unique = codes!.unique_codes as number
  }
  const state = { applied: applied.length, inOrder, hasCode, organizations: counts!.organizations as number,
    memberships: counts!.memberships as number, requests: counts!.requests as number, valid, unique }
  console.log(`[${target} ${label}] applied ${state.applied}/${local.length} (in order: ${state.inOrder}) | invite_code ${state.hasCode ? 'present' : 'absent'} | organizations ${state.organizations} (valid ${state.valid}, unique ${state.unique}) | memberships ${state.memberships} | purchase_requests ${state.requests}`)
  return state
}

try {
  const before = await inspect('before')
  if (process.argv.includes('--apply')) {
    if (!before.inOrder || before.applied !== local.length - 1 || before.hasCode) {
      console.log('STOP: expected exactly 0009 pending and no invite_code column')
      process.exitCode = 1
    } else {
      await migrate(drizzle(sql), { migrationsFolder: migrations })
      const after = await inspect('after')
      const ok = after.applied === local.length && after.inOrder && after.hasCode
        && after.valid === after.organizations && after.unique === after.organizations
        && after.organizations === before.organizations && after.memberships === before.memberships && after.requests === before.requests
      console.log(ok ? 'MIGRATION_0009_APPLIED' : 'CHECK_FAILED_AFTER_MIGRATE')
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

Run: `npx tsx .superpowers/apply-0009.mts dev` 다음 `npx tsx .superpowers/apply-0009.mts preview`
Expected: 둘 다 `applied 9/10 (in order: true) | invite_code absent | …`가 나온다. `FAILED CONNECT_TIMEOUT`이면 학교 와이파이가 5432 포트를 막은 것이다. 사용자에게 네트워크를 바꿔 달라고 요청한다.

- [ ] **Step 3: 승인 받기**

두 DB의 점검 결과(적용 수, 학생회·소속·구매 요청 수)를 보여 주고, AskUserQuestion으로 적용 여부를 묻는다. 승인 전에는 다음 단계로 가지 않는다.

- [ ] **Step 4: 적용**

Run: `npx tsx .superpowers/apply-0009.mts dev --apply` 다음 `npx tsx .superpowers/apply-0009.mts preview --apply`
Expected: 둘 다 `MIGRATION_0009_APPLIED`가 나온다. 하나라도 `STOP`이나 `CHECK_FAILED_AFTER_MIGRATE`가 나오면 멈추고 보고한다. 그 경우 병합하지 않는다.

- [ ] **Step 5: 병합과 푸시**

```bash
git switch main
git merge --ff-only invite-join
git push origin main
```

Expected: fast-forward로 병합된다. 푸시하면 GitHub Actions CI와 Render 자동 배포가 시작된다.

- [ ] **Step 6: CI와 배포 확인**

Run: `gh run list --branch main --limit 1`
Expected: 최신 실행이 `completed success`다(진행 중이면 끝날 때까지 기다린다).

새 버전이 배포되면 초대 API가 404 대신 401로 답한다. 최대 15분 동안 1분 간격으로 아래를 확인한다.

Run: `curl -s -o /dev/null -w "%{http_code}\n" --max-time 90 https://vada-m1.onrender.com/api/invites/ZZZZ9999`
Expected: `401`

Run: `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" --max-time 90 https://vada-m1.onrender.com/join/ZZZZ9999`
Expected: `200 text/html; charset=UTF-8`

- [ ] **Step 7: 사용자 확인 요청**

Google 로그인과 카카오톡이 필요해 사용자가 직접 확인한다. 아래를 순서대로 안내한다.
1. 운영 화면 사이드바에 [초대 링크 복사]와 [코드 복사]가 보이는지 확인한다. 링크를 복사한다.
2. 카카오톡 '나와의 채팅'에 링크를 보내고 휴대폰에서 누른다. 기본 브라우저(Chrome이나 Safari)로 넘어가는지 확인한다. 넘어가지 않으면 로그인 화면에 '다른 브라우저로 열기' 안내가 보이는지 확인한다.
3. 기본 브라우저에서 로그인한다. 이미 소속이므로 [참여하기] 없이 학생회 화면이 열리는지 확인한다.
4. (선택) 학생회 소속이 없는 다른 Google 계정이 있으면 확인한다.
   - 링크로 들어가 [참여하기]를 누른다. 사이드바에 "미배정"이 보여야 한다.
   - 코드 입력 화면에서 코드를 직접 입력해도 같은 결과가 나와야 한다.

- [ ] **Step 8: 정리**

Run: `git branch -d invite-join`
Expected: 병합된 브랜치라 지워진다. 권한 설정이 거부하면 사용자에게 알리고 남겨 둔다.
