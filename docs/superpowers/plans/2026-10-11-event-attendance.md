# M3c 행사 참석 확인 구현 계획

> **For agentic workers:** 이 저장소는 사용자가 정한 방식(직접 구현 TDD → 새 컨텍스트 Opus 최종 리뷰)으로 실행한다. superpowers:executing-plans로 작업을 차례로 하고, 단계는 체크박스(`- [ ]`)로 따라간다.

**Goal:** 신청자마다 참석 확인 QR을 주고, 운영진이 참가자 탭의 스캐너(휴대폰 카메라)나 명단의 이름 찾기로 참석을 남긴다.

**Architecture:**
- QR 글자는 `VADA:` + 개인 링크 토큰의 SHA-256(대문자)이다. DB의 `token_hash`를 그대로 찾는 열쇠로 쓰므로 새 열쇠 칸이 없다.
- 참석은 `registrations`의 두 칸(`checked_in_at`, `checked_in_by`)이고, 조건을 건 `UPDATE` 하나로 바꾼다.
- 스캐너는 카메라 프레임을 캔버스로 줄여 `zxing-wasm` reader로 읽는다. wasm은 Vite가 `/assets/`에 내보낸 우리 파일이다.

**Tech Stack:** Hono, drizzle-orm(PostgreSQL·PGlite), zod 4, React 19 + Tailwind, uqr(QR 만들기), zxing-wasm(QR 읽기), vitest, node:test.

**Spec:** `docs/superpowers/specs/2026-10-11-event-attendance-design.md`

## Global Constraints

- 요청 본문은 contracts의 `z.strictObject`, 문자열은 `text(max)`/`token(max)`. 스캔 본문은 `{ code: token(64) + 소문자 16진 64자 }`, 나머지 둘은 `{}`.
- 라우트는 `json(Schema)`를 인증보다 앞에 두고 `c.req.valid('json')`만 쓴다. 실패는 `ApiError(code, status)`. 새 오류 코드는 `CHECKED_IN`(409)과 `NOT_CHECKED_IN`(409)이다.
- 0023은 새 칸 둘과 그 칸에 거는 FK·CHECK만 더한다. 새 코드가 새 칸을 읽으므로 두 DB에 먼저 적용하고 배포한다.
- 참석은 행사 행을 잠그지 않고, 정산 여부를 보지 않는다(`requireOpenEvents`를 쓰는 `entryOf`를 쓰지 않는다).
- QR 글자: `VADA:` + 대문자 64자. 읽을 때는 앞뒤 공백을 빼고 대소문자를 가리지 않는다.
- 판독기는 스캐너를 열 때만 동적 `import('zxing-wasm/reader')`로 받는다. wasm 주소는 `zxing-wasm/reader/zxing_reader.wasm?url`이다. 외부 CDN 주소를 쓰지 않는다.
- 화면은 `components/ui` 부품과 Tailwind 기본 스케일·테마 토큰만 쓴다. 긴 이름에는 `wrap-anywhere`를 준다. 체크박스 말고 날것의 `<button>`·`<input>`에 모양을 주지 않는다.
- 화면 문구는 spec "화면 문구" 표 그대로 쓴다.
- 로그와 오류 응답에 코드·학번·이름을 넣지 않는다.
- 시간에 기대는 API 테스트는 2999년 시계(`prepare`)나 SQL로 정한 시각만 쓴다.
- 커밋 제목은 한국어 명령형 50자 안이다. AI 서명·트레일러를 붙이지 않는다.
- 새 API 테스트 파일은 `apps/api/package.json`의 `test` 목록에 더한다.
- 이 PC에서 API 테스트 여러 파일은 `npx tsx --test --test-concurrency=2 <파일들>`로 돌린다(메모리).

## Review Focus

1. 스캔 요청이 끝나기 전에 대화상자를 닫음: 닫은 뒤 결과를 그리거나 카메라를 다시 켜지 않아야 한다 → Task 7 테스트
2. 같은 QR이 계속 화면에 있음: [다음]을 누르기 전에는 다시 보내지 않고, 누른 뒤 같은 QR이면 "이미 참석했어요"여야 한다 → Task 7 테스트
3. 스캐너를 연 채 화면이 숨었다가 다시 보임: 숨으면 카메라를 끄고, 보이면 다시 켜야 한다 → Task 7 테스트
4. 보관 기간이 지나 지워진 신청의 QR: `NOT_FOUND`여야 하고, 참석 수에는 남아야 한다 → Task 3 테스트
5. 학생이 내 신청을 열어 둔 사이 운영진이 참석을 확인하고, 학생이 취소를 누름: `CHECKED_IN`으로 막히고 화면이 다시 불러와 "참석 확인됨"을 보여야 한다 → Task 5 테스트

---

### Task 1: 참석 확인 계약

**Files:**
- Modify: `packages/contracts/src/registrations.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/registrations.test.ts`

**Interfaces (Produces):**
- `CheckInScanSchema = z.strictObject({ code })`, `CheckInScanRequest`
- `CheckInActionSchema = z.strictObject({})`
- `checkInQrText(code: string): string`, `checkInCodeOf(text: string): string | null`
- `RegistrationFormView.checkedIn: number`
- `RegistrationEntry.checkedIn: { at: string; by: ExpensePerson } | null`
- `CheckInScanResponse extends RegistrationResponse { checkIn: { registrationId: string; already: boolean } }`
- `MyRegistration.checkInCode: string | null`, `MyRegistration.checkedInAt: string | null`

- [ ] **Step 1: 실패하는 계약 테스트**

```ts
const code = 'a'.repeat(32) + '0123456789abcdef'.repeat(2)
test('참석 확인 스캔: 소문자 16진 64자 코드만 받는다', () => {
  assert.equal(isStrictObject(CheckInScanSchema), true)
  assert.equal(isStrictObject(CheckInActionSchema), true)
  assert.deepEqual(CheckInScanSchema.parse({ code: ` ${code} ` }), { code })
  rejects(CheckInScanSchema, [{}, { code: '' }, { code: '   ' }, { code: code.slice(1) }, { code: `${code}0` }, { code: code.toUpperCase() },
    { code: `${code.slice(1)}g` }, { code: `${code.slice(2)}${emoji}` }, { code: `${code.slice(1)}${nul}` }, { code: `${code.slice(1)}${lone}` },
    { code, extra: 1 }, { code: 1 }])
  accepts(CheckInActionSchema, [{}])
  rejects(CheckInActionSchema, [{ code }, { extra: 1 }])
})

test('참석 확인 QR 글자: VADA:와 대문자 코드이고, 읽을 때 앞뒤 공백과 대소문자를 가리지 않는다', () => {
  assert.equal(checkInQrText(code), `VADA:${code.toUpperCase()}`)
  assert.equal(checkInCodeOf(checkInQrText(code)), code)
  assert.equal(checkInCodeOf(`  vada:${code}\n`), code)
  for (const text of ['', code, `VADA:${code.slice(1)}`, `VADA:${code}0`, `VADA:${code.slice(1)}G`, `VADB:${code}`, `VADA: ${code}`,
    `https://vada-m1.onrender.com/r#${code}`, `VADA:${code}VADA:${code}`]) assert.equal(checkInCodeOf(text), null, text)
})
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/registrations.test.ts`(packages/contracts) → import 실패
- [ ] **Step 3: 구현**

```ts
// 참석 확인(M3c). 코드는 개인 링크 토큰의 SHA-256(소문자 16진 64자)이고 DB의 token_hash와 같다.
// 해시라서 QR이 새도 내 신청을 보거나 취소할 수 없다(토큰이 있어야 한다).
const checkInCode = /^[0-9a-f]{64}$/
export const CheckInScanSchema = z.strictObject({ code: token(64).refine(value => checkInCode.test(value)) })
// 이름으로 찾아 참석 확인과 확인 취소에는 본문이 없다.
export const CheckInActionSchema = z.strictObject({})
export type CheckInScanRequest = z.infer<typeof CheckInScanSchema>
// QR에는 앞에 VADA:를 붙이고 대문자로 담는다. 대문자는 QR 영숫자 모드라 작게 그려진다(버전 4).
export const checkInQrText = (code: string) => `VADA:${code.toUpperCase()}`
// 스캐너가 읽은 글자에서 코드를 꺼낸다. 참가 신청 QR이 아니면 null이다.
export function checkInCodeOf(text: string): string | null {
  const match = /^VADA:([0-9A-F]{64})$/i.exec(text.trim())
  return match ? match[1]!.toLowerCase() : null
}
```

`RegistrationFormView`에 `checkedIn: number`를 더한다. 주석은 "참석을 확인한 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다."다. 나머지 타입은 위 Interfaces 그대로 주석을 달아 더한다. 주석 내용은 다음과 같다.
- `RegistrationEntry.checkedIn`: 참석 확인(한국 시각과 확인한 사람). 확인 전이면 null이다.
- `CheckInScanResponse.checkIn.already`: 찍기 전에 이미 참석이었는지
- `MyRegistration.checkInCode`: 참석 확인 QR의 코드. 취소 응답이면 null이다.
- `MyRegistration.checkedInAt`: 참석을 확인한 한국 시각
- `cancellable` 주석: "마감 전이고 입금·참석을 확인하지 않았으면 스스로 취소할 수 있다."

`index.ts`에서 새 스키마·함수·타입을 내보낸다.
- [ ] **Step 4: 통과 확인** — `npm test --workspace @vada/contracts`
- [ ] **Step 5: 커밋** — `참석 확인 계약 추가`

### Task 2: 참석 칸과 마이그레이션 0023

**Files:**
- Modify: `apps/api/src/db/schema.ts`(`registrations`)
- Create: `apps/api/migrations/0023_event_attendance.sql`, `meta/0023_snapshot.json`, `meta/_journal.json`(drizzle-kit 생성)
- Test: `apps/api/src/db/migrations.test.ts`

- [ ] **Step 1: 실패하는 마이그레이션 테스트** — 0022 테스트 뒤에 더한다

```ts
test('0023 adds attendance to registrations without touching existing registrations', async (t) => {
  const pg = new PGlite()
  const previous = migrationsBefore('0023_event_attendance')
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: previous.folder })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('u','기획','u@example.test');
      INSERT INTO organizations (id,name) VALUES ('o','Council');
      INSERT INTO events (id,organization_id,name,created_by,starts_at) VALUES ('e','o','체육대회','u','2026-08-20T10:00+09');
      INSERT INTO registration_forms (id,organization_id,event_id,closes_at,created_by) VALUES ('f','o','e','2026-08-19T23:59+09','u');
      INSERT INTO registrations (id,organization_id,form_id,token_hash,name,student_id) VALUES ('r','o','f','${'0'.repeat(64)}','김바다','2022000001');
      INSERT INTO registrations (id,organization_id,form_id,cancelled_at,cancelled_by,purged_at) VALUES ('c','o','f',now(),'u',now());
    `)
    const before = await pg.query<Record<string, unknown>>('SELECT * FROM registrations ORDER BY id')
    await migrate(db, { migrationsFolder })
    const update = (change: string, id: string) => pg.exec(`UPDATE registrations SET ${change} WHERE id = '${id}'`)

    await t.test('existing registrations keep their values and are not checked in', async () => {
      const after = await pg.query<Record<string, unknown>>('SELECT * FROM registrations ORDER BY id')
      assert.deepEqual(sameColumns(after.rows, before.rows), before.rows)
      assert.deepEqual(after.rows.map(row => [row.checked_in_at, row.checked_in_by]), [[null, null], [null, null]])
    })
    await t.test('attendance time and staff come together, a cancelled registration has none, and the staff must exist', async () => {
      await assert.rejects(update('checked_in_at = now()', 'r'), { constraint: 'registrations_checked_in_pair' })
      await assert.rejects(update("checked_in_by = 'u'", 'r'), { constraint: 'registrations_checked_in_pair' })
      await assert.rejects(update("checked_in_at = now(), checked_in_by = 'nobody'", 'r'), { constraint: 'registrations_checked_in_by_users_id_fk' })
      await assert.rejects(update("checked_in_at = now(), checked_in_by = 'u'", 'c'), { constraint: 'registrations_cancelled_not_checked_in' })
      await update("checked_in_at = now(), checked_in_by = 'u'", 'r')
      // 보관 기간이 지나 개인 칸을 지워도 참석 칸은 남는다.
      await update('token_hash = NULL, name = NULL, student_id = NULL, purged_at = now()', 'r')
      await assert.rejects(update('cancelled_at = now()', 'r'), { constraint: 'registrations_cancelled_not_checked_in' })
    })
  } finally {
    previous.remove()
    await pg.close()
  }
})
```

- [ ] **Step 2: 실패 확인** — `npx tsx --test src/db/migrations.test.ts`(apps/api) → `0023_event_attendance`가 없어 실패
- [ ] **Step 3: 스키마** — `registrations`의 입금 칸 아래에 더한다

```ts
  // 참석 확인(M3c). 둘이 함께 있거나 함께 없다. 개인 칸을 지워도 남아 참석 수로 센다. 취소한 신청에는 없다.
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedInBy: text('checked_in_by').references(() => users.id, { onDelete: 'restrict' }),
```

CHECK 두 개를 표 설정 끝에 더한다.

```ts
  check('registrations_checked_in_pair', sql`(${table.checkedInAt} IS NULL) = (${table.checkedInBy} IS NULL)`),
  check('registrations_cancelled_not_checked_in', sql`${table.cancelledAt} IS NULL OR ${table.checkedInAt} IS NULL`),
```

- [ ] **Step 4: 생성** — `npx drizzle-kit generate --name event_attendance`(apps/api). 생성된 SQL에 위 두 칸·FK·CHECK 둘만 있는지 본다. 줄바꿈은 `.gitattributes`가 LF로 고정한다.
- [ ] **Step 5: 통과 확인** — `npx tsx --test src/db/migrations.test.ts src/db/schema.test.ts`
- [ ] **Step 6: 커밋** — `참석 칸과 마이그레이션 0023 추가`

### Task 3: 참석 확인 API

**Files:**
- Modify: `apps/api/src/registrations/service.ts`, `routes.ts`, `test-setup.ts`
- Create: `apps/api/src/registrations/attendance.test.ts`(package.json `test` 목록에 더함)
- Modify tests: `public.test.ts`(내 신청 전체 비교), `registrations.test.ts`(명단 줄 전체 비교)

**Interfaces:**
- Consumes: Task 1의 스키마·타입, Task 2의 칸
- Produces: `POST .../registration/check-in` → `CheckInScanResponse`, `POST .../entries/:id/check-in`·`/check-in/cancel` → `RegistrationResponse`

- [ ] **Step 1: test-setup 도우미**

```ts
export const checkIn = (env: Env, id: string, body: unknown = {}) => env.request('POST', `${registrationBase}/entries/${id}/check-in`, body)
export const uncheck = (env: Env, id: string, body: unknown = {}) => env.request('POST', `${registrationBase}/entries/${id}/check-in/cancel`, body)
export const scan = (env: Env, body: unknown) => env.request('POST', `${registrationBase}/check-in`, body)
// 내 신청이 주는 참석 확인 코드: 토큰의 SHA-256
export const codeOf = (token: string) => createHash('sha256').update(token).digest('hex')
```

- [ ] **Step 2: 실패하는 API 테스트** — `attendance.test.ts`(모두 `setupPurchases` + `prepare`)
  1. **QR로 참석 확인**
     - `create(env, { fee: 5000 })` 뒤 둘을 신청한다(박참여는 입금 전).
     - 박참여의 `codeOf(token)`으로 `scan` → `checkIn: { registrationId, already: false }`, `form.checkedIn` 1, 그 줄의 `checkedIn.by` `{ id: 'p', name: '기획' }`, `checkedIn.at`은 한국 시각, `paid`는 null(입금 전도 막지 않음)
     - 같은 코드를 `q`(기획2)로 다시 찍는다 → `already: true`, `checkedIn.by.id`는 여전히 `p`, 참석 수 1
  2. **찾을 수 없음**
     - 모르는 코드(`'f'.repeat(64)`), e2 행사의 신청 코드(e 경로로), 취소한 신청의 옛 코드는 모두 `NOT_FOUND`다.
     - 다른 학생회 행사 `ex`의 경로는 `x`로 로그인해도 e의 코드를 찾지 못한다. ex에 참가 신청이 없으므로 404다.
  3. **이름으로 참석 확인**
     - `checkIn` → 참석이 되고, 다시 하면 `CHECKED_IN`이다.
     - `uncheck` → 두 칸이 비고, 다시 하면 `NOT_CHECKED_IN`이다.
     - 취소한 신청, `'missing'`은 `NOT_FOUND`다.
  4. **정산한 행사도 된다:** payments.test.ts의 정산 순서(기간 만들기 → 편성 → `finance/settle`)대로 정산한 뒤에도 `scan`·`checkIn`·`uncheck`가 된다.
  5. **취소 막기**
     - 참석한 신청의 운영진 취소와 스스로 취소는 둘 다 `CHECKED_IN`이다. 내 신청의 `cancellable`은 false, `checkedInAt`은 한국 시각이다.
     - `uncheck` 뒤에는 `cancellable`이 true이고 스스로 취소가 된다.
  6. **보관 기간**
     - 참석한 신청이 있는 채로 행사 날짜를 2024년으로 바꾼다 → 명단 0명, `form.checkedIn` 1이다.
     - DB의 `checked_in_at`은 남는다.
     - 지운 신청의 옛 코드로 `scan`하면 `NOT_FOUND`다(Review Focus 4).
  7. **내 신청**
     - `checkInCode === codeOf(token)`이고 `checkInCodeOf(checkInQrText(checkInCode))`가 같은 코드다.
     - 확인 전 `checkedInAt`은 null이다.
     - 취소 응답의 `checkInCode`·`checkedInAt`은 null이다.
  8. **권한과 본문**
     - `n`·`x`는 셋 모두 403이고, 미인증은 401이다.
     - 본문이 틀리면 인증 전에 400 `INVALID_INPUT`이다.
       - `scan`: `{}`, `{ code: '' }`, `{ code: '   ' }`, 63자, 65자, 대문자, `${code.slice(2)}😀`, NUL, 홀로 쓰인 서러게이트, `{ code, extra: 1 }`
       - 나머지 둘: `{ extra: 1 }`
     - DB에는 아무 참석도 남지 않는다.
- [ ] **Step 3: 실패 확인** — `npx tsx --test src/registrations/attendance.test.ts` → 404(경로 없음)로 실패
- [ ] **Step 4: 서비스 구현** (`service.ts`)

```ts
const checkers = alias(users, 'check_in_staff')
// 참석을 확인한 신청 수. 보관 기간이 지나 정보를 지운 신청도 센다. 취소한 신청에는 참석 기록이 없다(CHECK).
async function checkedInOf(db: Reader, formId: string) {
  const [row] = await db.select({ value: count() }).from(registrations)
    .where(and(eq(registrations.formId, formId), isNotNull(registrations.checkedInAt)))
  return row?.value ?? 0
}
```

  - `formView`는 `checkedIn: number`를 받아 넣는다. `view`는 `await checkedInOf(tx, form.id)`를 넘긴다.
  - 명단 조회에 `checkerName: checkers.name`과 `leftJoin(checkers, eq(checkers.id, registrations.checkedInBy))`를 더한다.
  - 줄에는 `checkedIn: row.checkedInAt && row.checkedInBy ? { at: koreanOf(row.checkedInAt), by: { id: row.checkedInBy, name: checkerName ?? '' } } : null`을 넣는다.

```ts
  // 참석 확인 앞에 부른다. 참석은 정산과 관계없어 행사 행을 잠그지 않는다. 지울 정보를 먼저 지우고 지우지 않은 신청을 찾는다.
  async function attendeeOf(tx: Writer, scope: RegistrationScope, eventId: string, match: SQL) {
    const form = await formOf(tx, scope.organizationId, eventId)
    if (!form) throw new ApiError('NOT_FOUND', 404)
    await purgeExpired(tx, form.id)
    const [row] = await tx.select().from(registrations).where(and(eq(registrations.formId, form.id), match, isNull(registrations.purgedAt)))
    if (!row) throw new ApiError('NOT_FOUND', 404)
    return row
  }
  // 참석으로 남긴다. 그사이 남이 먼저 확인했으면 false다. 그사이 지워졌으면 NOT_FOUND다.
  async function markCheckedIn(tx: Writer, userId: string, registrationId: string) {
    const [updated] = await tx.update(registrations).set({ checkedInAt: sql`now()`, checkedInBy: userId })
      .where(and(eq(registrations.id, registrationId), isNull(registrations.checkedInAt), isNull(registrations.purgedAt)))
      .returning({ id: registrations.id })
    if (updated) return true
    const [current] = await tx.select({ purgedAt: registrations.purgedAt }).from(registrations).where(eq(registrations.id, registrationId))
    if (!current || current.purgedAt) throw new ApiError('NOT_FOUND', 404)
    return false
  }
```

  반환 객체에 더한다.

```ts
    // QR로 참석 확인. 코드는 개인 링크 토큰의 해시다. 이미 참석이면 바꾸지 않고 already로 알린다.
    checkInByCode: (scope: RegistrationScope, eventId: string, code: string) => db.transaction(async (tx): Promise<CheckInScanResponse> => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.tokenHash, code))
      const already = row.checkedInAt !== null || !await markCheckedIn(tx, scope.userId, row.id)
      return { ...await view(tx, scope.organizationId, eventId), checkIn: { registrationId: row.id, already } }
    }),
    // 이름으로 찾아 참석 확인. QR을 못 꺼내는 사람을 위한 것이다.
    checkIn: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.id, registrationId))
      if (row.checkedInAt || !await markCheckedIn(tx, scope.userId, row.id)) throw new ApiError('CHECKED_IN', 409)
      return view(tx, scope.organizationId, eventId)
    }),
    // 참석 확인 취소. 잘못 찍거나 눌렀을 때 쓴다.
    cancelCheckIn: (scope: RegistrationScope, eventId: string, registrationId: string) => db.transaction(async tx => {
      const row = await attendeeOf(tx, scope, eventId, eq(registrations.id, registrationId))
      if (!row.checkedInAt) throw new ApiError('NOT_CHECKED_IN', 409)
      const [updated] = await tx.update(registrations).set({ checkedInAt: null, checkedInBy: null })
        .where(and(eq(registrations.id, row.id), isNotNull(registrations.checkedInAt), isNull(registrations.purgedAt)))
        .returning({ id: registrations.id })
      if (!updated) {
        const [current] = await tx.select({ purgedAt: registrations.purgedAt }).from(registrations).where(eq(registrations.id, row.id))
        throw !current || current.purgedAt ? new ApiError('NOT_FOUND', 404) : new ApiError('NOT_CHECKED_IN', 409)
      }
      return view(tx, scope.organizationId, eventId)
    }),
```

  - **운영진 취소:** `UPDATE` 조건에 `isNull(registrations.checkedInAt)`을 더한다. 0행이면 `(formId, id)`로 다시 읽는다. 지우지 않았고 참석이면 `CHECKED_IN`, 아니면 `NOT_FOUND`다.
  - **스스로 취소**
    - `PAYMENT_CONFIRMED` 검사 뒤에 `if (current.registration.checkedInAt) throw new ApiError('CHECKED_IN', 409)`를 둔다.
    - `UPDATE` 조건에 `isNull(registrations.checkedInAt)`을 더한다. 0행이면 다시 읽어 `paidAt`이 있으면 `PAYMENT_CONFIRMED`, 아니면 `CHECKED_IN`이다.
  - **`myView`**
    - `checkInCode: registration.tokenHash`, `checkedInAt: registration.checkedInAt && koreanOf(registration.checkedInAt)`
    - `cancellable`에 `&& registration.checkedInAt === null`을 더한다.
    - 취소 응답에는 `checkInCode: null, checkedInAt: null`을 더한다.
- [ ] **Step 5: 라우트** (`routes.ts`, 입금 경로 아래)

```ts
  // 참석 확인: QR로 찍기, 이름으로 확인, 확인 취소
  routes.post(`${base}/check-in`, json(CheckInScanSchema), auth, member, manager, async c =>
    c.json(await service.checkInByCode(scope(c), eventId(c), c.req.valid('json').code)))
  routes.post(`${base}/entries/:registrationId/check-in`, json(CheckInActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.checkIn(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
  routes.post(`${base}/entries/:registrationId/check-in/cancel`, json(CheckInActionSchema), auth, member, manager, async c =>
    c.json(reply(await service.cancelCheckIn(scope(c), eventId(c), idOf(c.req.param('registrationId'))))))
```

- [ ] **Step 6: 기존 테스트 고침**
  - `public.test.ts`의 내 신청 전체 비교에 `checkInCode: codeOf(token), checkedInAt: null`을 더한다.
  - 그 테스트의 취소 응답 비교에 `cancelled.checkInCode`·`cancelled.checkedInAt`(null)을 더한다.
  - `registrations.test.ts`의 명단 줄 전체 비교에 `checkedIn: null`을 더한다.
- [ ] **Step 7: 통과 확인** — `npx tsx --test --test-concurrency=2 src/registrations/attendance.test.ts src/registrations/public.test.ts src/registrations/registrations.test.ts src/registrations/payments.test.ts src/registrations/purge.test.ts src/http/boundary.test.ts`, `npm run typecheck --workspace @vada/api`
- [ ] **Step 8: 커밋** — `QR과 이름으로 참석 확인하는 API`

### Task 4: QR 부품과 판독 왕복

**Files:**
- Modify: `apps/web/package.json`(`uqr` 0.1.3, `zxing-wasm` 3.1.5, 정확한 버전), `package-lock.json`
- Create: `apps/web/src/lib/qr-code.ts`, `apps/web/src/components/QrCode.tsx`, `apps/web/src/registrations/qr-reader.ts`
- Modify: `apps/web/src/ui-gallery/Gallery.tsx`
- Test: `apps/web/src/lib/qr-code.test.ts`(node 환경), `apps/web/src/ui-gallery/Gallery.test.tsx`

**Interfaces (Produces):**
- `qrMatrix(text: string): boolean[][]`: 여백 2칸을 넣은 정사각 칸(true = 검정)
- `QrCode({ value, label, className })`: `role="img"`, `aria-label={label}`인 SVG
- `readerOptions: ReaderOptions`(`formats: ['QRCode']`, `tryHarder: true`, `maxNumberOfSymbols: 1`)
- `QrReader = { read(video: HTMLVideoElement): Promise<string | null> }`, `loadQrReader(): Promise<QrReader>`

- [ ] **Step 1: 실패하는 왕복 테스트** (`qr-code.test.ts`)

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { checkInQrText } from '@vada/contracts'
import { readerOptions } from '../registrations/qr-reader'
import { qrMatrix } from './qr-code'

// 칸 하나를 scale 픽셀로 그린 흑백 그림(RGBA). 스캐너가 캔버스에서 꺼내는 그림과 같은 모양이다.
function imageOf(matrix: boolean[][], scale = 4) {
  const size = matrix.length * scale
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = matrix[Math.floor(y / scale)]![Math.floor(x / scale)] ? 0 : 255
    data.set([value, value, value, 255], (y * size + x) * 4)
  }
  return { data, width: size, height: size, colorSpace: 'srgb' as const }
}

test('QrCode가 그리는 칸을 스캐너의 판독기로 읽으면 같은 글자가 나온다', async () => {
  const wasm = readFileSync(createRequire(import.meta.url).resolve('zxing-wasm/reader/zxing_reader.wasm'))
  await prepareZXingModule({ overrides: { wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength) }, fireImmediately: true })
  const text = checkInQrText('0123456789abcdef'.repeat(4))
  const matrix = qrMatrix(text)
  // 대문자라 영숫자 모드: 버전 4(33칸) + 여백 2칸씩
  expect(matrix.length).toBe(37)
  const [result] = await readBarcodes(imageOf(matrix), readerOptions)
  expect(result?.text).toBe(text)
})
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/qr-code.test.ts`(apps/web) → 모듈 없음
- [ ] **Step 3: 구현**

```ts
// lib/qr-code.ts
import { encode } from 'uqr'
// QR 칸(true = 검정). 오류 정정 M, 여백 2칸이다. 휴대폰 화면을 찍을 때 반사·기울기를 견디는 보통 수준이다.
export const qrMatrix = (text: string): boolean[][] => encode(text, { ecc: 'M', border: 2 }).data
```

```tsx
// components/QrCode.tsx
import { qrMatrix } from '@/lib/qr-code'
import { cn } from '@/lib/utils'

type Props = { value: string; label: string; className?: string }
// 글자를 QR(SVG)로 그린다. 판독이 잘 되게 검정·흰색으로 고정한다. 표시만 하고 API를 부르지 않는다.
export function QrCode({ value, label, className }: Props) {
  const matrix = qrMatrix(value)
  const path = matrix.flatMap((row, y) => row.map((dark, x) => dark ? `M${x} ${y}h1v1h-1z` : '')).join('')
  return <svg role="img" aria-label={label} viewBox={`0 0 ${matrix.length} ${matrix.length}`} shapeRendering="crispEdges"
    className={cn('bg-white', className)}><path d={path} className="fill-black" /></svg>
}
```

```ts
// registrations/qr-reader.ts
import type { ReaderOptions } from 'zxing-wasm/reader'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// 참석 확인 QR만 읽는다. 휴대폰 화면의 QR은 반사·기울기가 있어 tryHarder를 켠다.
export const readerOptions: ReaderOptions = { formats: ['QRCode'], tryHarder: true, maxNumberOfSymbols: 1 }
// 프레임을 이 크기(긴 변)까지 줄여 읽는다. 휴대폰에서도 한 번에 수십 ms 안이다.
const longSide = 640
export type QrReader = { read: (video: HTMLVideoElement) => Promise<string | null> }

let module: Promise<typeof import('zxing-wasm/reader')> | null = null
// 판독기(zxing-wasm)는 스캐너를 처음 열 때만 받는다. wasm은 빌드가 /assets/에 내보낸 우리 파일이다(외부 CDN을 쓰지 않는다).
// 실패하면 다음 시도에서 다시 받는다.
function readerModule() {
  module ??= import('zxing-wasm/reader').then(async zxing => {
    await zxing.prepareZXingModule({ overrides: { locateFile: (path, prefix) => path.endsWith('.wasm') ? wasmUrl : prefix + path },
      fireImmediately: true })
    return zxing
  }).catch(error => { module = null; throw error })
  return module
}

export async function loadQrReader(): Promise<QrReader> {
  const { readBarcodes } = await readerModule()
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas unavailable')
  return {
    async read(video) {
      const { videoWidth: width, videoHeight: height } = video
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !width || !height) return null
      const scale = Math.min(1, longSide / Math.max(width, height))
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const [result] = await readBarcodes(context.getImageData(0, 0, canvas.width, canvas.height), readerOptions)
      return result?.isValid ? result.text : null
    },
  }
}
```

  - 부품 확인 화면에 `Section title="QR"`을 더한다. `QrCode`에 예시 글자 `checkInQrText('0123456789abcdef'.repeat(4))`를 넣고 `className="size-48"`을 준다.
  - `Gallery.test.tsx`의 묶음 이름 목록에 `'QR'`을 더한다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/lib/qr-code.test.ts src/ui-gallery/Gallery.test.tsx`, `npm run typecheck --workspace @vada/web`
- [ ] **Step 5: 빌드 확인** — `npm run build --workspace @vada/web` 뒤 `dist/assets/zxing_reader-*.wasm`이 있고, 첫 화면 묶음(`index-*.js`)에 `zxing`이 없는지 본다.
  - 첫 화면 묶음을 보는 명령: `grep -l zxing_reader dist/assets/index-*.js`. 결과가 없어야 한다.
- [ ] **Step 6: 커밋** — `참석 확인 QR 부품과 판독기`

### Task 5: 내 신청 QR과 개인정보 고지

**Files:**
- Modify: `apps/web/src/public/MyRegistrationPage.tsx`, `apps/web/src/public/registration-text.ts`
- Test: `apps/web/src/public/MyRegistrationPage.test.tsx`, `apps/web/src/public/registration-text.test.ts`, `apps/web/src/public/ApplyPage.test.tsx`(고지 문구가 있으면)

- [ ] **Step 1: 실패하는 화면 테스트**
  - 고정 데이터 `mine()`에 `checkInCode: '0123456789abcdef'.repeat(4), checkedInAt: null`을 더한다.
  - **참석 전**
    - `region '참석 확인'` 안에 `getByRole('img', { name: '참석 확인 QR' })`과 "행사장에서 이 QR을 보여 주세요. 학생회가 찍어 참석을 확인해요."가 있다.
    - 이름·학번은 이 묶음에 다시 나오지 않는다. 기존 `getByText('김바다')` 테스트가 그대로 통과해야 한다.
  - **참석 뒤:** `checkedInAt: '2026-08-20T10:02', cancellable: false` → "참석 확인됨" 칩과 "8월 20일 (목) 오전 10:02", QR 없음, "참석을 확인한 신청은 학생회에 문의해 취소해 주세요.", [신청 취소] 없음
  - **취소가 막힘(Review Focus 5)**
    - `cancellable: true`로 열고, 취소 응답을 `json({ error: 'CHECKED_IN' }, 409)`로 둔다. 다시 부른 조회는 참석 뒤 데이터로 둔다.
    - 대화상자에서 [취소하기] → 조회를 다시 부르고 "참석 확인됨"이 보인다.
  - **고지 문구:** `registration-text.test.ts`의 `privacyNotice` 목적이 다음과 같다.
    - 무료: "목적: 2026 체육대회 참가 신청 확인, 참석 확인과 행사 운영"
    - 참가비 있음: "목적: 2026 체육대회 참가 신청 확인, 참가비 확인, 참석 확인과 행사 운영"
- [ ] **Step 2: 실패 확인** — `npx vitest run src/public`
- [ ] **Step 3: 구현**
  - `registration-text.ts`
    - `privacyNotice` 목적: `${eventName} 참가 신청 확인${fee > 0 || memberFee !== null ? ', 참가비 확인' : ''}, 참석 확인과 행사 운영`
    - 오류 문구 둘
      - `CHECKED_IN`: '이미 참석을 확인한 신청이에요. 새로 불러왔어요.'
      - `NOT_CHECKED_IN`: '참석 확인이 이미 취소됐어요. 새로 불러왔어요.'
  - `MyRegistrationPage.tsx`
    - `CheckIn` 부분을 `EventSummary` 아래에 둔다.

```tsx
// 참석 확인: 행사장에서 운영진이 찍을 QR. 참석을 확인하면 QR 대신 확인 시각을 보인다.
function CheckIn({ registration }: { registration: MyRegistration }) {
  return <section aria-label="참석 확인" className="flex flex-col items-center gap-2 rounded-md border p-4 text-center">
    <h2 className="self-start text-sm font-semibold text-gray-900">참석 확인</h2>
    {registration.checkedInAt ? <>
      <Badge tone="success">참석 확인됨</Badge>
      <p className="text-sm text-gray-900">{formatKoreanTime(registration.checkedInAt)}</p>
    </> : registration.checkInCode && <>
      <QrCode value={checkInQrText(registration.checkInCode)} label="참석 확인 QR" className="size-60 max-w-full" />
      <p className="text-sm text-gray-600">행사장에서 이 QR을 보여 주세요. 학생회가 찍어 참석을 확인해요.</p>
    </>}
  </section>
}
```

  - 취소 자리: `cancellable`이 false일 때 문구 순서는 참석 → 입금 → 마감이다.
    - `checkedInAt`이 있으면 "참석을 확인한 신청은 학생회에 문의해 취소해 주세요."
    - 아니고 입금을 확인했으면 기존 `paidCancelText`
    - 아니면 마감 문구
  - `cancel()`: `result.code`가 `PAYMENT_CONFIRMED`나 `CHECKED_IN`이면 다시 불러온다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/public`
- [ ] **Step 5: 커밋** — `내 신청에 참석 확인 QR 보이기`

### Task 6: 참가자 탭의 참석 확인

**Files:**
- Modify: `apps/web/src/registrations/useRegistration.ts`, `registration-view.ts`, `RegistrantList.tsx`, `RegistrantDialog.tsx`, `RegistrationPanel.tsx`, `registration-fixtures.ts`
- Test: `apps/web/src/registrations/registration-view.test.ts`, `RegistrationPanel.test.tsx`

**Interfaces:**
- Produces(Task 7이 씀)
  - `ScanResult = { ok: true; registrationId: string; already: boolean } | { ok: false; missing: boolean; message: string }`
  - 훅의 `checkIn(id)`, `cancelCheckIn(id)`: `Promise<RegistrationResult>`. `scan(code)`: `Promise<ScanResult>`
  - `RegistrantActions`에 `onCheckIn`, `onCancelCheckIn`, `onScan`을 더한다.
  - `RegistrantFilter = 'all' | 'unpaid' | 'paid' | 'checkedIn' | 'notCheckedIn'`
  - `filterRegistrants(list, filter)`. 지금의 `PaymentFilter`·`paymentFilter`를 바꾼 이름이다.

- [ ] **Step 1: 실패하는 테스트**
  - `registration-view.test.ts`: `filterRegistrants`가 다섯 거르기를 나눈다. 참석 전은 `checkedIn === null`이다.
  - 고정 데이터에 `checkedIn: 0`(form)과 `checkedIn: null`(줄)을 더한다. `checkedBy = { at: '2026-08-20T10:02', by: { id: 'p', name: '기획' } }`도 더한다.
  - `RegistrationPanel.test.tsx`
    - **카드와 줄**
      - 참가 신청 카드에 "참석"과 "1명"이 있다.
      - 참석한 줄에는 "참석" 칩이 있고 `{이름} 참석 확인` 버튼이 없다.
      - 참석 전 줄의 `{이름} 참석 확인` → `POST /entries/r2/check-in` 본문 `{}` → 받은 응답을 그린다.
    - **거르기:** "참석 1" → 김바다만, "참석 전 1" → 이수강만. 참가비가 없어도 참석 거르기가 있다.
    - **관리 대화상자**
      - 참석 전: "참석 전"과 [참석 확인] → `POST /entries/r1/check-in`
      - 참석: "참석 확인 · 8월 20일 (목) 오전 10:02 · 기획"과 [참석 확인 취소] → `POST /entries/r1/check-in/cancel`
      - 참석한 신청은 [신청 취소]가 꺼지고 "참석을 확인한 신청은 먼저 참석 확인을 취소해 주세요."가 보인다.
    - **실패:** 409 `CHECKED_IN` → "이미 참석을 확인한 신청이에요. 새로 불러왔어요."와 GET 다시 부름
    - **보관 기간:** `purged: true, count: 3, checkedIn: 2` → "보관 기간이 지나 신청자 정보를 지웠어요(신청 3명 · 참석 2명)."
- [ ] **Step 2: 실패 확인** — `npx vitest run src/registrations`
- [ ] **Step 3: 구현**
  - `useRegistration.ts`

```ts
export type ScanResult = { ok: true; registrationId: string; already: boolean } | { ok: false; missing: boolean; message: string }
const isScan = (body: unknown): body is CheckInScanResponse => isRegistration(body)
  && typeof (body as Partial<CheckInScanResponse>).checkIn?.registrationId === 'string'
// QR로 참석 확인. 찾을 수 없으면(404) 새로 불러오지 않는다. 명단은 그대로이고, 스캐너가 이름으로 찾으라고 알린다.
async function scan(code: string): Promise<ScanResult> {
  try {
    const response = await fetch(`${base}/check-in`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }) })
    const result: unknown = await response.json().catch(() => null)
    if (response.ok && isScan(result)) {
      setData(result)
      return { ok: true, registrationId: result.checkIn.registrationId, already: result.checkIn.already }
    }
    if (response.status === 404) return { ok: false, missing: true, message: '' }
    refresh()
    return { ok: false, missing: false, message: registrationMessage(errorOf(result)) }
  } catch {
    return { ok: false, missing: false, message: registrationFailure }
  }
}
```

    - `checkIn`은 `send('POST', '/entries/${id}/check-in', {})`, `cancelCheckIn`은 `'/entries/${id}/check-in/cancel'`이다. 둘 다 `encodeURIComponent`를 쓴다.
  - `registration-view.ts`: `filterRegistrants`와 `RegistrantFilter`를 둔다. `checkedIn`은 `item.checkedIn !== null`, `notCheckedIn`은 `item.checkedIn === null`이다.
  - `RegistrationPanel.tsx`
    - 카드의 "신청" 줄 아래에 `<dt>참석</dt><dd>{form.checkedIn}명</dd>`를 둔다.
    - `RegistrantList`에 `onCheckIn={state.checkIn} onCancelCheckIn={state.cancelCheckIn} onScan={state.scan}`을 넘긴다.
  - `RegistrantList.tsx`
    - 거르기 목록: `전체`, (`fees`일 때) `입금 전`·`입금 확인`, `참석`·`참석 전`
    - 줄: `item.checkedIn`이면 `<Badge tone="success">참석</Badge>`
    - 줄 버튼: 아니면 `variant="outline" size="sm"` [참석](`aria-label={`${item.name} 참석 확인`}`)을 [입금 확인] 앞에 둔다. 누르는 동안 끈다.
    - 실패하면 목록 아래에 오류를 적는다.
    - 보관 기간 문구는 spec 그대로다.
  - `RegistrantDialog.tsx`
    - `dl`을 늘 그린다. 참가비 줄은 `fees &&` 안에 둔다.
    - "참석" 묶음
      - 참석 전: `<dd>참석 전</dd>`와 [참석 확인]
      - 참석: `참석 확인 · {formatKoreanTime(at)} · {by.name}`와 [참석 확인 취소](outline)
    - 참석이면 [신청 취소]에 `disabled`를 주고, 위에 `StateMessage kind="notice"`로 spec 문구를 적는다.
- [ ] **Step 4: 통과 확인** — `npx vitest run src/registrations`, `npm run typecheck --workspace @vada/web`
- [ ] **Step 5: 커밋** — `참가자 탭에서 이름으로 참석 확인`

### Task 7: QR 스캐너

**Files:**
- Create: `apps/web/src/registrations/camera.ts`, `apps/web/src/registrations/CheckInScanner.tsx`
- Modify: `apps/web/src/registrations/RegistrantList.tsx`(머리 버튼과 스캐너)
- Test: `apps/web/src/registrations/CheckInScanner.test.tsx`

**Interfaces:**
- Consumes: Task 4의 `loadQrReader`·`QrReader`, Task 6의 `ScanResult`·훅 동작, Task 1의 `checkInCodeOf`
- Produces
  - `CameraProblem = 'denied' | 'unsupported' | 'failed'`, `CameraError`
  - `openCamera(): Promise<MediaStream>`, `stopCamera(stream: MediaStream): void`
  - `CheckInScanner` props: `{ open, form, registrations, settled, onScan, onCancelCheckIn, onConfirmPayment, onClose }`

- [ ] **Step 1: 실패하는 스캐너 테스트** (`CheckInScanner.test.tsx`, jsdom)
  - **준비**
    - `vi.mock('./camera', ...)`로 `openCamera`가 가짜 스트림을 준다. 트랙의 `stop`은 `vi.fn()`이다.
    - `CameraError`는 진짜를 쓴다(`importActual`).
    - `vi.mock('./qr-reader', ...)`로 `loadQrReader`가 줄(queue)에서 하나씩 꺼내는 가짜 판독기를 준다. 줄이 비면 null이다.
    - `HTMLMediaElement.prototype.play`를 `vi.fn(async () => {})`로 바꾼다.
    - 판독 간격은 상수(`scanInterval`)를 내보내 테스트가 기다린다.
    - RegistrationPanel.test의 `Harness`로 그리고 [QR로 참석 확인]을 눌러 연다.
  - **결과 카드**
    1. 확인함
       - 줄에 `checkInQrText(code)` → `POST .../check-in` 본문 `{ code }`
       - "참석을 확인했어요", 이름, "학번 2023222222"
       - 판독 호출 수가 [다음] 전에는 늘지 않는다.
       - [다음] 뒤에는 다시 읽는다. 같은 QR이면 두 번째 응답의 `already: true`로 "이미 참석했어요"다(Review Focus 2).
    2. 이미 참석: `already: true`, 줄에 `checkedIn` → "이미 참석했어요"와 "참석 확인 · 8월 20일 (목) 오전 10:02 · 기획"
    3. 찾을 수 없음: 404 → "이 행사 신청에서 찾을 수 없어요"와 안내. GET을 다시 부르지 않는다.
    4. 연결 실패: fetch가 던짐 → "연결하지 못했어요", "다시 찍어 주세요."
    5. 그 밖의 실패: 403 `FORBIDDEN` → "참석을 확인하지 못했어요"와 `FORBIDDEN` 문구
    6. 다른 QR: `'https://example.com'` → "참가 신청 QR이 아니에요."가 보이고 요청하지 않는다. 판독은 이어진다.
    7. 결과 카드의 입금 확인과 확인 취소
       - 입금 전 줄이면 [입금 확인] → `POST /entries/{id}/payment` → 칩이 "7,000원 · 입금 확인"이 된다.
       - [참석 확인 취소] → `POST /entries/{id}/check-in/cancel` → "참석 확인을 취소했어요"
       - 정산한 행사(`settled: true`)는 [입금 확인]이 없다.
  - **카메라와 판독기**
    8. 카메라 권한 거절(`CameraError('denied')`)
       - "카메라를 쓸 수 없어요. 브라우저 설정에서 이 사이트의 카메라 사용을 허용해 주세요."와 [다시 시도], 대체 안내 문구
       - 판독기를 부르지 않는다. [다시 시도]는 `openCamera`를 다시 부른다.
    9. 지원 안 함: "이 브라우저에서는 카메라를 쓸 수 없어요."
    10. 판독기 실패: `loadQrReader`가 던짐 → "QR 판독기를 불러오지 못했어요."
  - **닫기와 화면 숨김**
    11. 닫기 → 트랙 `stop`이 불린다.
    12. 응답을 기다리는 사이 닫기(Review Focus 1)
        - 스캔 응답을 `deferredResponse`로 미루고 닫는다. 그다음 응답을 풀어 준다.
        - 결과 카드가 보이지 않고 `openCamera` 호출 수가 늘지 않는다.
    13. 화면 숨김(Review Focus 3)
        - `document.visibilityState`를 `'hidden'`으로 바꾸고 `visibilitychange`를 보낸다 → `stop`이 불린다.
        - `'visible'`로 되돌리면 `openCamera`가 다시 불린다.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/registrations/CheckInScanner.test.tsx`
- [ ] **Step 3: 카메라** (`camera.ts`)

```ts
export type CameraProblem = 'denied' | 'unsupported' | 'failed'
export class CameraError extends Error {
  constructor(readonly problem: CameraProblem) { super(`Camera ${problem}`) }
}
// 뒤쪽 카메라를 고르고 소리는 받지 않는다. 브라우저는 https(또는 localhost)에서만 카메라를 준다.
export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new CameraError('unsupported')
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
  } catch (error) {
    const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
    throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed')
  }
}
export const stopCamera = (stream: MediaStream) => { for (const track of stream.getTracks()) track.stop() }
```

- [ ] **Step 4: 스캐너** (`CheckInScanner.tsx`)

  상태와 흐름은 다음과 같다.
  - `camera`: `'starting' | 'loading' | 'ready' | CameraProblem | 'reader'`
  - `outcome`: `null | { kind: 'checked' | 'already' | 'undone'; registrationId } | { kind: 'missing' } | { kind: 'failed'; offline: boolean; message }`
  - 화면이 숨었는지(`hidden`)는 `visibilitychange`로 따라간다.
  - 효과는 `[open, hidden, attempt]`가 바뀔 때 돈다. 순서는 아래와 같다.
    1. `openCamera`
    2. `video.srcObject`와 `play`(실패는 무시한다)
    3. `loadQrReader`
    4. `scanInterval`마다 읽기
  - 정리 함수가 할 일
    - `stopped = true`, 타이머를 지우고 `stopCamera`, `video.srcObject = null`
    - 진행 중인 판독·요청이 끝나도 `stopped`면 아무것도 하지 않는다.
  - 결과를 보이는 동안(`pausedRef`)과 요청 중에는 읽지 않는다. [다음]을 누르면 결과를 지우고 다시 읽는다.
  - 읽은 글자에 `checkInCodeOf`가 null이면 "참가 신청 QR이 아니에요."를 2초 보이고 계속 읽는다. 마지막에 읽은 때부터 센다.
  - 대화상자를 닫았다 다시 열면 결과와 안내를 지운다.

```tsx
export const scanInterval = 200
```

  화면은 다음과 같다.
  - 제목 "QR로 참석 확인"
  - 카메라 화면: `<div className="relative aspect-square w-full overflow-hidden rounded-md bg-gray-900">` 안에 `<video ref playsInline muted autoPlay aria-label="카메라 화면" className="size-full object-cover" />`를 둔다.
  - 가운데 틀: `<div aria-hidden className="absolute inset-1/5 rounded-md border-2 border-white/80" />`
  - 카메라 문제일 때는 비디오 대신 `Alert tone="warning"`으로 까닭을 적는다. [다시 시도](`attempt + 1`)와 대체 안내 문구를 둔다.
  - 상태 글(`text-sm text-gray-600`)과 다른 QR 안내(`text-sm text-yellow-700`)
  - 결과 카드(`rounded-md border p-4`, 아이콘 `CheckCircle2`·`Info`·`XCircle`·`RotateCcw`)
    - 이름(`text-lg font-semibold wrap-anywhere`), "학번 {학번}"
    - 참가비가 있으면 `paymentChip`
    - 버튼: [입금 확인](fees·!settled·입금 전·낼 돈 있음), [참석 확인 취소](checked일 때), [다음]
    - 카드 안 동작이 실패하면 카드 안에 `StateMessage kind="error"`로 적는다.
  - 결과의 줄은 받은 명단에서 `registrationId`로 찾는다. 없어지면 찾을 수 없음으로 보인다.
  - 실패 결과의 제목과 설명
    - 연결 실패(`message === registrationFailure`): "연결하지 못했어요" / "다시 찍어 주세요."
    - 그 밖: "참석을 확인하지 못했어요" / 받은 문구
  - 바닥에 [닫기](outline)를 둔다.
- [ ] **Step 5: 명단에 연결** — `RegistrantList` 머리를 `flex items-center justify-between`으로 바꾼다.
  - 오른쪽에 `<Button size="sm"><ScanLine /> QR로 참석 확인</Button>`을 둔다. `!form.purged && registrations.length > 0`일 때만 보인다.
  - 누르면 `<CheckInScanner open ... />`를 연다.
- [ ] **Step 6: 통과 확인** — `npx vitest run src/registrations`, `npm run typecheck --workspace @vada/web`
- [ ] **Step 7: 커밋** — `QR 스캐너로 참석 확인`

### Task 8: 문서와 전체 확인

**Files:**
- Modify: `docs/ERD.md`(참가 신청 절)

- [ ] **Step 1: ERD**
  - mermaid `registrations`에 `timestamptz checked_in_at "참석 확인한 때"`와 `text checked_in_by FK "참석 확인한 운영진"`을 더하고, `users |o..o{ registrations : "참석 확인"` 관계를 더한다.
  - 참석 설명 한 줄을 더한다. 두 칸은 함께 있거나 함께 없다. 취소한 신청에는 없다. 개인 칸을 지워도 남는다. QR은 `token_hash`로 찾는다.
- [ ] **Step 2: 관련 검사 전부**
  - `npm test --workspace @vada/contracts`
  - `npm test --workspace @vada/web`
  - `npm run typecheck`
  - API: `npx tsx --test --test-concurrency=2 src/registrations/*.test.ts src/http/boundary.test.ts src/db/migrations.test.ts src/db/schema.test.ts src/settlement/settlement.test.ts src/settlement/fee-income.test.ts`(apps/api)
- [ ] **Step 3: 커밋** — `참석 확인을 문서에 반영`
