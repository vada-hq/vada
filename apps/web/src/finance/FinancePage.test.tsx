// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  councilView,
  FINANCE_PERMISSIONS,
  HEAD_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
} from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { COUNCIL_ID, FinanceAt, PurchasesAt } from '@/test-support/finance-at'
import { CURRENT_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { closingFixture } from '@/test-support/closing-fixtures'
import { eventSummary } from '@/test-support/event-fixtures'
import { CLOSING_HIDDEN, PERIODS_LOAD_FAILED, SETTLEMENT_LOAD_FAILED } from '@/lib/messages'
import { PageTrailProvider, type PageTrail } from '@/components/PageHeading'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}/purchase-requests`
const listPath = (view: string) => `${base}?view=${view}`
const list = (requests = [purchaseSummary('a')], truncated = false) => json({ requests, truncated })

const financeRoot = `/api/organizations/${COUNCIL_ID}`
const settlementsPath = `${financeRoot}/event-settlements`
const periodsPath = `${financeRoot}/fiscal-periods`
const closingPath = `${periodsPath}/${CURRENT_PERIOD}/closing`
const settlements = () => ({
  period: { id: CURRENT_PERIOD, name: '2026년 2학기' },
  events: [{ event: eventSummary(), settlement: { remaining: 2, settled: false } }],
  truncated: false,
})

test.each([
  ['', '예산 현황'],
  ['?tab=ledger', '사용 내역'],
  ['?tab=closing', '결산'],
])('재정 주소 %s는 읽는 중에도 현재 탭 경로 칸 하나를 넘긴다', (query, label) => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('GET', periodsPath, () => pending.promise)
  api.on('GET', `${financeRoot}/expenses`, () => pending.promise)
  api.on('GET', settlementsPath, () => pending.promise)
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}${query}`)
  const send = vi.fn<(trail: PageTrail | null) => void>()
  render(
    <PageTrailProvider value={send}>
      <FinanceAt view={councilView(COUNCIL_ID)} onForbidden={vi.fn()} />
    </PageTrailProvider>,
  )
  expect(send).toHaveBeenLastCalledWith({
    title: '재정',
    crumbs: [{ label, truncate: false }],
  })
  expect(screen.queryByRole('navigation', { name: '결산 구역' }) !== null).toBe(
    query === '?tab=closing',
  )
  for (const next of ['결산', '사용 내역', '예산 현황']) {
    fireEvent.click(screen.getByRole('tab', { name: next }))
    expect(send).toHaveBeenLastCalledWith({
      title: '재정',
      crumbs: [{ label: next, truncate: false }],
    })
  }
  api.assertNoUnexpectedRequests()
})

test('결산 구역 길은 각 제목으로 스크롤과 초점을 옮기고 주소를 유지한다', () => {
  const api = mockApi()
  const pending = deferredResponse()
  api.on('GET', settlementsPath, () => pending.promise)
  api.on('GET', periodsPath, () => pending.promise)
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=closing`)
  render(<FinanceAt view={councilView(COUNCIL_ID)} onForbidden={vi.fn()} />)
  const navigation = screen.getByRole('navigation', { name: '결산 구역' })
  const headings = screen.getAllByRole('heading', { level: 2 })
  expect(
    navigation.compareDocumentPosition(headings[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  for (const label of ['행사 정산', '기간 결산']) {
    const heading = screen.getByRole('heading', { level: 2, name: label })
    const scroll = vi.fn()
    heading.scrollIntoView = scroll
    const link = within(navigation).getByRole('button', { name: label })
    expect(link.className).toContain('max-sm:min-h-11')
    fireEvent.click(link)
    expect(scroll).toHaveBeenCalledWith({ block: 'start' })
    expect(document.activeElement).toBe(heading)
  }
  expect(window.location.pathname + window.location.search + window.location.hash).toBe(
    `/finance/${COUNCIL_ID}?tab=closing`,
  )
  api.assertNoUnexpectedRequests()
})

test.each([
  ['부원', councilView(COUNCIL_ID, { permissions: MEMBER_PERMISSIONS, councilRank: null })],
  [
    '부서장',
    councilView(COUNCIL_ID, {
      permissions: HEAD_PERMISSIONS,
      councilRank: null,
      departments: [{ id: 'd1', name: '기획부', role: null, rank: 'head' }],
    }),
  ],
  ['회장단', councilView(COUNCIL_ID, { permissions: PRESIDENT_PERMISSIONS })],
  [
    '재정부',
    councilView(COUNCIL_ID, {
      permissions: FINANCE_PERMISSIONS,
      councilRank: null,
      departments: [{ id: 'd1', name: '재정부', role: 'finance', rank: 'head' }],
    }),
  ],
] as const)(
  '%s도 같은 세 탭과 행사 정산을 보고 기간 결산 초안만 읽기 권한으로 가른다',
  async (_, view) => {
    const api = mockApi()
    api.on('GET', settlementsPath, () => json(settlements()))
    api.on('GET', periodsPath, () => json(standardPeriods()))
    api.on('GET', closingPath, () => json({ closing: closingFixture() }))
    window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=closing`)
    render(<FinanceAt view={view} onForbidden={vi.fn()} />)
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      '예산 현황',
      '사용 내역',
      '결산',
    ])
    const eventSection = screen.getByRole('region', { name: '행사 정산' })
    expect(await within(eventSection).findByRole('button', { name: '신입생 환영회' })).toBeTruthy()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent),
    ).toEqual(['행사 정산', '기간 결산'])
    const periodSection = screen.getByRole('region', { name: '기간 결산' })
    const canRead = view.permissions.includes('closing.view_draft')
    expect(
      await within(periodSection).findByText(canRead ? '작성 중' : CLOSING_HIDDEN),
    ).toBeTruthy()
    expect(api.calls.some(call => call.path === closingPath)).toBe(canRead)
    api.assertNoUnexpectedRequests()
  },
)

test.each(['기간 결산', '행사 정산'])('%s 불러오기가 실패해도 다른 구역은 보인다', async failed => {
  const api = mockApi()
  api.on('GET', settlementsPath, () =>
    failed === '행사 정산' ? json({}, 500) : json(settlements()),
  )
  api.on('GET', periodsPath, () =>
    failed === '기간 결산' ? json({}, 500) : json(standardPeriods()),
  )
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=closing`)
  render(
    <FinanceAt
      view={councilView(COUNCIL_ID, { permissions: MEMBER_PERMISSIONS })}
      onForbidden={vi.fn()}
    />,
  )
  expect(
    await screen.findByText(failed === '기간 결산' ? PERIODS_LOAD_FAILED : SETTLEMENT_LOAD_FAILED),
  ).toBeTruthy()
  expect(
    await screen.findByText(failed === '기간 결산' ? '신입생 환영회' : CLOSING_HIDDEN),
  ).toBeTruthy()
  api.assertNoUnexpectedRequests()
})

// 구매 칸반(품목 현황)의 내 요청에서 시작한다. 재정부의 기본 보드는 처리 단계라 보드를 주소로 고른다.
function show(view = councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })) {
  window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}?view=mine&board=items`)
  const handlers = { onForbidden: vi.fn() }
  render(<PurchasesAt view={view} {...handlers} />)
  return handlers
}

test('품목 카드에 품목 이름과 진행 상태가 보이고 긴 이름이 칸을 밀어내지 않는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () =>
    list([
      purchaseSummary('a', { status: 'partial' }),
      purchaseSummary('b', { neededBy: null, itemCount: 1, status: 'cancelled' }),
    ]),
  )
  show()
  const card = (await screen.findByRole('heading', { name: '요청 a' })).closest('article')!
  expect(within(card).getByText('구매 준비')).toBeTruthy()
  const second = screen.getByRole('heading', { name: '요청 b' }).closest('article')!
  expect(within(second).getByText('취소')).toBeTruthy()
  expect(screen.getByRole('button', { name: '요청 a' }).className).toContain('wrap-anywhere')
})

test('구매 목록에는 재정 탭이 없다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  show()
  expect((await screen.findAllByText('품목 없음')).length).toBeGreaterThan(0)
  expect(screen.queryByRole('tab', { name: '예산 현황' })).toBeNull()
  expect(screen.queryByRole('tab', { name: '사용 내역' })).toBeNull()
  expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}`)
})

test('사용 내역의 지출·수입 구분은 주소에 남고 해당 목록만 읽는다', async () => {
  const api = mockApi()
  const root = `/api/organizations/${COUNCIL_ID}`
  api.on('GET', `${root}/expenses`, () => json({ expenses: [], truncated: false }))
  api.on('GET', `${root}/fiscal-periods`, () => json(standardPeriods()))
  api.on('GET', `${root}/incomes?period=${CURRENT_PERIOD}`, () =>
    json({ incomes: [], truncated: false }),
  )
  window.history.replaceState(null, '', `/finance/${COUNCIL_ID}?tab=ledger`)
  render(<FinanceAt view={councilView(COUNCIL_ID)} onForbidden={vi.fn()} />)
  await screen.findByText('지출 없음')
  expect(api.calls.some(call => call.path.includes('/incomes'))).toBe(false)
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(screen.getByRole('button', { name: '수입' }))
  await screen.findByText('수입 없음')
  expect(window.location.search).toBe('?tab=ledger&kind=income')
  fireEvent.click(screen.getByRole('tab', { name: '사용 내역' }))
  expect(window.location.search).toBe('?tab=ledger&kind=income')
  fireEvent.click(screen.getByRole('button', { name: '지출' }))
  await screen.findByText('지출 없음')
  expect(window.location.search).toBe('?tab=ledger')
  expect(push).not.toHaveBeenCalled()
})

test('요청 범위는 전체 요청과 내 요청이고 바꾸면 그 보기를 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('all'), () => list([purchaseSummary('z')]))
  show()
  const group = await screen.findByRole('group', { name: '요청 범위' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['전체 요청', '내 요청'])
  fireEvent.click(screen.getByRole('button', { name: '전체 요청' }))
  expect(await screen.findByRole('heading', { name: '요청 z' })).toBeTruthy()
})

test('넘침과 불러오기 실패 문구가 있고 다시 시도로 다시 읽는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', listPath('mine'), () => list([purchaseSummary('a')], true))
  api.on('GET', listPath('all'), () => {
    reads += 1
    return reads === 1 ? json({ error: 'INTERNAL' }, 500) : list([purchaseSummary('b')])
  })
  show()
  expect(await screen.findByText('요청이 많아서 최근 100개만 보여요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '전체 요청' }))
  expect(
    await screen.findByText('구매 요청을 불러오지 못했어요. 연결을 확인해 주세요.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByRole('heading', { name: '요청 b' })).toBeTruthy()
})

test('보기를 바꾸면 이전 보기의 늦은 응답은 버린다', async () => {
  const api = mockApi()
  const slow = deferredResponse()
  api.on('GET', listPath('mine'), () => slow.promise)
  api.on('GET', listPath('all'), () => list([purchaseSummary('전체것')]))
  show()
  fireEvent.click(await screen.findByRole('button', { name: '전체 요청' }))
  await screen.findByRole('heading', { name: '요청 전체것' })
  slow.resolve(list([purchaseSummary('내것')]))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByRole('heading', { name: '요청 내것' })).toBeNull()
})

test('권한 목록에 purchase.request가 없으면 [새 구매 요청]이 없다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  show(councilView(COUNCIL_ID, { permissions: ['council.view'] }))
  await screen.findAllByText('품목 없음')
  expect(screen.queryByRole('button', { name: '새 구매 요청' })).toBeNull()
})

test('목록을 읽다 403이면 학생회를 다시 읽게 한다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => json({ error: 'FORBIDDEN' }, 403))
  const handlers = show()
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
})

test('푸시가 오거나 화면이 다시 보이면 목록을 다시 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list())
  show()
  await screen.findByRole('heading', { name: '요청 a' })
  const reads = () => api.calls.filter(call => call.path === listPath('mine')).length
  const before = reads()
  window.dispatchEvent(new Event(PUSH_ARRIVED_EVENT))
  await waitFor(() => expect(reads()).toBe(before + 1))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(reads()).toBe(before + 2))
})
