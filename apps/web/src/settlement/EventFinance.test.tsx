// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { json, mockApi } from '../test-support/mock-api'
import { event, membership } from '../test-support/workflow-fixtures'
import { expense } from '../expenses/expense-fixtures'
import EventFinance from './EventFinance'
import { financeResponse } from './settlement-fixtures'
import { useEventFinance } from './useEventFinance'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const base = '/api/organizations/o/events/e/finance'
function Harness({ finance }: { finance: boolean }) {
  const state = useEventFinance('o', 'e', true)
  return <EventFinance organizationId="o" eventId="e" finance={finance} viewerMembershipId="mf" events={[event(), event('e2')]} state={state} />
}
function setup(body = financeResponse(), finance = true) {
  const api = mockApi()
  api.on('GET', base, () => json(body))
  render(<Harness finance={finance} />)
  return api
}
const numbers = () => screen.findByRole('region', { name: '행사 재정' })

test('숫자 넷과 정산 조건: 예산이 미정이면 남은 예산이 없고, 금액을 모르는 품목은 지출 예정에서 빼고 알린다', async () => {
  setup(financeResponse({ spent: 50000, planned: 23180, plannedUnknown: 1, missingEvidence: 1, pendingRequests: 1, unrecordedItems: 2 }))
  const region = await numbers()
  for (const text of ['미정', '50,000원', '23,180원', '—', '금액을 모르는 품목 1개 제외']) expect(within(region).getByText(text)).toBeTruthy()
  const checklist = screen.getByRole('region', { name: '정산하려면' })
  for (const text of ['증빙 누락 1건', '검토 대기 요청 1건', '지출로 기록하지 않은 승인 품목 2개', '지출 상세에서 증빙을 올려 주세요.',
    '구매 검토에서 승인하거나 반려해 주세요.', '산 품목은 지출에 연결하고, 사지 않을 품목은 승인을 취소해 주세요.']) {
    expect(within(checklist).getByText(text)).toBeTruthy()
  }
  expect(within(checklist).getByRole('button', { name: '정산 완료' }).hasAttribute('disabled')).toBe(true)
})

test('남은 예산이 0보다 작으면 초과로 빨갛게 보인다', async () => {
  setup(financeResponse({ budget: 30000, spent: 50000, remaining: -20000, version: 1 }))
  expect(within(await numbers()).getByText('20,000원 초과').className).toContain('text-destructive')
})

test('예산을 정하면 받은 숫자로 바꾸고, 비우면 미정으로 보낸다. 저장 버튼은 같은 스키마로 켠다', async () => {
  const api = setup(financeResponse({ spent: 50000 }))
  api.on('POST', `${base}/budget`, call => {
    const { budget, version } = call.body as { budget: number | null; version: number }
    return json(financeResponse({ budget, spent: 50000, remaining: budget === null ? null : budget - 50000, version: version + 1 }))
  })
  const open = async () => {
    fireEvent.click(within(await numbers()).getByRole('button', { name: '예산 정하기' }))
    return screen.findByRole('dialog', { name: '예산 정하기' })
  }
  let dialog = await open()
  const save = () => within(dialog).getByRole('button', { name: '저장' })
  fireEvent.change(within(dialog).getByLabelText('예산(원)'), { target: { value: '-1' } })
  expect(save().hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('예산(원)'), { target: { value: '3000000' } })
  fireEvent.click(save())
  expect(await within(await numbers()).findByText('3,000,000원')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  dialog = await open()
  fireEvent.change(within(dialog).getByLabelText('예산(원)'), { target: { value: '' } })
  fireEvent.click(save())
  expect(await within(await numbers()).findByText('미정')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ version: 0, budget: 3000000 }, { version: 1, budget: null }])
})

test('조건이 맞으면 한 번 더 물은 뒤 정산하고, 정산 완료 표시와 다시 열기를 보여 준다', async () => {
  const settled = { by: { id: 'f', name: '재정 테스터' }, at: '2026-10-09T09:40:00.000Z' }
  const api = setup(financeResponse({ version: 1, budget: 100000, remaining: 100000 }))
  api.on('POST', `${base}/settle`, () => json(financeResponse({ version: 2, budget: 100000, remaining: 100000, settled,
    history: [{ id: 'h1', action: 'settled', actor: settled.by, changes: { budget: 100000, spent: 0, expenseCount: 0 }, reason: null, createdAt: settled.at }] })))
  api.on('POST', `${base}/reopen`, () => json(financeResponse({ version: 3, budget: 100000, remaining: 100000 })))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(within(checklist).getByText('정산을 마치면 이 행사의 지출·예산·증빙 삭제가 잠겨요.')).toBeTruthy()
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  const status = await screen.findByRole('region', { name: '정산 상태' })
  expect(within(status).getByText('10월 9일 · 재정 테스터')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '정산하려면' })).toBeNull()
  for (const name of ['예산 정하기', '지출 기록']) expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.getByText(/정산 완료 · 실제 지출 0원$/)).toBeTruthy()
  fireEvent.click(within(status).getByRole('button', { name: '정산 다시 열기' }))
  expect(within(status).getByText('다시 열면 지출과 예산을 바꿀 수 있어요.')).toBeTruthy()
  const reopen = within(status).getByRole('button', { name: '다시 열기' })
  expect(reopen.hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(status).getByLabelText('다시 여는 사유'), { target: { value: '영수증 빠짐' } })
  fireEvent.click(reopen)
  expect(await screen.findByRole('region', { name: '정산하려면' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => [call.path, call.body])).toEqual([
    [`${base}/settle`, { version: 1, feeIncomeLineId: null }], [`${base}/reopen`, { version: 2, reason: '영수증 빠짐' }]])
})

test('서버가 정산을 거절하면 알리고 새로 불러온다', async () => {
  const api = setup()
  api.on('POST', `${base}/settle`, () => json({ error: 'NOT_READY_TO_SETTLE' }, 409))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(await screen.findByText('아직 정산할 수 없어요. 남은 항목을 확인해 주세요.')).toBeTruthy()
  await waitFor(() => expect(api.calls.filter(call => call.method === 'GET' && call.path === base)).toHaveLength(2))
})

test('재정 권한이 없으면 숫자·조건·지출만 보고, 엑셀은 내려받는다', async () => {
  setup(financeResponse({ missingEvidence: 1 }), false)
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  expect(within(checklist).getByText('증빙 누락 1건')).toBeTruthy()
  expect(within(checklist).queryByText('지출 상세에서 증빙을 올려 주세요.')).toBeNull()
  for (const name of ['예산 정하기', '정산 완료', '지출 기록']) expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.getByRole('button', { name: '엑셀 내려받기' })).toBeTruthy()
})

test('엑셀을 받으면 서버가 준 파일 이름으로 내려받고, 실패하면 알린다', async () => {
  const api = setup()
  const name = '체육대회 정산 2026-10-09.xlsx'
  // jsdom의 Blob은 Node Response 본문으로 읽히지 않아 문자열로 준다.
  api.on('GET', `${base}/export`, () => new Response('xlsx', { headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="settlement.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}` } }))
  // jsdom에는 파일 주소 만들기가 없다.
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:settlement') })
  const revoke = vi.fn()
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revoke })
  const timeouts = vi.spyOn(globalThis, 'setTimeout')
  const clicks: { download: string; href: string }[] = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push({ download: this.download, href: this.getAttribute('href') ?? '' })
  })
  fireEvent.click(await screen.findByRole('button', { name: '엑셀 내려받기' }))
  await waitFor(() => expect(clicks).toEqual([{ download: name, href: 'blob:settlement' }]))
  // 아이폰 Safari는 확인 창에서 누를 때 파일을 읽으므로 주소를 바로 풀지 않는다.
  expect(revoke).not.toHaveBeenCalled()
  expect(timeouts).toHaveBeenCalledWith(expect.any(Function), 40_000)
  api.on('GET', `${base}/export`, () => json({ error: 'EXPORT_TOO_LARGE' }, 409))
  fireEvent.click(screen.getByRole('button', { name: '엑셀 내려받기' }))
  expect(await screen.findByText('지출이 너무 많아 엑셀로 만들 수 없어요.')).toBeTruthy()
})

test('이 행사의 지출 카드를 누르면 상세를 연다', async () => {
  const api = setup(financeResponse({ spent: 10000, expenseCount: 1, missingEvidence: 1 }, { expenses: [expense()] }))
  api.on('GET', '/api/organizations/o/expenses/x1', () => json({ expense: expense() }))
  const list = await screen.findByRole('region', { name: '이 행사의 지출' })
  fireEvent.click(within(list).getByRole('button', { name: '쿠팡' }))
  expect(await screen.findByRole('dialog', { name: '쿠팡 · 10,000원' })).toBeTruthy()
})

test('지출 기록은 이 행사를 미리 고른 채 연다', async () => {
  const api = setup()
  api.on('GET', '/api/organizations/o/members', () => json({ viewer: membership(true), departments: [],
    members: [{ id: 'mf', name: '재정 테스터', title: null, departmentId: 'df' }] }))
  api.on('GET', '/api/organizations/o/purchase-review/linkable-items', () => json({ items: [], truncated: false }))
  fireEvent.click(await screen.findByRole('button', { name: '지출 기록' }))
  const form = await screen.findByRole('dialog', { name: '지출 기록' })
  expect((within(form).getByLabelText('행사') as HTMLSelectElement).value).toBe('e')
})

test('지출이 없으면 안내하고, 불러오지 못하면 다시 시도한다. 긴 사유는 줄을 바꾼다', async () => {
  const api = mockApi()
  api.on('GET', base, () => json({ error: 'X' }, 500))
  render(<Harness finance />)
  expect(await screen.findByText('재정을 불러오지 못했어요.')).toBeTruthy()
  const reason = '가'.repeat(200)
  api.on('GET', base, () => json(financeResponse({ history: [{ id: 'h1', action: 'reopened', actor: { id: 'f', name: '재정 테스터' }, changes: {},
    reason, createdAt: '2026-10-09T09:40:00.000Z' }] })))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('이 행사에 기록된 지출이 없어요')).toBeTruthy()
  expect(screen.getByText(new RegExp(`정산 다시 엶: ${reason}$`)).className).toContain('wrap-anywhere')
})

test('예산 칸은 쉼표를 넣어도 숫자로 저장하고, 숫자가 아닌 글자가 있으면 미정으로 지우지 않고 저장 버튼을 끈다', async () => {
  const api = setup(financeResponse({ budget: 100000, spent: 50000, remaining: 50000, version: 1 }))
  api.on('POST', `${base}/budget`, () => json(financeResponse({ budget: 300000, spent: 50000, remaining: 250000, version: 2 })))
  fireEvent.click(within(await numbers()).getByRole('button', { name: '예산 정하기' }))
  const dialog = await screen.findByRole('dialog', { name: '예산 정하기' })
  const input = within(dialog).getByLabelText('예산(원)') as HTMLInputElement
  expect(input.value).toBe('100,000')
  const save = within(dialog).getByRole('button', { name: '저장' })
  for (const value of ['30만', '1e5', '-1', '3.5']) {
    fireEvent.change(input, { target: { value } })
    expect(save.hasAttribute('disabled'), value).toBe(true)
  }
  fireEvent.change(input, { target: { value: '300,000' } })
  fireEvent.click(save)
  expect(await within(await numbers()).findByText('300,000원')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ version: 1, budget: 300000 }])
})

test('마감한 회계 기간의 행사는 정산 다시 열기 대신 이유를 적는다', async () => {
  setup(financeResponse({ settled: { by: { id: 'f', name: '재정 테스터' }, at: '2026-10-09T05:00:00.000Z' }, version: 2, periodClosed: true }))
  const status = await screen.findByRole('region', { name: '정산 상태' })
  expect(within(status).getByText('마감한 회계 기간의 행사라 정산을 다시 열 수 없어요.')).toBeTruthy()
  expect(within(status).queryByRole('button', { name: '정산 다시 열기' })).toBeNull()
})

const fees = { received: 14000, count: 2, unpaid: 1 }
const feePeriod = { id: 'p1', name: '2999년 1학기', incomes: [{ id: 'l1', name: '학생회비' }, { id: 'l2', name: '행사 참가비' }] }
const feeIncome = { id: 'i1', amount: 14000, period: { id: 'p1', name: '2999년 1학기' }, line: { id: 'l2', name: '행사 참가비' } }
const settledBy = { by: { id: 'f', name: '재정 테스터' }, at: '2026-10-09T09:40:00.000Z' }

test('참가비 묶음: 받은 참가비와 입금 전을 보이고, 정산 전이면 재정 권한자에게 먼저 확인하라고 알린다', async () => {
  setup(financeResponse({ fees, period: feePeriod }))
  const section = await screen.findByRole('region', { name: '참가비' })
  for (const text of ['받은 참가비 14,000원 · 입금 확인 2명', '입금 전 1명', '정산 뒤에는 입금을 확인할 수 없어요. 들어온 돈이면 참가자 탭에서 먼저 확인해 주세요.']) {
    expect(within(section).getByText(text)).toBeTruthy()
  }
})

test('참가비 묶음: 재정 권한이 없으면 안내 없이 숫자만 보고, 참가비가 없는 행사에는 묶음이 없다', async () => {
  setup(financeResponse({ fees, period: feePeriod }), false)
  const section = await screen.findByRole('region', { name: '참가비' })
  expect(within(section).getByText('입금 전 1명')).toBeTruthy()
  expect(within(section).queryByText(/정산 뒤에는/)).toBeNull()
  cleanup()
  setup(financeResponse())
  await numbers()
  expect(screen.queryByRole('region', { name: '참가비' })).toBeNull()
})

test('받은 참가비를 넣을 회계 기간이 없으면 정산 버튼이 꺼지고 해결 방법을 보인다', async () => {
  setup(financeResponse({ fees }))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  expect(within(checklist).getByText('참가비를 넣을 회계 기간이 없어요')).toBeTruthy()
  expect(within(checklist).getByText('예산 화면의 편성 수정에서 이 행사를 회계 기간에 넣어 주세요.')).toBeTruthy()
  expect(within(checklist).getByRole('button', { name: '정산 완료' }).hasAttribute('disabled')).toBe(true)
})

test('정산 확인: 참가비가 들어갈 기간과 잠금을 알리고, 고른 수입 항목으로 정산한 뒤 넣은 수입을 보인다', async () => {
  const api = setup(financeResponse({ fees, period: feePeriod }))
  api.on('POST', `${base}/settle`, () => json(financeResponse({ version: 1, settled: settledBy, fees, period: feePeriod, feeIncome,
    history: [{ id: 'h1', action: 'settled', actor: settledBy.by, changes: { budget: null, spent: 0, expenseCount: 0,
      fee: { amount: 14000, count: 2, period: '2999년 1학기', line: '행사 참가비' } }, reason: null, createdAt: settledBy.at }] })))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  expect(within(checklist).getByText('참가비를 넣을 회계 기간: 2999년 1학기')).toBeTruthy()
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  for (const text of ['받은 참가비 14,000원은 2999년 1학기 수입으로 들어가요.', '정산 뒤에는 입금 확인과 참가비를 바꿀 수 없어요.']) {
    expect(within(checklist).getByText(text)).toBeTruthy()
  }
  expect((within(checklist).getByLabelText('참가비 수입 항목') as HTMLSelectElement).value).toBe('l2')
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(await screen.findByText('14,000원을 2999년 1학기 수입으로 넣었어요.')).toBeTruthy()
  expect(screen.getByText('수입 항목: 행사 참가비')).toBeTruthy()
  expect(screen.getByText(/정산 완료 · 실제 지출 0원 · 참가비 14,000원 → 2999년 1학기 수입$/)).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ version: 0, feeIncomeLineId: 'l2' }])
})

test('정산 확인: 고르지 않음을 고르면 수입 항목 없이 보낸다', async () => {
  const api = setup(financeResponse({ fees, period: feePeriod }))
  api.on('POST', `${base}/settle`, () => json({ error: 'BUDGET_LINE_INVALID' }, 409))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  fireEvent.change(within(checklist).getByLabelText('참가비 수입 항목'), { target: { value: '' } })
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(await screen.findByText('참가비 수입 항목을 다시 골라 주세요.')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ version: 0, feeIncomeLineId: null }])
})

test('정산 확인: 받은 참가비가 없으면 들어갈 수입과 항목 고르기 없이 잠금만 알린다', async () => {
  const api = setup(financeResponse({ fees: { received: 0, count: 0, unpaid: 2 }, period: feePeriod }))
  api.on('POST', `${base}/settle`, () => json(financeResponse({ version: 1, settled: settledBy, fees: { received: 0, count: 0, unpaid: 2 } })))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(within(checklist).getByText('정산 뒤에는 입금 확인과 참가비를 바꿀 수 없어요.')).toBeTruthy()
  expect(within(checklist).queryByText(/수입으로 들어가요/)).toBeNull()
  expect(within(checklist).queryByLabelText('참가비 수입 항목')).toBeNull()
  fireEvent.click(within(checklist).getByRole('button', { name: '정산 완료' }))
  expect(await screen.findByRole('region', { name: '정산 상태' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ version: 0, feeIncomeLineId: null }])
})

test('참가비 수입을 넣은 정산을 다시 열면 그 수입이 취소된다고 알리고, 정산 뒤에는 입금 전 안내를 하지 않는다', async () => {
  setup(financeResponse({ version: 1, settled: settledBy, fees, period: feePeriod, feeIncome }))
  const status = await screen.findByRole('region', { name: '정산 상태' })
  fireEvent.click(within(status).getByRole('button', { name: '정산 다시 열기' }))
  expect(within(status).getByText('다시 열면 참가비 수입 14,000원이 취소되고, 지출과 예산을 바꿀 수 있어요.')).toBeTruthy()
  expect(screen.getByText('입금 전 1명')).toBeTruthy()
  expect(screen.queryByText(/정산 뒤에는 입금을 확인할 수 없어요/)).toBeNull()
})

test('참가비를 넣을 회계 기간 이름이 길면 줄을 바꾼다', async () => {
  setup(financeResponse({ fees, period: { ...feePeriod, name: 'A'.repeat(30) } }))
  const checklist = await screen.findByRole('region', { name: '정산하려면' })
  expect(within(checklist).getByText(`참가비를 넣을 회계 기간: ${'A'.repeat(30)}`).className).toContain('wrap-anywhere')
})
