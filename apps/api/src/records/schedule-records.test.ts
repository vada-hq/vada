import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateRecord } from './records.js'
import { withSettlement } from '../test-support/settlement.js'

test(
  '일정 부서·행사는 바꿀 수 있고 같은 학생회 확인을 우회할 수 없다',
  withSettlement(async t => {
    const eventId = await t.event()
    const id = await t.make(t.council, 'schedule_item', {
      type: 'other',
      title: '답사',
      startsOn: '2026-10-28',
    })
    const change = (changes: Parameters<typeof updateRecord<'schedule_item'>>[1]['changes']) =>
      t.db.transaction(tx =>
        updateRecord(tx, {
          kind: 'schedule_item',
          id,
          actor: t.council.people.president.memberId,
          reason: null,
          changes,
        }),
      )
    await change({ departmentId: t.council.departments.planning, eventId })
    await assert.rejects(change({ departmentId: t.other.departments.planning }), /학생회/)
    await assert.rejects(change({ eventId: await t.event({}, t.other) }), /학생회/)
    await assert.rejects(
      t.make(t.council, 'schedule_item', {
        type: 'other',
        title: '잘못된 부서',
        startsOn: '2026-10-28',
        departmentId: t.other.departments.planning,
      }),
      /학생회/,
    )
    await assert.rejects(change({ councilId: t.other.councilId }), /주인 칸/)
    const versions = await t.pg.query<{ n: string }>(
      'SELECT count(*) AS n FROM record_version WHERE record_id = $1',
      [id],
    )
    assert.equal(Number(versions.rows[0]!.n), 2)
  }),
)
