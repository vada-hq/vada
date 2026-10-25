import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestDb } from '../src/db/test-db.js'
import { ERASED_BY_REQUEST } from '../src/chat/erase.js'
import { createRecord } from '../src/records/records.js'
import { markLeft, seedCouncil } from '../src/test-support/council.js'
import { fakeStorage } from '../src/test-support/storage.js'
import { parsePrivacyArgs, runPrivacy, type PrivacyRun } from './privacy-command.js'

// privacy erase-messages(기능 021 조각 8, 정한 것 14, DEC-56, DEC-88).
const SECRET_URL = 'postgres://user:hunter2@db.example.test/vada'
const INVITE = 'TESTDATA'
const OTHER_INVITE = 'ZZZZ2345'
const BODY = '비밀 본문 010-1234-5678'
const WRITER_EMAIL = 's-planningMember@example.test'
// 한국 시각 2026-10-25 10:00 ~ 10:59(그 분 끝까지)
const RANGE = ['--from', '2026-10-25T10:00', '--to', '2026-10-25T10:59']
const args = (...extra: string[]) => [
  'erase-messages',
  '--invite',
  INVITE,
  '--sender',
  WRITER_EMAIL,
  ...RANGE,
  ...extra,
]

test('인자: 초대 코드, 보낸 사람 하나(--sender 또는 --left), 한국 시각의 분 두 개, --expect, 플래그만 받는다', () => {
  const parsed = parsePrivacyArgs([
    'erase-messages',
    '--invite',
    'testdata',
    '--left',
    '2',
    ...RANGE,
    '--expect',
    '0',
    '--apply',
  ])
  assert.deepEqual(parsed, {
    command: 'erase-messages',
    invite: INVITE,
    sender: { left: 2 },
    from: new Date('2026-10-25T01:00:00Z'),
    until: new Date('2026-10-25T02:00:00Z'),
    expect: 0,
    apply: true,
    fromShell: false,
  })
  const byEmail = parsePrivacyArgs(args())
  assert.ok(byEmail?.command === 'erase-messages')
  assert.deepEqual(byEmail.sender, { email: WRITER_EMAIL })
  assert.equal(byEmail.expect, null)
  const without = (name: string) => {
    const list = args()
    const at = list.indexOf(name)
    list.splice(at, 2)
    return list
  }
  for (const bad of [
    without('--invite'),
    without('--sender'),
    without('--from'),
    without('--to'),
    args('--left', '1'),
    args('--expect'),
    args('--expect', '-1'),
    args('--expect', '1.5'),
    args('--apply', '--dry-run'),
    args('--apply', '--apply'),
    args('extra'),
    args('--sender', 'a@b.test'),
    ['erase-messages', '--invite', 'TESTDAT0', '--sender', WRITER_EMAIL, ...RANGE],
    ['erase-messages', '--invite', INVITE, '--sender', 'not-an-email', ...RANGE],
    ['erase-messages', '--invite', INVITE, '--left', '0', ...RANGE],
    [
      'erase-messages',
      '--invite',
      INVITE,
      '--sender',
      WRITER_EMAIL,
      '--from',
      '2026-02-30T10:00',
      '--to',
      '2026-03-01T10:00',
    ],
    [
      'erase-messages',
      '--invite',
      INVITE,
      '--sender',
      WRITER_EMAIL,
      '--from',
      '2026-10-25 10:00',
      '--to',
      '2026-10-25T11:00',
    ],
    [
      'erase-messages',
      '--invite',
      INVITE,
      '--sender',
      WRITER_EMAIL,
      '--from',
      '2026-10-25T11:00',
      '--to',
      '2026-10-25T10:59',
    ],
  ])
    assert.equal(parsePrivacyArgs(bad), null, bad.join(' '))
})

function harness(overrides: Partial<PrivacyRun> = {}) {
  const info: string[] = []
  const error: string[] = []
  let connected = 0
  const store = fakeStorage()
  const run: PrivacyRun = {
    args: args(),
    env: {},
    shellUrl: undefined,
    readEnvUrl: () => SECRET_URL,
    connect: () => {
      connected += 1
      throw new Error('connect must not be called')
    },
    storage: () => store.storage,
    now: () => new Date('2026-10-26T03:00:00Z'),
    log: { info: line => info.push(line), error: line => error.push(line) },
    ...overrides,
  }
  return {
    run,
    info,
    error,
    store,
    out: () => [...info, ...error].join('\n'),
    connected: () => connected,
    on(testDb: TestDb) {
      run.connect = () => {
        connected += 1
        return { db: testDb.db, end: () => Promise.resolve() }
      }
      return this
    },
  }
}

// 두 학생회에 같은 모양의 자료를 둔다: 쓴 사람의 범위 안 메시지 둘(하나는 사진 둘), 범위 바로 앞과 바로 뒤,
// 같은 학생회 다른 사람, 다른 학생회의 같은 모양 사람, 두 학생회에 모두 있는 쓴 사람이 다른 학생회에 같은 때 보낸 것.
// 사진 객체는 저장소에 올려 둔다.
async function seeded(run: (s: Awaited<ReturnType<typeof seed>>) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    await run(await seed(testDb))
  } finally {
    await testDb.close()
  }
}
async function seed(testDb: TestDb) {
  const { db, pg } = testDb
  const mine = await seedCouncil(db, pg, 's')
  const other = await seedCouncil(db, pg, 'o')
  const store = fakeStorage()
  for (const [council, code] of [
    [mine, INVITE],
    [other, OTHER_INVITE],
  ] as const)
    await pg.query('INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)', [
      council.councilId,
      code,
      council.people.president.memberId,
    ])
  const made = await db.transaction(async tx => {
    const roomOf = (councilId: string, actor: string) =>
      createRecord(tx, { kind: 'chat_room', councilId, actor, values: { type: 'all_members' } })
    const myRoom = await roomOf(mine.councilId, mine.people.president.memberId)
    const otherRoom = await roomOf(other.councilId, other.people.president.memberId)
    const here = { council: mine, roomId: myRoom }
    const there = { council: other, roomId: otherRoom }
    const send = async (
      { council, roomId }: typeof here,
      sender: string,
      sentAt: string,
      photos: number,
    ) => {
      const id = await createRecord(tx, {
        kind: 'message',
        councilId: council.councilId,
        actor: sender,
        values: { roomId, body: BODY, sentAt: new Date(sentAt) },
      })
      for (let index = 0; index < photos; index++) {
        const key = `chat/${council.councilId}/${sender}/${id}-${index}`
        store.put(key)
        await createRecord(tx, {
          kind: 'file',
          councilId: council.councilId,
          actor: sender,
          values: {
            name: `photo-${index + 1}.jpg`,
            mediaType: 'image/jpeg',
            sizeBytes: 1000,
            storageKey: key,
            attachedToId: id,
          },
        })
      }
      return id
    }
    const writer = mine.people.planningMember.memberId
    // 쓴 사람은 다른 학생회에도 있다(운영진은 학생회를 넘어 이어진다). 학생회 거르기가 빠지면 이 메시지도 지워진다.
    await createRecord(tx, {
      kind: 'council_membership',
      councilId: other.councilId,
      actor: other.people.president.memberId,
      values: {
        memberId: writer,
        cohortId: other.cohortId,
        startsAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
    return {
      inRange: [
        await send(here, writer, '2026-10-25T01:00:00Z', 2),
        await send(here, writer, '2026-10-25T01:59:59.999Z', 0),
      ],
      untouched: [
        await send(here, writer, '2026-10-25T00:59:59.999Z', 1),
        await send(here, writer, '2026-10-25T02:00:00Z', 1),
        await send(here, mine.people.plain.memberId, '2026-10-25T01:30:00Z', 1),
        await send(there, other.people.planningMember.memberId, '2026-10-25T01:30:00Z', 1),
        await send(there, writer, '2026-10-25T01:30:00Z', 1),
      ],
    }
  })
  const bodies = async (ids: string[]) =>
    (
      await pg.query<{ body: string | null }>(
        'SELECT body FROM message WHERE id = ANY($1) ORDER BY id',
        [ids],
      )
    ).rows.map(row => row.body)
  const keysOf = async (ids: string[]) =>
    (
      await pg.query<{ storage_key: string | null }>(
        'SELECT storage_key FROM file WHERE attached_to_id = ANY($1) ORDER BY storage_key',
        [ids],
      )
    ).rows.map(row => row.storage_key)
  const versionCount = async () =>
    Number((await pg.query<{ n: string }>('SELECT count(*) AS n FROM record_version')).rows[0]!.n)
  return { testDb, mine, other, store, ...made, bodies, keysOf, versionCount }
}
type Seeded = Awaited<ReturnType<typeof seed>>
// 같은 저장소(올려 둔 객체)를 쓰는 명령
const on = (s: Seeded, overrides: Partial<PrivacyRun> = {}) =>
  harness({ storage: () => s.store.storage, ...overrides }).on(s.testDb)

test('미리 보기는 대상과 개수만 보이고 아무것도 바꾸지 않으며, 본문·이메일·번호·저장소 위치를 찍지 않는다', () =>
  seeded(async s => {
    const before = await s.versionCount()
    const t = on(s)
    assert.equal(await runPrivacy(t.run), 0)
    assert.match(t.out(), /대상: db\.example\.test\/vada \(\.env\)/)
    assert.match(
      t.out(),
      /지울 것: 메시지 2, 판 4, 사진 파일 2, 저장소 객체 2, 이미 지운 메시지 0\. 미리 보기라 바꾸지 않았다\. 실제로 하려면 같은 명령에 --expect 2 --apply를 붙인다\./,
    )
    for (const secret of [
      'hunter2',
      '@',
      '010-',
      s.mine.councilId,
      s.mine.people.planningMember.memberId,
      ...s.inRange,
      'chat/',
    ])
      assert.ok(!t.out().includes(secret), secret)
    assert.deepEqual(await s.bodies(s.inRange), [BODY, BODY])
    assert.equal(await s.versionCount(), before)
    assert.deepEqual(s.store.removed, [])
  }))

test('--apply는 --expect가 없으면 연결하기 전에, 다르면 아무것도 바꾸지 않고 멈춘다', () =>
  seeded(async s => {
    const missing = on(s, { args: args('--apply') })
    assert.equal(await runPrivacy(missing.run), 1)
    assert.equal(missing.connected(), 0)
    assert.match(missing.error.join('\n'), /--expect <개수>로 함께 준다/)
    for (const expect of ['1', '3']) {
      const wrong = on(s, { args: args('--expect', expect, '--apply') })
      assert.equal(await runPrivacy(wrong.run), 1)
      assert.match(
        wrong.error.join('\n'),
        new RegExp(`지울 메시지가 2개라 --expect ${expect}와 다르다`),
      )
    }
    assert.deepEqual(await s.bodies(s.inRange), [BODY, BODY])
    assert.deepEqual(s.store.removed, [])
  }))

test('--apply는 사진 객체를 지우고 범위 안의 메시지와 사진을 모든 판에서 비우며, 다시 돌리면 이미 지운 것으로 센다', () =>
  seeded(async s => {
    const keys = (await s.keysOf(s.inRange)) as string[]
    const untouchedKeys = await s.keysOf(s.untouched)
    const t = on(s, { args: args('--expect', '2', '--apply') })
    assert.equal(await runPrivacy(t.run), 0)
    assert.match(
      t.info.join('\n'),
      /지움: 메시지 2, 판 4, 사진 파일 2, 저장소 객체 2, 이미 지운 메시지 0/,
    )
    assert.deepEqual(new Set(s.store.removed), new Set(keys))
    for (const key of keys) assert.equal(s.store.has(key), false)
    assert.deepEqual(await s.bodies(s.inRange), [null, null])
    assert.deepEqual(await s.keysOf(s.inRange), [null, null])
    const versions = await s.testDb.pg.query<{ data: unknown }>(
      `SELECT data FROM record_version WHERE record_id = ANY($1)
          OR record_id IN (SELECT id FROM file WHERE attached_to_id = ANY($1))`,
      [s.inRange],
    )
    const text = JSON.stringify(versions.rows)
    assert.ok(!text.includes(BODY) && !text.includes('chat/') && !text.includes('photo-'))
    const reasons = await s.testDb.pg.query<{ reason: string; changed_by: string | null }>(
      `SELECT DISTINCT ON (record_id) reason, changed_by FROM record_version
        WHERE record_id = ANY($1) ORDER BY record_id, version_no DESC`,
      [s.inRange],
    )
    assert.deepEqual(reasons.rows, [
      { reason: ERASED_BY_REQUEST, changed_by: null },
      { reason: ERASED_BY_REQUEST, changed_by: null },
    ])
    const deleted = await s.testDb.pg.query(
      'SELECT 1 FROM message WHERE id = ANY($1) AND deleted_at IS NOT NULL',
      [s.inRange],
    )
    assert.equal(deleted.rows.length, 2)
    // 범위 바로 앞·뒤, 다른 사람, 다른 학생회는 그대로다.
    assert.deepEqual(await s.bodies(s.untouched), [BODY, BODY, BODY, BODY, BODY])
    assert.deepEqual(await s.keysOf(s.untouched), untouchedKeys)

    const before = await s.versionCount()
    const removed = s.store.removed.length
    const preview = on(s)
    assert.equal(await runPrivacy(preview.run), 0)
    assert.match(
      preview.out(),
      /지울 것: 메시지 0, 판 0, 사진 파일 0, 저장소 객체 0, 이미 지운 메시지 2/,
    )
    const again = on(s, { args: args('--expect', '0', '--apply') })
    assert.equal(await runPrivacy(again.run), 0)
    assert.match(again.info.join('\n'), /지움: 메시지 0, .*이미 지운 메시지 2/)
    assert.equal(await s.versionCount(), before)
    assert.equal(s.store.removed.length, removed)
  }))

test('저장소 지우기가 실패하면 DB를 바꾸지 않고, 다시 돌리면 끝까지 간다', () =>
  seeded(async s => {
    const failing = {
      ...s.store.storage,
      remove: () => Promise.reject(new Error('STORAGE_DELETE_FAILED secret')),
    }
    const t = on(s, { args: args('--expect', '2', '--apply'), storage: () => failing })
    assert.equal(await runPrivacy(t.run), 1)
    assert.match(t.error.join('\n'), /저장소에서 사진을 지우지 못했다\. DB는 바꾸지 않았다/)
    assert.doesNotMatch(t.out(), /secret/)
    assert.deepEqual(await s.bodies(s.inRange), [BODY, BODY])
    const retry = on(s, { args: args('--expect', '2', '--apply') })
    assert.equal(await runPrivacy(retry.run), 0)
    assert.deepEqual(await s.bodies(s.inRange), [null, null])
  }))

test('탈퇴한 사람은 --left N으로 찾고, 없는 초대 코드·그 학생회에 없는 사람은 바꾸지 않고 멈춘다', () =>
  seeded(async s => {
    await markLeft(s.testDb.pg, s.mine.people.planningMember.memberId, '2026-10-26T00:00:00Z')
    const byEmail = on(s)
    assert.equal(await runPrivacy(byEmail.run), 1)
    assert.match(byEmail.error.join('\n'), /그 운영진을 하나로 찾지 못했다/)
    const left = ['erase-messages', '--invite', INVITE, '--left', '1', ...RANGE]
    const preview = on(s, { args: left })
    assert.equal(await runPrivacy(preview.run), 0)
    assert.match(preview.out(), /지울 것: 메시지 2,/)
    for (const [stopArgs, reason] of [
      [['erase-messages', '--invite', INVITE, '--left', '2', ...RANGE], /하나로 찾지 못했다/],
      [
        ['erase-messages', '--invite', 'ABCDEFGH', '--left', '1', ...RANGE],
        /초대 코드의 학생회가 없다/,
      ],
      [
        ['erase-messages', '--invite', OTHER_INVITE, '--sender', 's-plain@example.test', ...RANGE],
        /하나로 찾지 못했다/,
      ],
    ] as const) {
      const t = on(s, { args: [...stopArgs] })
      assert.equal(await runPrivacy(t.run), 1, stopArgs.join(' '))
      assert.match(t.error.join('\n'), reason)
    }
    assert.deepEqual(await s.bodies(s.inRange), [BODY, BODY])
  }))

test('저장소(R2)가 없으면 미리 보기도 연결하기 전에 멈춘다', async () => {
  for (const extra of [[], ['--expect', '2', '--apply']]) {
    const t = harness({ args: args(...extra), storage: () => null })
    assert.equal(await runPrivacy(t.run), 1)
    assert.equal(t.connected(), 0)
    assert.match(t.error.join('\n'), /R2 설정/)
  }
})
