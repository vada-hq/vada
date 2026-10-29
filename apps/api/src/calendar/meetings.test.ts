import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CalendarResponse, MeetingResponse, MeetingsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createMeetingRoutes } from '../meetings/routes.js'
import {
  caller,
  ORIGIN,
  testSession,
  withoutReadsOutsideTransaction,
} from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createCalendarFeedRoutes, createPublicCalendarRoutes } from './feed.js'
import { createCalendarRoutes } from './routes.js'

const NOW = new Date('2026-10-29T03:00:00Z')
const feedOrigin = 'https://calendar.example.test'
const range = 'from=2026-10-27&to=2026-10-31'
const USERS = [
  's-president',
  's-planningHead',
  's-planningMember',
  's-financeMember',
  's-plain',
] as const
const INPUT = {
  title: '운영 회의',
  heldAt: '2026-10-29T14:00',
  endsAt: '2026-10-29T15:00',
  place: '학생회실',
  purpose: '비밀 목적',
  attendeeIds: [],
  agenda: [{ title: '비밀 안건', body: '비밀 설명' }],
}

function open(t: SettlementKit) {
  const clock = () => NOW
  const db = withoutReadsOutsideTransaction(t.db)
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: ORIGIN,
    meetings: createMeetingRoutes(db, testSession, { clock }),
    calendar: createCalendarRoutes(db, testSession, { clock }),
    calendarFeeds: createCalendarFeedRoutes(t.db, testSession, {
      clock,
      trustedOrigin: feedOrigin,
    }),
    publicCalendar: createPublicCalendarRoutes(t.db, { clock, trustedOrigin: feedOrigin }),
  })
  const api = caller(app)
  const base = (councilId = t.council.councilId) => `/api/organizations/${councilId}`
  const create = async (body: object = {}, user = 's-president', councilId?: string) => {
    const response = await api.post(`${base(councilId)}/meetings`, { ...INPUT, ...body }, user)
    assert.equal(response.status, 201, await response.clone().text())
    return ((await response.json()) as MeetingResponse).meeting
  }
  const calendar = async (user: string) => {
    const response = await api.get(`${base()}/calendar?${range}`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as CalendarResponse
  }
  const meetings = async (user: string) => {
    const response = await api.get(`${base()}/meetings?${range}`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as MeetingsResponse
  }
  const relation = async (id: string, user: string) => {
    const response = await api.get(`${base()}/meetings/${id}`, user)
    return ((await response.json()) as MeetingResponse).meeting.relation
  }
  const feed = async (user: string) => {
    const created = await api.post(`${base()}/calendar/feed`, {}, user)
    const { url } = (await created.json()) as { url: string }
    const response = await app.request(new URL(url).pathname)
    assert.equal(response.status, 200)
    return (await response.text()).replace(/\r\n /g, '')
  }
  return { api, base, create, calendar, meetings, relation, feed }
}

test(
  '캘린더는 회의 API가 보이는 회의에서 취소한 것만 빼고, mine은 회의의 내 관계를 따른다',
  withSettlement(async t => {
    const h = open(t)
    const held = await h.create({
      hostDepartmentId: t.council.departments.planning,
      attendeeIds: [t.council.people.financeMember.memberId],
    })
    const cancelled = await h.create({ title: '취소한 회의' })
    const response = await h.api.post(
      `${h.base()}/meetings/${cancelled.id}/cancel`,
      { reason: '일정 변경' },
      's-president',
    )
    assert.equal(response.status, 200)
    await h.create({ title: '범위 밖', heldAt: '2026-11-05T14:00', endsAt: '2026-11-05T15:00' })
    await h.create({ title: '다른 학생회' }, 'o-president', t.other.councilId)
    const event = await t.event({
      name: '같은 때 행사',
      startsAt: new Date('2026-10-29T05:00:00Z'),
    })
    for (const user of USERS) {
      const items = (await h.calendar(user)).items
      const meetingItems = items.filter(item => item.source === 'meeting')
      const visible = (await h.meetings(user)).meetings.filter(m => m.status !== 'cancelled')
      assert.deepEqual(
        meetingItems.map(item => item.target.id),
        visible.map(m => m.id),
        user,
      )
      assert.deepEqual(meetingItems, [
        {
          key: `meeting:${held.id}`,
          source: 'meeting',
          kind: 'meeting',
          title: '운영 회의',
          allDay: false,
          start: '2026-10-29T14:00',
          end: '2026-10-29T15:00',
          place: '학생회실',
          event: null,
          department: { id: t.council.departments.planning, name: '기획부' },
          mine: (await h.relation(held.id, user)) !== 'none',
          overdue: false,
          target: { record: 'meetings', id: held.id },
        },
      ])
      // 같은 때면 행사가 회의보다 앞이다(종류 차례).
      assert.deepEqual(
        items.filter(item => item.start === '2026-10-29T14:00').map(item => item.key),
        [`event:${event}`, `meeting:${held.id}`],
      )
    }
    const mineOf = async (user: string) =>
      (await h.calendar(user)).items.find(item => item.source === 'meeting')?.mine
    assert.equal(await mineOf('s-president'), true)
    assert.equal(await mineOf('s-planningHead'), true)
    assert.equal(await mineOf('s-financeMember'), true)
    assert.equal(await mineOf('s-plain'), false)
    assert.equal((await h.api.get(`${h.base()}/calendar?${range}`, 'o-president')).status, 403)
  }),
)

test(
  '구독은 참가자가 아니어도 취소하지 않은 회의를 바쁨(OPAQUE)으로 담고 목적·안건은 담지 않는다',
  withSettlement(async t => {
    const h = open(t)
    const held = await h.create()
    const cancelled = await h.create({ title: '취소한 회의' })
    await h.api.post(
      `${h.base()}/meetings/${cancelled.id}/cancel`,
      { reason: '일정 변경' },
      's-president',
    )
    await h.create({ title: '다른 학생회' }, 'o-president', t.other.councilId)
    const body = await h.feed('s-plain')
    const events = body.split('BEGIN:VEVENT\r\n').slice(1)
    const meeting = events.find(event => event.includes(`UID:meeting-${held.id}@vada`))
    assert.ok(meeting, body)
    for (const line of [
      'SUMMARY:[회의] 운영 회의',
      'DTSTART:20261029T050000Z',
      'DTEND:20261029T060000Z',
      'LOCATION:학생회실',
      `URL:${feedOrigin}/meetings/${t.council.councilId}/${held.id}`,
      `DESCRIPTION:${feedOrigin}/meetings/${t.council.councilId}/${held.id}`,
      'TRANSP:OPAQUE',
    ])
      assert.ok(meeting.includes(`${line}\r\n`), line)
    for (const value of ['취소한 회의', '다른 학생회', '비밀 목적', '비밀 안건', '비밀 설명'])
      assert.ok(!body.includes(value), value)
  }),
)
