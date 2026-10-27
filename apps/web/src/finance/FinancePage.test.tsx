// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView, MEMBER_PERMISSIONS } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { PUSH_ARRIVED_EVENT } from '@/lib/service-worker'
import { COUNCIL_ID, FinanceAt } from '@/test-support/finance-at'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}/purchase-requests`
const listPath = (view: string) => `${base}?view=${view}`
const list = (requests = [purchaseSummary('a')], truncated = false) => json({ requests, truncated })

function show(view = councilView(COUNCIL_ID, { permissions: MEMBER_PERMISSIONS })) {
  const handlers = { onForbidden: vi.fn() }
  render(<FinanceAt view={view} {...handlers} />)
  return handlers
}

test('카드에 제목, 상태, 요청한 사람, 필요한 때, 품목 수가 보인다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () =>
    list([
      purchaseSummary('a', { status: 'partial' }),
      purchaseSummary('b', { neededBy: null, itemCount: 1, status: 'cancelled' }),
    ]),
  )
  show()
  const card = (await screen.findByRole('heading', { name: '요청 a' })).closest(
    'div',
  )!.parentElement!
  expect(within(card).getByText('일부 승인')).toBeTruthy()
  expect(card.textContent).toContain('김회장')
  expect(card.textContent).toContain('10월 25일까지 필요')
  expect(card.textContent).toContain('품목 2개')
  const second = screen.getByRole('heading', { name: '요청 b' }).closest('div')!.parentElement!
  expect(second.textContent).not.toContain('필요한 때 없음')
  expect(within(second).getByText('취소')).toBeTruthy()
  // 긴 제목이 칸을 밀어내지 않는다.
  expect(screen.getByRole('button', { name: '요청 a' }).className).toContain('wrap-anywhere')
})

test('탭은 개요, 구매 요청, 지출, 수입, 예산, 행사 정산, 계좌, 결산이다(개요는 모든 운영진)', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  show()
  await screen.findByText('내 구매 요청 없음')
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '개요',
    '구매 요청',
    '지출',
    '수입',
    '예산',
    '행사 정산',
    '계좌',
    '결산',
  ])
})

test('거르기 셋이 있고 바꾸면 그 보기를 읽는다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('pending'), () => list([]))
  api.on('GET', listPath('all'), () => list([purchaseSummary('z')]))
  show()
  const group = await screen.findByRole('group', { name: '구매 요청 거르기' })
  expect(
    within(group)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['내 요청', '결재 대기', '전체'])
  fireEvent.click(screen.getByRole('button', { name: '결재 대기' }))
  expect(await screen.findByText('결재 대기 요청 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '전체' }))
  expect(await screen.findByRole('heading', { name: '요청 z' })).toBeTruthy()
})

test('넘침과 불러오기 실패 문구가 있고 다시 시도로 다시 읽는다', async () => {
  const api = mockApi()
  let reads = 0
  api.on('GET', listPath('mine'), () => list([purchaseSummary('a')], true))
  api.on('GET', listPath('pending'), () => {
    reads += 1
    return reads === 1 ? json({ error: 'INTERNAL' }, 500) : list([])
  })
  show()
  expect(await screen.findByText('요청이 많아서 100개만 보여요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '결재 대기' }))
  expect(
    await screen.findByText('구매 요청을 불러오지 못했어요. 연결을 확인해 주세요.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('결재 대기 요청 없음')).toBeTruthy()
})

test('결재 대기가 넘치면 300개라고 알린다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  api.on('GET', listPath('pending'), () => list([purchaseSummary('a')], true))
  show()
  fireEvent.click(await screen.findByRole('button', { name: '결재 대기' }))
  expect(await screen.findByText('요청이 많아서 300개만 보여요.')).toBeTruthy()
})

test('결재 대기에서 필요한 때가 3일 안이면 임박(노랑), 이미 지났으면 지남(빨강)이다', async () => {
  // 한국 10월 25일 오전. 시각만 고정하고 타이머는 그대로 둔다.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-24T23:30:00Z'))
  try {
    const api = mockApi()
    const requests = [
      purchaseSummary('어제', { neededBy: '2026-10-24' }),
      purchaseSummary('오늘', { neededBy: '2026-10-25' }),
      purchaseSummary('3일 뒤', { neededBy: '2026-10-28' }),
      purchaseSummary('4일 뒤', { neededBy: '2026-10-29' }),
      purchaseSummary('없음', { neededBy: null }),
    ]
    api.on('GET', listPath('mine'), () => list(requests))
    api.on('GET', listPath('pending'), () => list(requests))
    show()
    const markOf = (id: string) => {
      const card = screen
        .getByRole('heading', { name: `요청 ${id}` })
        .closest('div')!.parentElement!
      const badge = within(card).queryByText(/^(임박|지남)$/)
      return badge
        ? `${badge.textContent} ${badge.className.includes('yellow') ? '노랑' : '빨강'}`
        : null
    }
    // 내 요청에는 표시가 없다(재정 역할 부서의 결재 목록에만).
    await screen.findByRole('heading', { name: '요청 3일 뒤' })
    expect(markOf('3일 뒤')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '결재 대기' }))
    await waitFor(() => expect(markOf('3일 뒤')).toBe('임박 노랑'))
    expect(markOf('오늘')).toBe('임박 노랑')
    expect(markOf('어제')).toBe('지남 빨강')
    expect(markOf('4일 뒤')).toBeNull()
    expect(markOf('없음')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('보기를 바꾸면 이전 보기의 늦은 응답은 버린다', async () => {
  const api = mockApi()
  const slow = deferredResponse()
  api.on('GET', listPath('mine'), () => slow.promise)
  api.on('GET', listPath('all'), () => list([purchaseSummary('전체것')]))
  show()
  fireEvent.click(await screen.findByRole('button', { name: '전체' }))
  await screen.findByRole('heading', { name: '요청 전체것' })
  slow.resolve(list([purchaseSummary('내것')]))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(screen.queryByRole('heading', { name: '요청 내것' })).toBeNull()
})

test('권한 목록에 purchase.request가 없으면 [구매 요청 내기]가 없다', async () => {
  const api = mockApi()
  api.on('GET', listPath('mine'), () => list([]))
  show(councilView(COUNCIL_ID, { permissions: ['council.view'] }))
  await screen.findByText('내 구매 요청 없음')
  expect(screen.queryByRole('button', { name: '구매 요청 내기' })).toBeNull()
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
