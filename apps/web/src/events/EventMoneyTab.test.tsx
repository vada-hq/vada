// @vitest-environment jsdom
import { useState, type ComponentProps } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { EventAction, EventDetail } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import { budgetWithPeriod } from '@/test-support/budget-fixtures'
import { eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { expenseDetail } from '@/test-support/expense-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { budgetWithoutPeriod } from '@/test-support/budget-fixtures'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { settle } from '@/test-support/settle'
import { COMPLETION_ERRORS, EVENT_LOST, PERMISSION_CHANGED } from '@/lib/messages'
import EventDetailView from './EventDetailView'
import { dayLabel, type EventTab } from './event-view'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// 탭은 주소가 정하는데, 이 시험은 주소 없이 탭만 본다.
function Harness(props: Omit<ComponentProps<typeof EventDetailView>, 'tab' | 'onTab' | 'from'>) {
  const [tab, setTab] = useState<EventTab>('overview')
  return <EventDetailView {...props} tab={tab} onTab={setTab} from={null} />
}

const ORG = '/api/organizations/c1'
const EVENT = `${ORG}/events/e1`
// 서버가 줄 수 있는 조합만 쓴다: 끝난 행사에는 완료, 완료한 행사에는 완료 취소다.
const event = (extra: Partial<EventDetail> = {}, actions?: EventAction[]) =>
  eventDetail(
    { id: 'e1', status: 'ended', ...extra },
    actions ?? [extra.status === 'completed' ? 'event.cancel_completion' : 'event.complete'],
  )

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
    <Harness
      view={councilView('c1', {
        permissions: ['council.view', 'finance.manage', 'purchase.request'],
      })}
      eventId="e1"
      {...handlers}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: '예산·정산' }))
  return { api, handlers, serve: (next: EventDetail) => (current = next) }
}

const button = (name: string) => screen.getByRole('button', { name })
const posts = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'POST')

test('예산·정산 탭이 개요, 업무, 참가 신청 옆에 있고 예산·실제·차이와 예산 항목이 보인다', async () => {
  openMoney()
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    '개요',
    '업무',
    '참가 신청',
    '예산·정산',
  ])
  const text = (await screen.findByText('지출 예산')).closest('dl')?.textContent
  expect(text).toContain('500,000원')
  expect(text).toContain('36,000원')
  expect(text).toContain('464,000원 남았어요')
  expect(text).toContain('40,000원 · 입금 2건')
  const items = screen.getByRole('region', { name: '예산 항목' })
  expect(items.textContent).toContain('간식')
  expect(items.textContent).toContain('지출 36,000원 / 예산 300,000원')
})

test('남은 것은 종류별 수와 대상이고, 환불 대기는 수만 보인다', async () => {
  openMoney(
    event(),
    settlementOf({
      remaining: [{ kind: 'refund_pending', count: 2, targets: [] }],
      actual: { expense: 0, fee: 0, income: 0, depositCount: 3, refundPendingCount: 2 },
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
  expect(dialog.textContent).toContain('끝나지 않은 업무 2개')
  expect(dialog.textContent).toContain(
    '완료하면 이 행사의 지출, 요청, 참가 신청, 입금을 바꿀 수 없어요.',
  )
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
  fireEvent.change(screen.getByLabelText('사유'), { target: { value: '정산 끝' } })
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

test.each([
  'SETTLEMENT_PENDING',
  'EVENT_NOT_ENDED',
  'NO_FISCAL_PERIOD',
  'PERIOD_CLOSED',
  'EVENT_COMPLETED',
])(
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

test('완료 취소는 사유 없이(공백만도) 누르면 보내지 않고 사유 칸 아래에 알린다', async () => {
  const { api } = openMoney(event({ status: 'completed' }))
  api.on('POST', `${EVENT}/cancel-completion`, () => json({ event: event() }))
  fireEvent.click(await screen.findByRole('button', { name: '완료 취소' }))
  const dialog = await screen.findByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: '완료 취소' })
  const reason = within(dialog).getByLabelText('취소 사유')
  expect(dialog.textContent).toContain('완료할 때 모은 참가비 수입도 취소돼요.')
  expect(confirm).toHaveProperty('disabled', false)
  fireEvent.click(confirm)
  expect(within(dialog).getByText('취소 사유를 입력해 주세요')).toBeTruthy()
  expect(reason.getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(reason))
  fireEvent.change(reason, { target: { value: '   ' } })
  fireEvent.click(confirm)
  expect(within(dialog).getByText('취소 사유를 입력해 주세요')).toBeTruthy()
  expect(posts(api)).toHaveLength(0)
  fireEvent.change(reason, { target: { value: '실수' } })
  expect(within(dialog).queryByText('취소 사유를 입력해 주세요')).toBeNull()
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

test('상태가 막은 완료는 버튼 대신 그 이유 한 줄이 보이고, 정산이 끝났어요는 없다', async () => {
  openMoney(event({ status: 'upcoming', blockers: { 'event.complete': 'EVENT_NOT_ENDED' } }, []))
  await screen.findByText('지출 예산')
  expect(screen.queryByRole('button', { name: '완료' })).toBeNull()
  expect(screen.getByText(COMPLETION_ERRORS.EVENT_NOT_ENDED!)).toBeTruthy()
  expect(screen.queryByText('정산이 끝났어요')).toBeNull()
})

test('기간이 공개돼 막힌 완료 취소도 버튼 대신 이유 한 줄이 보인다', async () => {
  const blockers = { 'event.cancel_completion': 'PERIOD_CLOSED' } as const
  openMoney(event({ status: 'completed', blockers }, []))
  await screen.findByText('지출 예산')
  expect(screen.queryByRole('button', { name: '완료 취소' })).toBeNull()
  expect(screen.getByText(COMPLETION_ERRORS.PERIOD_CLOSED!)).toBeTruthy()
})

test('거절 뒤 다시 읽은 행사에서 버튼이 사라져도 거절 문구는 남는다', async () => {
  const { api, serve } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ error: 'SETTLEMENT_PENDING' }, 409))
  await screen.findByText('지출 예산')
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  serve(event({ blockers: { 'event.complete': 'SETTLEMENT_PENDING' } }, []))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '완료' })).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS.SETTLEMENT_PENDING)
})

test('거절 뒤 막힘이 풀려 다시 읽은 행사에 버튼이 되살아나면 낡은 거절 문구를 지운다', async () => {
  const { api, serve } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ error: 'SETTLEMENT_PENDING' }, 409))
  await screen.findByText('지출 예산')
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  serve(event({ blockers: { 'event.complete': 'SETTLEMENT_PENDING' } }, []))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: '완료' })).toBeNull())
  expect(await screen.findByRole('alert')).toBeTruthy()
  serve(event())
  document.dispatchEvent(new Event('visibilitychange'))
  await screen.findByRole('button', { name: '완료' })
  expect(screen.queryByRole('alert')).toBeNull()
})

test('확인을 열어 둔 사이 정산이 다시 생겨 막히면 권한 문구 없이 그 이유로 닫는다', async () => {
  const { handlers, serve } = openMoney()
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  await screen.findByRole('dialog')
  serve(event({ blockers: { 'event.complete': 'SETTLEMENT_PENDING' } }, []))
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS.SETTLEMENT_PENDING)
  expect(handlers.onLost).not.toHaveBeenCalled()
})

test('상태 옆에 마지막 완료·완료 취소 결재의 이름, 날짜, 사람, 사유가 보이고, 결재가 없으면 없다', async () => {
  const approvals = [
    {
      outcome: 'completed',
      by: { id: 'm1', name: '김회장' },
      at: '2026-10-24T03:00:00.000Z',
      reason: null,
    },
    {
      outcome: 'completion_cancelled',
      by: { id: 'm1', name: '김회장' },
      at: '2026-10-25T03:00:00.000Z',
      reason: '금액을 잘못 적음',
    },
  ] as const
  openMoney(event({ approvals: [...approvals] }, []))
  const note = await screen.findByRole('group', { name: '완료 사유' })
  expect(note.textContent).toBe(
    `완료 취소 · ${dayLabel('2026-10-25T03:00:00.000Z')} · 김회장금액을 잘못 적음`,
  )
  cleanup()
  openMoney(event({}, []))
  await screen.findByText('지출 예산')
  expect(screen.queryByLabelText('완료 사유')).toBeNull()
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
    <Harness
      view={councilView('c1')}
      eventId="e1"
      onLost={vi.fn()}
      onForbidden={vi.fn()}
      onChanged={vi.fn()}
      onTasksChanged={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole('tab', { name: '예산·정산' }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('지출 예산')).toBeTruthy()
  expect(button('완료')).toBeTruthy()
})

const reads = (api: ReturnType<typeof mockApi>, path: string) =>
  api.calls.filter(call => call.method === 'GET' && call.path === path).length

test('완료와 완료 취소가 끝나면 부모에게 알려 행사 목록을 다시 읽게 한다', async () => {
  const { api, handlers } = openMoney()
  api.on('POST', `${EVENT}/complete`, () => json({ event: event({ status: 'completed' }) }))
  api.on('POST', `${EVENT}/cancel-completion`, () => json({ event: event() }))
  fireEvent.click(await screen.findByRole('button', { name: '완료' }))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledTimes(1))
  fireEvent.click(await screen.findByRole('button', { name: '완료 취소' }))
  fireEvent.change(screen.getByLabelText('취소 사유'), { target: { value: '실수' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료 취소' }))
  await waitFor(() => expect(handlers.onChanged).toHaveBeenCalledTimes(2))
})

test('정산은 화면이 다시 보일 때 다시 읽는다', async () => {
  const { api } = openMoney()
  await screen.findByText('지출 예산')
  const before = reads(api, `${EVENT}/settlement`)
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(reads(api, `${EVENT}/settlement`)).toBeGreaterThan(before))
})

test('열어 둔 지출을 내가 바꾸면 정산과 행사를 다시 읽는다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/expenses/x1`, () => json({ expense: expenseDetail('x1') }))
  api.on('POST', `${ORG}/expenses/x1/reimburse`, () =>
    json({ expense: expenseDetail('x1', { reimbursed: true }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: /인쇄소 · 36,000원/ }))
  const dialog = await screen.findByRole('dialog')
  const settlementBefore = reads(api, `${EVENT}/settlement`)
  const eventBefore = reads(api, EVENT)
  fireEvent.click(await within(dialog).findByRole('button', { name: '환급함' }))
  const confirm = (await screen.findAllByRole('dialog')).at(-1)!
  fireEvent.click(within(confirm).getByRole('button', { name: '환급함' }))
  await waitFor(() => expect(reads(api, `${EVENT}/settlement`)).toBeGreaterThan(settlementBefore))
  expect(reads(api, EVENT)).toBeGreaterThan(eventBefore)
})

test('열어 둔 지출을 잃으면(404) 정산을 다시 읽는다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/expenses/x1`, () => json({ error: 'NOT_FOUND' }, 404))
  await screen.findByText('지출 예산')
  const before = reads(api, `${EVENT}/settlement`)
  fireEvent.click(await screen.findByRole('button', { name: /인쇄소 · 36,000원/ }))
  await waitFor(() => expect(reads(api, `${EVENT}/settlement`)).toBeGreaterThan(before))
})

const startCancel = async (api: ReturnType<typeof mockApi>, status: number, error: string) => {
  api.on('POST', `${EVENT}/cancel-completion`, () => json({ error }, status))
  fireEvent.click(await screen.findByRole('button', { name: '완료 취소' }))
  fireEvent.change(screen.getByLabelText('취소 사유'), { target: { value: '실수' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '완료 취소' }))
}

test('완료 취소가 409 EVENT_NOT_COMPLETED이면 창을 닫고 문구를 보이며 다시 읽는다', async () => {
  const { api } = openMoney(event({ status: 'completed' }))
  await screen.findByText('지출 예산')
  const before = reads(api, `${EVENT}/settlement`)
  await startCancel(api, 409, 'EVENT_NOT_COMPLETED')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS.EVENT_NOT_COMPLETED)
  await waitFor(() => expect(reads(api, `${EVENT}/settlement`)).toBeGreaterThan(before))
})

test('완료 취소 중 행사가 사라지면(404) 부모가 닫고 이유를 받는다', async () => {
  const { api, handlers } = openMoney(event({ status: 'completed' }))
  await startCancel(api, 404, 'NOT_FOUND')
  await waitFor(() => expect(handlers.onLost).toHaveBeenCalledWith(EVENT_LOST))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('완료 취소 중 권한을 잃으면(403) 학생회를 다시 읽게 하고 이유를 받는다', async () => {
  const { api, handlers } = openMoney(event({ status: 'completed' }))
  await startCancel(api, 403, 'FORBIDDEN')
  await waitFor(() => expect(handlers.onForbidden).toHaveBeenCalled())
  expect(handlers.onLost).toHaveBeenCalledWith(PERMISSION_CHANGED)
})

test('완료 취소 확인을 열어 둔 사이 다른 사람이 이미 취소하면 닫고 문구를 보인다', async () => {
  const { serve } = openMoney(event({ status: 'completed' }))
  fireEvent.click(await screen.findByRole('button', { name: '완료 취소' }))
  await screen.findByRole('dialog')
  serve(event())
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((await screen.findByRole('alert')).textContent).toBe(COMPLETION_ERRORS.EVENT_NOT_COMPLETED)
})

test('예산·정산 탭에서 연 요청 상세에는 예산 탭으로 가기 버튼이 없다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/budget`, () => json(budgetWithoutPeriod()))
  api.on('GET', `${ORG}/purchase-requests/r1`, () =>
    json({ request: purchaseDetail('r1', { actions: ['purchase_request.decide'] }) }),
  )
  fireEvent.click(await screen.findByRole('button', { name: '포스터 인쇄' }))
  await screen.findByRole('dialog')
  await screen.findByText(/회계 기간을 먼저 만들어 주세요/)
  expect(screen.queryByRole('button', { name: '예산 탭으로 가기' })).toBeNull()
})

test('열어 둔 요청을 잃으면(404) 정산을 다시 읽는다', async () => {
  const { api } = openMoney()
  api.on('GET', `${ORG}/purchase-requests/r1`, () => json({ error: 'NOT_FOUND' }, 404))
  await screen.findByText('지출 예산')
  const before = reads(api, `${EVENT}/settlement`)
  fireEvent.click(await screen.findByRole('button', { name: '포스터 인쇄' }))
  await waitFor(() => expect(reads(api, `${EVENT}/settlement`)).toBeGreaterThan(before))
})

test('예산·정산 탭에서 연 요청, 예산 항목, 지출은 행사 칸이 이 행사로 채워지고, 완료한 행사에는 버튼이 없다', async () => {
  const { api } = openMoney(event({ name: '봄 축제' }))
  api.on('GET', `${ORG}/events`, () =>
    json({ events: [eventSummary({ id: 'e1', name: '봄 축제' })], truncated: false }),
  )
  api.on('GET', `${ORG}/budget`, () => json(budgetWithPeriod()))
  api.on('GET', `${ORG}/members`, () => json({ members: [], departments: [] }))
  const select = async () => {
    const field = (await screen.findByLabelText('행사')) as HTMLSelectElement
    await waitFor(() => expect(field.disabled).toBe(false))
    return field
  }
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  expect((await select()).value).toBe('e1')
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  fireEvent.click(screen.getByRole('button', { name: '예산 항목 더하기' }))
  expect((await select()).value).toBe('e1')
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  fireEvent.click(screen.getByRole('button', { name: '지출 적기' }))
  expect((await select()).value).toBe('e1')
})

test('완료한 행사의 예산·정산 탭에는 더하기 버튼이 없다', async () => {
  openMoney(event({ status: 'completed' }, []))
  await screen.findByText('지출 예산')
  expect(screen.queryByRole('button', { name: '지출 적기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '예산 항목 더하기' })).toBeNull()
})
