import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capturePushLogs, fanoutSummary } from '../test-support/push.js'
import { runPurchases } from '../test-support/purchases.js'
import { createPurchasePush } from './notify.js'

test(
  '구매 요청 이벤트마다 purchase 발송 요약 한 줄을 남긴다',
  runPurchases(async s => {
    const logs = await capturePushLogs(async () => {
      await s.made()
    })
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [fanoutSummary('purchase', 1, 1, 1)],
    )
  }),
)

test(
  '구매 메시지가 없으면 no_message 한 줄을 남긴다',
  runPurchases(async s => {
    const logs = await capturePushLogs(() =>
      createPurchasePush(s.db, async () => ({ result: 'sent' })).notify({
        requestId: s.council.councilId,
        recipientIds: [],
        decidedBy: null,
      }),
    )
    assert.deepEqual(
      logs.map(line => JSON.parse(line) as unknown),
      [{ ...fanoutSummary('purchase'), skipped: 'no_message' }],
    )
  }),
)
