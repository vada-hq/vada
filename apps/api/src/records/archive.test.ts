import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  attendanceCheckIns,
  attendanceQrs,
  budgetItems,
  departments,
  documents,
  eventArchives,
  events,
  eventStaffMembers,
  meetingAgendas,
  meetings,
  members,
  organizations,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  surveyApplications,
  surveys,
  tasks,
  users,
} from '../db/schema.ts'
import { harness, matchesContract, NOW, viewer } from '../events/testing.ts'
import { hashToken } from '../public/tokens.ts'
import { freezeArchive } from './archive-body.ts'
import { archiveReview, archiveReviewers } from './archive.ts'

// 행사 아카이브를 읽는 열한 자리(REC-02 · REC-02A).
//
// 이 파일이 재는 것이 다섯이다.
//
// 1. **발행 전에는 지금 값으로, 발행 뒤에는 굳은 값으로.** `frozen`이 있으면 거기서
//    읽고 없으면 표에서 만든다 — 그 갈림이 한 함수에 있고, 승인 단추가 생기는 날
//    이 검사가 곧 발행의 뜻이 된다.
// 2. **문서가 아직 없어도 읽힌다.** 아무것도 안 쓴 행사의 아카이브는 빈 초안이다 —
//    없다고 터뜨리면 쓰기 시작할 화면이 열리지 않는다.
// 3. **조건 목록과 채운 수가 한 셈에서 나온다.** 그림이 그린 여섯 줄 그대로다.
// 4. **글에 없는 구조를 지어내지 않는다.** 회고는 빈 줄이 아닌 줄 하나가 한 줄이고,
//    `causeNote`는 오지 않는다. 인수인계는 글이 가진 만큼만 묶인다.
// 5. **울타리가 선다.** 남의 학생회의 행사는 없는 것이다.

let db: Db
let close: () => Promise<void>

const at = (text: string) => new Date(`${text}+09:00`)

type Row = Record<string, unknown>

async function get(path: string, who = viewer('chair')) {
  return harness(db, { who }).request(path)
}

async function one(path: string): Promise<Row> {
  const res = await get(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row
}

async function many(path: string): Promise<Row[]> {
  const res = await get(path)
  expect(res.status, `${path}가 ${res.status}로 답했다`).toBe(200)
  return (await res.json()) as Row[]
}

const archiveOf = (eventId: string) => `/api/records/events/${eventId}/archive`

/** 발행 시점에 굳은 값. **표와 다른 값**이라야 어디서 읽었는지 드러난다. */
const FROZEN = {
  detail: {
    goal: '굳은 목표',
    audience: '굳은 대상',
    scheduleAndPlace: '굳은 일정',
    owner: '굳은 담당',
    scale: '굳은 규모',
    attendance: '신청 100명 → 참석 90명 (90.0%)',
    satisfaction: '굳은 만족도',
    budget: '굳은 예산',
    taskCompletion: '굳은 업무',
    runOrder: '굳은 순서',
    staffing: '굳은 배치',
    incident: '굳은 돌발',
    operationChange: '굳은 변경',
  },
  timeline: [{ id: 'frozen-1', date: '01. 01', title: '굳은 마디', description: '굳은 설명' }],
  evidence: [
    {
      id: 'tasks',
      title: '행사 업무',
      detail: '99건 (완료 99)',
      actionLabel: '원본 보기 →',
      targetKind: 'tasks',
    },
  ],
  autoFilled: {
    overview: '굳은 개요',
    outcome: '굳은 성과',
    timeline: '굳은 타임라인',
    evidence: '굳은 근거',
  },
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
    { id: 'D-01', orgId: 'ORG-01', name: '대외협력부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '홍보부', sortOrder: 1 },
    { id: 'D-99', orgId: 'ORG-02', name: '남의 부서' },
  ])
  await db.insert(users).values({ id: 'U-01', email: 'bada@example.ac.kr' })
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '이윤슬', role: 'head', departmentId: 'D-01' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-02' },
    { id: 'M-99', orgId: 'ORG-02', name: '남의 사람', departmentId: 'D-99' },
  ])

  await db.insert(events).values([
    // 기록이 두루 걸린 행사. 아카이브는 **쓰다 만 초안**이다.
    {
      id: 'E-A1',
      orgId: 'ORG-01',
      title: '봄 축제 학생회 부스',
      status: 'done',
      purpose: '재학생 교류 확대',
      audience: '재학생 전체',
      startAt: at('2026-05-28T11:00:00'),
      endAt: at('2026-05-28T17:00:00'),
      place: '잔디밭',
      capacityType: 'limited',
      capacityCount: 200,
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-02',
      createdAt: at('2026-04-01T10:00:00'),
      updatedAt: NOW,
    },
    // 아무 기록도 없고 아카이브 줄도 없는 행사.
    {
      id: 'E-A2',
      orgId: 'ORG-01',
      title: '겨울 나눔 행사',
      status: 'done',
      createdAt: at('2025-12-01T10:00:00'),
      updatedAt: NOW,
    },
    // 발행된 행사. 표의 값과 굳은 값이 다르다.
    {
      id: 'E-A3',
      orgId: 'ORG-01',
      title: '가을 한마당',
      status: 'done',
      startAt: at('2026-05-28T11:00:00'),
      endAt: at('2026-05-28T17:00:00'),
      hostDepartmentId: 'D-01',
      hostMemberId: 'M-02',
      createdAt: at('2026-04-01T10:00:00'),
      updatedAt: NOW,
    },
    // 여섯 조건을 다 채운 초안.
    {
      id: 'E-A4',
      orgId: 'ORG-01',
      title: '체육대회',
      status: 'done',
      createdAt: at('2026-03-01T10:00:00'),
      updatedAt: NOW,
    },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'done', updatedAt: NOW },
  ])

  await db.insert(eventArchives).values([
    {
      id: 'AR-A1',
      orgId: 'ORG-01',
      eventId: 'E-A1',
      status: 'draft',
      onSiteOperation: '12:00 준비 → 14:00 개회 → 16:30 정리',
      retroGood: '부스별 담당자를 2명씩 배치했다\n\n우천 대비 장소를 미리 정했다\n',
      retroImprovements: '제작물 업체는 6주 전까지 확정한다',
      improvementDepartmentId: 'D-02',
      handover:
        '[재사용 자산]\n부스 배치도 (재사용 가능) / 포스터 원본 파일\n[협력처·담당자]\n현수막 제작: 한빛기획\n[주의사항]\n잔디밭 사용은 총무처 사전 승인이 필요하다\n',
      authorMemberId: 'M-02',
    },
    {
      id: 'AR-A3',
      orgId: 'ORG-01',
      eventId: 'E-A3',
      status: 'published',
      onSiteOperation: '현장 운영 글',
      retroGood: '잘된 점 한 줄',
      retroIssues: '미흡한 점 한 줄',
      retroImprovements: '개선안 한 줄',
      handover: '머리글 없는 인수인계 한 줄\n둘째 줄',
      nextOwner: '대외협력부 부서장',
      authorMemberId: 'M-02',
      publishedAt: at('2026-06-04T09:00:00'),
      publishedByMemberId: 'M-01',
      frozen: FROZEN,
    },
    {
      id: 'AR-A4',
      orgId: 'ORG-01',
      eventId: 'E-A4',
      status: 'draft',
      onSiteOperation: '운영',
      retroGood: '좋았다',
      retroIssues: '아쉬웠다',
      retroImprovements: '고치자',
      handover: '넘긴다',
      nextOwner: '다음 사람',
    },
  ])

  // ── E-A1에 걸린 기록들 ────────────────────────────────────────────────
  await db.insert(tasks).values([
    { id: 'T-1', orgId: 'ORG-01', eventId: 'E-A1', title: '부스 정리', status: 'done', assigneeMemberId: 'M-03' },
    { id: 'T-2', orgId: 'ORG-01', eventId: 'E-A1', title: '정산 마무리', status: 'done' },
    // 기한이 지난 채 검토 중이다 — 지연으로 센다.
    {
      id: 'T-3',
      orgId: 'ORG-01',
      eventId: 'E-A1',
      title: '후기 정리',
      status: 'review',
      dueDate: at('2026-05-20T00:00:00'),
    },
    { id: 'T-4', orgId: 'ORG-01', eventId: 'E-A1', title: '물품 반납', status: 'planned' },
    // 발행된 행사에도 표에는 업무가 있다 — 굳은 값과 다른 지금 값이다.
    { id: 'T-5', orgId: 'ORG-01', eventId: 'E-A3', title: '뒷정리', status: 'done' },
  ])
  await db.insert(meetings).values([
    {
      id: 'MT-1',
      orgId: 'ORG-01',
      kind: 'event',
      eventId: 'E-A1',
      title: '부스 기획 회의',
      status: 'done',
      scheduledAt: at('2026-04-12T18:00:00'),
      startedAt: at('2026-04-12T18:05:00'),
    },
    // 임시 저장한 회의와 취소된 회의는 마디가 아니다.
    { id: 'MT-2', orgId: 'ORG-01', kind: 'event', eventId: 'E-A1', title: '쓰다 만 회의', status: 'draft' },
    {
      id: 'MT-3',
      orgId: 'ORG-01',
      kind: 'event',
      eventId: 'E-A1',
      title: '취소된 회의',
      status: 'cancelled',
      scheduledAt: at('2026-04-20T18:00:00'),
    },
  ])
  await db.insert(meetingAgendas).values([
    { id: 'AG-1', orgId: 'ORG-01', meetingId: 'MT-1', sortOrder: 0, title: '부스 구성', decisionText: '부스 4종 확정' },
    { id: 'AG-2', orgId: 'ORG-01', meetingId: 'MT-1', sortOrder: 1, title: '예산', decisionText: '  ' },
  ])
  await db.insert(documents).values([
    { id: 'DOC-1', orgId: 'ORG-01', eventId: 'E-A1', category: '사양서', title: '부스 사양서', createdAt: at('2026-04-02T10:00:00') },
    { id: 'DOC-2', orgId: 'ORG-01', eventId: 'E-A1', category: '시안', title: '현수막 시안 v2.png', createdAt: at('2026-04-03T10:00:00') },
    { id: 'DOC-3', orgId: 'ORG-01', eventId: 'E-A1', title: '분류 없는 문서', createdAt: at('2026-04-04T10:00:00') },
  ])
  await db.insert(budgetItems).values({ id: 'B-1', orgId: 'ORG-01', eventId: 'E-A1', name: '운영비', amount: 1_000_000 })
  await db.insert(purchaseRequests).values([
    {
      id: 'PR-1',
      orgId: 'ORG-01',
      eventId: 'E-A1',
      title: '부스 물품',
      stage: 'settled',
      submittedAt: at('2026-05-01T10:00:00'),
      evidenceCompletedAt: at('2026-06-04T15:00:00'),
    },
    // 아직 안 낸 요청은 근거가 아니다.
    { id: 'PR-2', orgId: 'ORG-01', eventId: 'E-A1', title: '쓰다 만 요청', stage: 'draft' },
  ])
  await db.insert(purchaseOrders).values({ id: 'ORD-1', orgId: 'ORG-01', requestId: 'PR-1', vendor: '한빛기획' })
  await db.insert(purchaseRequestItems).values([
    { id: 'IT-1', orgId: 'ORG-01', requestId: 'PR-1', sortOrder: 0, name: '현수막', quantity: 2, unit: '개', orderId: 'ORD-1' },
    { id: 'IT-2', orgId: 'ORG-01', requestId: 'PR-1', sortOrder: 1, name: '경품', quantity: 30, unit: '개' },
  ])
  await db.insert(payments).values({
    id: 'PAY-1',
    orgId: 'ORG-01',
    requestId: 'PR-1',
    vendor: '한빛기획',
    paidOn: at('2026-05-20T14:00:00'),
    paidAmount: 920_000,
  })
  await db.insert(surveys).values({
    id: 'SV-1',
    orgId: 'ORG-01',
    eventId: 'E-A1',
    linkToken: 'SSSSSSSSSSSSSSSSSSSSSS',
    opensAt: at('2026-05-01T09:00:00'),
    closesAt: at('2026-05-15T18:00:00'),
  })
  await db.insert(surveyApplications).values(
    ['01', '02', '03'].map((n) => ({
      id: `SA-${n}`,
      surveyId: 'SV-1',
      name: `신청자${n}`,
      studentNumber: `20210000${n}`,
      receiptHash: hashToken(`PPPPPPPPPPPPPPPPPPPP${n}`),
      receiptExpiresAt: NOW,
      privacyConsentAt: NOW,
    })),
  )
  await db.insert(attendanceQrs).values({
    id: 'QR-1',
    orgId: 'ORG-01',
    eventId: 'E-A1',
    tokenHash: hashToken('AAAAAAAAAAAAAAAAAAAAAA'),
  })
  await db.insert(attendanceCheckIns).values(
    ['01', '02'].map((n) => ({
      id: `CI-${n}`,
      qrId: 'QR-1',
      name: `참석자${n}`,
      studentNumber: `20210000${n}`,
      receiptHash: hashToken(`RRRRRRRRRRRRRRRRRRRR${n}`),
      receiptExpiresAt: NOW,
    })),
  )
  await db.insert(eventStaffMembers).values([
    { id: 'ST-1', orgId: 'ORG-01', eventId: 'E-A1', memberId: 'M-02', isEventLeader: true },
    { id: 'ST-2', orgId: 'ORG-01', eventId: 'E-A1', memberId: 'M-03' },
  ])
}, 60_000)

afterAll(async () => {
  await close()
})

describe('아카이브 문서 자체(record.archive)', () => {
  it('쓰는 중인 문서는 이름·상태·AI 계약 문장만 준다', async () => {
    const row = await one(archiveOf('E-A1'))
    expect(row).toEqual({
      title: '봄 축제 학생회 부스',
      statusLabel: '인수인계 문서 미발행',
      statusTone: 'gray',
      aiDisclaimer:
        'AI 초안은 이 행사의 업무·회의·문서·정산 기록만 재구성하며, 기록에 없는 자산·연락처·담당자를 새로 만들지 않습니다. 생성 후 반드시 검토·수정해 확정하세요.',
    })
  })

  // **문서 줄이 없어도 읽힌다.** 아무것도 안 쓴 아카이브는 빈 초안이다.
  it('아카이브 줄이 없는 행사도 빈 초안으로 읽힌다', async () => {
    const row = await one(archiveOf('E-A2'))
    expect(row).toMatchObject({ title: '겨울 나눔 행사', statusLabel: '인수인계 문서 미발행' })
    expect(await one(`${archiveOf('E-A2')}/draft`)).toEqual({})
  })

  it('발행된 문서는 누가 언제 쓰고 발행했는지까지 준다', async () => {
    const row = await one(archiveOf('E-A3'))
    expect(row).toEqual({
      title: '가을 한마당',
      statusLabel: '발행 완료',
      statusTone: 'green',
      scheduleNote: '2026. 05. 28 (목) 11:00–17:00',
      ownerNote: '대외협력부 · 책임자 이윤슬',
      publishedNote: '발행 2026. 06. 04',
      authorNote: '작성 이윤슬',
      nextOwnerNote: '다음 담당: 대외협력부 부서장',
    })
    // 검토 단계가 없어지므로 검토자 조각은 오지 않고, 쓰는 화면의 문장도 오지 않는다.
    expect(row.reviewerNote).toBeUndefined()
    expect(row.aiDisclaimer).toBeUndefined()
  })

  it('남의 학생회 행사는 없는 것이다', async () => {
    expect((await get(archiveOf('E-99'))).status).toBe(404)
    expect((await get(`${archiveOf('E-99')}/evidence`)).status).toBe(404)
  })
})

describe('사람이 쓰는 칸(record.archiveDraft)', () => {
  // **칸은 칸으로 준다.** 안 적은 칸은 아예 오지 않는다 — 빈 글을 주면 화면이 그것을 저장한다.
  it('적어 둔 칸만 온다', async () => {
    expect(await one(`${archiveOf('E-A1')}/draft`)).toEqual({
      onSiteOperation: '12:00 준비 → 14:00 개회 → 16:30 정리',
      retroGood: '부스별 담당자를 2명씩 배치했다\n\n우천 대비 장소를 미리 정했다\n',
      retroImprovements: '제작물 업체는 6주 전까지 확정한다',
      improvementDepartment: 'D-02',
      handover:
        '[재사용 자산]\n부스 배치도 (재사용 가능) / 포스터 원본 파일\n[협력처·담당자]\n현수막 제작: 한빛기획\n[주의사항]\n잔디밭 사용은 총무처 사전 승인이 필요하다\n',
    })
  })
})

describe('발행 조건(record.archiveGate · archiveGateConditions)', () => {
  // **그림이 그린 여섯 줄 그대로다.** 검토자 줄은 그림에 없고, 검토 단계도 없어진다.
  it('조건 여섯 줄을 채웠는지와 함께 준다', async () => {
    const rows = await many(`${archiveOf('E-A1')}/gate/conditions`)
    expect(rows.map((row) => [row.label, row.met, row.tone])).toEqual([
      ['현장 운영 기록', 'y', 'green'],
      ['회고 · 잘된 점', 'y', 'green'],
      ['회고 · 미흡했던 점과 원인', '', 'orange'],
      ['회고 · 다음 행사 개선안', 'y', 'green'],
      ['인수인계 내용', 'y', 'green'],
      ['다음 담당자 지정', '', 'orange'],
    ])
  })

  // **딱지의 수가 같은 셈에서 나온다.**
  it('채운 수와 막힌 까닭을 같은 셈으로 준다', async () => {
    expect(await one(`${archiveOf('E-A1')}/gate`)).toEqual({
      metCountNote: '4 / 6',
      blockedNote: '아직 채우지 않은 발행 조건이 2개 있습니다.',
    })
    expect(await one(`${archiveOf('E-A2')}/gate`)).toMatchObject({ metCountNote: '0 / 6' })
    // 다 채우면 막힌 까닭이 오지 않는다.
    expect(await one(`${archiveOf('E-A4')}/gate`)).toEqual({ metCountNote: '6 / 6' })
  })

  it('이미 발행된 문서는 다시 넘길 수 없다', async () => {
    expect(await one(`${archiveOf('E-A3')}/gate`)).toEqual({
      metCountNote: '6 / 6',
      blockedNote: '이미 발행된 문서입니다.',
    })
  })
})

describe('목차(record.archiveSections)', () => {
  // 쓰는 중인 문서는 절마다 어디까지 썼는지가 함께 온다. 저절로 채워지는 넷은 '자동'이다.
  it('쓰는 중인 문서의 절에는 진행 상태가 붙는다', async () => {
    const rows = await many(`${archiveOf('E-A1')}/sections`)
    expect(rows.map((row) => [row.key, row.label, row.statusLabel, row.statusTone])).toEqual([
      ['overview', '개요', '자동', 'gray'],
      ['outcome', '성과', '자동', 'gray'],
      ['timeline', '타임라인', '자동', 'gray'],
      ['evidence', '근거 자료', '자동', 'gray'],
      ['onSite', '현장 운영', '작성 완료', 'green'],
      // 셋 중 둘을 썼다 — 작성 전도 완료도 아니다.
      ['retro', '회고', '작성 중', 'orange'],
      ['handover', '인수인계', '작성 중', 'orange'],
    ])
    expect(rows.every((row) => row.rows === undefined)).toBe(true)
  })

  it('아무것도 안 쓴 문서는 사람이 쓰는 절이 전부 작성 전이다', async () => {
    const rows = await many(`${archiveOf('E-A2')}/sections`)
    expect(rows.slice(4).map((row) => row.statusLabel)).toEqual(['작성 전', '작성 전', '작성 전'])
  })

  // 발행된 문서는 회고가 세 갈래로 펴지고 진행 상태는 오지 않는다.
  it('발행된 문서의 회고는 세 갈래로 펴진다', async () => {
    const rows = await many(`${archiveOf('E-A3')}/sections`)
    expect(rows.map((row) => row.key)).toEqual([
      'overview',
      'outcome',
      'timeline',
      'onSite',
      'evidence',
      'retro',
      'handover',
    ])
    expect(rows[5]!.rows).toEqual([
      { key: 'retroGood', label: '잘된 점' },
      { key: 'retroIssues', label: '미흡했던 점' },
      { key: 'retroImprovements', label: '개선안' },
    ])
    expect(rows.every((row) => row.statusLabel === undefined)).toBe(true)
  })
})

describe('본문 열세 조각(record.archiveDetail)', () => {
  it('발행 전에는 표에서 지금 값으로 만든다', async () => {
    expect(await one(`${archiveOf('E-A1')}/detail`)).toEqual({
      goal: '재학생 교류 확대',
      audience: '재학생 전체',
      scheduleAndPlace: '2026. 05. 28 11:00–17:00 · 잔디밭',
      owner: '대외협력부 · 이윤슬',
      scale: '정원 200명 · 운영 인력 2명 · 참석 2명',
      attendance: '신청 3명 → 참석 2명 (66.7%)',
      // 만족도를 담는 표가 없다. 지어내지 않고 그 사실을 말한다.
      satisfaction: '만족도 조사 기록 없음',
      budget: '계획 1,000,000원 → 집행 920,000원 (92%)',
      taskCompletion: '전체 4건 · 완료 2건 · 지연 1건',
      // 현장 운영은 한 칸이다. 넷으로 가르는 구조가 글에 없으므로 첫 칸에 그대로 두고
      // 나머지 셋은 어디에 있는지를 말한다.
      runOrder: '12:00 준비 → 14:00 개회 → 16:30 정리',
      staffing: '현장 운영 기록에 함께 적혀 있습니다',
      incident: '현장 운영 기록에 함께 적혀 있습니다',
      operationChange: '현장 운영 기록에 함께 적혀 있습니다',
    })
  })

  // **없는 것은 없다고 말한다.** 빈 글을 주면 화면이 빈 칸을 그린다.
  it('기록이 없는 행사는 조각마다 없다는 말이 온다', async () => {
    expect(await one(`${archiveOf('E-A2')}/detail`)).toEqual({
      goal: '행사 목표 미기재',
      audience: '참여 대상 미기재',
      scheduleAndPlace: '일시 미정 · 장소 미정',
      owner: '담당 미정',
      scale: '규모 기록 없음',
      attendance: '신청·참석 기록 없음',
      satisfaction: '만족도 조사 기록 없음',
      budget: '예산 기록 없음',
      taskCompletion: '업무 기록 없음',
      runOrder: '현장 운영 기록 없음',
      staffing: '기록 없음',
      incident: '기록 없음',
      operationChange: '기록 없음',
    })
  })

  // **발행 뒤에는 원본이 바뀌어도 이 문서는 바뀌지 않는다.** 표에는 완료 업무가
  // 있지만 굳은 값이 답한다.
  it('발행된 문서는 굳은 값에서 읽는다', async () => {
    expect(await one(`${archiveOf('E-A3')}/detail`)).toEqual(FROZEN.detail)
    expect(await many(`${archiveOf('E-A3')}/timeline`)).toEqual(FROZEN.timeline)
    expect(await many(`${archiveOf('E-A3')}/evidence`)).toEqual(FROZEN.evidence)
    expect(await one(`${archiveOf('E-A3')}/auto-filled`)).toEqual(FROZEN.autoFilled)
  })
})

describe('타임라인(record.archiveTimeline)', () => {
  // **표가 아는 날짜에서만 마디가 난다.** 지어낸 마디는 없다.
  it('행사 생성·회의·모집·결제·행사·정산의 때가 차례로 온다', async () => {
    const rows = await many(`${archiveOf('E-A1')}/timeline`)
    expect(rows.map((row) => [row.date, row.title, row.description])).toEqual([
      ['04. 01', '행사 생성', '봄 축제 학생회 부스'],
      ['04. 12', '회의', '부스 기획 회의 · 결정 1건'],
      ['05. 01', '모집 시작', '참여 설문 접수 시작'],
      ['05. 15', '모집 마감', '신청 3명'],
      ['05. 20', '결제', '한빛기획 · 920,000원'],
      ['05. 28', '행사 진행', '잔디밭 · 참석 2명'],
      ['06. 04', '정산 완료', '부스 물품'],
    ])
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
  })

  it('기록이 없어도 만들어진 날은 안다', async () => {
    const rows = await many(`${archiveOf('E-A2')}/timeline`)
    expect(rows.map((row) => [row.date, row.title])).toEqual([['12. 01', '행사 생성']])
  })
})

describe('근거 자료(record.archiveEvidence)', () => {
  it('그림이 그린 네 종류를 표에서 센다', async () => {
    const rows = await many(`${archiveOf('E-A1')}/evidence`)
    expect(rows).toEqual([
      { id: 'tasks', title: '행사 업무', detail: '4건 (완료 2 · 지연 1)', actionLabel: '원본 보기 →', targetKind: 'tasks' },
      { id: 'meetings', title: '관련 회의', detail: '1건 · 결정 1건', actionLabel: '원본 보기 →', targetKind: 'meetings' },
      { id: 'documents', title: '행사 문서', detail: '3건 (사양서·시안)', actionLabel: '원본 보기 →', targetKind: 'documents' },
      { id: 'finance', title: '정산', detail: '구매 요청 1건 · 집행 920,000원', actionLabel: '원본 보기 →', targetKind: 'finance' },
    ])
  })

  // 갈 곳이 없는 줄에는 가는 문구가 오지 않는다 — 열어도 볼 것이 없다.
  it('이어진 것이 없으면 수만 오고 갈 곳은 오지 않는다', async () => {
    const rows = await many(`${archiveOf('E-A2')}/evidence`)
    expect(rows.map((row) => row.detail)).toEqual(['0건', '0건', '0건', '구매 요청 0건'])
    expect(rows.every((row) => row.actionLabel === undefined && row.targetKind === undefined)).toBe(true)
  })
})

describe('자동 채움 네 줄(record.archiveAutoFilled)', () => {
  it('행사 데이터를 한 줄씩으로 줄인다', async () => {
    expect(await one(`${archiveOf('E-A1')}/auto-filled`)).toEqual({
      overview: '봄 축제 학생회 부스 · 2026. 05. 28 · 담당 대외협력부 · 책임자 이윤슬 · 2명 참석 (신청 3명)',
      outcome: '2명 참석 (신청 3명) · 예산 집행 92% · 완료 업무 2건',
      timeline: '행사 생성 2026. 04. 01 → 정산 완료 2026. 06. 04 · 마디 7개',
      evidence: '업무 4건 · 회의 1건 · 문서 3건 · 구매 1건',
    })
  })

  // 이어진 데이터가 없으면 그 사실까지 서버가 적는다.
  it('없는 것은 없다고 적는다', async () => {
    expect(await one(`${archiveOf('E-A2')}/auto-filled`)).toEqual({
      overview: '겨울 나눔 행사 · 일시 미정',
      outcome: '참석·예산·업무 기록 없음',
      timeline: '행사 생성 2025. 12. 01',
      evidence: '업무·회의·문서·구매 연결 데이터 없음',
    })
  })
})

describe('회고(record.archiveRetro)', () => {
  // **빈 줄이 아닌 줄 하나가 한 줄이다.** 글에 없는 까닭(causeNote)은 지어내지 않고,
  // 맡을 부서는 개선안 묶음에 부서가 골라져 있을 때만 붙는다.
  it('글의 줄이 곧 줄이고 빈 묶음은 오지 않는다', async () => {
    expect(await many(`${archiveOf('E-A1')}/retrospective`)).toEqual([
      {
        groupLabel: '잘된 점',
        rows: [
          { key: 'good-1', label: '부스별 담당자를 2명씩 배치했다' },
          { key: 'good-2', label: '우천 대비 장소를 미리 정했다' },
        ],
      },
      {
        groupLabel: '다음 행사 개선안',
        rows: [
          { key: 'improvements-1', label: '제작물 업체는 6주 전까지 확정한다', ownerLabel: '홍보부' },
        ],
      },
    ])
  })

  it('아무것도 안 썼으면 비어 있다', async () => {
    expect(await many(`${archiveOf('E-A2')}/retrospective`)).toEqual([])
  })
})

describe('인수인계(record.archiveHandover)', () => {
  // 글이 가진 만큼만 묶인다. `[이름]` 줄이 묶음을 열고, `이름: 값` 줄은 앞뒤로 갈리며,
  // 그림이 그린 ' / '로도 줄이 나뉜다. 주의사항 묶음만 색을 갖는다.
  it('묶음 머리와 이름·값을 글에서 읽는다', async () => {
    expect(await many(`${archiveOf('E-A1')}/handover`)).toEqual([
      {
        groupLabel: '재사용 자산',
        rows: [
          { key: 'g1-1', label: '부스 배치도 (재사용 가능)' },
          { key: 'g1-2', label: '포스터 원본 파일' },
        ],
      },
      {
        groupLabel: '협력처·담당자',
        rows: [{ key: 'g2-1', label: '현수막 제작', value: '한빛기획' }],
      },
      {
        groupLabel: '주의사항',
        rows: [{ key: 'g3-1', label: '잔디밭 사용은 총무처 사전 승인이 필요하다', tone: 'orange' }],
      },
    ])
  })

  // 머리글 없이 적은 글은 한 묶음이다 — 없는 묶음을 지어내지 않는다.
  it('머리글이 없으면 한 묶음으로 온다', async () => {
    expect(await many(`${archiveOf('E-A3')}/handover`)).toEqual([
      {
        groupLabel: '인수인계',
        rows: [
          { key: 'g1-1', label: '머리글 없는 인수인계 한 줄' },
          { key: 'g1-2', label: '둘째 줄' },
        ],
      },
    ])
    expect(await many(`${archiveOf('E-A2')}/handover`)).toEqual([])
  })
})

describe('발행 시점에 굳히기(freezeArchive)', () => {
  // **지금 값을 계약의 모양 그대로 굳힌다.** 승인 변이가 이것을 `frozen`에 넣으면
  // 그 뒤로 위의 읽기가 전부 여기서 답한다.
  it('지금 값을 네 자리의 응답 모양 그대로 모은다', async () => {
    const frozen = await freezeArchive(db, 'ORG-01', 'E-A1', NOW)
    expect(frozen.detail).toEqual(await one(`${archiveOf('E-A1')}/detail`))
    expect(frozen.timeline).toEqual(await many(`${archiveOf('E-A1')}/timeline`))
    expect(frozen.evidence).toEqual(await many(`${archiveOf('E-A1')}/evidence`))
    expect(frozen.autoFilled).toEqual(await one(`${archiveOf('E-A1')}/auto-filled`))
  })

  // 굳은 값이 있어도 **굳히는 함수는 늘 지금 값을 본다** — 다시 발행할 일이 생기면 그때의 값이다.
  it('이미 굳은 문서에서도 지금 값을 만든다', async () => {
    const frozen = await freezeArchive(db, 'ORG-01', 'E-A3', NOW)
    expect(frozen.detail.taskCompletion).toBe('전체 1건 · 완료 1건')
    expect(frozen.detail.goal).toBe('행사 목표 미기재')
  })
})

describe('답이 계약의 모양을 지킨다', () => {
  const cases: Array<[string, string]> = [
    ['record.archive', archiveOf('E-A1')],
    ['record.archive', archiveOf('E-A3')],
    ['record.archiveSections', `${archiveOf('E-A1')}/sections`],
    ['record.archiveSections', `${archiveOf('E-A3')}/sections`],
    ['record.archiveAutoFilled', `${archiveOf('E-A1')}/auto-filled`],
    ['record.archiveDraft', `${archiveOf('E-A1')}/draft`],
    ['record.archiveDraft', `${archiveOf('E-A2')}/draft`],
    ['record.archiveGate', `${archiveOf('E-A1')}/gate`],
    ['record.archiveGateConditions', `${archiveOf('E-A1')}/gate/conditions`],
    ['record.archiveDetail', `${archiveOf('E-A1')}/detail`],
    ['record.archiveTimeline', `${archiveOf('E-A1')}/timeline`],
    ['record.archiveEvidence', `${archiveOf('E-A1')}/evidence`],
    ['record.archiveRetro', `${archiveOf('E-A1')}/retrospective`],
    ['record.archiveHandover', `${archiveOf('E-A1')}/handover`],
  ]
  for (const [operationId, path] of cases) {
    it(`${operationId}(${path})`, async () => {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(matchesContract(operationId, await res.json())).toBe(true)
    })
  }
})

// ── 검토 — 그림에 있는 둘. 의견을 적는 자리는 승인 단추와 함께 나중에 온다.
describe('검토자 후보와 검토 의견', () => {
  it('검토자 후보는 회장단과 부서장뿐이다', async () => {
    const options = await archiveReviewers(db, 'ORG-01', 'E-A1')
    const ids = options.map((one) => one.value)
    expect(ids).toContain('M-01')
    expect(ids).toContain('M-02')
    expect(ids).not.toContain('M-03')
    // 고르는 사람이 누가 누군지 알아야 한다 — 자리가 곁말로 붙는다.
    expect(options.find((one) => one.value === 'M-01')?.description).toBe('회장단')
    expect(options.find((one) => one.value === 'M-02')?.description).toMatch(/^부서장/)
  })

  it('아직 검토되지 않았으면 의견 조각이 오지 않는다', async () => {
    expect(await archiveReview(db, 'ORG-01', 'E-A1')).toEqual({})
  })
})
