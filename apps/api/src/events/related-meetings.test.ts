import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  events,
  meetingParticipants,
  meetings,
  members,
  organizations,
} from '../db/schema.ts'
import { harness, matchesContract } from './testing.ts'

// 행사에 걸린 회의(EVT-MEET-01).
//
// **회의 전체 목록(meeting.groups)과 다른 것이다** — 저쪽은 행사별로 묶어 오고
// 카드에 담기는 조각도 더 많다. 여기는 한 행사의 회의만 줄로 온다.
//
// **세는 말이 회의의 단계마다 다르다.** 끝난 회의는 실제로 온 사람을 세고, 아직
// 안 한 회의는 오기로 한 사람을 센다 — 화면이 그것을 유도할 수 없어 서버가 완성한
// 문구로 준다(명세가 그렇게 적었다).

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'head' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(meetings).values([
    {
      id: 'MTG-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '체육대회 운영 점검 회의',
      status: 'inProgress',
      scheduledAt: new Date('2026-07-18T10:00:00+09:00'),
      place: '제1회의실',
    },
    {
      id: 'MTG-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '안전 관리 최종 회의',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-25T15:00:00+09:00'),
      place: '학생회실',
    },
    {
      id: 'MTG-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '참가자 모집 결과 검토',
      status: 'done',
      scheduledAt: new Date('2026-07-12T18:00:00+09:00'),
      place: '온라인 (Discord)',
    },
    {
      id: 'MTG-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '운영 결과 정리 회의',
      status: 'wrapUp',
      scheduledAt: new Date('2026-07-20T18:00:00+09:00'),
    },
    // **임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다.**
    {
      id: 'MTG-05',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '아직 안 알린 회의',
      status: 'draft',
    },
    // 다른 행사의 회의도 남의 학생회의 회의도 이 목록에 없다.
    {
      id: 'MTG-06',
      orgId: 'ORG-01',
      eventId: 'E-02',
      kind: 'event',
      title: '다른 행사의 회의',
      status: 'scheduled',
    },
    { id: 'MTG-99', orgId: 'ORG-02', eventId: 'E-99', kind: 'event', title: '남의 회의' },
  ])
  await db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-01' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-02' },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-01', memberId: 'M-03' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-02', memberId: 'M-01' },
    { id: 'MP-05', orgId: 'ORG-01', meetingId: 'MTG-02', memberId: 'M-02' },
    // 끝난 회의는 **실제로 온 사람**을 센다. 셋 중 둘만 왔다.
    { id: 'MP-06', orgId: 'ORG-01', meetingId: 'MTG-03', memberId: 'M-01', attendance: 'present' },
    { id: 'MP-07', orgId: 'ORG-01', meetingId: 'MTG-03', memberId: 'M-02', attendance: 'present' },
    { id: 'MP-08', orgId: 'ORG-01', meetingId: 'MTG-03', memberId: 'M-03', attendance: 'absent' },
    { id: 'MP-09', orgId: 'ORG-01', meetingId: 'MTG-04', memberId: 'M-01', attendance: 'present' },
  ])
})

afterAll(async () => {
  await close()
})

const counts = (eventId = 'E-01') =>
  harness(db).request(`/api/ops/event/meetings/counts?eventId=${eventId}`)
const list = (eventId = 'E-01') => harness(db).request(`/api/ops/event/meetings?eventId=${eventId}`)

type Row = Record<string, unknown>

describe('회의 건수(event.meetingCounts)', () => {
  it('단계마다 세어 한 줄로 준다', async () => {
    const body = (await (await counts()).json()) as Record<string, unknown>
    expect(body.countsNote).toBe('진행 중 1건 · 예정 1건 · 정리 중 1건 · 완료 1건')
  })

  // **0건도 말한다.** 빠뜨리면 줄의 길이가 행사마다 달라져 읽는 자리가 흔들린다.
  it('회의가 없어도 0건으로 말한다', async () => {
    const body = (await (await counts('E-02')).json()) as Record<string, unknown>
    expect(body.countsNote).toBe('진행 중 0건 · 예정 1건 · 정리 중 0건 · 완료 0건')
  })

  it('울타리를 넘지 않는다', async () => {
    expect((await counts('E-99')).status).toBe(404)
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.meetingCounts', await (await counts()).json())).toBe(true)
  })
})

describe('행사에 걸린 회의(event.meetings)', () => {
  it('이 행사의 회의만 온다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows.map((row) => row.title)).toEqual([
      '체육대회 운영 점검 회의',
      '안전 관리 최종 회의',
      '운영 결과 정리 회의',
      '참가자 모집 결과 검토',
    ])
  })

  it('때는 요일까지 붙어서 온다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows[0]).toMatchObject({
      id: 'MTG-01',
      status: '진행 중',
      statusTone: 'green',
      kindLabel: '행사 연결 회의',
      startAt: '2026. 07. 18 (토) 10:00',
      place: '제1회의실',
    })
  })

  // **끝났는지에 따라 세는 말이 다르다.** 명세가 그 셋을 예로 들었다.
  it('단계마다 세는 말이 다르다', async () => {
    const rows = (await (await list()).json()) as Row[]
    const noteOf = (title: string) =>
      rows.find((row) => row.title === title)!.attendanceNote as string
    expect(noteOf('체육대회 운영 점검 회의')).toBe('참가 3명')
    expect(noteOf('안전 관리 최종 회의')).toBe('참가 예정 2명')
    expect(noteOf('참가자 모집 결과 검토')).toBe('참석 2명')
  })

  // 장소를 안 적은 회의가 있다. **빈 글을 주면 화면이 그 자리에 무엇이든 그린다.**
  it('안 적은 장소는 그 사실로 온다', async () => {
    const rows = (await (await list()).json()) as Row[]
    expect(rows.find((row) => row.title === '운영 결과 정리 회의')!.place).toBe('미정')
  })

  // **계약이 이 자리에 '없다'를 두지 않았다**(404가 응답 목록에 없다). 그래서
  // 남의 학생회 행사를 물으면 없다고 하는 대신 **우리 것 중에 그런 것이 없다**고
  // 답한다 — 거르고 남은 것이 비었다는 뜻이지, 빈 값으로 대신한 것이 아니다.
  it('울타리를 넘지 않는다', async () => {
    const res = await list('E-99')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('답이 계약의 모양을 지킨다', async () => {
    expect(matchesContract('event.meetings', await (await list()).json())).toBe(true)
  })
})
