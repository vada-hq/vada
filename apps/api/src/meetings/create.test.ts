import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
  organizations,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'

// 회의를 만들고 임시 저장한다(OPS-MEET-02의 두 단추).
//
// **둘은 같은 것을 보낸다.** 명세가 그렇게 적었고(payloadScope: meetingDraft) 다른
// 것은 보내는 곳과 그 결과의 단계뿐이다 — 만들면 '예정'이고 임시 저장하면 '초안'이다.
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **화면이 보내는 꼴을 읽는다.** 초안은 배열이 아니라 줄 이름을 열쇠에 박은
//    평평한 맵으로 온다(compute.ts의 itemKey) — 계약은 배열이라 적었으므로 둘 다 읽는다.
// 2. **참가자와 안건이 함께 저장된다.** 한 번에 보낸다고 명세가 적었다.
// 3. **울타리가 선다.** 남의 학생회의 사람도 행사도 회의에 걸리지 않는다.
// 4. **임시 저장은 덮어쓰기다.** 두 번 눌러도 초안이 둘 생기지 않는다.

let db: Db
let close: () => Promise<void>
let made = 0
const NOW = new Date('2026-07-20T10:00:00+09:00')

function viewer(memberId = 'M-01', role: 'chair' | 'head' | 'member' = 'chair'): Viewer {
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

function harness(who: Viewer | null = viewer()) {
  const deps: Deps = {
    audit: { async write() {} },
    db,
    who: async () => who,
    lookups: {
      isEventStaff: async () => false,
      isEventStaffManager: async () => false,
      isMeetingHost: async () => false,
      isMeetingCreator: async () => false,
    },
    signIn: {
      open: () => ({ google: true, kakao: false }),
      start: async (provider: string) => ({ url: `https://example.test/${provider}` }),
    },
    attempts: inMemoryAttempts(),
    counter: inMemoryCounter(),
    invite: { linkBase: 'https://vada.app/join', now: () => NOW, newCode: () => 'CODE' },
    // **부를 때마다 다른 것을 준다.** 하나로 고정하면 둘째 안건이 같은 열쇠로 들어간다.
    newId: () => `X-${(made += 1)}`,
  }
  return createApp(deps)
}

let keys = 0

/** 화면이 누르는 두 단추. 되풀이를 가리는 열쇠는 누를 때마다 새것이다. */
async function press(
  path: string,
  payload: Record<string, unknown>,
  who: Viewer = viewer(),
): Promise<Response> {
  return harness(who).request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Idempotency-Key': `KEY-${(keys += 1)}` },
    body: JSON.stringify(payload),
  })
}

/**
 * 화면이 실제로 보내는 꼴.
 *
 * 되풀이되는 묶음은 줄 이름을 이어 담고 칸마다 `묶음.줄.칸`으로 편다 —
 * `OPSMEET02Screen`의 초안이 그 모양이고, 그것이 그대로 몸통이 된다.
 */
const FLAT = {
  meetingType: 'event',
  linkedEventId: 'E-01',
  title: '체육대회 안전 관리 최종 회의',
  hostName: '이수현',
  departmentId: 'D-01',
  statusLabel: '예정',
  purpose: '행사 당일 안전 관리 계획을 최종 확인합니다.',
  date: '2026-07-25',
  startTime: '15:00',
  endTime: '16:30',
  mode: '대면',
  place: '학생회실 (A204)',
  onlineLink: '',
  // 체크 상자는 켜짐을 'y'로 담는다. 계약은 참거짓이라 적었고 둘 다 온다.
  isPrivate: 'y',
  memberQuery: '',
  participants: 'r0\nr1',
  'participants.r0.memberId': 'M-02',
  'participants.r0.name': '박해랑',
  'participants.r0.departmentNote': '운영부',
  'participants.r0.canRemove': 'true',
  'participants.r1.memberId': 'M-03',
  'participants.r1.name': '정하늘',
  'participants.r1.departmentNote': '부서 미배정',
  'participants.r1.canRemove': 'true',
  agendaItems: 'r0\nr1',
  'agendaItems.r0.agendaTitle': '행사장 안전 점검 결과',
  'agendaItems.r0.agendaNote': '점검표를 함께 봅니다.',
  'agendaItems.r0.attachmentName': '',
  'agendaItems.r0.duration': '',
  'agendaItems.r1.agendaTitle': '비상 연락망 및 담당자 확정',
  'agendaItems.r1.agendaNote': '',
  'agendaItems.r1.attachmentName': '',
  'agendaItems.r1.duration': '',
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회', term: '2026' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '기획부' },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '이수현', role: 'chair', departmentId: 'D-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '박해랑', role: 'member' },
    { id: 'M-03', orgId: 'ORG-01', name: '정하늘', role: 'member' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의사람', role: 'chair', departmentId: 'D-99' },
  ])
  await db.insert(events).values([
    { id: 'E-01', orgId: 'ORG-01', title: '2026 소프트웨어융합대학 체육대회' },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('회의를 만든다', () => {
  it('화면이 보내는 평평한 꼴을 그대로 읽는다', async () => {
    const res = await press('/api/ops/meetings', FLAT)
    expect(res.status).toBe(200)
    const made = (await res.json()) as { id: string }
    expect(typeof made.id).toBe('string')

    const rows = await db.select().from(meetings).where(eq(meetings.id, made.id))
    const row = rows[0]!
    expect(row.orgId).toBe('ORG-01')
    expect(row.title).toBe('체육대회 안전 관리 최종 회의')
    // **만들면 예정이다.** 화면의 안내가 그렇게 적었다.
    expect(row.status).toBe('scheduled')
    expect(row.kind).toBe('event')
    expect(row.eventId).toBe('E-01')
    expect(row.departmentId).toBe('D-01')
    expect(row.isPrivate).toBe(true)
    expect(row.mode).toBe('대면')
    expect(row.place).toBe('학생회실 (A204)')
    // 링크는 안 적었다 — 빈 글을 담지 않는다.
    expect(row.onlineLink).toBeNull()
    // **만든 사람은 서버가 안다.** 몸통의 주최자 이름을 믿지 않는다.
    expect(row.creatorMemberId).toBe('M-01')
  })

  // 날짜 칸과 시각 칸이 따로 오고, 표에는 때 하나로 든다.
  it('날짜와 시각을 하나의 때로 잇는다', async () => {
    const res = await press('/api/ops/meetings', { ...FLAT, title: '일정을 이어 붙인 회의' })
    const made = (await res.json()) as { id: string }
    const row = (await db.select().from(meetings).where(eq(meetings.id, made.id)))[0]!
    expect(row.scheduledAt?.toISOString()).toBe('2026-07-25T06:00:00.000Z')
    expect(row.plannedEndAt?.toISOString()).toBe('2026-07-25T07:30:00.000Z')
  })

  it('참가자와 안건이 함께 저장된다', async () => {
    const res = await press('/api/ops/meetings', { ...FLAT, title: '참가자와 안건이 있는 회의' })
    const made = (await res.json()) as { id: string }

    const people = await db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, made.id))
    expect(people.map((one) => one.memberId).sort()).toEqual(['M-02', 'M-03'])

    const agenda = await db
      .select()
      .from(meetingAgendas)
      .where(eq(meetingAgendas.meetingId, made.id))
    expect(agenda.sort((a, b) => a.sortOrder - b.sortOrder).map((one) => one.title)).toEqual([
      '행사장 안전 점검 결과',
      '비상 연락망 및 담당자 확정',
    ])
    expect(agenda.find((one) => one.sortOrder === 0)!.description).toBe('점검표를 함께 봅니다.')
  })

  // 계약은 참가자와 안건을 배열이라 적었다. 그 꼴로 와도 같은 뜻으로 읽는다.
  it('계약이 적은 배열 꼴로 와도 읽는다', async () => {
    const res = await press('/api/ops/meetings', {
      title: '배열로 보낸 회의',
      meetingType: 'regular',
      isPrivate: false,
      participants: [{ memberId: 'M-02' }],
      agendaItems: [{ agendaTitle: '한 가지 안건' }],
    })
    const made = (await res.json()) as { id: string }
    const people = await db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, made.id))
    expect(people.map((one) => one.memberId)).toEqual(['M-02'])
  })

  // **이름 없는 회의는 목록에서 가리킬 수 없다.** 표도 이름을 요구한다.
  it('회의명이 없으면 막는다', async () => {
    const res = await press('/api/ops/meetings', { ...FLAT, title: '   ' })
    expect(res.status).toBe(422)
  })

  it('안건에 이름이 없으면 막는다', async () => {
    const res = await press('/api/ops/meetings', {
      ...FLAT,
      title: '이름 없는 안건',
      'agendaItems.r0.agendaTitle': '',
    })
    expect(res.status).toBe(422)
  })

  // **울타리.** 조용히 빼면 사람은 넣었다고 믿고 그 사람은 회의를 못 본다.
  it('남의 학생회 사람은 참가자로 못 넣는다', async () => {
    const res = await press('/api/ops/meetings', {
      ...FLAT,
      title: '남의 사람을 부른 회의',
      'participants.r0.memberId': 'M-99',
    })
    expect(res.status).toBe(422)
  })

  it('남의 학생회 행사에는 걸 수 없다', async () => {
    const res = await press('/api/ops/meetings', {
      ...FLAT,
      title: '남의 행사에 건 회의',
      linkedEventId: 'E-99',
    })
    expect(res.status).toBe(422)
  })

  it('남의 학생회 부서를 주관으로 둘 수 없다', async () => {
    const res = await press('/api/ops/meetings', {
      ...FLAT,
      title: '남의 부서가 주관하는 회의',
      departmentId: 'D-99',
    })
    expect(res.status).toBe(422)
  })

  // ORG-04의 권한 표가 '회의 생성'을 회장단·부서장에게만 준다.
  it('부원은 회의를 만들 수 없다', async () => {
    const res = await press(
      '/api/ops/meetings',
      { ...FLAT, title: '부원이 만든 회의' },
      viewer('M-02', 'member'),
    )
    expect(res.status).toBe(403)
  })
})

describe('회의를 임시 저장한다', () => {
  it('임시 저장한 회의는 초안 단계로 남는다', async () => {
    const res = await press('/api/ops/meetings/drafts', {
      ...FLAT,
      title: '아직 쓰는 중인 회의',
    })
    expect(res.status).toBe(200)
    const made = (await res.json()) as { id: string }
    const row = (await db.select().from(meetings).where(eq(meetings.id, made.id)))[0]!
    expect(row.status).toBe('draft')
  })

  // **임시 저장한 회의는 다른 참가자에게 보이지 않는다**(명세가 그렇게 적었다).
  it('임시 저장한 회의는 목록에 오지 않는다', async () => {
    const found = (await (await harness().request('/api/ops/meetings')).json()) as Array<{
      meetings: Array<{ title: string }>
    }>
    expect(found.flatMap((group) => group.meetings).map((row) => row.title)).not.toContain(
      '아직 쓰는 중인 회의',
    )
  })

  // **초안은 하나뿐이다**(mutations.json의 repeat: overwrite). 두 번 눌러 둘이
  // 생기면 어느 것이 그 사람이 쓰던 것인지 아무도 모른다.
  it('두 번 임시 저장해도 초안이 하나다', async () => {
    await press('/api/ops/meetings/drafts', { ...FLAT, title: '고쳐 쓰는 회의' })
    await press('/api/ops/meetings/drafts', { ...FLAT, title: '고쳐 쓰고 또 고친 회의' })
    const drafts = (await db.select().from(meetings).where(eq(meetings.status, 'draft'))).filter(
      (row) => row.creatorMemberId === 'M-01',
    )
    expect(drafts.map((row) => row.title)).toEqual(['고쳐 쓰고 또 고친 회의'])
  })

  // 덮어쓸 때 앞서 담은 참가자와 안건도 함께 갈린다 — 남으면 지운 사람이 되살아난다.
  it('덮어쓰면 앞서 담은 참가자와 안건이 남지 않는다', async () => {
    const res = await press('/api/ops/meetings/drafts', {
      title: '참가자를 지운 초안',
      meetingType: 'regular',
      participants: '',
      agendaItems: '',
    })
    const made = (await res.json()) as { id: string }
    const people = await db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, made.id))
    expect(people).toEqual([])
  })

  it('임시 저장도 부원은 할 수 없다', async () => {
    const res = await press(
      '/api/ops/meetings/drafts',
      { ...FLAT, title: '부원의 초안' },
      viewer('M-02', 'member'),
    )
    expect(res.status).toBe(403)
  })
})
