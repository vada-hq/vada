import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from './test-db.js'
import { seedCouncil } from '../test-support/council.js'
import { createRecord } from '../records/records.js'
import { TRACKING_NUMBER_MAX, SHIPMENT_CARRIERS } from '@vada/contracts'

test('S1은 기록 종류·학생회·품목 연결과 택배사·송장 번호 CHECK를 DB에서도 지킨다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const mine = await seedCouncil(db, pg)
    const other = await seedCouncil(db, pg, 'o')
    const make = async (councilId: string) =>
      db.transaction(async tx => {
        const actor =
          councilId === mine.councilId
            ? mine.people.planningMember.memberId
            : other.people.planningMember.memberId
        const requestId = await createRecord(tx, {
          kind: 'request',
          councilId,
          actor,
          values: { type: 'purchase', title: '물품', requestedBy: actor },
        })
        const itemId = await createRecord(tx, {
          kind: 'line_item',
          councilId,
          actor,
          values: { requestId, name: '물품', quantity: 1 },
        })
        return { requestId, itemId }
      })
    const own = await make(mine.councilId)
    const theirs = await make(other.councilId)
    const id = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'shipment',
        councilId: mine.councilId,
        actor: mine.people.financeMember.memberId,
        values: { requestId: own.requestId, carrierId: 'kr.coupangls', trackingNumber: '123-456' },
      }),
    )
    await pg.query(
      'INSERT INTO shipment_item (shipment_id,line_item_id,council_id) VALUES ($1,$2,$3)',
      [id, own.itemId, mine.councilId],
    )
    await assert.rejects(
      pg.query(
        'INSERT INTO shipment_item (shipment_id,line_item_id,council_id) VALUES ($1,$2,$3)',
        [id, theirs.itemId, mine.councilId],
      ),
      { code: '23503' },
    )
    await assert.rejects(
      pg.query(
        'INSERT INTO shipment_item (shipment_id,line_item_id,council_id) VALUES ($1,$2,$3)',
        [id, theirs.itemId, other.councilId],
      ),
      { code: '23503' },
    )
    await assert.rejects(
      pg.query(
        'INSERT INTO shipment_item (shipment_id,line_item_id,council_id) VALUES ($1,$2,$3)',
        [id, own.requestId, mine.councilId],
      ),
      { code: '23503' },
    )
    await assert.rejects(
      pg.query('UPDATE shipment SET request_id=$1 WHERE id=$2', [theirs.requestId, id]),
      { code: '23503' },
    )
    for (const value of [
      '',
      ' ',
      '---',
      '123x',
      '1'.repeat(TRACKING_NUMBER_MAX + 1),
      '😀'.repeat(TRACKING_NUMBER_MAX + 1),
    ])
      await assert.rejects(
        pg.query('UPDATE shipment SET tracking_number=$1 WHERE id=$2', [value, id]),
        { code: '23514' },
      )
    for (const carrier of SHIPMENT_CARRIERS)
      await pg.query('UPDATE shipment SET carrier_id=$1 WHERE id=$2', [carrier, id])
    await assert.rejects(
      pg.query('UPDATE shipment SET carrier_id=$1 WHERE id=$2', ['unknown', id]),
      { code: '23514' },
    )
    await assert.rejects(pg.query('UPDATE shipment SET kind=$1 WHERE id=$2', ['line_item', id]), {
      code: '23514',
    })
    await assert.rejects(
      db.transaction(tx =>
        createRecord(tx, {
          kind: 'shipment',
          councilId: mine.councilId,
          actor: mine.people.financeMember.memberId,
          values: { requestId: theirs.requestId, carrierId: 'kr.coupangls', trackingNumber: '123' },
        }),
      ),
    )
  } finally {
    await close()
  }
})
