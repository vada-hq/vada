import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../../db/test-db.js'
import { pgliteConnection } from '../../test-support/smoke-connection.js'
import { eventRoomsTogetherCase } from './pg-smoke-event-room-case.js'

// PGlite는 거래를 하나씩 돌려 동시 처리는 증명하지 못한다. 사례의 준비와 판정 모양만 본다(실제 확인은 pg-smoke).
const now = new Date('2026-10-19T03:00:00Z')

test('행사 방 동시 처리 사례: 준비와 판정이 PGlite에서 통과한다', async () => {
  const testDb = await createTestDb()
  try {
    const verdict = await eventRoomsTogetherCase.run({
      connect: () => pgliteConnection(testDb),
      now,
      sessionLimitMs: 2000,
    })
    assert.equal(verdict.ok, true, JSON.stringify(verdict))
  } finally {
    await testDb.close()
  }
})

test('행사 방 동시 처리 사례: 같은 행사에 방이 둘이면 실패로 판정한다', async () => {
  const testDb = await createTestDb()
  try {
    // 행사 방이 생길 때마다 같은 방을 하나 더 넣어 잠금이 없을 때의 모습을 흉내 낸다.
    await testDb.pg.exec(`
      CREATE FUNCTION double_event_room() RETURNS trigger AS $$
      DECLARE copy uuid := uuidv7();
      BEGIN
        IF NEW.event_id IS NOT NULL AND pg_trigger_depth() = 1 THEN
          INSERT INTO record (id, kind, council_id) SELECT copy, 'chat_room', council_id FROM record WHERE id = NEW.id;
          INSERT INTO chat_room (id, type, event_id, department_id) VALUES (copy, NEW.type, NEW.event_id, NEW.department_id);
        END IF;
        RETURN NEW;
      END $$ LANGUAGE plpgsql;
      CREATE TRIGGER double_event_room AFTER INSERT ON chat_room FOR EACH ROW EXECUTE FUNCTION double_event_room();
    `)
    const verdict = await eventRoomsTogetherCase.run({
      connect: () => pgliteConnection(testDb),
      now,
      sessionLimitMs: 2000,
    })
    assert.equal(verdict.ok, false)
    assert.match(verdict.detail, /같은 방이 둘/)
  } finally {
    await testDb.close()
  }
})
