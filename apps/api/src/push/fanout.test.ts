import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import { seedCouncil } from '../test-support/council.js'
import { capturePushLogs, fanoutSummary } from '../test-support/push.js'
import { createFanout } from './fanout.js'
import type { PushMessage } from './sender.js'

const message: PushMessage = { title: '비밀 제목', body: '비밀 본문', url: '/' }

test('대상이 없거나 기기가 없어도 이벤트 요약은 한 줄이다', async () => {
  const { db, close } = await createTestDb()
  try {
    const fanout = createFanout(db, async () => {
      assert.fail('보내면 안 됨')
    })
    const logs = await capturePushLogs(async () => {
      await fanout.deliver(new Map(), { kind: 'chat', recipients: 0 })
      await fanout.deliver(new Map([['no-device', message]]), { kind: 'task', recipients: 1 })
    })
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [fanoutSummary('chat'), fanoutSummary('task', 1)],
    )
  } finally {
    await close()
  }
})

test('기기별 sent·expired·rejected와 던진 실패를 세고 비밀 값은 남기지 않는다', async t => {
  const { db, pg, close } = await createTestDb()
  try {
    const council = await seedCouncil(db, pg)
    const { userId, memberId } = council.people.plain
    const endpoints = ['sent', 'expired', 'rejected', 'throw'].map(
      result => `https://fcm.googleapis.com/fcm/send/${result}`,
    )
    for (const endpoint of endpoints)
      await pg.query(
        'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
        [userId, endpoint, 'p', 'a'],
      )
    const warnings: string[] = []
    t.mock.method(console, 'warn', (line: string) => {
      warnings.push(line)
    })
    const fanout = createFanout(db, async target => {
      if (target.endpoint.endsWith('/throw')) throw new Error(`secret ${target.endpoint}`)
      if (target.endpoint.endsWith('/expired')) return { result: 'expired', status: 410 }
      if (target.endpoint.endsWith('/rejected')) return { result: 'rejected', status: 403 }
      return { result: 'sent' }
    })
    const logs = await capturePushLogs(() =>
      fanout.deliver(new Map([[userId, message]]), { kind: 'chat', recipients: 1 }),
    )
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [{ ...fanoutSummary('chat', 1, 4, 1), expired: 1, rejected: 2 }],
    )
    const logged = [...logs, ...warnings].join('')
    for (const secret of [...endpoints, userId, memberId, message.title, message.body, 'secret'])
      assert.ok(!logged.includes(secret), secret)
    assert.equal((await pg.query('SELECT * FROM push_device')).rows.length, 3)
  } finally {
    await close()
  }
})
