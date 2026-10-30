// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Action, HomeResponse } from '@vada/contracts'
import { PURCHASE_LOST } from '@/lib/messages'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import { roomList } from '@/test-support/chat-fixtures'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { expenseDetail, expenseSummary } from '@/test-support/expense-fixtures'
import { homeRequest, homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { CURRENT_PERIOD, OLD_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { overviewFixture } from '@/test-support/overview-fixtures'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { accountsResponse } from '@/test-support/account-fixtures'
import type { Page } from './pages'

const base = `/api/organizations/${COUNCIL_ID}`
const R1 = '0199d1a0-0000-7000-8000-00000000b001'
const X1 = '0199d1a0-0000-7000-8000-00000000b101'
const GONE = '0199d1a0-0000-7000-8000-00000000bfff'
const pathNow = () => window.location.pathname + window.location.search
const requestsOf = (view: string) => `${base}/purchase-requests?view=${view}`
// 구매 칸반은 품목 카드의 이름을 눌러 요청을 연다.
const withItem = (id: string) =>
  purchaseSummary(id, {
    itemBriefs: [
      {
        id: `${id}-item`,
        name: `요청 ${id}`,
        quantity: 1,
        estimate: null,
        amount: null,
        status: 'pending',
        paid: false,
        shipped: false,
      },
    ],
  })

let api: ReturnType<typeof mockApi>

function setup(startPage: Page, permissions: Action[] = FINANCE_PERMISSIONS, home?: HomeResponse) {
  api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all&event=${EVENT_ID}`, () =>
    json({
      requests: [],
      truncated: false,
      stageCounts: { pending: 0, unpaid: 0, paid: 0, closed: 0 },
    }),
  )
  onHomeExtras(api, {}, COUNCIL_ID)
  api.on('GET', base, () => json(councilView(COUNCIL_ID, { permissions })))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(home ?? homeResponse()))
  for (const taskScope of ['mine', 'all'])
    api.on(
      'GET',
      `${base}/tasks?view=${taskScope}&status=open${taskScope === 'all' ? '&event=none' : ''}`,
      () => json({ tasks: [], truncated: false }),
    )
  api.on('GET', `${base}/accounts`, () => json(accountsResponse()))
  for (const view of ['mine', 'pending', 'all'])
    api.on('GET', requestsOf(view), () => json({ requests: [withItem(R1)], truncated: false }))
  api.on('GET', `${base}/purchase-requests/${R1}`, () =>
    json({
      request: purchaseDetail(R1, {
        expenses: [
          {
            id: X1,
            vendor: '인쇄소',
            amount: 36000,
            paidAt: '2026-10-20T03:00:00Z',
            cancelled: false,
          },
        ],
      }),
    }),
  )
  api.on('GET', `${base}/expenses`, () =>
    json({ expenses: [expenseSummary(X1, { vendor: '인쇄소' })], truncated: false }),
  )
  api.on('GET', `${base}/expenses/${X1}`, () =>
    json({
      expense: expenseDetail(X1, { event: { id: EVENT_ID, name: '신입생 환영회' } }),
    }),
  )
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/event-settlements`, () =>
    json({
      period: null,
      events: [
        { event: eventSummary({ status: 'ended' }), settlement: { remaining: 1, settled: false } },
      ],
      truncated: false,
    }),
  )
  api.on('GET', `${base}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  // 재정 첫 화면(개요)이 지금 기간의 개요를 읽는다(모든 운영진).
  api.on('GET', `${base}/fiscal-periods`, () => json(standardPeriods()))
  api.on('GET', `${base}/finance-overview?period=${CURRENT_PERIOD}`, () =>
    json({ overview: overviewFixture() }),
  )
  return render(<WorkspaceAt startPage={startPage} />)
}
const startAt = (path: string, page: Page = 'finance', permissions?: Action[]) => {
  window.history.replaceState(null, '', path)
  return setup(page, permissions)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const isSelected = async (name: string) =>
  (await screen.findByRole('tab', { name })).getAttribute('aria-selected') === 'true'
const requestPage = () => screen.findByRole('region', { name: '구매 요청 상세' })
const backFromRequest = async () => {
  fireEvent.click(screen.getByRole('button', { name: '들어온 곳으로 돌아가기' }))
  await waitFor(() => expect(window.location.pathname).not.toMatch(/\/purchases\/[^/]+\//))
  await waitFor(() => expect(screen.queryByRole('region', { name: '구매 요청 상세' })).toBeNull())
  await act(() => windowHistoryIdle())
}
const closeDialog = async (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await act(() => windowHistoryIdle())
}

test('재정 탭 셋이 주소에 남고 기록을 쌓지 않으며 기본은 예산 현황이다', async () => {
  startAt(`/finance/${COUNCIL_ID}`)
  const push = vi.spyOn(window.history, 'pushState')
  const tabs: [string, string][] = [
    ['사용 내역', '?tab=ledger'],
    ['결산', '?tab=closing'],
    ['예산 현황', ''],
  ]
  expect(await isSelected('예산 현황')).toBe(true)
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '예산 현황',
    '사용 내역',
    '결산',
  ])
  for (const [name, search] of tabs) {
    fireEvent.click(await screen.findByRole('tab', { name }))
    await waitFor(() => expect(pathNow()).toBe(`/finance/${COUNCIL_ID}${search}`))
    expect(await isSelected(name)).toBe(true)
  }
  expect(push).not.toHaveBeenCalled()
})

test('옛 계좌 탭 주소는 설정의 계좌로 옮기고 기록을 쌓지 않는다', async () => {
  const push = vi.spyOn(window.history, 'pushState')
  startAt(`/finance/${COUNCIL_ID}?tab=accounts`)
  await waitFor(() => expect(pathNow()).toBe(`/settings/${COUNCIL_ID}?section=accounts`))
  expect(await isSelected('계좌')).toBe(true)
  expect(push).not.toHaveBeenCalled()
})

test('설정 머리 제목은 지금 탭을 따른다', async () => {
  startAt(`/settings/${COUNCIL_ID}?section=accounts`)
  expect(await screen.findByRole('heading', { level: 1, name: '계좌' })).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: '학생회 정보' }))
  expect(await screen.findByRole('heading', { level: 1, name: '학생회 정보' })).toBeTruthy()
})

test('새로 고침하면 주소의 탭이 그대로 열리고, 모르는 탭은 기본 탭으로 읽어 주소를 고쳐 쓴다', async () => {
  startAt(`/finance/${COUNCIL_ID}`)
  expect(await isSelected('예산 현황')).toBe(true)
  cleanup()
  const push = vi.spyOn(window.history, 'pushState')
  startAt(`/finance/${COUNCIL_ID}?tab=nope`)
  expect(await isSelected('예산 현황')).toBe(true)
  await waitFor(() => expect(pathNow()).toBe(`/finance/${COUNCIL_ID}`))
  expect(push).not.toHaveBeenCalled()
})

test.each([
  ['overview', '', '예산 현황'],
  ['budget', 'section=items&', '예산 현황'],
  ['expenses', 'tab=ledger&', '사용 내역'],
  ['incomes', 'tab=ledger&kind=income&', '사용 내역'],
])(
  '옛 %s 주소는 기간을 보존해 새 탭으로 바꿔 쓰고 기록을 쌓지 않는다',
  async (old, query, name) => {
    const push = vi.spyOn(window.history, 'pushState')
    startAt(`/finance/${COUNCIL_ID}?tab=${old}&period=${CURRENT_PERIOD}`)
    api.on('GET', `${base}/incomes?period=${CURRENT_PERIOD}`, () =>
      json({ incomes: [], truncated: false }),
    )
    await waitFor(() =>
      expect(pathNow()).toBe(`/finance/${COUNCIL_ID}?${query}period=${CURRENT_PERIOD}`),
    )
    expect(await isSelected(name)).toBe(true)
    if (old === 'incomes')
      expect(screen.getByRole('button', { name: '수입' }).getAttribute('aria-pressed')).toBe('true')
    expect(push).not.toHaveBeenCalled()
  },
)

test('옛 예산 탭 주소는 항목 부분을 그린 뒤 그곳으로 스크롤한다', async () => {
  const scroll = vi.fn()
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scroll,
  })
  try {
    startAt(`/finance/${COUNCIL_ID}?tab=budget&period=${CURRENT_PERIOD}`)
    const items = await screen.findByRole('region', { name: '예산 항목별 현황' })
    await waitFor(() => expect(scroll.mock.contexts).toContain(items))
    expect(window.location.search).toBe(`?section=items&period=${CURRENT_PERIOD}`)
    fireEvent.click(screen.getByRole('tab', { name: '사용 내역' }))
    expect(window.location.search).not.toContain('section=items')
  } finally {
    if (original) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

test('옛 행사 정산 주소를 결산으로 바꿔 쓰고 행사에서 뒤로 가면 결산으로 돌아온다', async () => {
  const push = vi.spyOn(window.history, 'pushState')
  const replace = vi.spyOn(window.history, 'replaceState')
  startAt(`/finance/${COUNCIL_ID}?tab=settlements`, 'finance', MEMBER_PERMISSIONS)
  expect(await isSelected('결산')).toBe(true)
  await waitFor(() => expect(pathNow()).toBe(`/finance/${COUNCIL_ID}?tab=closing`))
  expect(screen.getByRole('heading', { level: 2, name: '행사 정산' })).toBeTruthy()
  expect(replace.mock.calls.some(call => String(call[2]).endsWith('?tab=closing'))).toBe(true)
  expect(push).not.toHaveBeenCalled()
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  await waitFor(() => expect(pathNow()).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}?tab=money`))
  expect((await screen.findByRole('tab', { name: '구매' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  act(() => window.history.back())
  expect(await isSelected('결산')).toBe(true)
  expect(pathNow()).toBe(`/finance/${COUNCIL_ID}?tab=closing`)
})

test('고른 요청 범위와 보드를 주소에 남긴다', async () => {
  startAt(`/purchases/${COUNCIL_ID}?board=items`)
  const pressed = async (name: string) =>
    (await screen.findByRole('button', { name })).getAttribute('aria-pressed')
  expect(await pressed('전체 요청')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '내 요청' }))
  await waitFor(() => expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?view=mine&board=items`))
  expect(await pressed('내 요청')).toBe('true')
  fireEvent.click(screen.getByRole('tab', { name: '처리 단계' }))
  await waitFor(() => expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?view=mine&board=process`))
})

test('회계 기간이 주소에 남고 새로 고침해도 같은 기간이 열린다', async () => {
  const periods = () => {
    api.on('GET', `${base}/fiscal-periods`, () => json(standardPeriods()))
    for (const period of [CURRENT_PERIOD, OLD_PERIOD])
      api.on('GET', `${base}/incomes?period=${period}`, () =>
        json({ incomes: [], truncated: false }),
      )
  }
  startAt(`/finance/${COUNCIL_ID}?tab=incomes`)
  periods()
  const select = async () => screen.findByLabelText('회계 기간')
  expect(await select()).toHaveProperty('value', CURRENT_PERIOD)
  fireEvent.change(await select(), { target: { value: OLD_PERIOD } })
  await waitFor(() =>
    expect(pathNow()).toBe(`/finance/${COUNCIL_ID}?tab=ledger&kind=income&period=${OLD_PERIOD}`),
  )
  cleanup()
  startAt(pathNow())
  periods()
  expect(await select()).toHaveProperty('value', OLD_PERIOD)
})

test('납부자 명단 권한이 없으면 옛 재정 탭 주소는 조직 첫 화면으로 바꿔 쓴다', async () => {
  const push =
    (startAt(`/finance/${COUNCIL_ID}?tab=fees`, 'finance', MEMBER_PERMISSIONS),
    vi.spyOn(window.history, 'pushState'))
  await screen.findByRole('heading', { name: '회장단' })
  await waitFor(() => expect(pathNow()).toBe(`/people/${COUNCIL_ID}`))
  expect(screen.queryByRole('tab', { name: '납부자 명단' })).toBeNull()
  expect(push).not.toHaveBeenCalled()
})

test('요청을 열면 /purchases 주소로 한 칸 쌓이고, 닫으면 같은 거르기의 목록으로 돌아간다', async () => {
  startAt(`/purchases/${COUNCIL_ID}?view=all&board=items`)
  const push = vi.spyOn(window.history, 'pushState')
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${R1}` }))
  await requestPage()
  await screen.findByRole('heading', { level: 1, name: '행사 포스터 인쇄' })
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}/${R1}`)
  expect(push).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('button', { name: '전체 요청' })).toBeNull()
  await backFromRequest()
  expect(screen.getByRole('button', { name: '전체 요청' }).getAttribute('aria-pressed')).toBe(
    'true',
  )
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?view=all&board=items`)
  expect(screen.queryByRole('tab', { name: '구매 요청' })).toBeNull()
})

test('요청에서 연 지출을 닫으면 그 요청으로 돌아가고, 한 번 더 닫으면 목록이다', async () => {
  startAt(`/purchases/${COUNCIL_ID}?board=items`)
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${R1}` }))
  const request = await requestPage()
  fireEvent.click(await within(request).findByRole('button', { name: /인쇄소/ }))
  await waitFor(() => expect(pathNow()).toBe(`/expenses/${COUNCIL_ID}/${X1}`))
  const expense = await screen.findByRole('dialog', { name: '인쇄소' })
  await closeDialog(expense)
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}/${R1}`)
  await requestPage()
  await screen.findByRole('heading', { level: 1, name: '행사 포스터 인쇄' })
  await backFromRequest()
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?board=items`)
})

test('지출 상세의 행사는 행사 주소로 가는 링크이고, 뒤로 가면 그 지출이다', async () => {
  startAt(`/finance/${COUNCIL_ID}?tab=ledger`)
  fireEvent.click(await screen.findByRole('button', { name: /인쇄소/ }))
  const dialog = await screen.findByRole('dialog', { name: '인쇄소' })
  fireEvent.click(await within(dialog).findByRole('button', { name: '신입생 환영회' }))
  expect(await screen.findByRole('heading', { level: 1, name: '행사' })).toBeTruthy()
  await act(() => windowHistoryIdle())
  expect(pathNow()).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}`)
  act(() => window.history.back())
  expect(await screen.findByRole('dialog', { name: '인쇄소' })).toBeTruthy()
  expect(pathNow()).toBe(`/expenses/${COUNCIL_ID}/${X1}`)
})

test('홈의 받은 것 모두 보기는 처리 단계의 요청 검토로 구매를 연다', async () => {
  window.history.replaceState(null, '', `/home/${COUNCIL_ID}`)
  setup(
    'home',
    FINANCE_PERMISSIONS,
    homeResponse({
      received: { requests: [homeRequest('r1')], total: 50, truncated: true },
    }),
  )
  const section = await screen.findByRole('region', { name: '받은 것' })
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  expect(
    (await screen.findByRole('button', { name: /^요청 검토/ })).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?board=process`)
})

test('행사 돈 탭에서 연 요청에는 예산 탭으로 가는 길이 있고, 닫으면 그 행사의 돈 탭이다', async () => {
  startAt(`/events/${COUNCIL_ID}`, 'events')
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () =>
    json(
      settlementOf({
        remaining: [
          {
            kind: 'unpaid_items',
            count: 1,
            targets: [{ type: 'request', id: R1, title: '포스터 인쇄' }],
          },
        ],
      }),
    ),
  )
  // 행사의 탭은 주소에 있으므로 요청을 닫고 돌아오면 같은 돈 탭이다.
  fireEvent.click(await screen.findByRole('button', { name: /신입생 환영회/ }))
  fireEvent.click(await screen.findByRole('tab', { name: '구매' }))
  // 회계 기간이 없으면 결재할 수 없어 요청 상세가 예산 탭으로 가는 길을 보인다.
  api.on('GET', `${base}/budget`, () => json(budgetWithoutPeriod()))
  api.on('GET', `${base}/purchase-requests/${R1}`, () =>
    json({ request: purchaseDetail(R1, { actions: ['purchase_request.decide'] }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: /포스터 인쇄/ }))
  const dialog = await requestPage()
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}/${R1}`)
  await within(dialog).findByRole('button', { name: '예산 현황으로 가기' })
  await backFromRequest()
  expect(pathNow()).toBe(`/events/${COUNCIL_ID}/${EVENT_ID}?tab=money`)
  // 요청을 바꿨을 수 있으므로 돌아온 돈 탭은 정산을 다시 읽는다.
  await waitFor(() =>
    expect(
      api.calls.filter(call => call.path === `${base}/events/${EVENT_ID}/settlement`).length,
    ).toBeGreaterThan(1),
  )
  expect((await screen.findByRole('tab', { name: '구매' })).getAttribute('aria-selected')).toBe(
    'true',
  )
  // 예산 탭 길은 요청 상세를 닫고 재정 예산 탭을 쌓는다.
  fireEvent.click(await screen.findByRole('button', { name: /포스터 인쇄/ }))
  fireEvent.click(
    await within(await requestPage()).findByRole('button', {
      name: '예산 현황으로 가기',
    }),
  )
  await waitFor(() => expect(pathNow()).toBe(`/finance/${COUNCIL_ID}`))
  expect(await isSelected('예산 현황')).toBe(true)
})

test('열려던 요청이 없거나 다른 학생회의 것이면(서버가 404) 같은 안내를 보이고 보던 목록으로 돌아갈 수 있다', async () => {
  startAt(`/purchases/${COUNCIL_ID}?view=all&board=items`)
  api.on('GET', requestsOf('all'), () => json({ requests: [withItem(GONE)], truncated: false }))
  api.on('GET', `${base}/purchase-requests/${GONE}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: `요청 ${GONE}` }))
  expect((await screen.findByRole('alert')).textContent).toBe(PURCHASE_LOST)
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}/${GONE}`)
  expect(screen.queryByRole('region', { name: '구매 요청 상세' })).toBeNull()
  await backFromRequest()
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}?view=all&board=items`)
  expect(
    (await screen.findByRole('button', { name: '전체 요청' })).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('열려던 지출이 없으면 지출 목록에 남아 안내한다', async () => {
  startAt(`/finance/${COUNCIL_ID}?tab=ledger`)
  api.on('GET', `${base}/expenses`, () =>
    json({ expenses: [expenseSummary(GONE, { vendor: '없는 곳' })], truncated: false }),
  )
  api.on('GET', `${base}/expenses/${GONE}`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '없는 곳' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/지출/)
  await waitFor(() => expect(pathNow()).toBe(`/finance/${COUNCIL_ID}?tab=ledger`))
})

test('지출 적기에 쓰던 입력이 남았으면 새로 고침 때 브라우저 확인을 걸고, 닫으면 푼다', async () => {
  startAt(`/finance/${COUNCIL_ID}?tab=ledger`)
  fireEvent.click(await screen.findByRole('button', { name: '지출 적기' }))
  const dialog = await screen.findByRole('dialog')
  const unloadBlocked = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  expect(unloadBlocked()).toBe(false)
  fireEvent.change(await within(dialog).findByLabelText(/사용처/), { target: { value: '인쇄소' } })
  expect(unloadBlocked()).toBe(true)
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' }).at(-1)!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(unloadBlocked()).toBe(false)
})

test('구매 메뉴는 모두에게 열리고 목록·상세·작성 경로에 구매가 남는다', async () => {
  startAt(`/purchases/${COUNCIL_ID}`, 'purchases', MEMBER_PERMISSIONS)
  await screen.findByRole('button', { name: `요청 ${R1}` })
  const nav = within(screen.getByRole('navigation', { name: '학생회 메뉴' }))
  expect(nav.getByRole('button', { name: '구매' }).getAttribute('aria-current')).toBe('page')
  expect(screen.queryByRole('tab', { name: '구매 요청' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '새 구매 요청' }))
  await screen.findByRole('form', { name: '구매 요청 내기' })
  expect(pathNow()).toBe(`/purchases/${COUNCIL_ID}/new`)
  expect(screen.getByLabelText('경로').textContent).toContain('구매')
})
