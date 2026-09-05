import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
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

// 회의록을 쓴다(OPS-MEET-06B의 결정사항·요약 초안·정리 완료, OPS-MEET-08의 요약 확인).
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **참가자가 쓴다**(meeting.minutes, 사람이 정함 2026-09-05). 그 회의의 참가자가
//    아니면 회장이라도 못 쓴다. 만든 사람은 참가자 줄이 없어도 참가자다.
// 2. **요약 초안은 기록에서만 나온다.** 안건별 논의·결정을 옮겨 적을 뿐 없는 결정을
//    만들지 않는다 — 없으면 없다고 적는다.
// 3. **마치는 것은 조건이 다 찼을 때만이다.** 서버가 막고(422), 이미 마친 것을 또
//    마치면 409다. 마치면 회의도 '완료'가 된다.
// 4. **확인은 회의의 상태가 아니라 그 사람의 상태다.** 두 번 확인해도 처음 확인한 때가
//    남는다.
// 5. **'없음' 표시는 아직 담을 자리가 없다.** 조용히 버리지 않고 막는다.

let db: Db
let close: () => Promise<void>
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId: string, role: 'chair' | 'head' | 'member' = 'member'): Viewer {
  return {
    userId: `U-${memberId}`,
    membership: {
      orgId: 'ORG-01',
      memberId,
      role,
      departmentId: null,
      inFinanceDepartment: false,
    },
  }
}

function harness(who: Viewer | null) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      // 참가자인지를 표에서 읽는다. '늘 참'으로 두면 막는 자리를 아예 안 재게 된다.
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

/** 만든 사람. 참가자 줄이 없어도 참가자다. */
const CREATOR = viewer('M-02')
/** 초대받은 사람. 회의록은 참가자가 함께 쓴다. */
const PARTICIPANT = viewer('M-03')
/** 불참한 참가자. 08이 이 사람의 화면이다. */
const ABSENT = viewer('M-04')
/** 초대받지 않은 회장. 조직 역할은 답하지 않는다. */
const OUTSIDER = viewer('M-01', 'chair')

interface Row {
  [key: string]: unknown
}

const send = async (
  method: 'PUT' | 'POST',
  path: string,
  who: Viewer = CREATOR,
  body?: Record<string, unknown>,
) =>
  harness(who).request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

const save = (meetingId: string, body: Record<string, unknown>, who: Viewer = CREATOR) =>
  send('PUT', `/api/ops/meetings/${meetingId}/minutes`, who, body)
const summarize = (meetingId: string, who: Viewer = CREATOR) =>
  send('POST', `/api/ops/meetings/${meetingId}/minutes/summary`, who)
const complete = (meetingId: string, who: Viewer = CREATOR) =>
  send('POST', `/api/ops/meetings/${meetingId}/minutes/complete`, who)
const acknowledge = (meetingId: string, who: Viewer) =>
  send('POST', `/api/ops/meetings/${meetingId}/acknowledge`, who)

const message = async (res: Response) => ((await res.json()) as Row).message

const meetingRow = async (meetingId: string) =>
  (await db.select().from(meetings).where(eq(meetings.id, meetingId)))[0]!
const agendaRow = async (agendaId: string) =>
  (await db.select().from(meetingAgendas).where(eq(meetingAgendas.id, agendaId)))[0]!
const participantRow = async (meetingId: string, memberId: string) =>
  (
    await db
      .select()
      .from(meetingParticipants)
      .where(
        and(eq(meetingParticipants.meetingId, meetingId), eq(meetingParticipants.memberId, memberId)),
      )
  )[0]

const minutesOf = async (meetingId: string) =>
  (await (await harness(CREATOR).request(`/api/ops/meetings/${meetingId}/minutes`)).json()) as Row

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'chair' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member' },
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-04', orgId: 'ORG-01', name: '김민준', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair' },
  ])

  await db.insert(meetings).values([
    // 정리 중인 회의. 둘째 안건에 결정이 없어 아직 마칠 수 없다.
    {
      id: 'MTG-W1',
      orgId: 'ORG-01',
      title: '정리 중인 회의',
      status: 'wrapUp',
      minutesStatus: 'drafting',
      startedAt: new Date('2026-07-15T16:00:00+09:00'),
      endedAt: new Date('2026-07-15T17:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 안건이 하나도 없는 회의. 회의록은 아직 손도 안 댔다.
    {
      id: 'MTG-W2',
      orgId: 'ORG-01',
      title: '안건 없는 회의',
      status: 'wrapUp',
      minutesStatus: 'notStarted',
      endedAt: new Date('2026-07-15T17:00:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 아직 도는 회의. 끝나기 전에는 마칠 수 없고 확인할 요약도 없다.
    {
      id: 'MTG-W3',
      orgId: 'ORG-01',
      title: '진행 중인 회의',
      status: 'inProgress',
      minutesStatus: 'drafting',
      startedAt: new Date('2026-07-20T09:30:00+09:00'),
      creatorMemberId: 'M-02',
    },
    // 정리가 끝난 회의(08이 읽는다). 불참자 둘 중 하나는 이미 확인했다.
    {
      id: 'MTG-W4',
      orgId: 'ORG-01',
      title: '정리가 끝난 회의',
      status: 'done',
      minutesStatus: 'done',
      startedAt: new Date('2026-07-14T15:00:00+09:00'),
      endedAt: new Date('2026-07-14T16:00:00+09:00'),
      creatorMemberId: 'M-02',
      minutesSummary: '위험 구간 조치 방안을 확정했습니다.',
    },
    { id: 'MTG-99', orgId: 'ORG-02', title: '남의 회의', status: 'wrapUp', creatorMemberId: 'M-99' },
  ])
  await db.insert(meetingParticipants).values([
    { id: 'MP-01', orgId: 'ORG-01', meetingId: 'MTG-W1', memberId: 'M-03', attendance: 'present' },
    { id: 'MP-02', orgId: 'ORG-01', meetingId: 'MTG-W1', memberId: 'M-04', attendance: 'absent' },
    { id: 'MP-03', orgId: 'ORG-01', meetingId: 'MTG-W3', memberId: 'M-03', attendance: 'present' },
    { id: 'MP-04', orgId: 'ORG-01', meetingId: 'MTG-W4', memberId: 'M-03', attendance: 'absent' },
    {
      id: 'MP-05',
      orgId: 'ORG-01',
      meetingId: 'MTG-W4',
      memberId: 'M-04',
      attendance: 'absent',
      acknowledgedAt: new Date('2026-07-15T09:00:00+09:00'),
    },
  ])
  await db.insert(meetingAgendas).values([
    {
      id: 'AG-W1-1',
      orgId: 'ORG-01',
      meetingId: 'MTG-W1',
      sortOrder: 0,
      title: '예산안 확정',
      status: 'done',
      discussionText: '예산안을 항목별로 살펴봤습니다.',
      decisionText: '예산안을 원안대로 확정합니다.',
    },
    {
      id: 'AG-W1-2',
      orgId: 'ORG-01',
      meetingId: 'MTG-W1',
      sortOrder: 1,
      title: '홍보 방안',
      status: 'done',
      discussionText: '홍보 채널을 논의했습니다.',
    },
    { id: 'AG-W3-1', orgId: 'ORG-01', meetingId: 'MTG-W3', sortOrder: 0, title: '점검 결과 공유', status: 'current' },
  ])
  // 정리 중인 회의의 후속 업무 하나. 이것이 있어야 '후속 업무 또는 없음 표시'가 찬다.
  await db.insert(tasks).values([
    {
      id: 'T-W1',
      orgId: 'ORG-01',
      fromMeetingId: 'MTG-W1',
      title: '홍보 글 초안 작성',
      status: 'planned',
      assigneeMemberId: 'M-03',
    },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('전체 요약 초안을 기록에서 만든다', () => {
  // **기록에 없는 결정을 만들지 않는다**(06B의 문장). 결정이 없는 안건은 없다고 적힌다.
  it('안건별 논의와 결정을 옮겨 적고 없는 것은 없다고 적는다', async () => {
    expect((await summarize('MTG-W1')).status).toBe(200)
    const row = await meetingRow('MTG-W1')
    expect(row.minutesSummary).toBe(
      "안건 1 '예산안 확정' — 논의: 예산안을 항목별로 살펴봤습니다. / 결정: 예산안을 원안대로 확정합니다.\n" +
        "안건 2 '홍보 방안' — 논의: 홍보 채널을 논의했습니다. / 결정: 기록 없음",
    )
    // 기계가 만든 때가 남는다. 사람이 쓴 것과 가르는 근거다.
    expect(row.minutesSummaryDraftedAt?.toISOString()).toBe(NOW.toISOString())
    // 읽는 자리가 같은 글을 준다.
    expect((await minutesOf('MTG-W1')).summaryText).toBe(row.minutesSummary)
  })

  // 손도 안 댄 회의록에 무엇이든 쓰면 그때부터 '작성 중'이다.
  it('안건이 없으면 없다고 적고 회의록은 작성 중이 된다', async () => {
    expect((await summarize('MTG-W2')).status).toBe(200)
    const row = await meetingRow('MTG-W2')
    expect(row.minutesSummary).toBe('기록된 안건이 없습니다')
    expect(row.minutesStatus).toBe('drafting')
  })

  // **참가자가 아니면 회장이라도 못 만든다.** 참가자 줄이 있는 사람은 만든다.
  it('참가자만 만든다', async () => {
    expect((await summarize('MTG-W1', OUTSIDER)).status).toBe(403)
    expect((await summarize('MTG-W1', PARTICIPANT)).status).toBe(200)
  })

  it('남의 학생회의 회의록은 만들 수 없다', async () => {
    expect((await summarize('MTG-99')).status).toBe(403)
  })
})

describe('조건이 남았으면 마칠 수 없다', () => {
  // 둘째 안건에 결정이 없다. 막는 말은 진행도가 주는 그 말이다.
  it('안건 정리가 남았으면 막는다', async () => {
    const res = await complete('MTG-W1')
    expect(res.status).toBe(422)
    expect(await message(res)).toBe('안건별 필수 정리를 완료해 주세요')
    expect((await meetingRow('MTG-W1')).minutesStatus).toBe('drafting')
  })

  it('끝나지 않은 회의는 막는다', async () => {
    const res = await complete('MTG-W3')
    expect(res.status).toBe(422)
    expect(await message(res)).toBe('회의가 끝난 뒤에 정리를 마칠 수 있습니다')
  })

  // **되풀이는 조용히 넘어가지 않는다**(계약의 repeat: conflict).
  it('이미 마친 회의록을 또 마치면 409다', async () => {
    expect((await complete('MTG-W4')).status).toBe(409)
  })
})

describe('안건 하나의 정리 내용을 저장한다', () => {
  it('참가자가 아니면 회장이라도 못 쓴다', async () => {
    expect(
      (await save('MTG-W1', { agendaId: 'AG-W1-2', decisionText: '남의 결정' }, OUTSIDER)).status,
    ).toBe(403)
    expect((await agendaRow('AG-W1-2')).decisionText).toBeNull()
  })

  it('어느 안건인지 없으면 막는다', async () => {
    expect((await save('MTG-W1', {})).status).toBe(422)
  })

  // 다른 회의의 안건은 이 회의에 없는 것이다.
  it('이 회의에 없는 안건은 막는다', async () => {
    expect((await save('MTG-W1', { agendaId: 'AG-W3-1', decisionText: '엉뚱한 결정' })).status).toBe(
      422,
    )
    expect((await agendaRow('AG-W3-1')).decisionText).toBeNull()
  })

  // **덮어쓴다**(계약의 repeat: overwrite). 빈 글은 결정이 없는 것이다.
  it('결정사항을 덮어쓰고 빈 글은 없는 것으로 둔다', async () => {
    expect(
      (await save('MTG-W1', { agendaId: 'AG-W1-2', decisionText: '  임시 결정  ' }, PARTICIPANT))
        .status,
    ).toBe(200)
    expect((await agendaRow('AG-W1-2')).decisionText).toBe('임시 결정')

    expect((await save('MTG-W1', { agendaId: 'AG-W1-2', decisionText: '' })).status).toBe(200)
    expect((await agendaRow('AG-W1-2')).decisionText).toBeNull()

    expect(
      (await save('MTG-W1', { agendaId: 'AG-W1-2', decisionText: '홍보는 학과 단체방으로 합니다.' }))
        .status,
    ).toBe(200)
    expect((await agendaRow('AG-W1-2')).decisionText).toBe('홍보는 학과 단체방으로 합니다.')
  })

  // **담을 자리가 없는 것은 조용히 버리지 않는다.** 표에 '없음' 표시를 담는 열이
  // 아직 없다 — 받았다고 답하고 잊으면 사람은 표시했다고 믿는다.
  it("'없음' 표시는 아직 담을 자리가 없어 막는다", async () => {
    expect((await save('MTG-W1', { agendaId: 'AG-W1-2', noDecision: true })).status).toBe(422)
    expect((await save('MTG-W1', { agendaId: 'AG-W1-2', noFollowUp: 'y' })).status).toBe(422)
    // 표시하지 않은 것은 막을 것이 없다 — 화면은 체크가 꺼져 있으면 그렇게 보낸다.
    // **덮어쓰기라 결정도 함께 보낸다.** 안 보낸 칸은 비운 것이다.
    expect(
      (
        await save('MTG-W1', {
          agendaId: 'AG-W1-2',
          decisionText: '홍보는 학과 단체방으로 합니다.',
          noDecision: false,
          noFollowUp: '',
        })
      ).status,
    ).toBe(200)
    expect((await agendaRow('AG-W1-2')).decisionText).toBe('홍보는 학과 단체방으로 합니다.')
  })
})

describe('정리를 마친다', () => {
  // **회의도 함께 완료가 된다.** 종료는 '정리 중'이었고, 정리를 마쳐야 '완료'다.
  it('조건이 다 찼으면 회의록과 회의가 완료된다', async () => {
    expect((await complete('MTG-W1')).status).toBe(200)
    const row = await meetingRow('MTG-W1')
    expect(row.minutesStatus).toBe('done')
    expect(row.status).toBe('done')
    // 확정된 요약이라 딱지가 떨어진다.
    expect((await minutesOf('MTG-W1')).statusLabel).toBe('')
  })

  it('또 마치면 409다', async () => {
    expect((await complete('MTG-W1')).status).toBe(409)
  })

  // 확정된 글은 고치지 않는다 — 고치면 '변경될 수 있음' 딱지를 뗀 것이 거짓이 된다.
  it('마친 회의록은 더 고칠 수 없다', async () => {
    expect((await save('MTG-W1', { agendaId: 'AG-W1-2', decisionText: '뒤늦은 결정' })).status).toBe(
      422,
    )
    expect((await summarize('MTG-W1')).status).toBe(422)
    expect((await agendaRow('AG-W1-2')).decisionText).toBe('홍보는 학과 단체방으로 합니다.')
  })
})

describe('요약을 확인했다고 기록한다', () => {
  // **회의의 상태가 아니라 그 사람의 상태다.** 회의 줄은 아무것도 안 바뀐다.
  it('참가자가 확인하면 그 사람의 확인 때가 남는다', async () => {
    expect((await acknowledge('MTG-W4', PARTICIPANT)).status).toBe(200)
    expect((await participantRow('MTG-W4', 'M-03'))?.acknowledgedAt?.toISOString()).toBe(
      NOW.toISOString(),
    )
    expect((await meetingRow('MTG-W4')).status).toBe('done')
  })

  // **두 번 확인해도 확인된 채다**(계약의 repeat: overwrite). 처음 확인한 때가 남는다.
  it('이미 확인한 사람이 또 확인해도 처음 때가 남는다', async () => {
    expect((await acknowledge('MTG-W4', ABSENT)).status).toBe(200)
    expect((await participantRow('MTG-W4', 'M-04'))?.acknowledgedAt?.toISOString()).toBe(
      new Date('2026-07-15T09:00:00+09:00').toISOString(),
    )
  })

  // 만든 사람은 참가자지만 참가자 줄이 없으면 확인을 적을 자리가 없다.
  it('참가자 줄이 없는 사람은 확인을 적을 자리가 없다', async () => {
    expect((await acknowledge('MTG-W4', CREATOR)).status).toBe(422)
  })

  it('초대받지 않은 사람은 확인할 수 없다', async () => {
    expect((await acknowledge('MTG-W4', OUTSIDER)).status).toBe(403)
  })

  // 아직 바뀔 수 있는 요약을 확인했다고 적으면 무엇을 확인했는지 알 수 없다.
  it('정리가 끝나지 않은 회의록은 확인할 것이 아니다', async () => {
    expect((await acknowledge('MTG-W3', PARTICIPANT)).status).toBe(422)
    expect((await participantRow('MTG-W3', 'M-03'))?.acknowledgedAt).toBeNull()
  })
})
