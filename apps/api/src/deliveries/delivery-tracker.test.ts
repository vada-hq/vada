import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDeliveryTracker } from './delivery-tracker.js'
import { deliveryStatus } from './status.js'

test('provider posts to fixed endpoint, strips private fields and maps status conservatively', async () => {
  const fakeFetch: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://apis.tracker.delivery/graphql')
    assert.equal(init?.redirect, 'error')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'TRACKQL-API-KEY client:secret')
    assert.deepEqual(JSON.parse(init?.body as string).variables, { carrierId: 'kr.coupangls', trackingNumber: '000123' })
    return Response.json({ data: { track: { lastEvent: { time: '2026-09-30T06:00:00Z', status: { code: 'OUT_FOR_DELIVERY' } }, recipient: 'PRIVATE' } } })
  }
  const provider = createDeliveryTracker({ clientId: 'client', clientSecret: 'secret', fetch: fakeFetch })
  const result = await provider.lookup({ carrierId: 'kr.coupangls', trackingNumber: '000123' })
  assert.equal(result.status, 'in_transit')
  assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  assert.equal(deliveryStatus('NEW_PROVIDER_STATUS'), 'unknown')
  assert.equal(deliveryStatus('DELIVERED'), 'delivered')
  assert.equal(deliveryStatus('INFORMATION_RECEIVED'), 'pending')
  assert.equal(deliveryStatus('AT_PICKUP'), 'in_transit')
  assert.equal(deliveryStatus('AVAILABLE_FOR_PICKUP'), 'in_transit')
  assert.equal(deliveryStatus('ATTEMPT_FAIL'), 'exception')
  assert.equal(deliveryStatus('EXCEPTION'), 'exception')
})

test('carrier pagination passes only safe fields and uses provider cursor', async () => {
  const provider = createDeliveryTracker({ clientId: 'id', clientSecret: 'key', fetch: async (_url, init) => {
    assert.deepEqual(JSON.parse(init?.body as string).variables, { after: 'cursor', search: '쿠팡' })
    return Response.json({ data: { carriers: { edges: [{ node: { id: 'kr.coupangls', name: '쿠팡', private: 'secret' } }], pageInfo: { hasNextPage: true, endCursor: 'next' } } } })
  } })
  assert.deepEqual(await provider.carriers('cursor', '쿠팡'), { carriers: [{ id: 'kr.coupangls', name: '쿠팡' }], nextCursor: 'next' })
})

test('provider safely rejects missing credentials, transport, GraphQL and malformed data', async () => {
  const input = { carrierId: 'kr.coupangls', trackingNumber: '000123' }
  await assert.rejects(createDeliveryTracker({}).lookup(input), /DELIVERY_NOT_CONFIGURED/)
  for (const body of [{ errors: [{ message: 'SECRET' }] }, { data: { track: null } }, { data: { track: { lastEvent: { time: 'bad', status: { code: 'DELIVERED' } } } } }]) {
    const provider = createDeliveryTracker({ clientId: 'id', clientSecret: 'key', fetch: async () => Response.json(body) })
    await assert.rejects(provider.lookup(input), error => error instanceof Error && !error.message.includes('SECRET'))
  }
  const provider = createDeliveryTracker({ clientId: 'id', clientSecret: 'key', fetch: async () => { throw new Error('SECRET') } })
  await assert.rejects(provider.lookup(input), /DELIVERY_PROVIDER_FAILED/)
})

test('registration requires true acknowledgement and never exposes upstream errors', async () => {
  const input = { carrierId: 'kr.coupangls', trackingNumber: '000123', callbackUrl: 'https://example.test/hook', expirationTime: '2026-10-03T00:00:00Z' }
  for (const confirmed of [true, false, null]) {
    const provider = createDeliveryTracker({ clientId: 'id', clientSecret: 'key', fetch: async (_url, init) => {
      const body = JSON.parse(init?.body as string)
      assert.deepEqual(body.variables, { input })
      assert.match(body.query, /RegisterTrackWebhookInput/)
      return Response.json({ data: { registerTrackWebhook: confirmed } })
    } })
    if (confirmed) await provider.register(input)
    else await assert.rejects(provider.register(input), /DELIVERY_PROVIDER_FAILED/)
  }
})
