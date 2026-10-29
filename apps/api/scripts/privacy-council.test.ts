import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CLOSING_REASON, REOPEN_REASON } from '../src/councils/closing.js'
import { DESTROY_STEPS } from '../src/councils/destroy.js'
import { createTestDb, type TestDb, type TestPg } from '../src/db/test-db.js'
import { clockNow, createRecord } from '../src/records/records.js'
import { markLeft, seedCouncil } from '../src/test-support/council.js'
import { fakeStorage } from '../src/test-support/storage.js'
import { DEMO_SCHOOL_NAME } from '../src/home/demo-budget.js'
import { seedDemoCouncil } from './demo-data.js'
import { parsePrivacyArgs, runPrivacy, type PrivacyRun } from './privacy-command.js'

// privacy council-close·council-reopen·council-destroy(기능 021 조각 9, 정한 것 15, DEC-55, DEC-56, DEC-72).
const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'
const INVITE = 'TESTDATA'
const OTHER_INVITE = 'ZZZZ2345'
// 한국 시각 2026-10-26 23:59:59에 표시했다. 그날은 세지 않고 다음 날(10-27)부터 30일, 30일째(11-25) 24:00에 끝나므로 11-26 0시(한국)부터 파기한다.
const MARKED = new Date('2026-10-26T14:59:59Z')
const DUE = new Date('2026-11-25T15:00:00Z')
const SECOND = 1000

test('인자: 초대 코드와 플래그를 받고, 파기만 --now와 --expect를 받는다', () => {
  assert.deepEqual(parsePrivacyArgs(['council-close', '--invite', 'testdata']), {
    command: 'council-close',
    invite: INVITE,
    apply: false,
    fromShell: false,
  })
  assert.deepEqual(
    parsePrivacyArgs(['council-reopen', '--invite', INVITE, '--apply', '--from-shell']),
    { command: 'council-reopen', invite: INVITE, apply: true, fromShell: true },
  )
  assert.deepEqual(
    parsePrivacyArgs(['council-destroy', '--invite', INVITE, '--now', '--expect', '12', '--apply']),
    {
      command: 'council-destroy',
      invite: INVITE,
      now: true,
      expect: 12,
      apply: true,
      fromShell: false,
    },
  )
  assert.equal(
    (
      parsePrivacyArgs(['council-destroy', '--invite', INVITE, '--expect', '1000000']) as {
        expect: number
      }
    ).expect,
    1_000_000,
  )
  assert.deepEqual(parsePrivacyArgs(['council-destroy', '--invite', INVITE]), {
    command: 'council-destroy',
    invite: INVITE,
    now: false,
    expect: null,
    apply: false,
    fromShell: false,
  })
  for (const bad of [
    ['council-close'],
    ['council-close', '--invite'],
    ['council-close', '--invite', 'TESTDAT0'],
    ['council-close', '--invite', INVITE, '--now'],
    ['council-close', '--invite', INVITE, '--expect', '1'],
    ['council-reopen', '--invite', INVITE, '--now'],
    ['council-reopen', '--invite', INVITE, 'extra'],
    ['council-destroy', '--invite', INVITE, '--now', '--now'],
    ['council-destroy', '--invite', INVITE, '--expect'],
    ['council-destroy', '--invite', INVITE, '--expect', '-1'],
    ['council-destroy', '--invite', INVITE, '--expect', '1000001'],
    ['council-destroy', '--invite', INVITE, '--expect', '00000001'],
    ['council-destroy', '--invite', INVITE, '--apply', '--dry-run'],
    ['council-destroy', '--invite', INVITE, '--aply'],
    ['council-close', '--invite', INVITE, '--invite', OTHER_INVITE],
  ])
    assert.equal(parsePrivacyArgs(bad), null, bad.join(' '))
})

function harness(testDb: TestDb | null, overrides: Partial<PrivacyRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  const store = fakeStorage()
  const run: PrivacyRun = {
    args: ['council-close', '--invite', INVITE],
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      if (!testDb) throw new Error('connect must not be called')
      return { db: testDb.db, end: () => Promise.resolve() }
    },
    storage: () => store.storage,
    now: () => MARKED,
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return {
    run,
    info,
    error,
    out: () => [...info, ...error].join('\n'),
    connected: () => connected,
    go: async (args: string[], extra: Partial<PrivacyRun> = {}) => {
      Object.assign(run, { args }, extra)
      info.length = 0
      error.length = 0
      return runPrivacy(run)
    },
  }
}

// 같은 모양의 두 학생회(seedCouncil)와 초대 코드
async function withTwo(run: (t: Awaited<ReturnType<typeof two>>) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    await run(await two(testDb))
  } finally {
    await testDb.close()
  }
}
async function two(testDb: TestDb) {
  const { db, pg } = testDb
  const mine = await seedCouncil(db, pg, 's')
  const other = await seedCouncil(db, pg, 'o')
  for (const [council, code] of [
    [mine, INVITE],
    [other, OTHER_INVITE],
  ] as const)
    await pg.query('INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)', [
      council.councilId,
      code,
      council.people.president.memberId,
    ])
  const closingOf = async (councilId: string) =>
    (
      await pg.query<{ at: Date | null }>(
        'SELECT closing_requested_at AS at FROM council WHERE id = $1',
        [councilId],
      )
    ).rows[0]!.at
  const lastVersion = async (councilId: string) =>
    (
      await pg.query<{ reason: string | null; changed_by: string | null; n: number }>(
        `SELECT reason, changed_by, version_no AS n FROM record_version WHERE record_id = $1
          ORDER BY version_no DESC LIMIT 1`,
        [councilId],
      )
    ).rows[0]!
  return { testDb, mine, other, closingOf, lastVersion }
}

test('council-close는 미리 보기에 개수만 보이고, --apply로 표시해 판을 남기며, 다시 돌려도 표시 시각을 바꾸지 않는다. council-reopen이 지운다', () =>
  withTwo(async t => {
    const h = harness(t.testDb)
    assert.equal(await h.go(['council-close', '--invite', INVITE]), 0)
    assert.match(h.out(), /대상: db\.example\.test\/vada \(\.env\)/)
    assert.match(
      h.out(),
      /그만두기 표시할 것: 학생회 1\. 파기는 2026-11-26\(한국\)부터 된다\. 미리 보기라 바꾸지 않았다/,
    )
    assert.equal(await t.closingOf(t.mine.councilId), null)

    assert.equal(await h.go(['council-close', '--invite', INVITE, '--apply']), 0)
    assert.match(h.out(), /그만두기 표시함: 학생회 1\. 파기는 2026-11-26\(한국\)부터 된다/)
    assert.deepEqual(await t.closingOf(t.mine.councilId), MARKED)
    assert.equal(await t.closingOf(t.other.councilId), null)
    const marked = await t.lastVersion(t.mine.councilId)
    assert.equal(marked.reason, CLOSING_REASON)
    assert.equal(marked.changed_by, null)

    const later = new Date(MARKED.getTime() + 3 * 86_400_000)
    assert.equal(
      await h.go(['council-close', '--invite', INVITE, '--apply'], { now: () => later }),
      0,
    )
    assert.match(h.out(), /이미 그만두기로 표시돼 있다/)
    assert.deepEqual(await t.closingOf(t.mine.councilId), MARKED)
    assert.equal((await t.lastVersion(t.mine.councilId)).n, marked.n)

    assert.equal(await h.go(['council-reopen', '--invite', INVITE]), 0)
    assert.match(h.out(), /미리 보기라 바꾸지 않았다/)
    assert.deepEqual(await t.closingOf(t.mine.councilId), MARKED)
    assert.equal(await h.go(['council-reopen', '--invite', INVITE, '--apply']), 0)
    assert.match(h.out(), /이어 쓰기 완료: 학생회 1/)
    assert.equal(await t.closingOf(t.mine.councilId), null)
    assert.equal((await t.lastVersion(t.mine.councilId)).reason, REOPEN_REASON)
    assert.equal(await h.go(['council-reopen', '--invite', INVITE, '--apply']), 0)
    assert.match(h.out(), /그만두기로 표시돼 있지 않다/)

    assert.equal(await h.go(['council-close', '--invite', 'ABCDEFGH', '--apply']), 1)
    assert.match(h.error.join('\n'), /그 초대 코드의 학생회가 없다/)
    for (const secret of ['hunter2', t.mine.councilId, 's 학생회', '@'])
      assert.ok(!h.out().includes(secret), secret)
  }))

test('council-destroy는 표시하지 않았거나 표시한 날부터 30일이 안 됐으면 --now 없이 멈춘다(한국 날짜 경계 ±1초)', () =>
  withTwo(async t => {
    const h = harness(t.testDb)
    const destroy = (...extra: string[]) => ['council-destroy', '--invite', INVITE, ...extra]
    assert.equal(await h.go(destroy()), 1)
    assert.match(h.error.join('\n'), /그만두기로 표시하지 않은 학생회다/)
    assert.equal(await h.go(destroy('--now')), 1)
    assert.match(h.error.join('\n'), /그만두기로 표시하지 않은 학생회다/)

    await t.testDb.pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      t.mine.councilId,
      MARKED,
    ])
    const at = (ms: number) => ({ now: () => new Date(DUE.getTime() + ms) })
    assert.equal(await h.go(destroy(), at(-SECOND)), 1)
    assert.match(
      h.error.join('\n'),
      /표시한 날부터 30일이 지나지 않았다\(파기는 2026-11-26\(한국\)부터\)/,
    )
    assert.equal(await h.go(destroy('--now'), at(-SECOND)), 0)
    assert.match(h.out(), /지울 것: /)
    assert.equal(await h.go(destroy(), at(SECOND)), 0)
    assert.match(h.out(), /지울 것: /)

    // 표시 시각의 한국 날짜로 센다. 1초 뒤(한국 10-27 0시)에 표시했으면 하루 늦다.
    await t.testDb.pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      t.mine.councilId,
      new Date(MARKED.getTime() + SECOND),
    ])
    assert.equal(await h.go(destroy(), at(SECOND)), 1)
    assert.match(h.error.join('\n'), /파기는 2026-11-27\(한국\)부터/)
    assert.equal(await h.go(destroy(), at(86_400_000)), 0)
  }))

test('council-destroy의 --apply는 저장소가 없거나 --expect가 없으면 연결하기 전에, --expect가 다르면 바꾸지 않고 멈춘다', () =>
  withTwo(async t => {
    const h = harness(t.testDb, { now: () => DUE })
    await t.testDb.pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      t.mine.councilId,
      MARKED,
    ])
    for (const extra of [[], ['--expect', '1', '--apply']]) {
      assert.equal(
        await h.go(['council-destroy', '--invite', INVITE, ...extra], { storage: () => null }),
        1,
      )
      assert.match(h.error.join('\n'), /R2 설정/)
    }
    const before = h.connected()
    assert.equal(
      await h.go(['council-destroy', '--invite', INVITE, '--apply'], { storage: () => null }),
      1,
    )
    assert.match(h.error.join('\n'), /--expect <기록 수>로 함께 준다/)
    assert.equal(h.connected(), before)
    const store = fakeStorage()
    assert.equal(
      await h.go(['council-destroy', '--invite', INVITE, '--expect', '1', '--apply'], {
        storage: () => store.storage,
      }),
      1,
    )
    assert.match(h.error.join('\n'), /지울 기록이 \d+개라 --expect 1와 다르다/)
    assert.ok(await t.closingOf(t.mine.councilId))
  }))

// --- 통째 파기: 시연 학생회 둘(같은 모양)과 시연이 쓰지 않는 표의 행 ---

const DEMO_UP = 'https://r2.test/up/'
const count = async (pg: TestPg, sql: string, params: unknown[] = []) =>
  Number((await pg.query<{ n: string }>(sql, params)).rows[0]!.n)
const oneOf = async (pg: TestPg, sql: string, params: unknown[] = []) =>
  (await pg.query<{ id: string }>(sql, params)).rows[0]!.id

async function demoCouncil(testDb: TestDb, store: ReturnType<typeof fakeStorage>, key: string) {
  const { db, pg } = testDb
  await pg.query('INSERT INTO users (id, name, email) VALUES ($1, $1, $2)', [
    key,
    `${key}@example.test`,
  ])
  await pg.query(
    "INSERT INTO accounts (id, user_id, provider_id, account_id) VALUES ($1, $2, 'google', $3)",
    [`a-${key}`, key, `sub-${key}`],
  )
  const fetcher = ((url: string) => {
    store.put(url.slice(DEMO_UP.length))
    return Promise.resolve(new Response(null, { status: 200 }))
  }) as typeof fetch
  const at = new Date(Date.now() - 60_000)
  assert.equal(await seedDemoCouncil(db, key, at, { storage: store.storage, fetcher }), 'created')
  // 시연은 학교 이름으로 하나만 둔다. 같은 모양의 둘째를 넣으려고 첫째의 학교 이름을 바꾼다.
  return oneOf(pg, 'UPDATE council SET school_name = $1 WHERE school_name = $2 RETURNING id', [
    `${key} 학교`,
    DEMO_SCHOOL_NAME,
  ])
}

// 시연이 쓰지 않는 표(회의·투표·결정·문서·초안·근거, 감사·의결기구, 출석, 납부, 결산)에도 그 학생회의 행을 하나씩 둔다.
async function addUnusedTables(testDb: TestDb, councilId: string, author: string) {
  const { db, pg } = testDb
  const raw = async (kind: string, values: Record<string, unknown>) => {
    const id = await oneOf(
      pg,
      'INSERT INTO record (kind, council_id, created_by) VALUES ($1, $2, $3) RETURNING id',
      [kind, councilId, author],
    )
    const names = Object.keys(values)
    await pg.query(
      `INSERT INTO ${kind} (id, ${names.join(', ')}) VALUES ($1, ${names.map((_, at) => `$${at + 2}`).join(', ')})`,
      [id, ...Object.values(values)],
    )
    await pg.query(
      `INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
       SELECT $1, 1, tstzrange(now(), NULL), to_jsonb(t), $2 FROM ${kind} t WHERE t.id = $1`,
      [id, author],
    )
    return id
  }
  const president = await oneOf(
    pg,
    `SELECT cm.member_id AS id FROM council_membership cm JOIN cohort c ON c.id = cm.cohort_id
      WHERE c.council_id = $1 AND cm.council_rank = 'president'`,
    [councilId],
  )
  const ofKind = (kind: string) =>
    oneOf(pg, 'SELECT id FROM record WHERE council_id = $1 AND kind = $2 ORDER BY id LIMIT 1', [
      councilId,
      kind,
    ])
  const eventId = await ofKind('event')
  const messageId = await ofKind('message')
  // 배송(024 조각 2): 그 학생회 요청과 품목에 송장 하나를 둔다.
  const shipmentId = await raw('shipment', {
    council_id: councilId,
    request_id: await ofKind('request'),
    carrier_id: 'kr.cjlogistics',
    tracking_number: '123456789',
  })
  await pg.query(
    'INSERT INTO shipment_item (shipment_id, line_item_id, council_id) VALUES ($1, $2, $3)',
    [shipmentId, await ofKind('line_item'), councilId],
  )
  // 캘린더(DEC-102): 캘린더에서 만든 일정 하나와 회장의 구독 주소 하나.
  await raw('schedule_item', {
    council_id: councilId,
    type: 'other',
    title: '답사',
    starts_on: '2026-10-28',
  })
  await pg.query(
    'INSERT INTO calendar_feed (member_id, council_id, token_hash) VALUES ($1, $2, $3)',
    // 학생회마다 다른 해시(token_hash는 UNIQUE): 학생회 번호의 16진 32자를 두 번.
    [president, councilId, councilId.replaceAll('-', '').repeat(2)],
  )
  // 내보낸 사람의 공지방 읽음 위치(0028): 그 학생회 공지방에 하나.
  await pg.query(
    `INSERT INTO left_room_read (room_id, member_id, last_read_at)
     SELECT cr.id, $2, now() FROM chat_room cr JOIN record r ON r.id = cr.id
      WHERE r.council_id = $1 AND cr.type = 'all_members' AND cr.event_id IS NULL`,
    [councilId, author],
  )
  await raw('audit_body', { council_id: councilId, name: '감사위원회' })
  await raw('voting_body', { council_id: councilId, name: '대의원회' })
  const meeting = await raw('meeting', { title: '회의', held_at: new Date(), event_id: eventId })
  const agenda = await raw('agenda_item', { meeting_id: meeting, position: 1, title: '안건' })
  await pg.query('INSERT INTO meeting_attendee (meeting_id, member_id) VALUES ($1, $2)', [
    meeting,
    president,
  ])
  await raw('task', { title: '후속 업무', origin_id: agenda, origin_kind: 'agenda_item' })
  const poll = await raw('poll', { title: '투표', origin_id: agenda, origin_kind: 'agenda_item' })
  const option = await raw('poll_option', { poll_id: poll, position: 1, label: '찬성' })
  await raw('poll_response', { poll_id: poll, member_id: president, option_id: option })
  await raw('decision', {
    content: '결정',
    decided_by: president,
    decided_at: new Date(),
    origin_id: poll,
    origin_kind: 'poll',
  })
  const documentId = await raw('document', { title: '문서', type: 'general' })
  await pg.query('INSERT INTO document_link (document_id, record_id) VALUES ($1, $2)', [
    documentId,
    eventId,
  ])
  const draft = await raw('draft_item', { record_id: documentId, position: 1, content: '초안' })
  await raw('source', {
    draft_item_id: draft,
    origin_id: messageId,
    origin_kind: 'message',
    location: '1-2',
  })
  const registrationId = await oneOf(
    pg,
    `SELECT r.id FROM registration r JOIN record rec ON rec.id = r.id
      WHERE rec.council_id = $1 AND r.cancelled_at IS NULL ORDER BY r.id LIMIT 1`,
    [councilId],
  )
  // 질문·선택지·답(025 조각 21): 그 신청의 양식에 고르기 질문 하나와 답 하나.
  const question = await oneOf(
    pg,
    `INSERT INTO registration_question (form_id, position, kind, title)
     SELECT form_id, 1, 'single_choice', '사이즈' FROM registration WHERE id = $1 RETURNING id`,
    [registrationId],
  )
  const choice = await oneOf(
    pg,
    `INSERT INTO registration_question_choice (question_id, form_id, position, label)
     SELECT id, form_id, 1, 'M' FROM registration_question WHERE id = $1 RETURNING id`,
    [question],
  )
  await pg.query(
    'INSERT INTO registration_answer (registration_id, question_id, choice_id) VALUES ($1, $2, $3)',
    [registrationId, question, choice],
  )
  const periodId = await ofKind('fiscal_period')
  await db.transaction(async tx => {
    const base = { councilId, actor: president }
    await createRecord(tx, {
      kind: 'attendance',
      ...base,
      values: { registrationId, confirmedAt: clockNow, method: 'manual' },
    })
    await createRecord(tx, {
      kind: 'fee_payment',
      ...base,
      values: { studentId: '2026000001', paidFrom: '2026-03-01', paidUntil: '2026-12-31' },
    })
    await createRecord(tx, {
      kind: 'account_closing',
      ...base,
      values: { fiscalPeriodId: periodId },
    })
  })
}

// 표마다 행의 지문(행 전체의 해시). 다른 학생회의 행이 하나도 바뀌거나 사라지지 않았는지 본다.
async function fingerprints(pg: TestPg) {
  const tables = await pg.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
  )
  const result = new Map<string, string[]>()
  for (const { name } of tables.rows)
    result.set(
      name,
      (
        await pg.query<{ h: string }>(
          `SELECT md5(to_jsonb(t)::text) AS h FROM ${name} t ORDER BY 1`,
        )
      ).rows.map(row => row.h),
    )
  return result
}

test('council-destroy는 미리 보기에 표마다 개수를 보이고, --apply로 저장소 객체와 그 학생회의 모든 행을 지우며 남길 것과 다른 학생회는 그대로 둔다', async () => {
  const testDb = await createTestDb()
  const { db, pg } = testDb
  try {
    const store = fakeStorage()
    const other = await demoCouncil(testDb, store, 'ua')
    await addUnusedTables(
      testDb,
      other,
      await oneOf(pg, "SELECT member_id AS id FROM member_login WHERE user_id = 'ua'"),
    )
    const otherKeys = (
      await pg.query<{ k: string }>(
        'SELECT storage_key AS k FROM file WHERE storage_key IS NOT NULL',
      )
    ).rows.map(row => row.k)
    const before = await fingerprints(pg)

    const mine = await demoCouncil(testDb, store, 'ub')
    const cohortId = await oneOf(pg, 'SELECT id FROM cohort WHERE council_id = $1', [mine])
    const president = await oneOf(
      pg,
      "SELECT member_id AS id FROM member_login WHERE user_id = 'ub'",
    )
    // 두 학생회에 모두 있는 사람(남는다)과, 이 학생회에만 있었고 탈퇴해 로그인이 없는 사람(함께 지운다)
    const shared = await oneOf(pg, "SELECT member_id AS id FROM member_login WHERE user_id = 'ua'")
    const leaver = await db.transaction(async tx => {
      const id = await createRecord(tx, {
        kind: 'member',
        councilId: null,
        actor: null,
        values: { name: '떠날 사람', email: 'leaver@example.test' },
      })
      for (const memberId of [shared, id])
        await createRecord(tx, {
          kind: 'council_membership',
          councilId: mine,
          actor: president,
          values: { memberId, cohortId, startsAt: clockNow },
        })
      return id
    })
    await markLeft(pg, leaver, new Date().toISOString())
    await addUnusedTables(testDb, mine, leaver)
    const code = await oneOf(pg, 'SELECT code AS id FROM invite_code WHERE council_id = $1', [mine])
    const mineKeys = (
      await pg.query<{ k: string }>(
        `SELECT storage_key AS k FROM file f JOIN record r ON r.id = f.id
          WHERE r.council_id = $1 AND storage_key IS NOT NULL`,
        [mine],
      )
    ).rows.map(row => row.k)
    assert.ok(mineKeys.length > 0)
    for (const key of [...mineKeys, ...otherKeys]) assert.ok(store.has(key), key)
    const accessLogs = await count(
      pg,
      'SELECT count(*) AS n FROM applicant_access_log WHERE council_id = $1',
      [mine],
    )
    assert.ok(accessLogs > 0)
    // 이 학생회를 가리키는 행: 기록, 학생회 자신, 지우는 운영진
    const ids = (
      await pg.query<{ id: string }>(
        'SELECT id FROM record WHERE council_id = $1 OR id = $1 OR id = $2',
        [mine, leaver],
      )
    ).rows.map(row => row.id)
    const left = async () => {
      const found: Record<string, number> = {}
      for (const step of DESTROY_STEPS) {
        const n = await count(
          pg,
          `SELECT count(*) AS n FROM ${step.table} WHERE ${step.column} = ANY($1::uuid[])`,
          [ids],
        )
        if (n) found[step.table] = n
      }
      return found
    }
    // 파기하는 표마다 이 학생회의 행이 있다(시연과 위의 행이 표를 빠짐없이 채운다). 새 표를 파기에 더하면 여기에도 행을 둔다.
    const full = await left()
    for (const step of DESTROY_STEPS)
      assert.ok(full[step.table], `${step.table}에 이 학생회의 행이 없다`)

    const closingAt = new Date('2026-10-01T00:00:00Z')
    await pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [mine, closingAt])
    const h = harness(testDb, {
      storage: () => store.storage,
      now: () => new Date('2026-10-02T00:00:00Z'),
    })
    const destroy = (...extra: string[]) => ['council-destroy', '--invite', code, '--now', ...extra]
    assert.equal(await h.go(destroy()), 0)
    const preview = h.out()
    assert.match(
      preview,
      /지울 것: .*record \d+, .*저장소 객체 \d+\. 남길 것: 운영진 \d+\(로그인이나 다른 학생회 소속이 있음\), 신청자 열람 기록 \d+\. 미리 보기라 바꾸지 않았다\. 실제로 하려면 같은 명령에 --expect \d+ --apply를 붙인다\./,
    )
    const records = Number(/--expect (\d+) --apply/.exec(preview)![1])
    assert.equal(
      records,
      await count(pg, 'SELECT count(*) AS n FROM record WHERE id = ANY($1::uuid[])', [ids]),
    )
    assert.match(preview, new RegExp(`신청자 열람 기록 ${accessLogs}\\.`))
    for (const secret of [
      'hunter2',
      mine,
      president,
      leaver,
      '떠날 사람',
      '@',
      'evidence/',
      'VADA 시연',
    ])
      assert.ok(!preview.includes(secret), secret)
    assert.equal(
      await count(pg, 'SELECT count(*) AS n FROM record WHERE council_id = $1', [mine]),
      full.record! - 2,
    )

    assert.equal(await h.go(destroy('--expect', String(records), '--apply')), 0)
    assert.match(h.out(), /파기함: /)
    // 그 학생회를 가리키는 행이 어느 표에도 없고, 저장소에 그 학생회의 객체가 없다.
    assert.deepEqual(await left(), {})
    for (const key of mineKeys) assert.equal(store.has(key), false, key)
    for (const key of otherKeys) assert.ok(store.has(key), key)
    // 다른 학생회의 행은 하나도 바뀌거나 사라지지 않았다.
    const after = await fingerprints(pg)
    for (const [table, rows] of before) {
      const now = new Set(after.get(table))
      assert.ok(
        rows.every(row => now.has(row)),
        `${table}: 다른 학생회의 행이 바뀌었다`,
      )
    }
    // 새로 남은 것은 로그인 쪽, 남기는 운영진(로그인이나 다른 학생회 소속이 있음)과 그 판, 신청자 열람 기록뿐이다.
    const added = (table: string) => after.get(table)!.length - before.get(table)!.length
    for (const table of after.keys())
      if (
        ![
          'users',
          'accounts',
          'member_login',
          'member',
          'record',
          'record_version',
          'applicant_access_log',
        ].includes(table)
      )
        assert.equal(added(table), 0, table)
    const keptMembers = added('member')
    assert.equal(added('member_login'), keptMembers)
    assert.equal(added('record'), keptMembers)
    assert.equal(
      await count(
        pg,
        "SELECT count(*) AS n FROM record WHERE council_id IS NULL AND kind <> 'member' AND kind <> 'council'",
      ),
      0,
    )
    assert.equal(await count(pg, 'SELECT count(*) AS n FROM member WHERE id = $1', [leaver]), 0)
    assert.equal(await count(pg, 'SELECT count(*) AS n FROM member WHERE id = $1', [shared]), 1)
    assert.equal(added('applicant_access_log'), accessLogs)
    assert.equal(await count(pg, 'SELECT count(*) AS n FROM council WHERE id = $1', [mine]), 0)
    // 다시 돌리면 초대 코드의 학생회가 없다.
    assert.equal(await h.go(destroy()), 1)
    assert.match(h.error.join('\n'), /그 초대 코드의 학생회가 없다/)
  } finally {
    await testDb.close()
  }
})
