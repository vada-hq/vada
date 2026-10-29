import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse, HomeWeek, MeetingResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createMeetingRoutes } from '../meetings/routes.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

// 회장단 홈 ⑤ 이번 주(시연 조각 ㉯): 외부·마감 일정과 다음 회의 하나. 한국 시각 2026-10-25(일) 12:00.
const now = new Date('2026-10-25T03:00:00Z')
const at = (value: string) => new Date(`${value}+09:00`)

function open(t: SettlementKit) {
  const app = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
      meetings: createMeetingRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  const week = async (user = 's-president', owner = t.council): Promise<HomeWeek> => {
    const response = await app.get(`/api/organizations/${owner.councilId}/home`, user)
    assert.equal(response.status, 200, user)
    const board = ((await response.json()) as HomeResponse).councilBoard
    assert.ok(board, `${user}의 회장단 홈`)
    return board.week
  }
  const schedule = (values: Record<string, unknown>, owner = t.council) =>
    t.make(owner, 'schedule_item', { type: 'external', title: '일정', ...values })
  const meeting = (values: Record<string, unknown>, creator?: string, owner = t.council) =>
    t.make(
      owner,
      'meeting',
      {
        title: '회의',
        heldAt: at('2026-10-27T19:00:00'),
        endsAt: at('2026-10-27T20:00:00'),
        place: '학생회실',
        ...values,
      },
      creator,
    )
  const meetingDetail = async (id: string) => {
    const response = await app.get(
      `/api/organizations/${t.council.councilId}/meetings/${id}`,
      's-president',
    )
    assert.equal(response.status, 200)
    return ((await response.json()) as MeetingResponse).meeting
  }
  return { week, schedule, meeting, meetingDetail }
}

const titles = (week: HomeWeek) =>
  week.items.map(item => (item.kind === 'meeting' ? item.meeting.title : item.item.title))

test('외부·마감 일정만 오늘부터 7일째까지 날짜순(같은 날 종일 먼저)으로 싣는다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    await h.schedule({
      title: '대표자 회의',
      startsAt: at('2026-10-26T18:00:00'),
      endsAt: at('2026-10-26T20:00:00'),
    })
    await h.schedule({
      title: '제출 마감',
      type: 'deadline',
      startsOn: '2026-10-26',
      endsOn: '2026-10-26',
    })
    await h.schedule({
      title: '학사',
      type: 'academic',
      startsOn: '2026-10-26',
      endsOn: '2026-10-26',
    })
    await h.schedule({ title: '8일째', startsOn: '2026-11-02', endsOn: '2026-11-02' })
    await h.schedule({ title: '7일째', startsOn: '2026-11-01', endsOn: '2026-11-01' })
    await h.schedule(
      { title: '다른 학생회', startsOn: '2026-10-26', endsOn: '2026-10-26' },
      t.other,
    )
    const week = await h.week()
    assert.deepEqual(titles(week), ['제출 마감', '대표자 회의', '7일째'])
    assert.equal(week.total, 3)
    const [deadline, external] = week.items
    assert.ok(deadline?.kind === 'schedule')
    assert.deepEqual(
      { type: deadline.item.type, date: deadline.date, time: deadline.time },
      { type: 'deadline', date: '2026-10-26', time: null },
    )
    assert.ok(external?.kind === 'schedule')
    assert.deepEqual(
      { date: external.date, time: external.time },
      { date: '2026-10-26', time: '18:00' },
    )
  })()
})

test('다음 회의는 끝나지 않은, 취소·확정 전의 가장 이른 학생회 회의 하나이고 3줄을 넘으면 회의를 남긴다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const planning = t.council.departments.planning
    const first = await h.meeting({ title: '다음 운영 회의' })
    await t.make(t.council, 'agenda_item', { meetingId: first, position: 1, title: '안건 하나' })
    await t.make(t.council, 'agenda_item', { meetingId: first, position: 2, title: '안건 둘' })
    const gone = await t.make(t.council, 'agenda_item', {
      meetingId: first,
      position: 3,
      title: '뺀 안건',
    })
    await t.pg.query(`UPDATE agenda_item SET cancelled_at = now() WHERE id = $1`, [gone])
    await h.meeting({
      title: '더 늦은 회의',
      heldAt: at('2026-10-28T19:00:00'),
      endsAt: at('2026-10-28T20:00:00'),
    })
    await h.meeting({
      title: '끝난 회의',
      heldAt: at('2026-10-25T09:00:00'),
      endsAt: at('2026-10-25T10:00:00'),
    })
    const cancelled = await h.meeting({
      title: '취소',
      heldAt: at('2026-10-26T09:00:00'),
      endsAt: at('2026-10-26T10:00:00'),
    })
    await t.pg.query(
      `UPDATE meeting SET cancelled_at = now(), cancel_reason = '취소' WHERE id = $1`,
      [cancelled],
    )
    await h.meeting(
      {
        title: '부서 회의',
        hostDepartmentId: planning,
        heldAt: at('2026-10-26T09:00:00'),
        endsAt: at('2026-10-26T10:00:00'),
      },
      t.council.people.planningHead.memberId,
    )
    await h.meeting({
      title: '8일째 회의',
      heldAt: at('2026-11-02T19:00:00'),
      endsAt: at('2026-11-02T20:00:00'),
    })
    for (const day of ['26', '27', '28'])
      await h.schedule({
        title: `외부 ${day}`,
        startsOn: `2026-10-${day}`,
        endsOn: `2026-10-${day}`,
      })
    const week = await h.week()
    assert.deepEqual(titles(week), ['외부 26', '외부 27', '다음 운영 회의'])
    assert.equal(week.total, 4)
    const meeting = week.items[2]!
    assert.ok(meeting.kind === 'meeting')
    assert.equal(meeting.meeting.agendaCount, 2)
    assert.equal(meeting.meeting.heldAt, '2026-10-27T19:00')
    assert.deepEqual(meeting.meeting.actions, (await h.meetingDetail(first)).actions)
    assert.ok(meeting.meeting.actions.includes('meeting.minutes'))
  })()
})

test('부서 회의는 내가 참가자이거나 만든 사람일 때만 다음 회의가 된다', async () => {
  await withSettlement(async t => {
    const h = open(t)
    const planning = t.council.departments.planning
    const id = await h.meeting(
      { title: '부서 회의', hostDepartmentId: planning },
      t.council.people.planningHead.memberId,
    )
    assert.deepEqual(titles(await h.week()), [])
    await t.pg.query(`INSERT INTO meeting_attendee (meeting_id, member_id) VALUES ($1, $2)`, [
      id,
      t.council.people.president.memberId,
    ])
    assert.deepEqual(titles(await h.week()), ['부서 회의'])
    await h.meeting({ title: '다른 학생회 회의' }, undefined, t.other)
    assert.deepEqual(titles(await h.week('o-president', t.other)), ['다른 학생회 회의'])
  })()
})
