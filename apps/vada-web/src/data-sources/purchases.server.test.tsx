import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { createApp } from '../../../api/src/app.ts'
import { freshDb } from '../../../api/src/db/testing.ts'
import { inMemoryCounter } from '../../../api/src/public/rate-limit.ts'
import { inMemoryAttempts } from '../../../api/src/idempotency.ts'
import {
  budgetItems,
  departments,
  events,
  members,
  organizations,
  paymentDocuments,
  payments,
  purchaseRequestItems,
  purchaseRequests,
  users,
} from '../../../api/src/db/schema.ts'
import type { Viewer } from '../../../api/src/permissions.ts'
import { ScreenRouter } from '../screens/ScreenRouter'
import { fetchOptions } from '../option-sources/catalog'
import { runMutation } from '../spec/mutations'
import { readListSource, readObjectSource } from './catalog'
import { forgetSources, loadSources, useServer } from './server'

// **구매 요청 한 건을 처음부터 끝까지 끌고 간다** — 쓰고(FIN-REQ-01) → 내고 → 재정부가 판정하고
// (FIN-REV-01) → 보완에 답해 다시 내고(FIN-SUP-01) → 승인되고 → 증빙을 끝낸다(FIN-EVID-01).
// 그 사이사이 요청자가 보는 상세(FIN-REQ-02)가 옳게 바뀌는지를 본다.
//
// | 화면 | 읽기 | 쓰기 |
// | --- | --- | --- |
// | FIN-REQ-01 | `finance.purchaseRequestDraft` · `finance.budgetItems` | `saveDraft` · `submit` |
// | FIN-REQ-02 | `finance.purchaseRequestDetail` · `purchaseRequestItems` · `purchaseRequestHistory` | |
// | FIN-REV-01 | (재정 영역이 답한다) | `sendReview` |
// | FIN-SUP-01 | `finance.supplementRequest` · `supplementItems` · `supplementInputFields` · `supplementAttachments` | `saveSupplement` · `resubmitSupplement` |
// | FIN-EVID-01 | (재정 영역이 답한다) | `completeEvidence` |
//
// **읽기는 `<ScreenRouter>`를 그려서 잰다.** 그릇에 손으로 값을 먹이면 화면이 서버에 붙는 순간
// 터지는 것을 못 본다. **쓰기는 `runMutation`으로 보낸다** — 화면이 누르는 그 길이다. 보내는 몸통은
// 화면이 만드는 것과 같은 꼴(초안의 평평한 맵 + requestId·eventId)로 만든다.

const NOW = new Date('2026-03-10T10:00:00+09:00')
const at = (text: string) => new Date(`${text}T00:00:00+09:00`)

/** 요청을 쓰는 사람 — 운영부 부원. 재정을 맡지 않는다. */
const MEMBER: Viewer = {
  userId: 'U-01',
  membership: { orgId: 'ORG-01', memberId: 'M-01', role: 'member', departmentId: 'D-01', inFinanceDepartment: false },
}

/** 판정을 보내고 증빙을 끝내는 사람 — 회장. `finance.manage`는 회장단이 늘 갖는다. */
const CHAIR: Viewer = {
  userId: 'U-02',
  membership: { orgId: 'ORG-01', memberId: 'M-02', role: 'chair', departmentId: 'D-02', inFinanceDepartment: true },
}

/** 지금 보고 있는 사람. 검사가 갈아 끼운다 — 앱은 한 번만 세운다. */
let sender: Viewer = MEMBER
const seeAs = (who: Viewer) => {
  sender = who
  forgetSources()
}

let db: Awaited<ReturnType<typeof freshDb>>['db']
let restore: () => void
let close: () => Promise<void>

const draw = (screenId: string, screenParams: Record<string, string> = {}) =>
  render(
    <ScreenRouter
      screenId={screenId}
      screenParams={screenParams}
      scopes={{}}
      onChangeScope={() => {}}
      onNavigate={() => {}}
    />,
  )

const drawn = () => document.body.textContent ?? ''

/**
 * 화면이 초안에 쓰는 그 모양 — 목록 칸에는 줄 이름이 줄바꿈으로, 줄의 칸은 `목록.줄.칸`에
 * (`spec/compute.ts`). FIN-REQ-01은 이 초안에 eventId·requestId를 얹어 그대로 보낸다.
 */
function draftOf(over: { requestId?: string; title?: string; items?: Array<Record<string, string>> } = {}) {
  const items = over.items ?? [
    {
      itemName: '안내 팻말',
      itemCategory: 'supplies',
      budgetItem: 'B-01',
      purchaseType: 'online',
      quantity: '5',
      unit: '개',
      unitPrice: '2000',
      vendor: '쿠팡',
      quoteStatus: 'none',
    },
  ]
  const values: Record<string, string> = {
    eventId: 'E-01',
    requestId: over.requestId ?? '',
    title: over.title ?? '한마당 안내 팻말 구매',
    department: '운영부',
    neededOn: '2026-03-15',
    priority: 'normal',
    purpose: '한마당 안내를 위한 팻말을 삽니다.',
    items: items.map((_, index) => `r${index}`).join('\n'),
  }
  items.forEach((item, index) => {
    for (const [key, value] of Object.entries(item)) values[`items.r${index}.${key}`] = value
  })
  return values
}

beforeAll(async () => {
  const fresh = await freshDb()
  db = fresh.db
  close = fresh.close

  await db.insert(organizations).values({ id: 'ORG-01', name: '제12대 학생회' })
  await db.insert(departments).values([
    { id: 'D-01', orgId: 'ORG-01', name: '운영부', sortOrder: 0 },
    { id: 'D-02', orgId: 'ORG-01', name: '재정부', handlesFinance: true, sortOrder: 1 },
  ])
  await db.insert(users).values([
    { id: 'U-01', email: 'haerang@example.ac.kr' },
    { id: 'U-02', email: 'bada@example.ac.kr' },
  ])
  await db.insert(members).values([
    { id: 'M-01', orgId: 'ORG-01', name: '박해랑', departmentId: 'D-01', userId: 'U-01' },
    { id: 'M-02', orgId: 'ORG-01', name: '김바다', departmentId: 'D-02', role: 'chair', userId: 'U-02' },
  ])
  // **개발용 응답에 없는 이름으로 둔다** — 그래야 서버를 거친 증거가 된다.
  await db.insert(events).values({
    id: 'E-01',
    orgId: 'ORG-01',
    title: '2026 소프트웨어융합대학 가을 한마당',
    updatedAt: NOW,
  })
  await db.insert(budgetItems).values([
    { id: 'B-01', orgId: 'ORG-01', eventId: 'E-01', name: '한마당 운영비', amount: 1_000_000, sortOrder: 0 },
    { id: 'B-02', orgId: 'ORG-01', eventId: 'E-01', name: '한마당 홍보비', amount: 500_000, sortOrder: 1 },
  ])
  // 증빙 정리 중이고 서류가 다 붙은 요청. 처리 완료는 이것에 보낸다 — 발주·결제를 만드는 자리는
  // 아직 명세에 없어 씨앗으로 둔다.
  await db.insert(purchaseRequests).values({
    id: 'PR-21',
    orgId: 'ORG-01',
    eventId: 'E-01',
    code: 'REQ-021',
    title: '한마당 간식 구매',
    departmentId: 'D-01',
    requesterMemberId: 'M-01',
    stage: 'proof',
    submittedAt: at('2026-03-01'),
    reviewedAt: at('2026-03-02'),
    reviewedByMemberId: 'M-02',
  })
  await db.insert(payments).values({
    id: 'PAY-21',
    orgId: 'ORG-01',
    requestId: 'PR-21',
    vendor: '한마당 마트',
    paidOn: at('2026-03-05'),
    payerMemberId: 'M-02',
    method: '법인카드',
    paidAmount: 24_500,
  })
  await db.insert(paymentDocuments).values({
    id: 'PD-21',
    orgId: 'ORG-01',
    paymentId: 'PAY-21',
    label: '영수증',
    registeredAt: at('2026-03-05'),
  })
  await db.insert(purchaseRequestItems).values({
    id: 'PRI-21',
    orgId: 'ORG-01',
    requestId: 'PR-21',
    sortOrder: 0,
    name: '한마당 초콜릿',
    quantity: 10,
    unit: '개',
    unitPrice: 2_500,
    reviewResult: 'approved',
    approvedAmount: 25_000,
    paymentId: 'PAY-21',
  })

  // **이름표는 부를 때마다 다르다.** 요청 하나에 품목 줄이 여럿 생긴다.
  let made = 0
  const app = createApp({
    audit: { async write() {} },
    db: db as never,
    who: async () => sender,
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
    newId: () => `X-${(made += 1)}`,
  })

  restore = useServer({
    baseUrl: 'http://server',
    fetch: async (input, init) => app.request(String(input), init),
  })
}, 60_000)

afterAll(async () => {
  restore()
  await close()
})

/** 요청 하나가 흐름을 따라 옮겨 간다. 검사들이 차례로 이어 쓴다. */
let requestId = ''

describe('구매 요청을 쓴다(FIN-REQ-01)', () => {
  it('새로 열면 아직 아무것도 적히지 않은 요청이 오고 작성자의 부서만 채워져 있다', async () => {
    draw('FIN-REQ-01', { eventId: 'E-01' })
    await waitFor(() => expect(screen.getByLabelText('요청 부서')).toHaveValue('운영부'))
    expect(screen.getByLabelText('요청 제목*')).toHaveValue('')
    expect(screen.getByLabelText('구매 목적*')).toHaveValue('')
    // 개발용 응답의 요청이 아니라는 증거.
    expect(screen.queryByDisplayValue('박스테이프')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('체육대회 운영 물품')).not.toBeInTheDocument()
  })

  // 고르는 목록도 같은 서버를 쓴다 — 두 벌을 두면 표는 진짜인데 목록이 가짜가 된다.
  it('예산 항목은 그 행사의 편성에서 온다', async () => {
    expect(await fetchOptions('finance.budgetItems', { eventId: 'E-01' })).toEqual([
      { value: 'B-01', label: '한마당 운영비' },
      { value: 'B-02', label: '한마당 홍보비' },
    ])
  })

  it('임시 저장하면 줄이 생기고, 그 요청을 열면 적어 둔 것이 그대로 온다', async () => {
    const answer = await runMutation('finance.purchaseRequest.saveDraft', draftOf())
    expect(typeof answer.id).toBe('string')
    requestId = String(answer.id)

    draw('FIN-REQ-01', { eventId: 'E-01', requestId })
    await waitFor(() => expect(screen.getByLabelText('요청 제목*')).toHaveValue('한마당 안내 팻말 구매'))
    expect(screen.getByLabelText('필요한 날짜*')).toHaveValue('2026-03-15')
    expect(screen.getByLabelText('구매 목적*')).toHaveValue('한마당 안내를 위한 팻말을 삽니다.')
    expect(screen.getByDisplayValue('안내 팻말')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('쿠팡')).toBeInTheDocument()
    // 아직 낸 것이 아니다 — 상세는 번호 없이 제출 단계에 서 있다.
    await loadSources([{ key: 'finance.purchaseRequestDetail', params: { requestId } }])
    expect(readObjectSource('finance.purchaseRequestDetail', { requestId })).toMatchObject({
      code: '번호 미정',
      status: '작성 중',
      stage: 'submitted',
      amountNote: '10,000원',
    })
  })

  it('이름표를 들고 다시 저장하면 같은 줄을 덮어쓴다', async () => {
    const before = await db.select({ id: purchaseRequests.id }).from(purchaseRequests)
    await runMutation('finance.purchaseRequest.saveDraft', draftOf({ requestId, title: '한마당 안내 팻말 구매(수정)' }))
    expect(await db.select({ id: purchaseRequests.id }).from(purchaseRequests)).toHaveLength(before.length)
    await loadSources([{ key: 'finance.purchaseRequestDraft', params: { eventId: 'E-01', requestId } }])
    expect(readObjectSource('finance.purchaseRequestDraft', { eventId: 'E-01', requestId }).title).toBe(
      '한마당 안내 팻말 구매(수정)',
    )
  })

  it('필수 칸이 비면 제출은 서버가 막는다(422)', async () => {
    await expect(runMutation('finance.purchaseRequest.submit', draftOf({ requestId, title: '' }))).rejects.toThrow('422')
    expect((await db.select().from(purchaseRequests)).find((row) => row.id === requestId)!.stage).toBe('draft')
  })

  it('제출하면 검토로 넘어가고 번호가 붙는다 — 상세가 그것을 그린다', async () => {
    await runMutation('finance.purchaseRequest.submit', draftOf({ requestId }))

    draw('FIN-REQ-02', { requestId })
    // 요청 번호는 서버가 만든다. 그 해의 첫 번째다.
    await waitFor(() => expect(screen.getAllByText('PR-2026-0001').length).toBeGreaterThan(0))
    const page = drawn()
    expect(page).toContain('한마당 안내 팻말 구매')
    expect(page).toContain('검토 대기')
    expect(page).toContain('2026 소프트웨어융합대학 가을 한마당')
    expect(page).toContain('박해랑')
    expect(page).toContain('10,000원')
    // 처리 기록 — 제출 한 줄. 누가 언제가 한 줄로 온다.
    expect(page).toContain('요청 제출')
    expect(page).toContain('박해랑 · 2026-03-10 10:00')
    // 진행 단계 줄은 재정부 검토에 서 있다.
    expect(screen.getByText('재정부 검토')).toHaveAttribute('aria-current', 'step')
    // 개발용 응답의 요청이 아니라는 증거.
    expect(page).not.toContain('REQ-001')
    expect(page).not.toContain('박스테이프')
  })
})

describe('재정부가 판정하고 요청자가 보완에 답한다(FIN-REV-01 · FIN-SUP-01)', () => {
  /** 제출한 요청의 품목 이름표. 검토 화면이 읽는 자리(재정 영역)에서 가져온다 — 같은 표를 같은 셈으로. */
  async function itemIdsOf(id: string): Promise<string[]> {
    forgetSources()
    await loadSources([{ key: 'finance.reviewItems', params: { requestId: id } }])
    return readListSource('finance.reviewItems', { requestId: id }).map((row) => String(row.id))
  }

  it('전부 승인하면 검토가 끝나 구매로 간다 — 부원은 판정을 보낼 수 없다', async () => {
    const [itemId] = await itemIdsOf(requestId)
    const verdict = { requestId, [`reviews.${itemId}.result`]: 'approved', [`reviews.${itemId}.approvedAmount`]: '9000' }
    await expect(runMutation('finance.purchaseRequest.sendReview', verdict)).rejects.toThrow('403')

    seeAs(CHAIR)
    await runMutation('finance.purchaseRequest.sendReview', verdict)

    seeAs(MEMBER)
    draw('FIN-REQ-02', { requestId })
    await waitFor(() => expect(screen.getAllByText('구매 진행 중').length).toBeGreaterThan(0))
    const page = drawn()
    expect(page).toContain('승인')
    expect(page).toContain('재정부 검토 완료')
    expect(page).toContain('김바다 · 2026-03-10 10:00')
    expect(screen.getByText('구매·발주')).toHaveAttribute('aria-current', 'step')
  })

  let asked = ''
  let askedItem = ''

  it('보완이 하나라도 있으면 보완 요청이 나간다 — 요청자가 그 화면을 연다', async () => {
    const answer = await runMutation(
      'finance.purchaseRequest.submit',
      draftOf({
        title: '한마당 이름표 제작',
        items: [
          { itemName: '이름표 목걸이', itemCategory: 'supplies', budgetItem: 'B-01', purchaseType: 'online', quantity: '100', unit: '개', unitPrice: '500', quoteStatus: 'none' },
          { itemName: '이름표 용지', itemCategory: 'print', budgetItem: 'B-02', purchaseType: 'contract', quantity: '200', unit: '장', unitPrice: '300', quoteStatus: 'requested' },
        ],
      }),
    )
    asked = String(answer.id)
    const [first, second] = await itemIdsOf(asked)
    askedItem = second!

    seeAs(CHAIR)
    await runMutation('finance.purchaseRequest.sendReview', {
      requestId: asked,
      [`reviews.${first}.result`]: 'approved',
      [`reviews.${second}.result`]: 'supplement',
      [`reviews.${second}.reviewNote`]: '용지 규격이 적혀 있지 않습니다. 알려 주세요',
    })
    // 이미 보완을 요청한 요청에는 또 보낼 수 없다.
    await expect(
      runMutation('finance.purchaseRequest.sendReview', { requestId: asked, [`reviews.${second}.result`]: 'approved' }),
    ).rejects.toThrow('409')

    seeAs(MEMBER)
    draw('FIN-SUP-01', { requestId: asked })
    await waitFor(() => expect(screen.getByText('요청 담당자 김바다')).toBeInTheDocument())
    const page = drawn()
    expect(page).toContain('보완 요청일 2026-03-10')
    // 언제까지 다시 내라는지는 FIN-REV-01에 적는 자리가 없다. 그 사실이 온다.
    expect(page).toContain('재제출 기한 미정')
    expect(page).toContain('보완 품목 — 이름표 용지')
    expect(page).toContain('인쇄물 · 한마당 홍보비')
    expect(page).toContain('60,000원')
    // 재정부가 FIN-REV-01에서 적은 사유가 그대로 요청자에게 온다.
    expect(page).toContain('용지 규격이 적혀 있지 않습니다. 알려 주세요')
    // 다시 받을 칸은 아직 정해진 것이 없다 — 개발용 응답의 칸이 새어 나오지 않는다.
    expect(page).not.toContain('사이즈·규격')
    expect(page).not.toContain('디자인 파일')
    // 승인된 품목은 보완 품목이 아니다.
    expect(page).not.toContain('보완 품목 — 이름표 목걸이')
  })

  it('보완 답을 적어 두고 다시 내면 검토 대기로 돌아간다', async () => {
    const answers = { requestId: asked, [`${askedItem}.corrections.size`]: 'A4 (210×297mm)' }
    await runMutation('finance.purchaseRequest.saveSupplement', answers)
    expect(
      (await db.select().from(purchaseRequestItems)).find((row) => row.id === askedItem)!.supplementAnswers,
    ).toEqual({ corrections: { size: 'A4 (210×297mm)' }, attachments: {} })

    await runMutation('finance.purchaseRequest.resubmitSupplement', answers)

    const { unmount } = draw('FIN-REQ-02', { requestId: asked })
    await waitFor(() => expect(screen.getAllByText('검토 대기').length).toBeGreaterThan(0))
    // 보완이던 품목은 다시 판정을 기다린다. 승인된 품목은 그대로다.
    expect(drawn()).toContain('승인')
    unmount()

    // 이제 걸린 보완 요청이 없다 — 그 화면은 그 사실을 말한다.
    draw('FIN-SUP-01', { requestId: asked })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('보완 요청을(를) 불러오지 못했습니다'))
  })

  it('다시 검토해 전부 승인하면 구매로 간다', async () => {
    const [first, second] = await itemIdsOf(asked)
    seeAs(CHAIR)
    await runMutation('finance.purchaseRequest.sendReview', {
      requestId: asked,
      [`reviews.${first}.result`]: 'approved',
      [`reviews.${second}.result`]: 'approved',
    })
    seeAs(MEMBER)
    await loadSources([{ key: 'finance.purchaseRequestDetail', params: { requestId: asked } }])
    expect(readObjectSource('finance.purchaseRequestDetail', { requestId: asked })).toMatchObject({
      code: 'PR-2026-0002',
      status: '구매 진행 중',
      stage: 'purchase',
      amountNote: '110,000원',
    })
  })
})

describe('증빙을 끝낸다(FIN-EVID-01)', () => {
  it('서류가 다 붙은 요청은 처리 완료가 되고 상세가 그것을 그린다', async () => {
    seeAs(CHAIR)
    draw('FIN-EVID-01', { requestId: 'PR-21' })
    await waitFor(() => expect(screen.getByText('한마당 마트')).toBeInTheDocument())

    await runMutation('finance.purchaseRequest.completeEvidence', { requestId: 'PR-21' })
    // 이미 끝난 요청을 또 끝낼 수 없다(계약의 repeat: conflict).
    await expect(runMutation('finance.purchaseRequest.completeEvidence', { requestId: 'PR-21' })).rejects.toThrow('409')

    seeAs(MEMBER)
    draw('FIN-REQ-02', { requestId: 'PR-21' })
    await waitFor(() => expect(screen.getAllByText('처리 완료').length).toBeGreaterThan(0))
    const page = drawn()
    // 정산을 누가 했는지는 표에 없다. 때만 온다.
    expect(page).toContain('결제 · 한마당 마트')
    expect(page).toContain('2026-03-10 10:00')
    expect(screen.getByText('처리 완료', { selector: '[aria-current="step"]' })).toBeInTheDocument()
  })
})
