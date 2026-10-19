import { afterEach, expect, test, vi } from 'vitest'
import { json, mockApi } from '@/test-support/mock-api'
import { getJson, postJson } from './api'

afterEach(() => vi.unstubAllGlobals())

test('성공하면 본문을, 204면 빈 성공을 돌려준다', async () => {
  const api = mockApi()
  api.on('GET', '/api/me/councils', () => json({ councils: [] }))
  api.on('POST', '/api/me/push/devices', () => new Response(null, { status: 204 }))
  expect(await getJson('/api/me/councils')).toEqual({ ok: true, data: { councils: [] } })
  expect(await postJson('/api/me/push/devices', { a: 1 })).toEqual({ ok: true, data: undefined })
  expect(api.calls.map(call => [call.method, call.path, call.body])).toEqual([['GET', '/api/me/councils', null], ['POST', '/api/me/push/devices', { a: 1 }]])
  api.assertNoUnexpectedRequests()
})

test('4xx는 서버의 오류 코드를, 5xx와 연결 실패와 코드 없는 응답은 FAILED를 돌려준다', async () => {
  const api = mockApi()
  api.on('POST', '/api/a', () => json({ error: 'DEPARTMENT_IN_USE' }, 409))
  api.on('POST', '/api/b', () => json({ error: 'Internal server error' }, 500))
  api.on('POST', '/api/c', () => new Response('not json', { status: 400 }))
  api.on('POST', '/api/d', () => { throw new TypeError('Load failed') })
  expect(await postJson('/api/a', {})).toEqual({ ok: false, status: 409, code: 'DEPARTMENT_IN_USE' })
  expect(await postJson('/api/b', {})).toEqual({ ok: false, status: 500, code: 'FAILED' })
  expect(await postJson('/api/c', {})).toEqual({ ok: false, status: 400, code: 'FAILED' })
  expect(await postJson('/api/d', {})).toEqual({ ok: false, status: 0, code: 'FAILED' })
})
