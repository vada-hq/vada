// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { resetAddress } from '@/test-support/address-reset'
import {
  councilView,
  FINANCE_PERMISSIONS,
  HEAD_PERMISSIONS,
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
const list = (
  requests = [purchaseSummary('a')],
  truncated = false,
  stageCounts?: { pending: number; unpaid: number; paid: number; closed: number },
) => json({ requests, truncated, stageCounts })
const show = (view = councilView(COUNCIL_ID)) => {
  const onForbidden = vi.fn()
  render(<PurchasesAt view={view} onForbidden={onForbidden} />)
  return onForbidden
}

test.each([
  ['부원', councilView(COUNCIL_ID, { councilRank: null }), 'all'],
  ['회장', councilView(COUNCIL_ID), 'all'],
  ['부서장', councilView(COUNCIL_ID, { councilRank: null, permissions: HEAD_PERMISSIONS }), 'all'],
  [
    '재정부',
    councilView(COUNCIL_ID, { councilRank: null, permissions: FINANCE_PERMISSIONS }),
    'pending',
  ],
])('%s 기본 보기와 모두에게 열린 결재 대기', async (_, view, filter) => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=${filter}`, () => list())
  api.on('GET', `${base}/purchase-requests?view=pending`, () => list())
  show(view)
  await screen.findByRole('heading', { name: '요청 a' })
  const group = screen.getByRole('group', { name: '구매 요청 거르기' })
  expect(
    within(group)
      .getByRole('button', { name: filter === 'all' ? '전체 요청' : '결재 대기' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  fireEvent.click(within(group).getByRole('button', { name: '결재 대기' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('?view=pending'))).toBe(true),
  )
})

test('명시한 내 요청과 내 부서 보기는 기본값보다 먼저 적용한다', async () => {
  window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}?view=mine`)
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=mine`, () => list())
  api.on('GET', `${base}/purchase-requests?view=department`, () => list([]))
  show(
    councilView(COUNCIL_ID, {
      permissions: [...MEMBER_PERMISSIONS, 'purchase.view_department'],
      departments: [{ id: EVENT_ID, name: '기획부', role: null, rank: 'head' }],
    }),
  )
  await screen.findByRole('heading', { name: '요청 a' })
  fireEvent.click(screen.getByRole('button', { name: '내 부서' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('?view=department'))).toBe(true),
  )
})

test.each([
  ['권한 있음·직급 없음', true, []],
  ['권한 없음·부서장', false, [{ id: EVENT_ID, name: '기획부', role: null, rank: 'head' }]],
  ['권한 없음·부원', false, [{ id: EVENT_ID, name: '기획부', role: null, rank: null }]],
] as const)('내 부서 칩은 서버 권한으로만 표시한다: %s', async (_, allowed, departments) => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  api.on('GET', `${base}/purchase-requests?view=department`, () => list([]))
  show(
    councilView(COUNCIL_ID, {
      councilRank: null,
      permissions: allowed
        ? [...MEMBER_PERMISSIONS, 'purchase.view_department']
        : MEMBER_PERMISSIONS,
      departments: [...departments],
    }),
  )
  await screen.findByRole('heading', { name: '요청 a' })
  const chip = screen.queryByRole('button', { name: '내 부서' })
  expect(chip !== null).toBe(allowed)
  if (chip) {
    fireEvent.click(chip)
    await waitFor(() =>
      expect(api.calls.some(call => call.path.endsWith('?view=department'))).toBe(true),
    )
  }
})

test('권한이 없어도 이미 고른 내 부서 보기는 남긴다', async () => {
  window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}?view=department`)
  mockApi().on('GET', `${base}/purchase-requests?view=department`, () => list([]))
  show(councilView(COUNCIL_ID, { permissions: MEMBER_PERMISSIONS }))
  await screen.findByText('구매 요청 없음')
  expect(screen.getByRole('button', { name: '내 부서' }).getAttribute('aria-pressed')).toBe('true')
})

test('부원도 서버가 돌려준 다른 사람의 요청을 본다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () =>
    list([purchaseSummary('다른 사람', { requestedBy: { id: 'other-member', name: '이요청' } })]),
  )
  show(councilView(COUNCIL_ID, { councilRank: null }))
  expect(await screen.findByRole('heading', { name: '요청 다른 사람' })).toBeTruthy()
})

test('상시·행사 범위는 서버 질의와 주소에 남고 행사 요약과 새 요청에도 이어진다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  api.on('GET', `${base}/purchase-requests?view=all&event=none`, () =>
    list([purchaseSummary('상시')]),
  )
  api.on('GET', `${base}/purchase-requests?view=all&event=${EVENT_ID}`, () =>
    list([purchaseSummary('행사')]),
  )
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  show(councilView(COUNCIL_ID, { councilRank: null }))
  await screen.findByRole('heading', { name: '요청 a' })
  expect(screen.getByRole('button', { name: '예산 현황' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '상시' }))
  await screen.findByRole('heading', { name: '요청 상시' })
  expect(window.location.search).toContain('scope=none')
  fireEvent.click(screen.getByRole('button', { name: '행사별' }))
  fireEvent.change(await screen.findByRole('combobox', { name: '행사' }), {
    target: { value: EVENT_ID },
  })
  await screen.findByRole('heading', { name: '요청 행사' })
  expect(window.location.search).toContain(`scope=${EVENT_ID}`)
  expect(await screen.findByText('500,000원')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '구매 요청 내기' }))
  const eventField = await screen.findByRole('combobox', { name: /행사/ })
  expect((eventField as HTMLSelectElement).value).toBe(EVENT_ID)
})

test('단계 수는 서버 집계를 쓰고 단계 선택은 상한 밖 요청도 서버에서 찾는다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () =>
    list(
      [
        purchaseSummary('대기'),
        purchaseSummary('결제전', {
          status: 'approved',
          progress: { decided: true, paid: false, partlyPaid: true, hasShipment: false },
        }),
        purchaseSummary('결제함', {
          status: 'partial',
          progress: { decided: true, paid: true, partlyPaid: false, hasShipment: true },
        }),
        purchaseSummary('반려', { status: 'rejected' }),
        purchaseSummary('취소', { status: 'cancelled' }),
      ],
      true,
      { pending: 101, unpaid: 1, paid: 1, closed: 2 },
    ),
  )
  api.on('GET', `${base}/purchase-requests?view=all&stage=closed`, () =>
    list(
      [
        purchaseSummary('반려', { status: 'rejected' }),
        purchaseSummary('취소', { status: 'cancelled' }),
      ],
      false,
      { pending: 101, unpaid: 1, paid: 1, closed: 2 },
    ),
  )
  api.on('GET', `${base}/purchase-requests?view=all&stage=paid`, () =>
    list(
      [
        purchaseSummary('상한 밖', {
          status: 'partial',
          progress: { decided: true, paid: true, partlyPaid: false, hasShipment: true },
        }),
      ],
      false,
      { pending: 101, unpaid: 1, paid: 1, closed: 2 },
    ),
  )
  show()
  const stages = await screen.findByRole('group', { name: '구매 단계 거르기' })
  await waitFor(() =>
    expect(within(stages).getByRole('button', { name: '결제 전 1건' })).toBeTruthy(),
  )
  expect(within(stages).getByRole('button', { name: '결재 대기 101건' })).toBeTruthy()
  expect(within(stages).getByRole('button', { name: '결제함 1건' })).toBeTruthy()
  fireEvent.click(within(stages).getByRole('button', { name: '반려·취소 2건' }))
  await screen.findByRole('heading', { name: '요청 반려' })
  expect(screen.queryByRole('heading', { name: '요청 대기' })).toBeNull()
  expect(screen.getByRole('heading', { name: '요청 취소' })).toBeTruthy()
  expect(screen.queryByText('요청이 많아서 100개만 보여요.')).toBeNull()
  fireEvent.click(within(stages).getByRole('button', { name: '결제함 1건' }))
  await screen.findByRole('heading', { name: '요청 상한 밖' })
  expect(window.location.search).toContain('stage=paid')
  expect(screen.getByRole('list', { name: '구매 요청 진행' }).textContent).toContain('송장 등록됨')
  fireEvent.click(within(stages).getByRole('button', { name: '결제함 1건' }))
  await screen.findByRole('heading', { name: '요청 대기' })
  expect(window.location.search).not.toContain('stage=')
})

test('읽기 전·실패는 집계 전, 빈 목록은 0건이다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => json({ error: 'INTERNAL' }, 500))
  show()
  const stages = screen.getByRole('group', { name: '구매 단계 거르기' })
  expect(within(stages).getAllByText('집계 전')).toHaveLength(4)
  await screen.findByRole('button', { name: '다시 시도' })
  expect(within(stages).getAllByText('집계 전')).toHaveLength(4)
  api.on('GET', `${base}/purchase-requests?view=all`, () =>
    list([], false, { pending: 0, unpaid: 0, paid: 0, closed: 0 }),
  )
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(within(stages).getAllByText('0건')).toHaveLength(4))
})

test('집계 없는 잘린 응답은 목록으로 수나 0건을 지어내지 않는다', async () => {
  mockApi().on('GET', `${base}/purchase-requests?view=all`, () =>
    list([purchaseSummary('a')], true),
  )
  show()
  await screen.findByRole('heading', { name: '요청 a' })
  const stages = screen.getByRole('group', { name: '구매 단계 거르기' })
  expect(within(stages).getAllByText('집계 전')).toHaveLength(4)
})
