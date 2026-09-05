import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, type Deps } from '../app.ts'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  budgetItems,
  departments,
  eventArchives,
  events,
  members,
  organizations,
  payments,
  purchaseRequests,
  surveyApplications,
  surveys,
  tasks,
  users,
} from '../db/schema.ts'
import { inMemoryAttempts } from '../idempotency.ts'
import type { Viewer } from '../permissions.ts'
import { inMemoryCounter } from '../public/rate-limit.ts'
import { hashToken } from '../public/tokens.ts'

// 완료된 행사(REC-01).
//
// **event.list와 다른 목록이다** — 저쪽은 완료된 행사를 주지 않는다고 명세가 적었다.
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **완료된 것만 온다.** 기획 중인 행사는 이 목록에 없다.
// 2. **인수인계 문서가 어디까지 왔는지를 서버가 말과 색으로 만든다.** 표에 있는
//    것은 `draft`·`inReview`·`published`이고 '발행 완료'는 읽을 때 붙는다.
// 3. **열 곳이 있으면 단추, 없으면 그 까닭.** 둘 중 하나만 온다.
// 4. **머리의 건수는 검색으로 걸러지지 않는다.** 목록을 좁혀도 미발행 수는 그대로다.

let db: Db
let close: () => Promise<void>

const NOW = new Date('2026-06-10T10:00:00+09:00')

const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

function viewer(orgId = 'ORG-01', memberId = 'M-01'): Viewer {
  return {
    userId: 'U-01',
    membership: {
      orgId,
      memberId,
      role: 'member',
      departmentId: 'D-01',
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
      isMeetingParticipant: async () => false,
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

type Row = Record<string, unknown>

async function one(path: string): Promise<Row> {
  const res = await harness().request(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row
}

async function many(path: string): Promise<Row[]> {
  const res = await harness().request(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row[]
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db as unknown as Db
  close = fresh.close

  await db.insert(organizations).values([
    { id: 'ORG-01', name: '제12대 학생회' },
    { id: 'ORG-02', name: '옆 학생회' },
  ])
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '대외협력부' },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(users).values({ id: 'U-01', email: 'haerang@example.ac.kr' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '홍길동' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])

  await db.insert(events).values([
    {
      id: 'E-D1',
      orgId: 'ORG-01',
      title: '봄 축제 학생회 부스',
      status: 'done',
      startAt: at('2026-05-28'),
      hostDepartmentId: 'D-01',
      updatedAt: NOW,
    },
    {
      id: 'E-D2',
      orgId: 'ORG-01',
      title: '2025 학년도 종강 행사',
      status: 'done',
      startAt: at('2025-12-19'),
      hostMemberId: 'M-02',
      updatedAt: NOW,
    },
    {
      id: 'E-D3',
      orgId: 'ORG-01',
      title: '2025 신입생 환영회',
      status: 'done',
      startAt: at('2025-03-14'),
      updatedAt: NOW,
    },
    // 날짜를 적지 않은 채 끝난 행사. **목록 맨 위가 아니라 맨 뒤여야 한다** —
    // 빈 날짜가 '가장 최근'으로 읽히면 인수인계가 필요한 행사를 못 찾는다.
    { id: 'E-D4', orgId: 'ORG-01', title: '날짜 없는 행사', status: 'done', updatedAt: NOW },
    // 아직 안 끝난 행사. 이 목록에 오지 않는다.
    { id: 'E-P1', orgId: 'ORG-01', title: '가을 한마당', status: 'planning', updatedAt: NOW },
    // 남의 학생회의 완료된 행사.
    { id: 'E-99', orgId: 'ORG-02', title: '남의 완료 행사', status: 'done', updatedAt: NOW },
  ])

  await db.insert(eventArchives).values([
    { id: 'AR-01', orgId: 'ORG-01', eventId: 'E-D1', status: 'published' },
    { id: 'AR-02', orgId: 'ORG-01', eventId: 'E-D2', status: 'inReview' },
    // E-D3은 인수인계 문서 자체가 없다.
  ])

  // 하이라이트의 바탕이 되는 사실들. **없으면 그 딱지가 오지 않는다.**
  await db.insert(attendanceQrs).values({
    id: 'QR-01',
    orgId: 'ORG-01',
    eventId: 'E-D1',
    tokenHash: hashToken('AAAAAAAAAAAAAAAAAAAAAA'),
  })
  await db.insert(attendanceCheckIns).values([
    {
      id: 'CI-01',
      qrId: 'QR-01',
      name: '최바람',
      studentNumber: '2021000001',
      receiptHash: hashToken('RRRRRRRRRRRRRRRRRRRR01'),
      receiptExpiresAt: NOW,
    },
    {
      id: 'CI-02',
      qrId: 'QR-01',
      name: '김하늘',
      studentNumber: '2021000002',
      receiptHash: hashToken('RRRRRRRRRRRRRRRRRRRR02'),
      receiptExpiresAt: NOW,
    },
  ])
  await db.insert(surveys).values({
    id: 'SV-01',
    orgId: 'ORG-01',
    eventId: 'E-D1',
    linkToken: 'SSSSSSSSSSSSSSSSSSSSSS',
  })
  await db.insert(surveyApplications).values([
    {
      id: 'SA-01',
      surveyId: 'SV-01',
      name: '최바람',
      studentNumber: '2021000001',
      receiptHash: hashToken('PPPPPPPPPPPPPPPPPPPP01'),
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    },
    {
      id: 'SA-02',
      surveyId: 'SV-01',
      name: '김하늘',
      studentNumber: '2021000002',
      receiptHash: hashToken('PPPPPPPPPPPPPPPPPPPP02'),
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    },
    {
      id: 'SA-03',
      surveyId: 'SV-01',
      name: '이윤슬',
      studentNumber: '2021000003',
      receiptHash: hashToken('PPPPPPPPPPPPPPPPPPPP03'),
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    },
  ])
  await db.insert(tasks).values([
    { id: 'T-01', orgId: 'ORG-01', eventId: 'E-D1', title: '부스 물품 정리', status: 'done' },
    { id: 'T-02', orgId: 'ORG-01', eventId: 'E-D1', title: '정산 마무리', status: 'done' },
    { id: 'T-03', orgId: 'ORG-01', eventId: 'E-D1', title: '후기 정리', status: 'review' },
  ])
  await db.insert(budgetItems).values({
    id: 'B-01',
    orgId: 'ORG-01',
    eventId: 'E-D1',
    name: '행사 운영비',
    amount: 1_000_000,
  })
  await db.insert(purchaseRequests).values({
    id: 'PR-01',
    orgId: 'ORG-01',
    eventId: 'E-D1',
    title: '부스 물품',
    stage: 'settled',
  })
  await db.insert(payments).values({
    id: 'PAY-01',
    orgId: 'ORG-01',
    requestId: 'PR-01',
    vendor: '다이소',
    paidAmount: 920_000,
  })
}, 60_000)

afterAll(async () => {
  await close()
})

describe('완료된 행사 목록이 저장소에서 온다(REC-01)', () => {
  it('완료된 행사만 오고 남의 학생회 것은 오지 않는다', async () => {
    const rows = await many('/api/records/completed-events')
    expect(rows.map((row) => row.title)).toEqual([
      '봄 축제 학생회 부스',
      '2025 학년도 종강 행사',
      '2025 신입생 환영회',
      // 날짜가 없는 것은 맨 뒤다.
      '날짜 없는 행사',
    ])
    expect(rows[3]).toMatchObject({ date: '일시 미정' })
  })

  it('인수인계 문서가 어디까지 왔는지를 말과 색으로 준다', async () => {
    const rows = await many('/api/records/completed-events')
    expect(rows[0]).toMatchObject({
      id: 'E-D1',
      statusLabel: '완료',
      archiveStatus: '발행 완료',
      archiveStatusTone: 'green',
      date: '2026. 05. 28',
      host: '대외협력부',
      // 발행된 문서는 읽는 화면으로 간다.
      actionLabel: '상세 보기 →',
      targetKind: 'published',
    })
    expect(rows[1]).toMatchObject({
      archiveStatus: '검토 중',
      archiveStatusTone: 'blue',
      host: '홍길동',
      // 아직 발행되지 않은 것은 쓰고 검토받는 화면으로 간다.
      actionLabel: '상세 보기 →',
      targetKind: 'draft',
    })
  })

  // **없는 것이 표현이 아니라 뜻이다.** 열 것이 없으면 그 까닭이 대신 온다.
  it('문서가 없으면 단추 대신 까닭이 온다', async () => {
    const rows = await many('/api/records/completed-events')
    expect(rows[2]).toMatchObject({
      archiveStatus: '인수인계 문서 미발행',
      archiveStatusTone: 'gray',
      blockedNote: '인수인계 문서가 아직 발행되지 않았습니다',
    })
    expect(rows[2]!.actionLabel).toBeUndefined()
    expect(rows[2]!.targetKind).toBeUndefined()
  })

  // 딱지 개수는 행사마다 다르다 — 바탕이 되는 사실이 없으면 그 딱지가 오지 않는다.
  it('눈에 띄어야 하는 것을 서버가 세어 말로 만든다', async () => {
    const rows = await many('/api/records/completed-events')
    expect(rows[0]!.highlights).toEqual([
      { label: '2명 참석 (신청 3명)' },
      { label: '예산 집행 92%' },
      { label: '완료 업무 2건' },
    ])
    expect(rows[2]!.highlights).toEqual([])
  })

  it('행사명으로 서버가 거른다', async () => {
    const rows = await many('/api/records/completed-events?query=종강')
    expect(rows.map((row) => row.title)).toEqual(['2025 학년도 종강 행사'])
  })
})

describe('머리의 알림이 저장소에서 온다(REC-01)', () => {
  // 발행되지 않은 것이 셋이다 — 검토 중인 것 하나와 문서가 아예 없는 것 둘.
  it('미발행 건수를 세어 완성된 문구로 준다', async () => {
    expect(await one('/api/records/completed-events/alert')).toEqual({
      unpublishedNote: '인수인계 문서 미발행 3건',
    })
  })
})
