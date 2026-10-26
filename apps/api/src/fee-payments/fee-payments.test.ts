import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withFeePayments } from '../test-support/fee-payments.js'

const PERIOD = { paidFrom: '2026-03-01', paidUntil: '2026-08-31' }
const body = (students: string, extra: object = {}) => ({ ...PERIOD, students, ...extra })

test(
  '재정부가 줄바꿈·쉼표·공백으로 나눈 학번을 올리면 더한 수와 건너뛴 수를 받고 판 1이 남는다',
  withFeePayments(async t => {
    const response = await t.upload(body('20260001, 20260002\n20260003 20260001\r\n\n20260004,'))
    assert.equal(response.status, 200)
    // 글 안에서 되풀이된 학번 하나는 건너뛴다.
    assert.deepEqual(await response.json(), { added: 4, skipped: 1 })
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 4)
    assert.equal(
      await t.count(
        `SELECT count(*) AS n FROM record_version v JOIN fee_payment f ON f.id = v.record_id WHERE v.version_no = 1`,
      ),
      4,
    )
    const again = await t.upload(
      body('20260001 20260002 20260003 20260004 20260005', { replace: true }),
    )
    assert.deepEqual(await again.json(), { added: 1, skipped: 4 })
    // 시작일이 다르면 같은 학번도 새 기간이다.
    const next = await t.upload({
      paidFrom: '2026-09-01',
      paidUntil: '2027-02-28',
      students: '20260001',
    })
    assert.deepEqual(await next.json(), { added: 1, skipped: 0 })
    assert.equal(
      await t.count(
        `SELECT count(*) AS n FROM record WHERE kind = 'fee_payment' AND council_id = $1`,
        [t.council.councilId],
      ),
      6,
    )
  }),
)

test(
  '재정부만 올린다: 회장단과 다른 운영진은 403, 로그인하지 않으면 401, 아무것도 남지 않는다',
  withFeePayments(async t => {
    for (const user of ['s-president', 's-vicePresident', 's-planningHead', 's-plain', 's-ended'])
      assert.equal((await t.upload(body('20260001'), user)).status, 403, user)
    // 다른 학생회의 재정부원은 우리 학생회에 올리지 못한다.
    assert.equal((await t.upload(body('20260001'), 'o-financeMember')).status, 403)
    assert.equal((await t.api.post(t.base, body('20260001'))).status, 401)
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 0)
  }),
)

test(
  '형식이 틀린 학번이 하나라도 있으면 400과 줄 번호를 주고 아무것도 쓰지 않는다. 입력 검사도 한다',
  withFeePayments(async t => {
    const bad = await t.upload(body('20260001\n12345\n20260002, abcdef\n2026000000000'))
    assert.equal(bad.status, 400)
    assert.deepEqual(await bad.json(), { error: 'INVALID_INPUT', lines: [2, 3, 4] })
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 0)
    for (const invalid of [
      body(''),
      body('   '),
      body(' , \n ,'),
      body('20260001', { paidUntil: '2026-02-28' }),
      body('20260001', { paidFrom: '2026-02-30' }),
      body('20260001', { extra: 1 }),
      body('2026\u0000001'),
      { paidFrom: PERIOD.paidFrom, students: '20260001' },
    ])
      assert.equal((await t.upload(invalid)).status, 400, JSON.stringify(invalid).slice(0, 80))
    // 20,001개는 한 번에 받지 않는다.
    const many = Array.from({ length: 20_001 }, (_, i) => String(100_000 + i)).join(',')
    assert.equal((await t.upload(body(many))).status, 400)
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 0)
  }),
)

test(
  '20,000개(12자리, 쉼표와 공백 구분)는 413 없이 받고 1 MiB를 넘으면 413이다',
  { timeout: 120_000 },
  withFeePayments(async t => {
    const students = Array.from({ length: 20_000 }, (_, i) => String(100_000_000_000 + i)).join(
      ', ',
    )
    assert.ok(students.length > 250_000)
    const response = await t.upload(body(students))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { added: 20_000, skipped: 0 })
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 20_000)
    assert.equal((await t.upload({ x: 'a'.repeat(1_048_576 + 8) })).status, 413)
  }),
)

test(
  '재정부와 회장단은 기간마다 수를 보고 학번 하나를 찾는다. 다른 운영진은 403이고 다른 학생회 줄은 안 보인다',
  withFeePayments(async t => {
    await t.upload(body('20260001 20260002 20260003'))
    await t.upload({ paidFrom: '2026-09-01', paidUntil: '2027-02-28', students: '20260001' })
    await t.upload(
      body('20260001'),
      'o-financeMember',
      `/api/organizations/${t.other.councilId}/fee-payments`,
    )
    for (const user of ['s-financeMember', 's-president', 's-vicePresident']) {
      const response = await t.api.get(t.base, user)
      assert.equal(response.status, 200, user)
      const read = (await response.json()) as { periods: unknown[]; matches: unknown[] }
      assert.deepEqual(read.periods, [
        { paidFrom: '2026-09-01', paidUntil: '2027-02-28', count: 1 },
        { paidFrom: '2026-03-01', paidUntil: '2026-08-31', count: 3 },
      ])
      // 찾지 않으면 학번은 나가지 않는다.
      assert.deepEqual(read.matches, [])
    }
    const found = (await (
      await t.api.get(`${t.base}?studentId=20260001`, 's-president')
    ).json()) as {
      matches: { studentId: string; paidFrom: string }[]
    }
    assert.deepEqual(
      found.matches.map(match => [match.studentId, match.paidFrom]),
      [
        ['20260001', '2026-09-01'],
        ['20260001', '2026-03-01'],
      ],
    )
    for (const user of ['s-planningHead', 's-plain', 's-ended', 'o-financeMember'])
      assert.equal((await t.api.get(t.base, user)).status, 403, user)
    assert.equal((await t.api.get(t.base)).status, 401)
    assert.equal((await t.api.get(`${t.base}?studentId=abc`, 's-president')).status, 400)
    assert.equal((await t.api.get(`${t.base}?other=1`, 's-president')).status, 400)
  }),
)

test(
  '빼기는 학번을 지금 값과 모든 판에서 비우고 줄은 남긴다. 다시 올릴 수 있고 남의 줄은 404다',
  withFeePayments(async t => {
    await t.upload(body('20260001 20260002'))
    const id = (
      (await (await t.api.get(`${t.base}?studentId=20260001`, 's-financeMember')).json()) as {
        matches: { id: string }[]
      }
    ).matches[0]!.id
    // 판을 하나 더 만들어 두어, 모든 판에서 비우는지 본다.
    await t.pg.query(
      `UPDATE record_version SET valid = tstzrange(lower(valid), now()) WHERE record_id = $1`,
      [id],
    )
    await t.pg.query(
      `INSERT INTO record_version (record_id, version_no, valid, data, changed_by)
       SELECT record_id, 2, tstzrange(now(), NULL), data, changed_by FROM record_version WHERE record_id = $1`,
      [id],
    )
    const remove = (user: string, target = id, base = t.base) =>
      t.api.post(`${base}/${target}/remove`, {}, user)
    assert.equal((await remove('s-president')).status, 403)
    assert.equal((await remove('s-financeMember')).status, 200)
    assert.equal(
      await t.count('SELECT count(*) AS n FROM fee_payment WHERE id = $1 AND student_id IS NULL', [
        id,
      ]),
      1,
    )
    assert.equal(
      await t.count(
        `SELECT count(*) AS n FROM record_version WHERE record_id = $1 AND data ->> 'student_id' IS NOT NULL`,
        [id],
      ),
      0,
    )
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 2)
    assert.equal((await remove('s-financeMember')).status, 404)
    assert.equal((await remove('s-financeMember', 'not-a-uuid')).status, 404)
    // 다른 학생회 재정부원은 남의 줄을 빼지 못한다(없는 것과 같다).
    assert.equal(
      (await remove('o-financeMember', id, `/api/organizations/${t.other.councilId}/fee-payments`))
        .status,
      404,
    )
    // 대조에서 빠졌으므로 목록에서 사라지고 다시 올릴 수 있다.
    const read = (await (
      await t.api.get(`${t.base}?studentId=20260001`, 's-financeMember')
    ).json()) as { matches: unknown[]; periods: { count: number }[] }
    assert.deepEqual([read.matches.length, read.periods[0]!.count], [0, 1])
    assert.deepEqual(await (await t.upload(body('20260001', { replace: true }))).json(), {
      added: 1,
      skipped: 0,
    })
  }),
)

test(
  '다른 학생회에 같은 학번·시작일이 있어도 우리 올리기는 더해지고, 우리 주소로 남의 살아 있는 줄을 빼려 하면 404이며 값이 남는다',
  withFeePayments(async t => {
    const otherBase = `/api/organizations/${t.other.councilId}/fee-payments`
    assert.deepEqual(
      await (await t.upload(body('20260001'), 'o-financeMember', otherBase)).json(),
      {
        added: 1,
        skipped: 0,
      },
    )
    // 건너뛰기는 같은 학생회 안에서만 본다.
    assert.deepEqual(await (await t.upload(body('20260001'))).json(), { added: 1, skipped: 0 })
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 2)
    const foreign = (
      await t.pg.query('SELECT id FROM fee_payment WHERE council_id = $1', [t.other.councilId])
    ).rows[0] as { id: string }
    const response = await t.api.post(`${t.base}/${foreign.id}/remove`, {}, 's-financeMember')
    assert.equal(response.status, 404)
    assert.equal(
      await t.count(
        `SELECT count(*) AS n FROM fee_payment WHERE id = $1 AND student_id = '20260001'`,
        [foreign.id],
      ),
      1,
    )
    assert.equal(
      await t.count(
        `SELECT count(*) AS n FROM record_version WHERE record_id = $1 AND data ->> 'student_id' = '20260001'`,
        [foreign.id],
      ),
      1,
    )
  }),
)
