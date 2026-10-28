import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ScheduleItemResponse, ScheduleOptionsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createScheduleRoutes } from './routes.js'

const now = new Date('2026-10-28T03:00:00Z')
const input = { title: '시험 기간', when: { allDay: true, startsOn: '2026-10-28', endsOn: null } }
const full = {
  ...input,
  type: 'academic',
  place: null,
  memo: null,
  departmentId: null,
  eventId: null,
  visibility: 'council',
}
function open(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      schedule: createScheduleRoutes(withoutReadsOutsideTransaction(t.db), testSession, {
        clock: () => now,
      }),
    }),
  )
  const base = `/api/organizations/${t.council.councilId}/schedule`
  const post = (path: string, body: unknown, user: string | undefined = 's-plain') =>
    api.post(`${base}${path}`, body, user)
  const get = (id: string, user = 's-plain') => api.get(`${base}/${id}`, user)
  const create = async (body: unknown = input, user = 's-plain') => {
    const response = await post('', body, user)
    assert.equal(response.status, 201)
    return ((await response.json()) as ScheduleItemResponse).item
  }
  return { api, base, post, get, create }
}

test(
  '일정 만들기·고치기·취소는 기록과 판을 남기고 알림·끼룩이 글은 없다',
  withSettlement(async t => {
    const h = open(t)
    const made = await h.create()
    assert.equal(made.title, input.title)
    assert.equal(made.allDay, true)
    assert.equal(made.start, '2026-10-28')
    assert.equal(made.end, null)
    assert.deepEqual(made.actions, ['schedule_item.update', 'schedule_item.cancel'])
    assert.equal(made.createdBy?.id, t.council.people.plain.memberId)
    const response = await h.post(`/${made.id}`, {
      ...full,
      title: '답사',
      when: { allDay: false, startsAt: '2026-10-29T14:00', endsAt: '2026-10-29T16:00' },
    })
    assert.equal(response.status, 200)
    const changed = ((await response.json()) as ScheduleItemResponse).item
    assert.equal(changed.start, '2026-10-29T14:00')
    assert.equal(changed.end, '2026-10-29T16:00')
    assert.equal(changed.allDay, false)
    assert.equal((await h.post(`/${made.id}/delete`, {})).status, 200)
    assert.equal((await h.get(made.id)).status, 404)
    assert.equal((await h.post(`/${made.id}`, full)).status, 404)
    assert.equal((await h.post(`/${made.id}/delete`, {})).status, 404)
    const rows = await t.pg.query<{ data: { title: string; cancelled_at: string | null } }>(
      'SELECT data FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [made.id],
    )
    assert.equal(rows.rows.length, 3)
    assert.deepEqual(
      rows.rows.map(row => row.data.title),
      ['시험 기간', '답사', '답사'],
    )
    assert.ok(rows.rows[2]!.data.cancelled_at)
    const count = await t.pg.query<{ n: number }>(
      'SELECT (SELECT count(*) FROM message) + (SELECT count(*) FROM notification) AS n',
    )
    assert.equal(Number(count.rows[0]!.n), 0)
  }),
)

test(
  '읽기는 동작 권한과 무관하고 부서 공개는 지금 소속과 회장단만 본다',
  withSettlement(async t => {
    const h = open(t)
    const publicItem = await h.create()
    const response = await h.get(publicItem.id, 's-financeMember')
    assert.equal(response.status, 200)
    assert.deepEqual(((await response.json()) as ScheduleItemResponse).item.actions, [])
    assert.equal((await h.post(`/${publicItem.id}`, full, 's-financeMember')).status, 403)
    assert.equal((await h.post(`/${publicItem.id}/delete`, {}, 's-financeMember')).status, 403)
    const privateItem = await h.create(
      { ...input, departmentId: t.council.departments.planning, visibility: 'department' },
      's-planningMember',
    )
    for (const user of [
      's-president',
      's-vicePresident',
      's-planningHead',
      's-planningViceHead',
      's-planningMember',
    ])
      assert.equal((await h.get(privateItem.id, user)).status, 200, user)
    for (const user of ['s-financeMember', 's-plain']) {
      assert.equal((await h.get(privateItem.id, user)).status, 404, user)
      assert.equal((await h.post(`/${privateItem.id}`, full, user)).status, 404, user)
      assert.equal((await h.post(`/${privateItem.id}/delete`, {}, user)).status, 404, user)
    }
    await t.pg.query(
      "UPDATE department_membership SET starts_at = $1::timestamptz - interval '1 day', ends_at = $1 WHERE member_id = $2",
      [now, t.council.people.planningMember.memberId],
    )
    assert.equal((await h.get(privateItem.id, 's-planningMember')).status, 404)
    assert.equal(
      (
        await h.post(
          `/${privateItem.id}`,
          { ...full, departmentId: t.council.departments.planning },
          's-planningHead',
        )
      ).status,
      200,
    )
  }),
)

test(
  '부서 선택 규칙과 다른 학생회·다른 종류·없는 대상의 경계를 지킨다',
  withSettlement(async t => {
    const h = open(t)
    const planning = t.council.departments.planning
    const foreignEvent = await t.event({}, t.other)
    for (const body of [
      { ...input, departmentId: t.other.departments.planning },
      { ...input, eventId: foreignEvent },
      { ...input, departmentId: foreignEvent },
      { ...input, eventId: planning },
    ])
      assert.equal((await h.post('', body)).status, 404)
    assert.equal((await h.post('', { ...input, departmentId: planning })).status, 403)
    const item = await h.create({ ...input, departmentId: planning }, 's-president')
    assert.equal(
      (
        await h.post(
          `/${item.id}`,
          { ...full, departmentId: t.council.departments.finance },
          's-planningHead',
        )
      ).status,
      403,
    )
    assert.equal(
      (
        await h.post(
          `/${item.id}`,
          { ...full, departmentId: t.other.departments.planning },
          's-president',
        )
      ).status,
      404,
    )
    assert.equal(
      (await h.post(`/${item.id}`, { ...full, eventId: foreignEvent }, 's-president')).status,
      404,
    )
    assert.equal((await h.get(item.id, 'o-president')).status, 403)
    const foreignItem = await t.make(t.other, 'schedule_item', {
      type: 'other',
      title: '다른 학생회',
      startsOn: '2026-10-28',
    })
    assert.equal((await h.get(foreignItem)).status, 404)
    assert.equal((await h.post(`/${foreignItem}`, full, 's-president')).status, 404)
  }),
)

test(
  '만든 사람이 떠나도 회장단은 고치고, 잘못된 본문은 인증보다 먼저 검사한다',
  withSettlement(async t => {
    const h = open(t)
    const item = await h.create()
    await t.pg.query(
      "UPDATE council_membership SET starts_at = $1::timestamptz - interval '1 day', ends_at = $1 WHERE member_id = $2",
      [now, t.council.people.plain.memberId],
    )
    assert.equal((await h.post(`/${item.id}`, full, 's-president')).status, 200)
    const detail = ((await (await h.get(item.id, 's-president')).json()) as ScheduleItemResponse)
      .item
    assert.equal(detail.createdBy?.current, false)
    assert.equal((await h.api.post(h.base, input)).status, 401)
    assert.equal((await h.api.post(h.base, {})).status, 400)
    assert.equal((await h.api.post(`${h.base}/${item.id}`, {})).status, 400)
    assert.equal((await h.api.post(`${h.base}/${item.id}/delete`, { extra: true })).status, 400)
    assert.equal((await h.api.get(`${h.base}/${item.id}`)).status, 401)
  }),
)

test(
  '만들기는 한 계정에 10초 20번까지다',
  withSettlement(async t => {
    const h = open(t)
    for (let n = 0; n < 20; n++) assert.equal((await h.post('', input)).status, 201)
    assert.equal((await h.post('', input)).status, 429)
    assert.equal((await h.post('', input, 's-president')).status, 201)
  }),
)

test(
  '일정 선택지: 고를 수 있는 부서는 만들기와 같은 판정이다(회장단은 모든 부서, 그 밖은 내 부서, 다른 학생회 없음)',
  withSettlement(async t => {
    const h = open(t)
    const options = async (user: string) => {
      const response = await h.api.get(`${h.base}/options`, user)
      assert.equal(response.status, 200)
      return ((await response.json()) as ScheduleOptionsResponse).departments.map(item => item.id)
    }
    const { planning, finance } = t.council.departments
    assert.deepEqual([...(await options('s-president'))].sort(), [finance, planning].sort())
    assert.deepEqual(await options('s-planningMember'), [planning])
    assert.deepEqual(await options('s-plain'), [])
    assert.equal((await h.api.get(`${h.base}/options`, undefined)).status, 401)
  }),
)
