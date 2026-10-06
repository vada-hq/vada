import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Hono } from 'hono'
import { createCallbackAddress, createDeliveryWebhook } from './webhook.js'

test('webhook DB 장애는 재시도용 503으로 응답하고 원문 없이 로그에 남긴다', async (t) => {
  const logged: string[] = []
  t.mock.method(console, 'error', (line: string) => { logged.push(line) })
  const address = createCallbackAddress('https://vada.test', 'k'.repeat(32))
  const failing = { transaction: async () => { throw new Error('row secret-token', { cause: Object.assign(new Error('x'), { code: '57P01' }) }) } }
  const app = new Hono().route('/api', createDeliveryWebhook(failing as never, address))
  const response = await app.request(new URL(address.url('ship-1')).pathname, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carrierId: 'kr.cj', trackingNumber: '1' }),
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: 'DELIVERY_CALLBACK_UNAVAILABLE' })
  assert.deepEqual(logged.map(line => JSON.parse(line)), [
    { event: 'request_failed', method: 'POST', route: '/api/delivery-webhooks/:shipmentId/:token', error: 'Error', sqlState: '57P01' },
  ])
  assert.ok(!logged.join('').includes('secret-token'))
  assert.ok(!logged.join('').includes('ship-1'))
})
