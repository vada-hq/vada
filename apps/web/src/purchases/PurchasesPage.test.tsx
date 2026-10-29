// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PurchaseItemBrief } from '@vada/contracts'
import { resetAddress } from '@/test-support/address-reset'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { COUNCIL_ID, PurchasesAt } from '@/test-support/finance-at'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})
const base = `/api/organizations/${COUNCIL_ID}`
const R1 = '0199d1a0-0000-7000-8000-00000000a001'
const brief = (name: string, extra: Partial<PurchaseItemBrief> = {}): PurchaseItemBrief => ({
  id: `item-${name}`,
  name,
  quantity: 2,
  estimate: 10000,
  amount: null,
  status: 'pending',
  paid: false,
  shipped: false,
  ...extra,
})
// 품목 다섯: 검토 중, 반려(확인 필요), 구매 준비, 송장(진행 중), 결제(처리 완료).
const sample = () =>
  purchaseSummary(R1, {
    title: '체육대회 물품',
    status: 'partial',
    requesterDepartments: ['운영부'],
    itemBriefs: [
      brief('생수'),
      brief('현수막', { status: 'rejected', amount: 50000 }),
      brief('네임펜', { status: 'approved', amount: 12000 }),
      brief('조끼', { status: 'approved', amount: 90000, shipped: true }),
      brief('테이블', { status: 'approved', amount: 90000, paid: true }),
    ],
  })
const list = (requests = [sample()]) => json({ requests, truncated: false })
const member = () => councilView(COUNCIL_ID, { councilRank: null, permissions: MEMBER_PERMISSIONS })
const show = (view = member()) => {
  render(<PurchasesAt view={view} onForbidden={vi.fn()} />)
}
const lane = (name: string) => screen.getByRole('region', { name })

test('운영진은 품목 현황 칸반을 보고, 품목은 진행 단계 열에 한 장씩 놓인다', async () => {
  mockApi().on('GET', `${base}/purchase-requests?view=all`, () => list())
  show()
  await screen.findByRole('button', { name: '생수' })
  expect(screen.queryByRole('tab', { name: '처리 단계' })).toBeNull()
  expect(within(lane('검토 중')).getByRole('button', { name: '생수' })).toBeTruthy()
  expect(within(lane('확인 필요')).getByText('반려')).toBeTruthy()
  expect(within(lane('구매 준비')).getByRole('button', { name: '네임펜' })).toBeTruthy()
  expect(within(lane('진행 중')).getByText('배송 중')).toBeTruthy()
  expect(within(lane('처리 완료')).getByRole('button', { name: '테이블' })).toBeTruthy()
  expect(within(lane('동의 대기')).getByText('품목 없음')).toBeTruthy()
  const chips = screen.getByRole('list', { name: '진행 단계' })
  expect(within(chips).getByRole('button', { name: /^구매 준비\s*1$/ })).toBeTruthy()
  expect(screen.getByText('품목 5건')).toBeTruthy()
  expect(within(lane('검토 중')).getByText('운영부')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '네임펜' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}/${R1}`))
})

test('재정부는 처리 단계가 기본이고, 업무 영역과 요청 기록 표를 오간다', async () => {
  mockApi().on('GET', `${base}/purchase-requests?view=all`, () => list())
  show(councilView(COUNCIL_ID, { councilRank: null, permissions: FINANCE_PERMISSIONS }))
  const areas = await screen.findByRole('group', { name: '업무 영역' })
  await within(lane('검토 대기')).findByText('생수')
  expect(
    within(areas)
      .getByRole('button', { name: /^요청 검토\s*1$/ })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(within(areas).getByRole('button', { name: /^물품 배송·수령\s*1$/ }))
  await waitFor(() => expect(window.location.search).toContain('area=goods'))
  expect(within(lane('배송 중')).getByText('조끼')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: /^구매 요청\s*1$/ }))
  const row = (await screen.findByRole('button', { name: '체육대회 물품' })).closest('tr')
  expect(row?.textContent).toContain('운영부')
  expect(window.location.search).toContain('board=records')
})

test('내 요청 전환은 서버에서 내 요청만 읽고, [내 구매 요청]은 상태별 수와 표를 연다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  api.on('GET', `${base}/purchase-requests?view=mine`, () =>
    list([purchaseSummary('mine', { title: '반려된 요청', status: 'rejected', itemBriefs: [] })]),
  )
  show()
  await screen.findByRole('button', { name: '생수' })
  fireEvent.click(screen.getByRole('button', { name: '내 요청' }))
  await waitFor(() => expect(window.location.search).toContain('view=mine'))
  fireEvent.click(screen.getByRole('button', { name: '내 구매 요청' }))
  const page = await screen.findByRole('region', { name: '내 구매 요청' })
  await within(page).findByRole('button', { name: '반려된 요청' })
  expect(within(page).getByText('반려·취소').nextSibling?.textContent).toBe('1')
  expect(window.location.search).toContain('page=mine')
  fireEvent.click(within(page).getByRole('button', { name: '구매로 돌아가기' }))
  await waitFor(() => expect(window.location.search).not.toContain('page=mine'))
})

test('범위 칩은 상시·행사를 서버 질의와 주소에 남기고, 행사면 예산 요약과 새 요청에 이어진다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  api.on('GET', `${base}/purchase-requests?view=all&event=none`, () =>
    list([purchaseSummary('none', { itemBriefs: [brief('상시 품목')] })]),
  )
  api.on('GET', `${base}/purchase-requests?view=all&event=${EVENT_ID}`, () =>
    list([purchaseSummary('event', { itemBriefs: [brief('행사 품목')] })]),
  )
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  show()
  await screen.findByRole('button', { name: '생수' })
  expect(screen.getByRole('button', { name: '재정 › 예산 현황' })).toBeTruthy()
  const scope = screen.getByRole('group', { name: '구매 범위' })
  fireEvent.click(within(scope).getByRole('button', { name: '상시' }))
  await screen.findByRole('button', { name: '상시 품목' })
  expect(window.location.search).toContain('scope=none')
  fireEvent.click(await within(scope).findByRole('button', { name: '신입생 환영회' }))
  await screen.findByRole('button', { name: '행사 품목' })
  expect(window.location.search).toContain(`scope=${EVENT_ID}`)
  const summary = await screen.findByRole('region', { name: '예산 요약' })
  expect(within(summary).getByText('500,000원')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 구매 요청' }))
  const eventField = await screen.findByRole('combobox', { name: /행사/ })
  expect((eventField as HTMLSelectElement).value).toBe(EVENT_ID)
})

test('읽기에 실패하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => json({ error: 'INTERNAL' }, 500))
  show()
  const retry = await screen.findByRole('button', { name: '다시 시도' })
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  fireEvent.click(retry)
  expect(await screen.findByRole('button', { name: '생수' })).toBeTruthy()
})
