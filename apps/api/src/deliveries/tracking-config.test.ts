import assert from 'node:assert/strict'
import { test } from 'node:test'
import { trackingConfig } from './tracking-config.js'

test('tracking is opt-in and fails closed for missing or unsafe configuration', () => {
  assert.equal(trackingConfig({}), null)
  const env = { DELIVERY_ENABLED: 'true', DELIVERY_TRACKING_ENABLED: 'true', DELIVERY_PUBLIC_URL: 'https://example.test', DELIVERY_WEBHOOK_SECRET: 's'.repeat(64), DELIVERY_TRACKER_CLIENT_ID: 'id', DELIVERY_TRACKER_CLIENT_SECRET: 'key' }
  assert.ok(trackingConfig(env))
  for (const change of [{ DELIVERY_ENABLED: 'false' }, { DELIVERY_PUBLIC_URL: 'http://example.test' }, { DELIVERY_PUBLIC_URL: 'https://example.test/path' }, { DELIVERY_WEBHOOK_SECRET: 'short' }, { DELIVERY_TRACKER_CLIENT_SECRET: '' }]) assert.throws(() => trackingConfig({ ...env, ...change }), /INVALID_DELIVERY/)
})
