import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { freshDb } from '../db/testing.ts'
import {
  departments,
  eventArchives,
  events,
  members,
  organizations,
  payments,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  tasks,
} from '../db/schema.ts'
import { harness, NOW, viewer } from '../events/testing.ts'
import { Blocked, NotFound } from '../routes.ts'
import { archiveDraft } from './archive.ts'
import { generateHandoverDraft, saveArchiveDraft } from './archive-write.ts'

// 아카이브를 쓰는 두 자리(REC-02A의 '임시 저장'과 'AI 초안 생성').
//
// **길은 아직 막혀 있다.** 계약이 두 자리의 권한을 `unstated`로 적어 두었고
// (누가 기록을 쓰는지 명세가 말하지 않는다) 미들웨어는 그 자리를 누구에게도 열지
// 않는다 — 그래서 여기서는 답을 짓는 함수를 곧바로 재고, 길이 막혀 있다는 사실은
// 마지막 검사가 못 박는다. 권한이 정해지는 날 그 검사가 먼저 빨개진다.
//
// 이 파일이 재는 것이 넷이다.
//
// 1. **임시 저장은 덮어쓰기다.** 줄이 없으면 만들고 있으면 통째로 갈아 끼운다.
// 2. **빈 글은 저장하지 않는다.** 지운 것과 안 적은 것을 같게 둔다.
// 3. **발행된 문서는 고치지 않는다.** 굳은 문서의 회고·인수인계가 바뀌면 발행이 거짓이 된다.
// 4. **초안은 기록에서만 모은다.** 기록에 없는 자산·연락처·담당자를 새로 만들지 않고,
//    기록이 없으면 그 사실을 적은 초안이 나온다.

let db: Db
let close: () => Promise<void>

const who = { memberId: 'M-01' }
let made = 0
const newId = () => `AR-NEW-${(made += 1)}`

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
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '김바다', role: 'chair', departmentId: 'D-01' },
    { id: 'M-03', orgId: 'ORG-01', name: '박해랑', role: 'member', departmentId: 'D-01' },
  ])
  await db.insert(events).values([
    { id: 'E-W1', orgId: 'ORG-01', title: '봄 축제 학생회 부스', status: 'done', updatedAt: NOW },
    { id: 'E-W2', orgId: 'ORG-01', title: '기록 없는 행사', status: 'done', updatedAt: NOW },
    { id: 'E-W3', orgId: 'ORG-01', title: '발행된 행사', status: 'done', updatedAt: NOW },
    { id: 'E-99', orgId: 'ORG-02', title: '남의 행사', status: 'done', updatedAt: NOW },
  ])
  await db.insert(eventArchives).values({
    id: 'AR-W3',
    orgId: 'ORG-01',
    eventId: 'E-W3',
    status: 'published',
    handover: '굳은 인수인계',
    publishedAt: NOW,
  })

  // E-W1의 기록. 초안은 여기서만 모은다.
  await db.insert(tasks).values([
    { id: 'T-1', orgId: 'ORG-01', eventId: 'E-W1', title: '부스 정리', status: 'done', assigneeMemberId: 'M-03' },
    { id: 'T-2', orgId: 'ORG-01', eventId: 'E-W1', title: '담당 없는 업무', status: 'done' },
  ])
  await db.insert(purchaseRequests).values([
    { id: 'PR-1', orgId: 'ORG-01', eventId: 'E-W1', title: '부스 물품', stage: 'settled' },
    // 아직 안 낸 요청의 품목은 산 것이 아니다.
    { id: 'PR-2', orgId: 'ORG-01', eventId: 'E-W1', title: '쓰다 만 요청', stage: 'draft' },
  ])
  await db.insert(purchaseOrders).values({ id: 'ORD-1', orgId: 'ORG-01', requestId: 'PR-1', vendor: '한빛기획' })
  await db.insert(purchaseRequestItems).values([
    { id: 'IT-1', orgId: 'ORG-01', requestId: 'PR-1', sortOrder: 0, name: '현수막', quantity: 2, unit: '개', orderId: 'ORD-1' },
    { id: 'IT-2', orgId: 'ORG-01', requestId: 'PR-1', sortOrder: 1, name: '경품', quantity: 30, unit: '개', vendor: '새봄상사' },
    { id: 'IT-9', orgId: 'ORG-01', requestId: 'PR-2', sortOrder: 0, name: '안 산 물건' },
  ])
  await db.insert(payments).values({
    id: 'PAY-1',
    orgId: 'ORG-01',
    requestId: 'PR-1',
    vendor: '한빛기획',
    paidOn: NOW,
    paidAmount: 920_000,
  })
}, 60_000)

afterAll(async () => {
  await close()
})

async function rowOf(eventId: string) {
  const rows = await db
    .select()
    .from(eventArchives)
    .where(and(eq(eventArchives.orgId, 'ORG-01'), eq(eventArchives.eventId, eventId)))
  return rows[0]
}

describe('임시 저장(record.archive.saveDraft)', () => {
  it('줄이 없으면 만들고, 쓴 사람과 빈 칸은 그대로 남긴다', async () => {
    await saveArchiveDraft(
      db,
      'ORG-01',
      'E-W2',
      {
        onSiteOperation: '12:00 준비',
        retroGood: '',
        retroIssues: null,
        improvementDepartment: 'D-01',
        nextOwner: ' 기획부 부서장 ',
        // 검토 단계가 없어지므로 검토자는 읽지 않는다.
        // 검토자는 회장단·부서장 중에서 고른다. M-01은 회장단이다.
        reviewer: 'M-01',
      },
      who,
      NOW,
      newId,
    )
    const row = await rowOf('E-W2')
    expect(row).toMatchObject({
      status: 'draft',
      onSiteOperation: '12:00 준비',
      retroGood: null,
      retroIssues: null,
      improvementDepartmentId: 'D-01',
      nextOwner: '기획부 부서장',
      authorMemberId: 'M-01',
      reviewerMemberId: 'M-01',
    })
    // 읽는 자리가 곧바로 같은 것을 준다.
    expect(await archiveDraft(db, 'ORG-01', 'E-W2')).toEqual({
      onSiteOperation: '12:00 준비',
      improvementDepartment: 'D-01',
      nextOwner: '기획부 부서장',
      // 고른 검토자도 칸으로 되돌아온다.
      reviewer: 'M-01',
    })
  })

  // **덮어쓰기다.** 안 보낸 칸은 비운 것이다 — 화면이 칸 전부를 한 번에 보낸다.
  it('다시 저장하면 통째로 갈아 끼운다', async () => {
    const before = await rowOf('E-W2')
    await saveArchiveDraft(db, 'ORG-01', 'E-W2', { retroGood: '잘됐다' }, who, NOW, newId)
    const row = await rowOf('E-W2')
    expect(row!.id).toBe(before!.id)
    expect(row).toMatchObject({
      onSiteOperation: null,
      retroGood: '잘됐다',
      improvementDepartmentId: null,
      nextOwner: null,
    })
  })

  it('이 학생회에 없는 부서는 막는다', async () => {
    await expect(
      saveArchiveDraft(db, 'ORG-01', 'E-W2', { improvementDepartment: 'D-99' }, who, NOW, newId),
    ).rejects.toBeInstanceOf(Blocked)
  })

  it('글이 아닌 값은 막는다', async () => {
    await expect(
      saveArchiveDraft(db, 'ORG-01', 'E-W2', { retroGood: 3 }, who, NOW, newId),
    ).rejects.toBeInstanceOf(Blocked)
  })

  // **발행된 문서는 고치지 않는다.** 회고와 인수인계는 굳지 않고 줄에서 읽히므로,
  // 여기를 고치면 발행된 문서가 바뀐다.
  it('발행된 문서는 막는다', async () => {
    await expect(
      saveArchiveDraft(db, 'ORG-01', 'E-W3', { handover: '바꾼다' }, who, NOW, newId),
    ).rejects.toBeInstanceOf(Blocked)
    expect((await rowOf('E-W3'))!.handover).toBe('굳은 인수인계')
  })

  it('남의 학생회 행사는 없는 것이다', async () => {
    await expect(
      saveArchiveDraft(db, 'ORG-01', 'E-99', {}, who, NOW, newId),
    ).rejects.toBeInstanceOf(NotFound)
  })
})

describe('인수인계 초안(record.archive.generateHandoverDraft)', () => {
  it('구매한 품목·발주처·업무 담당자를 기록에서 모은다', async () => {
    await generateHandoverDraft(db, 'ORG-01', 'E-W1', who, NOW, newId)
    const row = await rowOf('E-W1')
    expect(row!.handoverDraftedAt).toEqual(NOW)
    expect(row!.authorMemberId).toBe('M-01')
    expect(row!.handover).toBe(
      [
        '[재사용 자산]',
        "현수막 2개 — 구매 요청 '부스 물품'",
        "경품 30개 — 구매 요청 '부스 물품'",
        '[협력처·담당자]',
        '한빛기획: 현수막',
        '새봄상사: 경품',
        '부스 정리: 박해랑',
        '[주의사항]',
      ].join('\n'),
    )
    // 기록에 없는 것은 없다 — 안 낸 요청의 품목도, 전화번호도, 담당 없는 업무도.
    expect(row!.handover).not.toContain('안 산 물건')
    expect(row!.handover).not.toContain('담당 없는 업무')
    expect(row!.handover).not.toMatch(/\d{2,3}-\d{3,4}-\d{4}/)
  })

  // 기록이 없으면 그 사실을 적은 초안이 나온다.
  it('기록이 없으면 그 사실을 적는다', async () => {
    await generateHandoverDraft(db, 'ORG-01', 'E-W2', who, NOW, newId)
    expect((await rowOf('E-W2'))!.handover).toBe(
      [
        '[재사용 자산]',
        '구매 기록에서 찾은 품목이 없습니다',
        '[협력처·담당자]',
        '구매·업무 기록에서 찾은 협력처·담당자가 없습니다',
        '[주의사항]',
      ].join('\n'),
    )
  })

  // **덮어쓰기다.** 초안은 행사마다 하나뿐이고 다시 만들면 그 하나가 바뀐다.
  it('다시 만들면 사람이 고친 글도 그 하나가 바뀐다', async () => {
    await saveArchiveDraft(db, 'ORG-01', 'E-W1', { handover: '사람이 고친 글' }, who, NOW, newId)
    await generateHandoverDraft(db, 'ORG-01', 'E-W1', who, NOW, newId)
    const row = await rowOf('E-W1')
    expect(row!.handover).toContain('[재사용 자산]')
    expect(row!.handover).not.toContain('사람이 고친 글')
  })

  it('발행된 문서에는 만들지 않는다', async () => {
    await expect(generateHandoverDraft(db, 'ORG-01', 'E-W3', who, NOW, newId)).rejects.toBeInstanceOf(
      Blocked,
    )
  })
})

describe('회장단과 부서장만 쓴다', () => {
  // **사람이 정했다**(2026-09-05): 기록은 회장단·부서장이 쓰고 구성원은 읽는다.
  // 한동안 계약이 `unstated`라 회장단도 403이었다 — 그 검사가 여기 있었다.
  it('회장단은 임시 저장과 초안 생성이 열린다', async () => {
    const app = harness(db, { who: viewer('chair') })
    const saved = await app.request('/api/records/events/E-W2/archive/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retroGood: '열린다' }),
    })
    expect(saved.status).toBe(200)
    const drafted = await app.request('/api/records/events/E-W2/archive/handover-draft', {
      method: 'POST',
    })
    expect(drafted.status).toBe(200)
  })

  it('구성원은 403이다', async () => {
    const app = harness(db, { who: viewer('member') })
    const saved = await app.request('/api/records/events/E-W2/archive/drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retroGood: '막힌다' }),
    })
    expect(saved.status).toBe(403)
  })
})

// ── 검토 요청 — 그림에 있는 것까지. 승인 단추는 아직 없다.
describe('검토 요청은 문서를 검토 중으로 옮긴다', () => {
  it('회장단이 검토자를 골라 넘기면 검토 중이 되고 글도 함께 남는다', async () => {
    const app = harness(db, { who: viewer('chair') })
    const res = await app.request('/api/records/events/E-W1/archive/review-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retroGood: '넘기며 적은 글', reviewer: 'M-01' }),
    })
    expect(res.status).toBe(200)
    const row = await rowOf('E-W1')
    expect(row!.status).toBe('inReview')
    expect(row!.reviewerMemberId).toBe('M-01')
    expect(row!.retroGood).toBe('넘기며 적은 글')
    expect(row!.reviewRequestedAt).toEqual(NOW)
  })

  it('이미 넘어간 문서는 또 못 넘긴다 — 409', async () => {
    const app = harness(db, { who: viewer('chair') })
    const res = await app.request('/api/records/events/E-W1/archive/review-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewer: 'M-01' }),
    })
    expect(res.status).toBe(409)
  })

  it('검토자 없이는 넘길 수 없고, 평부원은 검토자가 못 된다 — 422', async () => {
    const app = harness(db, { who: viewer('chair') })
    const none = await app.request('/api/records/events/E-W2/archive/review-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ retroGood: '검토자 없음' }),
    })
    expect(none.status).toBe(422)
    const member = await app.request('/api/records/events/E-W2/archive/review-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewer: 'M-03' }),
    })
    expect(member.status).toBe(422)
  })

  it('구성원은 넘길 수 없다 — 403', async () => {
    const app = harness(db, { who: viewer('member') })
    const res = await app.request('/api/records/events/E-W2/archive/review-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewer: 'M-01' }),
    })
    expect(res.status).toBe(403)
  })
})
