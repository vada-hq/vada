import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readRuntime } from './runtime.js'

const env = { DATABASE_URL: 'postgres://example.invalid/test', BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'https://m1.example.test', GOOGLE_CLIENT_ID: 'test', GOOGLE_CLIENT_SECRET: 'test' }
test('production uses environment only, configurable bind and port, without local files', () => {
  const config = readRuntime({ ...env, NODE_ENV: 'production', PORT: '12345' }, false, () => { assert.fail('must not read local env') })
  assert.equal(config.production, true)
  assert.equal(config.hostname, '0.0.0.0')
  assert.equal(config.port, 12345)
  assert.equal(config.env.DATABASE_URL, env.DATABASE_URL)
})
test('development keeps loopback defaults and environment overrides optional local settings', () => {
  const config = readRuntime({ PORT: '9000', DATABASE_URL: env.DATABASE_URL }, false, () => ({ ...env, DATABASE_URL: 'local', PORT: '8891' }))
  assert.equal(config.port, 9000)
  assert.equal(config.hostname, '127.0.0.1')
  assert.equal(config.env.DATABASE_URL, env.DATABASE_URL)
  assert.equal(readRuntime(env, false, () => ({})).port, 8891)
})
test('explicit production startup validates config and never reveals values in errors', () => {
  for (const extra of [{ PORT: '0' }, { PORT: 'abc' }, { PORT: '65536' }, { BETTER_AUTH_URL: 'http://public.example.test' }, { BETTER_AUTH_SECRET: 'private' }]) {
    assert.throws(() => readRuntime({ ...env, ...extra }, true, () => { assert.fail('local read') }), error => {
      assert.ok(error instanceof Error)
      assert.ok(!error.message.includes('private'))
      return true
    })
  }
  assert.throws(() => readRuntime({}, true, () => ({})))
})
