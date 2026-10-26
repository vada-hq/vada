import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import { WON_MAX } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { migratedUntil } from './test-db.js'

test('0022는 기존 품목·판·승인금액을 보존하고 예상 가격의 범위와 합계 CHECK를 건다', async () => {
  const { pg, applyTarget } = await migratedUntil('0022_purchase_estimates')
  try {
    const db = drizzle(pg)
    const council = await seedCouncil(db, pg)
    const requestId = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'request',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: {
          type: 'purchase',
          title: '기존 요청',
          requestedBy: council.people.president.memberId,
        },
      }),
    )
    const id = (
      await pg.query<{ id: string }>(
        "INSERT INTO record(kind,council_id) VALUES('line_item',$1) RETURNING id",
        [council.councilId],
      )
    ).rows[0]!.id
    await pg.query(
      'INSERT INTO line_item(id,request_id,name,quantity,amount) VALUES($1,$2,$3,2,1234)',
      [id, requestId, '기존 품목'],
    )
    await pg.query(
      `INSERT INTO record_version(record_id,version_no,valid,data)
      SELECT r.id,1,tstzrange(r.created_at,NULL),to_jsonb(t) FROM record r JOIN line_item t ON t.id=r.id WHERE r.id=$1`,
      [id],
    )
    const versions = () =>
      pg.query<{ data: object }>('SELECT data FROM record_version WHERE record_id=$1', [id])
    const before = (await versions()).rows
    await applyTarget()
    assert.deepEqual((await versions()).rows, before)
    const row = (
      await pg.query<{ amount: string; estimated_unit_price: null; estimated_shipping_fee: null }>(
        'SELECT amount,estimated_unit_price,estimated_shipping_fee FROM line_item WHERE id=$1',
        [id],
      )
    ).rows[0]!
    assert.deepEqual(row, {
      amount: '1234',
      estimated_unit_price: null,
      estimated_shipping_fee: null,
    })
    const update = (price: number | null, shipping: number | null) =>
      pg.query(
        'UPDATE line_item SET estimated_unit_price=$2,estimated_shipping_fee=$3 WHERE id=$1',
        [id, price, shipping],
      )
    for (const [price, shipping] of [
      [-1, null],
      [null, -1],
      [WON_MAX + 1, null],
      [null, WON_MAX + 1],
      [WON_MAX, null],
      [WON_MAX / 2, 1],
    ])
      await assert.rejects(update(price!, shipping!), { code: '23514' })
    await update(0, 0)
    await update(WON_MAX / 2, 0)
    await update(100, null)
    const oldClient = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'line_item',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: { requestId, name: '옛 클라이언트', quantity: 1 },
      }),
    )
    assert.equal(
      (
        await pg.query<{ value: null }>(
          'SELECT estimated_unit_price AS value FROM line_item WHERE id=$1',
          [oldClient],
        )
      ).rows[0]!.value,
      null,
    )
  } finally {
    await pg.close()
  }
})
