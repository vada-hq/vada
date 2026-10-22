import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Hono } from 'hono'
import { clientIpOf } from './client-ip.js'

const app = new Hono().get('/', c => c.text(clientIpOf(c)))
const ipOf = async (headers: Record<string, string>) => (await app.request('/', { headers })).text()

test('요청 IP: X-Forwarded-For의 마지막 값이 IP 모양일 때만 쓰고, 아니면 소켓이 없는 호출은 unknown이다', async () => {
  assert.equal(await ipOf({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }), '203.0.113.7')
  assert.equal(await ipOf({ 'x-forwarded-for': '2001:db8::1' }), '2001:db8::1')
  assert.equal(await ipOf({ 'x-forwarded-for': "1.2.3.4'; DROP TABLE x" }), 'unknown')
  assert.equal(await ipOf({ 'x-forwarded-for': 'a'.repeat(200) }), 'unknown')
  assert.equal(await ipOf({}), 'unknown')
})
