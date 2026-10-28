import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSettlement } from '../test-support/settlement.js'

test(
  '일정 표는 날짜·시각 한 쌍, 순서, 길이, 공개 범위와 학생회 외래 키를 지킨다',
  withSettlement(async t => {
    const id = await t.make(t.council, 'schedule_item', {
      type: 'academic',
      title: '시험',
      startsOn: '2026-10-28',
    })
    for (const clause of [
      'starts_on = NULL',
      "starts_at = '2026-10-28T10:00:00Z'",
      "ends_at = '2026-10-28T11:00:00Z'",
      "ends_on = '2026-10-27'",
      "visibility = 'department'",
      "visibility = 'private'",
      "type = 'event'",
      "kind = 'event'",
      "title = ''",
      "title = repeat('😀', 101)",
      "place = ''",
      "place = repeat('😀', 101)",
      "memo = ''",
      "memo = repeat('😀', 1001)",
      `department_id = '${t.other.departments.planning}'`,
      `event_id = '${await t.event({}, t.other)}'`,
      `council_id = '${t.other.councilId}'`,
    ])
      await assert.rejects(t.pg.query(`UPDATE schedule_item SET ${clause} WHERE id = $1`, [id]))
    await t.pg.query(
      "UPDATE schedule_item SET starts_on = NULL, starts_at = '2026-10-28T10:00:00Z' WHERE id = $1",
      [id],
    )
    for (const clause of [
      "ends_at = '2026-10-28T10:00:00Z'",
      "ends_at = '2026-10-28T09:59:00Z'",
      "ends_on = '2026-10-28'",
    ])
      await assert.rejects(t.pg.query(`UPDATE schedule_item SET ${clause} WHERE id = $1`, [id]))
  }),
)
