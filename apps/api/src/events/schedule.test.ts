import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import { events, meetings, members, organizations, tasks } from '../db/schema.ts'
import { harness, matchesContract, NOW } from './testing.ts'

// 행사 일정(EVT-SCHED-01).
//
// **원본이 아니라 비친 것이다.** 표가 없다 — `db/schema.ts` 머리가 그 까닭을 적어
// 두었고, 화면의 꼬리말도 같은 말을 한다: "행사 일시·장소는 기본정보, 회의 일시는
// 관련 회의, 업무 마감은 행사 업무가 단일 원본입니다."
//
// 그 셋이 여기 모여 한 줄씩이 된다. **거르는 것도 서버가 한다** — 받아온 것을
// 화면에서 거르면 명세의 params와 다른 것을 구현하게 된다.

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
    { id: 'M-02', orgId: 'ORG-01', name: '이수현', role: 'head' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member' },
  ])
  await db.insert(events).values([
    {
      id: 'E-01',
      orgId: 'ORG-01',
      title: '2026 소프트웨어융합대학 체육대회',
      startAt: new Date('2026-08-20T10:00:00+09:00'),
      endAt: new Date('2026-08-20T14:00:00+09:00'),
      place: 'ERICA 체육관',
      hostMemberId: 'M-01',
    },
    { id: 'E-02', orgId: 'ORG-01', title: '2026 신입생 환영회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
  await db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '행사 운영 계획 확정',
      description: '행사 운영 계획의 범위와 역할 분담을 최종 확정합니다.',
      status: 'done',
      dueDate: new Date('2026-07-10T18:00:00+09:00'),
      assigneeMemberId: 'M-02',
    },
    // 기한이 지났는데 아직 안 끝났다. **지연은 상태와 다른 사실이라 함께 온다.**
    {
      id: 'T-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '현수막 디자인 수정 반영',
      description: '검토 의견을 반영해 현수막 디자인을 수정합니다.',
      status: 'inProgress',
      dueDate: new Date('2026-07-18T18:00:00+09:00'),
      assigneeMemberId: 'M-03',
    },
    // 담당자가 없다. 그 사실이 완성된 글로 온다.
    {
      id: 'T-03',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '참가자 명단 최종 확정',
      status: 'planned',
      dueDate: new Date('2026-08-10T18:00:00+09:00'),
    },
    // 기한이 없다. **날짜로 못 박히지 않는 줄도 온다** — 명세가 그렇게 적었다.
    {
      id: 'T-04',
      orgId: 'ORG-01',
      eventId: 'E-01',
      title: '결과 보고 자료 정리',
      status: 'planned',
    },
    { id: 'T-99', orgId: 'ORG-01', eventId: 'E-02', title: '다른 행사의 업무', status: 'planned' },
  ])
  await db.insert(meetings).values([
    {
      id: 'MTG-01',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '안전 관리 최종 회의',
      purpose: '세부 안건 확인',
      status: 'scheduled',
      scheduledAt: new Date('2026-07-25T15:00:00+09:00'),
      creatorMemberId: 'M-03',
    },
    // 임시 저장한 회의는 아직 아무에게도 알리지 않은 것이다.
    {
      id: 'MTG-02',
      orgId: 'ORG-01',
      eventId: 'E-01',
      kind: 'event',
      title: '아직 안 알린 회의',
      status: 'draft',
    },
  ])
})

afterAll(async () => {
  await close()
})

const schedule = (filter = 'all', eventId = 'E-01') =>
  harness(db).request(`/api/ops/event/schedule?eventId=${eventId}&filter=${filter}`)

type Row = Record<string, unknown>
const titles = async (filter = 'all', eventId = 'E-01') =>
  ((await (await schedule(filter, eventId)).json()) as Row[]).map((row) => row.title)

describe('세 원본이 한 줄로 모인다', () => {
  it('업무 마감·회의 일시·행사 기본정보가 이른 것부터 온다', async () => {
    expect(await titles()).toEqual([
      '행사 운영 계획 확정',
      '현수막 디자인 수정 반영',
      '안전 관리 최종 회의',
      '참가자 명단 최종 확정',
      '2026 소프트웨어융합대학 체육대회',
      // 때가 없는 줄은 뒤로 간다. 행사 목록이 쓰는 규칙과 같다.
      '결과 보고 자료 정리',
    ])
  })

  it('업무 줄은 상태와 지연을 앞에 달고 온다', async () => {
    const rows = (await (await schedule()).json()) as Row[]
    expect(rows[0]).toMatchObject({
      id: 'task:T-01',
      dateLabel: '07. 10',
      tone: 'gray',
      kindLabel: '업무',
      kindTone: 'gray',
      description: '완료 · 행사 운영 계획의 범위와 역할 분담을 최종 확정합니다.',
      ownerNote: '담당 · 이수현',
      originNote: '원본 · 행사 업무',
    })
    expect(rows[1]!.description).toBe(
      '진행 중 · 지연 · 검토 의견을 반영해 현수막 디자인을 수정합니다.',
    )
    // 담당자가 없는 것은 **배정해야 한다는 알림**이지 빈 자리가 아니다.
    expect(rows[3]!.ownerNote).toBe('담당 · 미지정 · 배정 필요')
    expect(rows[5]).toMatchObject({ dateLabel: '기한 미정', description: '예정' })
  })

  it('회의 줄은 관련 회의를 원본으로 든다', async () => {
    const rows = (await (await schedule()).json()) as Row[]
    expect(rows[2]).toMatchObject({
      id: 'meeting:MTG-01',
      dateLabel: '07. 25',
      kindLabel: '회의',
      kindTone: 'gray',
      description: '예정 · 세부 안건 확인',
      ownerNote: '담당 · 박해랑',
      originNote: '원본 · 관련 회의',
    })
  })

  // **행사 당일만 도드라진다.** 무엇이 기준인지는 데이터가 정하므로 색도 데이터가 든다.
  it('행사 당일 줄은 기본정보를 원본으로 들고 도드라진다', async () => {
    const rows = (await (await schedule()).json()) as Row[]
    expect(rows[4]).toMatchObject({
      id: 'event:E-01',
      dateLabel: '08. 20',
      tone: 'blue',
      kindLabel: '행사',
      kindTone: 'blue',
      description: '2026.08.20 10:00 ~ 14:00 · ERICA 체육관',
      ownerNote: '담당 · 김바다',
      originNote: '원본 · 행사 기본정보',
    })
  })
})

describe('좁혀 보는 것도 서버가 한다', () => {
  it('마감은 업무만 본다', async () => {
    expect(await titles('deadline')).toEqual([
      '행사 운영 계획 확정',
      '현수막 디자인 수정 반영',
      '참가자 명단 최종 확정',
      '결과 보고 자료 정리',
    ])
  })

  it('회의는 회의만 본다', async () => {
    expect(await titles('meeting')).toEqual(['안전 관리 최종 회의'])
  })

  it('행사 당일은 행사 줄만 본다', async () => {
    expect(await titles('eventDay')).toEqual(['2026 소프트웨어융합대학 체육대회'])
  })

  // 오늘이 2026-08-15(토)이므로 이번 주는 08-10(월)부터 08-16(일)까지다.
  it('이번 주는 이번 주에 걸린 것만 본다', async () => {
    expect(await titles('thisWeek')).toEqual(['참가자 명단 최종 확정'])
  })

  // **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 거르개는 화면 안의 칸에 살아서 그릇이
  // 미리 받을 때는 아직 없다 — 그때 막으면 화면이 그려지기도 전에 통째로 오류가 된다.
  it('안 넘기면 좁히지 않고, 없는 값은 막는다', async () => {
    expect(
      (
        (await (
          await harness(db).request('/api/ops/event/schedule?eventId=E-01')
        ).json()) as Row[]
      ).length,
    ).toBe(6)
    expect((await schedule('아무거나')).status).toBe(422)
  })

  // 계약이 이 자리에 '없다'를 두지 않았다(404가 응답 목록에 없다).
  it('울타리를 넘지 않는다', async () => {
    const res = await schedule('all', 'E-99')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  it('event.schedule의 답이 계약대로다', async () => {
    expect(matchesContract('event.schedule', await (await schedule()).json())).toBe(true)
  })

  it('검사가 못 박은 오늘이 실제로 토요일이다', () => {
    expect(NOW.toISOString()).toBe('2026-08-15T01:00:00.000Z')
  })
})
