import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, migratedUntil, type TestPg } from './test-db.js'

const HELD_AT = '2026-10-29T05:00:00Z'

// 기존 칸만 넣어 새 칸을 모르는 코드와 이미 있는 행도 계속 유효한지 본다.
async function legacyRows(pg: TestPg) {
  const { rows } = await pg.query<{ id: string; kind: string }>(
    `INSERT INTO record (kind) VALUES ('meeting'), ('agenda_item'), ('task'), ('member'), ('decision')
     RETURNING id, kind`,
  )
  const id = (kind: string) => rows.find(row => row.kind === kind)!.id
  await pg.query('INSERT INTO member (id, name, email) VALUES ($1, $2, $3)', [
    id('member'),
    '참가자',
    `${id('member')}@example.test`,
  ])
  await pg.query('INSERT INTO meeting (id, title, held_at) VALUES ($1, $2, $3)', [
    id('meeting'),
    '회의',
    HELD_AT,
  ])
  await pg.query(
    "INSERT INTO agenda_item (id, meeting_id, position, title) VALUES ($1, $2, 1, '안건')",
    [id('agenda_item'), id('meeting')],
  )
  await pg.query("INSERT INTO task (id, title) VALUES ($1, '후속 업무')", [id('task')])
  await pg.query(
    "INSERT INTO decision (id, content, decided_by, decided_at) VALUES ($1, '결정', $2, $3)",
    [id('decision'), id('member'), HELD_AT],
  )
  return {
    meeting: id('meeting'),
    agenda: id('agenda_item'),
    task: id('task'),
    member: id('member'),
  }
}

test('회의 끝은 시작보다 늦고, 취소 시각과 사유는 함께 있거나 함께 빈다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { meeting } = await legacyRows(pg)
    for (const endsAt of [HELD_AT, '2026-10-29T04:59:59Z'])
      await assert.rejects(
        pg.query('UPDATE meeting SET ends_at = $2 WHERE id = $1', [meeting, endsAt]),
        { code: '23514' },
      )
    await pg.query('UPDATE meeting SET ends_at = $2 WHERE id = $1', [
      meeting,
      '2026-10-29T05:00:01Z',
    ])
    for (const clause of ['cancelled_at = now()', "cancel_reason = '일정 변경'"])
      await assert.rejects(pg.query(`UPDATE meeting SET ${clause} WHERE id = $1`, [meeting]), {
        code: '23514',
      })
    await pg.query(
      "UPDATE meeting SET cancelled_at = now(), cancel_reason = '일정 변경' WHERE id = $1",
      [meeting],
    )
    await pg.query('UPDATE meeting SET cancelled_at = NULL, cancel_reason = NULL WHERE id = $1', [
      meeting,
    ])
  } finally {
    await close()
  }
})

test('장소·목적·취소 사유·논의 내용은 글자 수 경계까지 허용하고 한 글자 더는 거절한다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { meeting, agenda } = await legacyRows(pg)
    for (const [table, column, id, max] of [
      ['meeting', 'place', meeting, 100],
      ['meeting', 'purpose', meeting, 500],
      ['meeting', 'cancel_reason', meeting, 200],
      ['agenda_item', 'notes', agenda, 10000],
    ] as const) {
      const paired = column === 'cancel_reason' ? ', cancelled_at = now()' : ''
      const update = `UPDATE ${table} SET ${column} = repeat('😀', $2)${paired} WHERE id = $1`
      await pg.query(update, [id, max])
      await assert.rejects(pg.query(update, [id, max + 1]), { code: '23514' }, column)
      await pg.query(
        `UPDATE ${table} SET ${column} = NULL${column === 'cancel_reason' ? ', cancelled_at = NULL' : ''} WHERE id = $1`,
        [id],
      )
    }
  } finally {
    await close()
  }
})

test('업무의 나온 곳은 존재하는 안건이고 번호와 종류를 함께 채우거나 비운다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { meeting, agenda, task } = await legacyRows(pg)
    for (const clause of [
      `origin_id = '${agenda}'`,
      "origin_kind = 'agenda_item'",
      `origin_id = '${meeting}', origin_kind = 'meeting'`,
    ])
      await assert.rejects(pg.query(`UPDATE task SET ${clause} WHERE id = $1`, [task]), {
        code: '23514',
      })
    for (const id of ['00000000-0000-4000-8000-000000000000', meeting])
      await assert.rejects(
        pg.query("UPDATE task SET origin_id = $2, origin_kind = 'agenda_item' WHERE id = $1", [
          task,
          id,
        ]),
        { code: '23503' },
      )
    await pg.query("UPDATE task SET origin_id = $2, origin_kind = 'agenda_item' WHERE id = $1", [
      task,
      agenda,
    ])
    await pg.query('UPDATE task SET origin_id = NULL, origin_kind = NULL WHERE id = $1', [task])
  } finally {
    await close()
  }
})

test('회의 참가자는 회의와 운영진을 가리키고 같은 쌍을 두 번 넣을 수 없다', async () => {
  const { pg, close } = await createTestDb()
  try {
    const { meeting, member } = await legacyRows(pg)
    const insert = 'INSERT INTO meeting_attendee (meeting_id, member_id) VALUES ($1, $2)'
    await pg.query(insert, [meeting, member])
    await assert.rejects(pg.query(insert, [meeting, member]), { code: '23505' })
    const missing = '00000000-0000-4000-8000-000000000000'
    for (const pair of [
      [missing, member],
      [meeting, missing],
    ])
      await assert.rejects(pg.query(insert, pair), { code: '23503' })
    assert.equal(
      (await pg.query('SELECT 1 FROM meeting_attendee WHERE added_at IS NOT NULL')).rows.length,
      1,
    )
  } finally {
    await close()
  }
})

test('0026은 기존 행과 기존 칸만 쓰는 INSERT를 허용하고 기존 칸의 제약은 더하지 않는다', async () => {
  const { pg, applyTarget } = await migratedUntil('0026_meeting_minutes')
  try {
    const before = await legacyRows(pg)
    await pg.query("UPDATE meeting SET title = repeat('가', 101) WHERE id = $1", [before.meeting])
    await pg.query(
      "UPDATE agenda_item SET title = repeat('가', 101), body = repeat('가', 501) WHERE id = $1",
      [before.agenda],
    )
    await pg.query("UPDATE decision SET content = repeat('가', 501), rationale = repeat('가', 501)")
    await applyTarget()
    await legacyRows(pg)
    const { rows } = await pg.query(
      `SELECT 1 FROM meeting WHERE ends_at IS NULL AND place IS NULL AND purpose IS NULL
       AND cancelled_at IS NULL AND cancel_reason IS NULL`,
    )
    assert.equal(rows.length, 2)
    assert.equal(
      (await pg.query('SELECT 1 FROM agenda_item WHERE notes IS NULL AND cancelled_at IS NULL'))
        .rows.length,
      2,
    )
    assert.equal(
      (await pg.query('SELECT 1 FROM decision WHERE cancelled_at IS NULL')).rows.length,
      2,
    )
    assert.equal(
      (await pg.query('SELECT 1 FROM task WHERE origin_id IS NULL AND origin_kind IS NULL')).rows
        .length,
      2,
    )
  } finally {
    await pg.close()
  }
})
