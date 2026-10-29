import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capturePushLogs, failingPushDb, fanoutSummary } from '../test-support/push.js'
import { createTaskPush } from './notify.js'

test('업무 조회 실패도 숫자가 0인 failed 요약과 정제한 경고 한 줄을 남긴다', async t => {
  const warnings: string[] = []
  t.mock.method(console, 'warn', (line: string) => void warnings.push(line))
  let deliver!: () => Promise<void>
  const push = createTaskPush(
    failingPushDb(),
    async () => assert.fail('보내면 안 됨'),
    (_ms, run) => {
      deliver = run
      return () => {}
    },
  )
  push.notify({
    taskId: 'secret-task',
    recipientId: 'secret-recipient',
    assignerId: 'secret-assigner',
    previous: null,
  })
  const logs = await capturePushLogs(deliver)
  assert.deepEqual(
    logs.map(line => JSON.parse(line) as unknown),
    [{ ...fanoutSummary('task'), skipped: 'failed' }],
  )
  assert.deepEqual(
    warnings.map(line => JSON.parse(line) as unknown),
    [{ event: 'push_send_failed' }],
  )
  assert.ok(![...logs, ...warnings].join('').includes('secret'))
})
