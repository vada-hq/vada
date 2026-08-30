import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import openapi from '../../../specs/figma/vada-wireframe/openapi.json' with { type: 'json' }
import { authorizeMiddleware, matchRoute } from './authorize.ts'
import type { Lookups, Viewer } from './permissions.ts'

const NO: Lookups = {
  isEventStaff: async () => false,
  isEventStaffManager: async () => false,
  isMeetingHost: async () => false,
  isMeetingCreator: async () => false,
}
const YES: Lookups = {
  isEventStaff: async () => true,
  isEventStaffManager: async () => true,
  isMeetingHost: async () => true,
  isMeetingCreator: async () => true,
}

function member(role: 'chair' | 'head' | 'member'): Viewer {
  return {
    userId: 'U-1',
    membership: {
      orgId: 'O-1',
      memberId: 'M-1',
      role,
      departmentId: 'D-1',
      inFinanceDepartment: false,
    },
  }
}

function harness(viewer: Viewer | null, lookups: Lookups = NO) {
  const app = new Hono()
  app.use('*', authorizeMiddleware({ viewer: () => viewer, lookups }))
  app.get('/api/org/chart-title', (c) => c.json({ ok: true }))
  app.put('/api/org/chart', (c) => c.json({ ok: true }))
  app.post('/api/ops/events/:eventId/start', (c) => c.json({ ok: true }))
  app.post('/api/ops/meetings/:meetingId/start', (c) => c.json({ ok: true }))
  app.put('/api/ops/meetings/:meetingId/minutes', (c) => c.json({ ok: true }))
  app.post('/api/public/attendance/:checkInToken/check-in', (c) => c.json({ ok: true }))
  app.get('/api/이런자리는없다', (c) => c.json({ ok: true }))
  return app
}

describe('계약이 매단 권한을 서버가 강제한다', () => {
  it('계약에서 자리마다 권한을 읽어 온다', () => {
    expect(matchRoute('PUT', '/api/org/chart')?.authorize).toEqual({ area: 'org.structure' })
    expect(matchRoute('POST', '/api/ops/meetings/MT-01/start')).toEqual({
      authorize: { area: 'meeting.run', object: 'meetingId' },
      params: { meetingId: 'MT-01' },
    })
  })

  it('구성원이면 되는 자리는 부원도 연다', async () => {
    const res = await harness(member('member')).request('/api/org/chart-title')
    expect(res.status).toBe(200)
  })

  it('회장단만인 자리는 부서장을 막는다', async () => {
    expect((await harness(member('head')).request('/api/org/chart', { method: 'PUT' })).status).toBe(403)
    expect((await harness(member('chair')).request('/api/org/chart', { method: 'PUT' })).status).toBe(200)
  })

  // 대상은 이미 요청에 있다 — 어느 것인지만 계약이 말한다.
  it('경로가 실어 온 대상으로 조건을 판정한다', async () => {
    const url = '/api/ops/meetings/MT-01/start'
    expect((await harness(member('chair'), NO).request(url, { method: 'POST' })).status).toBe(403)
    expect((await harness(member('member'), YES).request(url, { method: 'POST' })).status).toBe(200)
  })

  it('로그인하지 않았으면 401, 권한이 없으면 403이다', async () => {
    expect((await harness(null).request('/api/org/chart-title')).status).toBe(401)
    expect((await harness(member('member')).request('/api/org/chart', { method: 'PUT' })).status).toBe(403)
  })

  it('로그인 없이 열리는 자리는 로그인 없이 열린다', async () => {
    const res = await harness(null).request('/api/public/attendance/T-01/check-in', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  // 명세가 아직 말하지 않은 자리는 열지 않는다. 지어내서 열어 두면 규칙 없이
  // 열려 있고 아무도 그 사실을 모른다.
  it('명세가 말하지 않은 자리는 아무도 못 연다', async () => {
    const url = '/api/ops/meetings/MT-01/minutes'
    for (const role of ['chair', 'head', 'member'] as const) {
      expect((await harness(member(role), YES).request(url, { method: 'PUT' })).status).toBe(403)
    }
  })

  // **명세 밖의 자리가 열려 있으면 아무 검사도 받지 않은 채 도는 코드다.**
  it('계약에 없는 자리는 막는다', async () => {
    const res = await harness(member('chair')).request('/api/이런자리는없다')
    expect(res.status).toBe(403)
  })

  // 미들웨어가 계약을 읽으므로, 계약이 다 채워져 있는 한 빠진 자리가 없다.
  it('계약의 모든 자리가 권한을 갖는다', () => {
    let missing = 0
    for (const [path, item] of Object.entries(openapi.paths as Record<string, Record<string, unknown>>)) {
      for (const method of Object.keys(item)) {
        const actual = path.replace(/\{([^}]+)\}/g, 'X-1')
        if (matchRoute(method, actual) === undefined) missing += 1
      }
    }
    expect(missing).toBe(0)
  })
})
