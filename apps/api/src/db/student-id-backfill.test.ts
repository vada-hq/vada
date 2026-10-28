import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migratedUntil, type TestPg } from './test-db.js'

// 0012(학번 받기, DEC-75)가 이미 있는 양식을 채우는 방식. 앞 마이그레이션까지 적용한 DB에 양식을 넣고 0012를 적용한다.
const TAG = '0012_registration_form_student_id'

async function add(pg: TestPg, kind: string, council: string | null, fields: object) {
  const { rows } = await pg.query<{ id: string }>(
    'INSERT INTO record (kind, council_id) VALUES ($1, $2) RETURNING id',
    [kind, council],
  )
  const row: Record<string, unknown> = { id: rows[0]!.id, ...fields }
  const columns = Object.keys(row)
  await pg.query(
    `INSERT INTO ${kind} (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  )
  return rows[0]!.id
}

test('0012는 이미 있는 양식을 두 참가비가 다르면 받기, 아니면 받지 않기로 채우고 새 양식은 받기다', async () => {
  const { pg, applyTarget } = await migratedUntil(TAG)
  try {
    const council = await add(pg, 'council', null, {
      name: '학생회',
      unit: 'department',
      school_name: '학교',
    })
    const event = await add(pg, 'event', council, { name: '축제' })
    let codes = 0
    const form = (fees: { payer_fee?: string; non_payer_fee?: string }) =>
      add(pg, 'registration_form', council, {
        event_id: event,
        name: '신청',
        closes_at: '2026-11-01T09:00:00Z',
        public_code: `AAAAAAA${'23456789'[codes++]}`,
        ...fees,
      })
    const none = await form({})
    const same = await form({ payer_fee: '3000', non_payer_fee: '3000' })
    const zero = await form({ payer_fee: '0', non_payer_fee: '0' })
    const split = await form({ payer_fee: '0', non_payer_fee: '5000' })
    await applyTarget()
    const collects = async (id: string) =>
      (
        await pg.query<{ collects_student_id: boolean }>(
          'SELECT collects_student_id FROM registration_form WHERE id = $1',
          [id],
        )
      ).rows[0]!.collects_student_id
    assert.deepEqual(
      [await collects(none), await collects(same), await collects(zero), await collects(split)],
      [false, false, false, true],
    )
    // 옛 코드처럼 칸 없이 넣으면 받기다. 두 참가비가 달라도 CHECK에 걸리지 않는다.
    assert.equal(await collects(await form({})), true)
    assert.equal(await collects(await form({ payer_fee: '0', non_payer_fee: '5000' })), true)
    // 두 참가비가 다르면 받지 않기로 바꿀 수 없고, 받지 않는 양식의 두 참가비를 다르게 바꿀 수도 없다.
    await assert.rejects(
      pg.query('UPDATE registration_form SET collects_student_id = false WHERE id = $1', [split]),
      { code: '23514' },
    )
    await assert.rejects(
      pg.query("UPDATE registration_form SET non_payer_fee = '4000' WHERE id = $1", [same]),
      { code: '23514' },
    )
  } finally {
    await pg.close()
  }
})
