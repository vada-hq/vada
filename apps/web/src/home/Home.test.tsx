// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { HomeItem, HomeResponse, MembershipPermissions } from '@vada/contracts'
import { expense } from '../expenses/expense-fixtures'
import { taskDetail, taskSummary } from '../tasks/task-fixtures'
import Home from './Home'
import { homeEvent, homeResponse, noCounts } from './home-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const leader: MembershipPermissions = { manageOrganization: true, approvePurchases: true, manageEvents: true }
const unassigned: MembershipPermissions = { manageOrganization: false, approvePurchases: false, manageEvents: false }
const overdue: HomeItem = { kind: 'task_overdue', eventId: 'e', task: taskSummary({ id: 't1', event: { id: 'e', name: '체육대회' }, dueOn: '2026-10-09',
  department: { id: 'dp', name: '기획부' } }) }
const pending: HomeItem = { kind: 'purchases_pending', eventId: 'e', count: 3, since: '2026-10-10T00:00:00.000Z' }
const fees: HomeItem = { kind: 'fees_unconfirmed', eventId: 'e', count: 5 }
const noEvidence: HomeItem = { kind: 'expense_no_evidence', eventId: 'e', expense: expense({ id: 'x1', description: '현수막 인쇄' }) }
const busy = homeResponse({ events: [homeEvent({ tasks: { total: 10, done: 6, overdue: 1, unassigned: 0 } })], items: [overdue, pending, noEvidence, fees],
  counts: { ...noCounts(), task_overdue: 1, purchases_pending: 3, expense_no_evidence: 1, fees_unconfirmed: 5 } })

// home 응답을 차례로 돌려준다. 업무·지출 상세도 같이 흉내 낸다.
function serve(...bodies: HomeResponse[]) {
  let call = 0
  const fetcher = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('/home') ? bodies[Math.min(call++, bodies.length - 1)]
    : url.endsWith('/tasks/t1') ? { task: taskDetail({ id: 't1', event: { id: 'e', name: '체육대회' } }) }
    : url.endsWith('/tasks/t1/status') ? { task: taskDetail({ id: 't1', event: { id: 'e', name: '체육대회' }, status: 'done', completedAt: '2026-10-12T03:00:00Z' }) }
    : url.endsWith('/expenses/x1') ? { expense: expense({ id: 'x1', description: '현수막 인쇄' }) } : {} }))
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function show(permissions = leader) {
  const callbacks = { onOpenEvent: vi.fn(), onOpenReview: vi.fn(), onCreateEvent: vi.fn(), onTasksChanged: vi.fn() }
  render(<Home organizationId="o1" permissions={permissions} {...callbacks} />)
  return callbacks
}

test('행사 카드에 상태 칩과 멈춘 일 줄을 보이고, 위에 종류별 수를 보인다', async () => {
  serve(busy)
  show()
  const card = await screen.findByRole('article', { name: '체육대회' })
  expect(within(card).getByText('기획 중')).toBeTruthy()
  expect(within(card).getByText('10.20 (D-8)')).toBeTruthy()
  expect(within(card).getByText('업무 6/10')).toBeTruthy()
  expect(within(card).getByRole('button', { name: /현수막 디자인.*기획부 · 윤태민 · 3일 지남/ })).toBeTruthy()
  expect(within(screen.getByRole('list', { name: '멈춘 일 수' })).getAllByRole('listitem').map(item => item.textContent))
    .toEqual(['지연 업무 1', '구매 승인 대기 3', '증빙 없는 지출 1', '입금 확인 전 5명'])
})

test('줄을 누르면: 업무는 상세를 열고, 구매는 구매 검토로, 입금 확인 전은 참가자 탭으로, 행사 이름은 행사로 간다', async () => {
  serve(busy)
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: /현수막 디자인/ }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /구매 승인 대기 3건/ }))
  expect(callbacks.onOpenReview).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /입금 확인 전 5명/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'e' }), 'registrations')
  fireEvent.click(screen.getByRole('button', { name: '체육대회' }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'e' }))
})

test('미배정은 입금 확인 전을 누르면 재정 탭으로, 구매는 행사 구매 탭으로 간다', async () => {
  serve(busy)
  const callbacks = show(unassigned)
  fireEvent.click(await screen.findByRole('button', { name: /입금 확인 전 5명/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'e' }), 'finance')
  fireEvent.click(screen.getByRole('button', { name: /구매 승인 대기 3건/ }))
  expect(callbacks.onOpenEvent).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'e' }), 'purchases')
  expect(callbacks.onOpenReview).not.toHaveBeenCalled()
})

test('업무 상세에서 상태를 바꾸면 운영 현황과 옆 메뉴 수를 새로 불러와 줄이 사라지고, 지출 줄은 지출 상세를 연다', async () => {
  const cleared = homeResponse({ events: busy.events, items: [pending, noEvidence, fees], counts: { ...busy.counts, task_overdue: 0 } })
  const fetcher = serve(busy, cleared)
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: /현수막 디자인/ }))
  fireEvent.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: '완료' }))
  await waitFor(() => expect(callbacks.onTasksChanged).toHaveBeenCalled())
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/home'))).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: /현수막 디자인/ })).toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /증빙 없음 · 현수막 인쇄/ }))
  expect(await within(await screen.findByRole('dialog')).findByText('현수막 인쇄')).toBeTruthy()
})

test('부서별로 바꾸면 할 차례로 묶고, 멈춘 일이 없는 부서는 그렇게 적는다', async () => {
  serve(busy)
  show()
  fireEvent.click(await screen.findByRole('button', { name: '부서별' }))
  const finance = screen.getByRole('article', { name: '총무부' })
  expect(within(finance).getByRole('button', { name: /구매 승인 대기 3건.*체육대회/ })).toBeTruthy()
  expect(within(screen.getByRole('article', { name: '회장단' })).getByText('멈춘 일이 없어요.')).toBeTruthy()
  expect(within(screen.getByRole('article', { name: '기획부' })).getByText('할 일 0 · 지연 0 · 완료 0')).toBeTruthy()
})

test('행사가 없으면 새 행사를 권하고, 상시 운영 지출만 있으면 그 카드를 보인다', async () => {
  serve(homeResponse())
  const callbacks = show()
  fireEvent.click(await screen.findByRole('button', { name: '새 행사' }))
  expect(callbacks.onCreateEvent).toHaveBeenCalledOnce()
  cleanup()
  serve(homeResponse({ items: [{ ...noEvidence, eventId: null, expense: expense({ id: 'x2', event: null, description: '사무용품' }) }],
    counts: { ...noCounts(), expense_no_evidence: 1 } }))
  show()
  expect(await screen.findByRole('article', { name: '상시 운영 지출' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('멈춘 일이 없으면 그렇게 적고, 잘렸으면 알린다', async () => {
  serve(homeResponse({ events: [homeEvent()] }))
  show()
  expect(await screen.findByText('멈춘 일이 없어요.')).toBeTruthy()
  cleanup()
  serve({ ...busy, truncated: true })
  show()
  expect(await screen.findByText('멈춘 일이 많아 오래된 것부터 일부만 보여요.')).toBeTruthy()
})

test('불러오지 못하면 다시 불러온다', async () => {
  let fail = true
  vi.stubGlobal('fetch', vi.fn(async () => fail ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => busy }))
  show()
  const retry = await screen.findByRole('button', { name: '다시 불러오기' })
  fail = false
  fireEvent.click(retry)
  expect(await screen.findByRole('article', { name: '체육대회' })).toBeTruthy()
})
