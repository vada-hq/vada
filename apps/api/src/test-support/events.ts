import assert from 'node:assert/strict'
import type { EventDetail, EventsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import type { ChatPush } from '../chat/notify.js'
import { createTestDb } from '../db/test-db.js'
import { createEventRoutes } from '../events/routes.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
export const NOON = new Date('2026-10-25T03:00:00Z')
export const MISSING = '019e0000-0000-7000-8000-000000000000'

export type EventCouncil = Awaited<ReturnType<typeof seedCouncil>>
type Values = Record<string, unknown>

// 학생회 둘(우리, 다른)과 행사 라우트를 띄운다. clock은 시험이 움직일 수 있다.
export async function startEvents(
  options: { writeLimiter?: RateLimiter; push?: Pick<ChatPush, 'notify'> } = {},
) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  let now = NOON
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      events: createEventRoutes(db, testSession, { clock: () => now, ...options }),
    }),
  )
  const base = `/api/organizations/${council.councilId}/events`
  const make = (values: Values, owner: EventCouncil = council) =>
    db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: owner.councilId,
        actor: owner.people.president.memberId,
        values: { name: '봄 축제', ...values },
      }),
    )
  const change = (id: string, changes: Values) =>
    db.transaction(tx =>
      updateRecord(tx, {
        kind: 'event',
        id,
        actor: council.people.president.memberId,
        reason: null,
        changes,
      }),
    )
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  const list = async (user = 's-president') => {
    const response = await api.get(base, user)
    assert.equal(response.status, 200)
    return (await response.json()) as EventsResponse
  }
  const detail = async (id: string, user = 's-president') =>
    ((await (await api.get(`${base}/${id}`, user)).json()) as { event: EventDetail }).event
  const post = (path: string, body: unknown, user = 's-president') =>
    api.post(`${base}${path}`, body, user)
  const versionNoOf = (id: string) =>
    count('SELECT coalesce(max(version_no), 1) AS n FROM record_version WHERE record_id = $1', [id])
  // 고치기는 지금 판을 함께 보낸다. 판을 따지지 않는 시험의 줄임이다. 없는 기록은 판 1로 보낸다.
  const edit = async (id: string, body: object, user = 's-president') =>
    post(`/${id}`, { ...body, baseVersionNo: await versionNoOf(id) }, user)
  return {
    pg,
    db,
    council,
    other,
    api,
    base,
    make,
    change,
    list,
    detail,
    post,
    edit,
    count,
    eventCount: () => count('SELECT count(*) AS n FROM event'),
    versions: (id: string) =>
      count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id]),
    setNow: (value: Date) => {
      now = value
    },
    close,
  }
}

export type EventKit = Awaited<ReturnType<typeof startEvents>>

export const withEvents = (body: (t: EventKit) => Promise<void>) => async () => {
  const t = await startEvents()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}
