// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventAction, EventDetail } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { eventDetail } from '@/test-support/event-fixtures'
import { expenseDetail } from '@/test-support/expense-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { settle } from '@/test-support/settle'
import { COMPLETION_ERRORS, EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import EventDetailView from './EventDetailView'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORG = '/api/organizations/c1'
const EVENT = `${ORG}/events/e1`
const COMPLETE: EventAction[] = ['event.complete']

const event = (extra: Partial<EventDetail> = {}, actions: EventAction[] = COMPLETE) =>
  eventDetail({ id: 'e1', ...extra }, actions)

function openMoney(initial: EventDetail = event(), settlement = settlementOf()) {
  const api = mockApi()
  let current = initial
  api.on('GET', EVENT, () => json({ event: current }))
  api.on('GET', `${EVENT}/settlement`, () => json(settlement))
  const handlers = {
    onLost: vi.fn(),
    onForbidden: vi.fn(),
    onChanged: vi.fn(),
    onTasksChanged: vi.fn(),
  }
  render(
    <EventDetailView
      view={councilView('c1', { permissions: ['council.view', 'finance.manage'] })}
      eventId="e1"
      onBack={vi.fn()}
      {...handlers}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: '돈' }))
  return { api, handlers, serve: (next: EventDetail) => (current = next) }
}

const button = (name: string) => screen.getByRole('button', { name })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')

test('돈 탭이 개요, 업무, 참가 신청 옆에 있고 예산·실제·차이와 예산 항목이 보인다', async () => {
  openMoney()
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '개요',
    '업무',
    '참가 신청',
    '돈',
  ])
  const text = (await screen.findByText('지출 예산')).closest('dl')?.textContent
  expect(text).toContain('500,000원')
  expect(text).toContain('36,000원')
  expect(text).toContain('464,000원 남았어요')
  expect(text).toContain('40,000원 · 입금 2건')
  const items = screen.getByRole('region', { name: '예산 항목' })
  expect(items.textContent).toContain('간식')
  expect(items.textContent).toContain('쓴 돈 36,000원 / 예산 300,000원')
})

test('남은 것은 종류별 수와 대상이고, 환불 대기는 수만 보인다', async () => {
  openMoney(
    event(),
    settlementOf({
      remaining: [{ kind: 'refund_pending', count: 2, targets: [] }],
      actual: { expense: 0, fee: 0, depositCount: 3, refundPendingCount: 2 },
    }),
  )
  const region = await screen.findByRole('region', { name: '정산에 남은 것' })
  expect(region.textContent).toContain('환불 대기 신청 2개')
  expect(within(region).queryAllByRole('button')).toHaveLength(0)
  expect(region.textContent).not.toContain('정산이 끝났어요')
})

test('남은 것이 없으면 정산이 끝났어요가 보인다', async () => {
  openMoney(event(), settlementOf({ remaining: [], settled: true }))
  expect(await screen.findByText('정산이 끝났어요')).toBeTruthy()
})

test('남은 것의 지출을 누르면 그 지출이 열린다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/expenses/x1`, () => json({ expense: expenseDetail('x1') }))
  fireEvent.click(await screen.findByRole('button', { name: /인쇄소 · 36,000원/ }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('포스터 인쇄')).toBeTruthy()
})

test('남은 것의 지출을 잃으면(404) 상세를 닫고 이유를 탭 위에 보인다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/expenses/x1`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: /인쇄소 · 36,000원/ }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/이 지출을 볼 수 없어요/)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('actions에 event.complete가 없으면 [완료]가 없다', async () => {
  openMoney(event({}, []))
  await screen.findByText('지출 예산')
  expect(screen.queryByRole('button', { name: '완료' })).toBeNull()
})

test('[완료]는 확인을 거치고 끝나지 않은 업무 수를 알리며, 두 번 눌러도 한 번만 보낸다', async () => {
  const { api } = openMoney()
  const done = event({ status: 'completed' })
  const pending = deferredResponse()
  api.on('POST', `${EVENT}/complete`, () => pending.promise)
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  const dialog = await screen.findByRole('dialog')
  expect(dialog.textContent).toContain('끝나지 않은 업무가 2개 있어요')
  const confirm = within(dialog).getByRole('button', { name: '완료' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(posts(api)).toHaveLength(1))
  expect(posts(api)[0]?.body).toEqual({ reason: null })
  api.on('GET', EVENT, () => json({ event: done }))
  pending.resolve(json({ event: done }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByRole('button', { name: '완료 취소' })).toBeTruthy()
  expect(screen.getByText('완료한 행사라 바꿀 수 없어요.')).toBeTruthy()
  // 완료한 행사는 상태 배지가 '완료'다.
  expect(screen.getAllByText('완료').length).toBeGreaterThan(0)
})

test('완료의 사유 칸은 적으면 그대로 보낸다', async () => {
  const { api } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ event: event({ status: 'completed' }) }))
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  fireEvent.change(screen.getByLabelText('사유 (선택)'), { target: { value: '정산 끝' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '정산 끝' }))
})

test('완료 뒤 정산을 다시 읽는다', async () => {
  const { api } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ event: event({ status: 'completed' }) }))
  await screen.findByText('지출 예산')
  const before = api.calls.filter(call => call.path === `${EVENT}/settlement`).length
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() =>
    expect(api.calls.filter(call => call.path === `${EVENT}/settlement`).length).toBeGreaterThan(
      before,
    ),
  )
})

test.each(['SETTLEMENT_PENDING', 'EVENT_NOT_STARTED', 'NO_FISCAL_PERIOD', 'EVENT_COMPLETED'])(
  '완료가 409 %s이면 확인을 닫고 문구를 버튼 옆에 보이며 행사와 정산을 다시 읽는다',
  async code => {
    const { api } = openMoney()
    api.on('POST', `${EVENT}/complete`, () => json({ error: code }, 409))
    await screen.findByText('지출 예산')
    const reads = () => api.calls.filter(call => call.method === 'GET').length
    const before = reads()
    fireEvent.click(await screen.findByRole('button', { name: '완료' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS[code])
    await waitFor(() => expect(reads()).toBeGreaterThan(before))
  },
)

test('완료 취소는 사유가 꼭 있어야 눌린다', async () => {
  const { api } = openMoney(event({ status: 'completed' }))
  api.on('POST', `${EVENT}/cancel-completion`, () => json({ event: event() }))
  fireEvent.click(await screen.findByRole('button', { name: '완료 취소' }))
  const dialog = await screen.findByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: '완료 취소' })
  expect(confirm).toHaveProperty('disabled', true)
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '   ' } })
  expect(confirm).toHaveProperty('disabled', true)
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '실수' } })
  expect(confirm).toHaveProperty('disabled', false)
  fireEvent.click(confirm)
  await waitFor(() => expect(posts(api)[0]?.body).toEqual({ reason: '실수' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByRole('button', { name: '완료' })).toBeTruthy()
})

test('완료하다 행사가 사라지면(404) 부모가 닫고 이유를 받는다', async () => {
  const { api, handlers } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ error: 'NOT_FOUND' }, 404))
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(handlers.onLost).toHaveBeenCalledWith(EVENT_LOST))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('완료하다 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 받는다', async () => {
  const { api, handlers } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ error: 'FORBIDDEN' }, 403))
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('확인을 열어 둔 사이 다시 읽은 행사에서 권한이 빠지면 닫고 이유를 보인다', async () => {
  const { handlers, serve } = openMoney()
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  await screen.findByRole('dialog')
  serve(event({}, []))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
})

test('확인을 열어 둔 사이 다른 사람이 완료하면 닫고 이미 완료했다고 보인다', async () => {
  const { serve } = openMoney()
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  await screen.findByRole('dialog')
  serve(event({ status: 'completed' }))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS.EVENT_COMPLETED)
  await settle()
})

test('정산을 불러오지 못하면 다시 시도할 수 있다', async () => {
  const api = mockApi()
  api.on('GET', EVENT, () => json({ event: event() }))
  let calls = 0
  api.on('GET', `${EVENT}/settlement`, () => {
    calls += 1
    return calls === 1 ? json({ error: 'INTERNAL' }, 500) : json(settlementOf())
  })
  render(
    <EventDetailView
      view={councilView('c1')}
      eventId="e1"
      onBack={vi.fn()}
      onLost={vi.fn()}
      onForbidden={vi.fn()}
      onChanged={vi.fn()}
      onTasksChanged={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: '돈' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('지출 예산')).toBeTruthy()
  expect(button('완료')).toBeTruthy()
})
