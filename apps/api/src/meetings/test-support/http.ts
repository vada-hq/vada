import assert from 'node:assert/strict'
import type { MeetingResponse, MeetingsResponse, MeetingOptionsResponse } from '@vada/contracts'
import { createApp } from '../../app.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../../test-support/http.js'
import type { SettlementKit } from '../../test-support/settlement.js'
import { createMeetingRoutes } from '../routes.js'

export const NOW = new Date('2026-10-29T03:00:00Z')
export const INPUT = {
  title: '운영 회의',
  heldAt: '2026-10-29T14:00',
  endsAt: '2026-10-29T15:00',
  place: '학생회실',
  attendeeIds: [],
  agenda: [{ title: '행사 준비', body: '일정 정하기' }],
}

export function open(t: SettlementKit) {
  let now = NOW
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      meetings: createMeetingRoutes(withoutReadsOutsideTransaction(t.db), testSession, {
        clock: () => now,
      }),
    }),
  )
  const base = `/api/organizations/${t.council.councilId}/meetings`
  const post = (path: string, body: unknown, user: string | undefined = 's-president') =>
    api.post(`${base}${path}`, body, user)
  const get = (path = '', user = 's-president') => api.get(`${base}${path}`, user)
  const create = async (body: unknown = INPUT, user = 's-president') => {
    const response = await post('', body, user)
    assert.equal(response.status, 201, await response.clone().text())
    return ((await response.json()) as MeetingResponse).meeting
  }
  const detail = async (id: string, user = 's-president') => {
    const response = await get(`/${id}`, user)
    assert.equal(response.status, 200)
    return ((await response.json()) as MeetingResponse).meeting
  }
  const list = async (query = '', user = 's-president') => {
    const response = await get(query, user)
    assert.equal(response.status, 200)
    return (await response.json()) as MeetingsResponse
  }
  const options = async (query = '') => {
    const response = await get(`/options${query}`, 's-plain')
    assert.equal(response.status, 200)
    return (await response.json()) as MeetingOptionsResponse
  }
  return {
    api,
    base,
    post,
    get,
    create,
    detail,
    list,
    options,
    setNow: (value: Date) => {
      now = value
    },
  }
}

export async function errorOf(response: Response) {
  return ((await response.json()) as { error: string }).error
}
