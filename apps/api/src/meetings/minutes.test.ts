import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
  tasks,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { meetingLookups } from './lookups.ts'

// 회의록(OPS-MEET-06A · 06B · 07).
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **전체 요약은 없을 수 있다.** 그때도 화면이 그릴 자리는 있으므로 **없다는 말을
//    서버가 준다** — 빈 글을 주면 화면이 빈 칸을 그린다.
// 2. **확정된 요약인지 아닌지를 딱지가 말한다.** 회의록이 정리 완료가 아닌 동안만
//    '변경될 수 있음'이 붙는다.
// 3. **정리 현황은 부분마다 세는 단위가 다르다**(안건은 몇 개 중 몇, 결정은 몇 건,
//    요약은 초안인지). 그래서 완성된 문구로 온다.
// 4. **울타리가 선다.** 남의 학생회의 회의록은 없는 것과 같다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId = 'M-02'): Viewer {
  return {
    userId: `U-${memberId}`,
    membership: {
      orgId: 'ORG-01',
      memberId,
      role: 'member',
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      ...meetingLookups(db),
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    newId: () => 'X-01',
  }
  return createApp(deps)
}

interface Row {
  [key: string]: unknown
}

const get = async (path: string, who: Viewer | null = viewer()) =>
  await harness(who).request(path)

const minutes = async (meetingId: string) =>
  (await (await get(`/api/ops/meetings/${meetingId}/minutes`)).json()) as Row

const status = async (meetingId: string) =>
  (await (await get(`/api/ops/meetings/${meetingId}/minutes/status`)).json()) as {
    parts: Array<{ label: string; stateNote: string }>
  }

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    // **옆 학생회를 하나 더 둔다.** 울타리를 재려면 넘어갈 담이 있어야 한다.
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([{ id: 'D-02', orgId: 'ORG-01', name: '운영부' }])
  await db.insert(members).values([
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await db.insert(meetings).values([
    // 정리 중인 회의(06A가 읽는다). 안건 셋 중 둘이 정리됐고 결정은 둘이다.
    {
      id: 'MTG-06',
      orgId: 'ORG-01',
      title: '신입생 환영 행사 기획회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      startedAt: new Date('2026-07-15T16:00:00+09:00'),
      endedAt: new Date('2026-07-15T17:18:00+09:00'),
      creatorMemberId: 'M-02',
      minutesSummary:
        '신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다.',
      minutesSummaryDraftedAt: new Date('2026-07-15T17:20:00+09:00'),
    },
    // 요약이 아직 없는 회의(06B가 빈 상태를 그렸다).
    {
      id: 'MTG-09',
      orgId: 'ORG-01',
      title: '아직 요약이 없는 회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      creatorMemberId: 'M-02',
    },
    // 정리가 끝난 회의(07이 읽는다). 요약이 확정됐으므로 딱지가 붙지 않는다.
    {
      id: 'MTG-07',
      orgId: 'ORG-01',
      title: '체육대회 안전 관리 최종 회의',
      status: 'done',
      minutesStatus: 'done',
      creatorMemberId: 'M-02',
      minutesSummary: '체육대회 안전 점검 결과를 바탕으로 조치 방안을 확정했습니다.',
    },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', creatorMemberId: 'M-99' },
  ])
  await db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-06', memberId: 'M-02' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-06', memberId: 'M-03' },
  ])
  await db.insert(meetingAgendas).values([
    {
      id: 'AG-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      sortOrder: 0,
      title: '행사 프로그램 구성',
      status: 'done',
      discussionText: '환영 인사, 학과 소개 순으로 진행합니다.',
      decisionText: '프로그램 순서는 환영 인사 이후 학과 소개로 진행합니다.',
    },
    {
      id: 'AG-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      sortOrder: 1,
      title: '장소와 참가자 동선',
      status: 'done',
      decisionText: '입장과 퇴장 동선을 분리합니다.',
    },
    {
      id: 'AG-3',
      orgId: 'ORG-01',
      meetingId: 'MTG-06',
      sortOrder: 2,
      title: '부서별 준비 범위',
      status: 'current',
    },
  ])
  // 이 회의에서 나온 후속 업무 하나. '1건 연결'이 여기서 나온다.
  await db.insert(tasks).values([
    {
      id: 'T-01',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-06',
      title: '비상 연락망 최종본 배포',
      status: 'planned',
      assigneeMemberId: 'M-03',
      dueDate: new Date('2026-07-23T18:00:00+09:00'),
    },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의록의 전체 요약이 저장소에서 온다', () => {
  it('정리 중인 회의는 요약과 함께 변경될 수 있다는 딱지를 준다', async () => {
    const row = await minutes('MTG-06')
    expect(row.summaryText).toBe(
      '신입생 환영 행사 프로그램 순서와 부서별 준비 범위를 논의했습니다.',
    )
    expect(row.statusLabel).toBe('정리 중 · 변경될 수 있음')
    expect(row.statusTone).toBe('yellow')
  })

  // **AI 초안이 무엇을 하고 무엇을 안 하는지가 계약이다.** 06B가 그 글을 그렸다.
  it('AI 초안이 무엇을 하지 않는지를 함께 준다', async () => {
    const row = await minutes('MTG-06')
    expect(String(row.aiDisclaimer)).toContain(
      '기록에 없는 결정·담당자·기한을 새로 만들지 않습니다',
    )
    expect(String(row.aiDisclaimer)).toContain('요약이 없어도 정리 완료가 막히지는 않습니다')
  })

  // **없다는 말도 서버가 준다.** 빈 글을 주면 화면이 빈 칸을 그린다.
  it('요약이 없으면 없다는 말이 온다', async () => {
    const row = await minutes('MTG-09')
    expect(row.summaryText).toBe('아직 작성된 전체 요약이 없습니다')
    expect(row.statusLabel).toBe('정리 중 · 변경될 수 있음')
  })

  // 정리가 끝나면 요약은 확정된 것이다. 딱지가 붙을 자리가 없다.
  it('정리가 끝난 회의록에는 변경될 수 있다는 딱지가 없다', async () => {
    const row = await minutes('MTG-07')
    expect(row.statusLabel).toBe('')
    expect(row.statusTone).toBe('')
  })

  it('남의 학생회의 회의록은 열리지 않는다', async () => {
    expect((await get('/api/ops/meetings/MTG-99/minutes')).status).toBe(404)
  })
})

describe('정리 현황이 부분마다 세어서 온다', () => {
  it('네 부분이 저마다 다른 단위로 온다', async () => {
    const row = await status('MTG-06')
    expect(row.parts.map((part) => part.label)).toEqual([
      '안건 내용',
      '의사결정',
      '후속 업무',
      '전체 요약',
    ])
    // 안건은 몇 개 중 몇, 결정은 몇 건, 후속 업무는 몇 건 연결, 요약은 초안인지.
    expect(row.parts.map((part) => part.stateNote)).toEqual([
      '2 / 3 정리',
      '2건 확인',
      '1건 연결',
      '초안 작성',
    ])
  })

  // **0도 센 값이다.** 아무것도 없는 회의는 0으로 세어서 말한다.
  it('아무것도 정리되지 않은 회의는 0으로 센다', async () => {
    const row = await status('MTG-09')
    expect(row.parts.map((part) => part.stateNote)).toEqual([
      '0 / 0 정리',
      '0건 확인',
      '0건 연결',
      '작성 전',
    ])
  })

  it('남의 학생회의 정리 현황은 열리지 않는다', async () => {
    expect((await get('/api/ops/meetings/MTG-99/minutes/status')).status).toBe(404)
  })
})
