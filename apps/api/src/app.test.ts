import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from './app.js'

test('GET /api/health returns the API health status', async () => {
  const app = createApp({ handler: async () => { throw new Error('health must not call auth') } })
  const response = await app.request('/api/health')
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
