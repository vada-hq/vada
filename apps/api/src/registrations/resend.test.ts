import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { saveReceipt } from '../commands/receipt.js'
import { runPurge } from '../purge/run.js'
import { clearPhones } from './personal-values.js'
import { purgeRegistrations } from './purge.js'
import { korean, withRegistrations, type RegistrationKit } from '../test-support/registrations.js'

// 공개 신청 다시 보내기(기능 017, DEC-84, RULE-45)
const HOUR_MS = 3_600_000
const SECOND_MS = 1000
const DAY_MS = 24 * HOUR_MS
const COMMAND = '3f2b8a52-6c1e-4d0b-9a7e-2d5c8f1b4a60'
const person = { name: '김신청' }
const tokenOf = async (response: Response) => ((await response.json()) as { token: string }).token

async function openForm(t: RegistrationKit, values: Record<string, unknown> = {}) {
  const event = await t.makeEvent()
  const { form } = await t.created(event, { collectsStudentId: false, ...values })
  return form
}
const registrations = (t: RegistrationKit) =>
  t.count('SELECT count(*) AS n FROM registration WHERE cancelled_at IS NULL')
const receipts = (t: RegistrationKit) => t.count('SELECT count(*) AS n FROM command_receipt')
const send = (t: RegistrationKit, code: string, body: Record<string, unknown>) =>
  t.publicPost(`/registration-forms/${code}/apply`, body)

test(
  '명령 번호가 없거나 UUID v4가 아니면 400이고 아무것도 남지 않는다',
  withRegistrations(async t => {
    const form = await openForm(t)
    for (const body of [
      person,
      { ...person, commandId: '' },
      { ...person, commandId: 'abc' },
      { ...person, commandId: '019e0000-0000-7000-8000-000000000000' },
      { ...person, commandId: 7 },
    ]) {
      const response = await send(t, form.publicCode, body)
      assert.equal(response.status, 400)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    assert.equal(await registrations(t), 0)
    assert.equal(await receipts(t), 0)
  }),
)

test(
  '같은 번호·같은 본문을 다시 보내면 201과 새 토큰이 오고 신청·판은 그대로이며 앞 토큰은 404다',
  withRegistrations(async t => {
    const form = await openForm(t)
    const first = await send(t, form.publicCode, { ...person, commandId: COMMAND })
    assert.equal(first.status, 201)
    const firstToken = await tokenOf(first)
    const versions = await t.count('SELECT count(*) AS n FROM record_version')
    const records = await t.count('SELECT count(*) AS n FROM record')
    const again = await send(t, form.publicCode, { ...person, commandId: COMMAND })
    assert.equal(again.status, 201)
    assert.equal(again.headers.get('cache-control'), 'no-store')
    const raw = await again.text()
    // 응답에는 토큰만 있다: 본문 해시도 명령 번호도 싣지 않는다.
    assert.deepEqual(Object.keys(JSON.parse(raw) as object), ['token'])
    const secondToken = (JSON.parse(raw) as { token: string }).token
    assert.notEqual(secondToken, firstToken)
    assert.equal(await registrations(t), 1)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 1)
    assert.equal(await t.count('SELECT count(*) AS n FROM record_version'), versions)
    assert.equal(await t.count('SELECT count(*) AS n FROM record'), records)
    assert.equal(await receipts(t), 1)
    assert.equal((await t.lookup(secondToken)).status, 200)
    assert.equal((await t.lookup(firstToken)).status, 404)
    // 세 번째도 같다.
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal(await registrations(t), 1)
  }),
)

test(
  '정원이 찬 뒤에도 같은 명령의 재전송은 201이고 다른 명령은 REGISTRATION_FULL이다',
  withRegistrations(async t => {
    const form = await openForm(t, { capacity: 1 })
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    const resent = await send(t, form.publicCode, { ...person, commandId: COMMAND })
    assert.equal(resent.status, 201)
    const other = await send(t, form.publicCode, { ...person, commandId: randomUUID() })
    assert.equal(other.status, 409)
    assert.deepEqual(await other.json(), { error: 'REGISTRATION_FULL' })
    assert.equal(await registrations(t), 1)
  }),
)

test(
  '같은 번호·다른 본문은 422 COMMAND_REUSED이고 신청·링크·영수증이 바뀌지 않는다',
  withRegistrations(async t => {
    const form = await openForm(t)
    const token = await tokenOf(await send(t, form.publicCode, { ...person, commandId: COMMAND }))
    const hashes = await t.pg.query('SELECT body_hash FROM command_receipt')
    const response = await send(t, form.publicCode, { name: '박다름', commandId: COMMAND })
    assert.equal(response.status, 422)
    assert.deepEqual(await response.json(), { error: 'COMMAND_REUSED' })
    assert.equal(await registrations(t), 1)
    assert.deepEqual((await t.pg.query('SELECT body_hash FROM command_receipt')).rows, hashes.rows)
    assert.equal((await t.lookup(token)).status, 200)
    assert.equal(await t.count("SELECT count(*) AS n FROM registration WHERE name = '박다름'"), 0)
  }),
)

test(
  '같은 번호를 다른 양식에 보내면 그 양식의 새 신청이다',
  withRegistrations(async t => {
    const first = await openForm(t)
    const second = await openForm(t)
    assert.equal((await send(t, first.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal((await send(t, second.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal(await registrations(t), 2)
    assert.equal(await receipts(t), 2)
  }),
)

test(
  '검사·상태로 거절한 요청은 영수증이 없어 같은 번호로 고쳐 다시 보낼 수 있다',
  withRegistrations(async t => {
    const form = await openForm(t)
    // 학번을 받지 않는 양식에 학번을 보내면 FORM_CHANGED(409)
    const wrong = await send(t, form.publicCode, {
      ...person,
      studentId: '202612345',
      commandId: COMMAND,
    })
    assert.equal(wrong.status, 409)
    assert.equal(await receipts(t), 0)
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal(await registrations(t), 1)
    // 아직 받지 않는 양식의 409도 같다.
    const early = await openForm(t, { opensAt: '2026-10-30T09:00' })
    const rejected = await send(t, early.publicCode, { ...person, commandId: randomUUID() })
    assert.equal(rejected.status, 409)
    assert.equal(await receipts(t), 1)
  }),
)

test(
  '신청이 취소된 뒤 같은 명령은 새 신청을 만든다',
  withRegistrations(async t => {
    const form = await openForm(t)
    const token = await tokenOf(await send(t, form.publicCode, { ...person, commandId: COMMAND }))
    assert.equal((await t.cancelMine(token)).status, 200)
    assert.equal(await registrations(t), 0)
    const again = await send(t, form.publicCode, { ...person, commandId: COMMAND })
    assert.equal(again.status, 201)
    assert.equal(await registrations(t), 1)
    assert.equal(await receipts(t), 1)
    assert.equal((await t.lookup(await tokenOf(again))).status, 200)
  }),
)

test(
  '24시간 1초 전까지는 재전송이고 24시간부터는 새 명령이다. 지우기 일은 지난 영수증만 지운다(두 번 돌아도 같다)',
  withRegistrations(async t => {
    const form = await openForm(t)
    const start = new Date('2026-10-25T03:00:00Z')
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    const almost = new Date(start.getTime() + DAY_MS - SECOND_MS)
    t.setNow(almost)
    assert.equal(await runPurge(t.db, almost), true)
    assert.equal(await receipts(t), 1)
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal(await registrations(t), 1)
    const expired = new Date(start.getTime() + DAY_MS)
    t.setNow(expired)
    // 지우기 일이 오기 전에도 24시간이 지난 영수증은 쓰지 않는다.
    assert.equal((await send(t, form.publicCode, { ...person, commandId: COMMAND })).status, 201)
    assert.equal(await registrations(t), 2)
    assert.equal(await receipts(t), 1)
    const later = new Date(expired.getTime() + DAY_MS)
    t.setNow(later)
    for (let round = 0; round < 2; round++) {
      assert.equal(await runPurge(t.db, later), true)
      assert.equal(await receipts(t), 0)
    }
  }),
)

test(
  '본문 해시는 신청 본문에서 나온 가명 정보라 다른 곳에 남지 않는다',
  withRegistrations(async t => {
    const form = await openForm(t)
    const token = await tokenOf(await send(t, form.publicCode, { ...person, commandId: COMMAND }))
    const { rows } = await t.pg.query('SELECT body_hash FROM command_receipt')
    const hash = (rows[0] as { body_hash: string }).body_hash
    assert.match(hash, /^[0-9a-f]{64}$/)
    const dump = JSON.stringify((await t.pg.query('SELECT data FROM record_version')).rows)
    assert.ok(!dump.includes(hash) && !dump.includes(token))
  }),
)

test(
  '같은 (종류, 범위, 번호)의 영수증은 DB가 하나만 둔다(앱의 잠금이 틀려도 막는 마지막 겹)',
  withRegistrations(async t => {
    const form = await openForm(t)
    await send(t, form.publicCode, { ...person, commandId: COMMAND })
    await assert.rejects(
      t.pg.query(
        `INSERT INTO command_receipt (kind, scope_key, command_id, body_hash, result_id, result_kind)
         SELECT kind, scope_key, command_id, body_hash, result_id, result_kind FROM command_receipt`,
      ),
      { code: '23505' },
    )
  }),
)

test(
  '취소하면 그 신청의 영수증을 바로 지운다. 취소 뒤 다른 본문에 같은 번호를 보내도 새 신청이다',
  withRegistrations(async t => {
    const form = await openForm(t)
    const token = await tokenOf(await send(t, form.publicCode, { ...person, commandId: COMMAND }))
    assert.equal(await receipts(t), 1)
    assert.equal((await t.cancelMine(token)).status, 200)
    assert.equal(await receipts(t), 0)
    const other = await send(t, form.publicCode, { name: '박다름', commandId: COMMAND })
    assert.equal(other.status, 201)
    assert.equal(await registrations(t), 1)
  }),
)

test(
  '기한이 지나 신청자 정보를 비울 때도 그 양식 신청의 영수증을 지운다',
  withRegistrations(async t => {
    const form = await openForm(t)
    await send(t, form.publicCode, { ...person, commandId: COMMAND })
    assert.equal(await receipts(t), 1)
    await t.db.transaction(tx => purgeRegistrations(tx, korean('2027-11-02T00:00')))
    assert.equal(await t.count('SELECT count(*) AS n FROM registration WHERE name IS NOT NULL'), 0)
    assert.equal(await receipts(t), 0)
  }),
)

test(
  '같은 (종류, 범위, 번호)를 거래 안에서 두 번 남기면 500이 아니라 COMMAND_CONFLICT(409)다',
  withRegistrations(async t => {
    const form = await openForm(t)
    await send(t, form.publicCode, { ...person, commandId: COMMAND })
    const { rows } = await t.pg.query('SELECT * FROM command_receipt')
    const row = rows[0] as { kind: 'registration_apply'; scope_key: string; result_id: string }
    await assert.rejects(
      t.db.transaction(tx =>
        saveReceipt(
          tx,
          { kind: row.kind, scopeKey: row.scope_key, commandId: COMMAND },
          { bodyHash: 'a'.repeat(64), resultId: row.result_id, resultKind: 'registration' },
          new Date(),
        ),
      ),
      { message: 'COMMAND_CONFLICT' },
    )
  }),
)

test(
  '영수증은 신청이 아닌 기록을 가리킬 수 없다(종류 CHECK를 지나는 값으로 외래 키만 본다)',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    // kind와 result_kind는 CHECK에 맞지만 (event 번호, 'registration')은 기록에 없다.
    await assert.rejects(
      t.pg.query(
        `INSERT INTO command_receipt (kind, scope_key, command_id, body_hash, result_id, result_kind)
         VALUES ('registration_apply', 'x', $1, $2, $3, 'registration')`,
        [COMMAND, 'a'.repeat(64), event],
      ),
      { code: '23503' },
    )
  }),
)

test(
  '양식에서 휴대폰 받기를 끄면 그 양식 신청의 영수증을 지운다',
  withRegistrations(async t => {
    const form = await openForm(t, { collectsPhone: true })
    await send(t, form.publicCode, { ...person, phone: '010-1234-5678', commandId: COMMAND })
    assert.equal(await receipts(t), 1)
    await t.db.transaction(tx => clearPhones(tx, form.id))
    assert.equal(await receipts(t), 0)
  }),
)
