// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CreateExpenseRequest, ExpenseDetail } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event, membership } from '../test-support/workflow-fixtures'
import { todayInSeoul } from '../purchases/purchase-view'
import ExpenseFormDialog from './ExpenseFormDialog'
import { expense, expenseItem } from './expense-fixtures'
import { budgetPeriod } from '../budget/budget-fixtures'
import type { ExpenseResult } from './useExpenses'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const members = { viewer: membership(true), departments: [], members: [{ id: 'mf', name: '재정 테스터', title: null, departmentId: 'df' },
  { id: 'mp', name: '기획 테스터', title: null, departmentId: 'd' }] }
function setup(initial: ExpenseDetail | null = null,
  onSubmit = vi.fn(async (_input: CreateExpenseRequest): Promise<ExpenseResult> => ({ ok: true, expense: expense() })),
  periods = [budgetPeriod(), budgetPeriod({ id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31',
    operating: [{ id: 'lo2', name: '소모품' }] })]) {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/members', () => json(members))
  api.on('GET', '/api/organizations/o/budget/periods', () => json({ periods }))
  api.on('GET', '/api/organizations/o/purchase-review/linkable-items', () => json({ items: [
    expenseItem({ id: 'i2', productName: '생수', quantity: 3, estimatedUnitPrice: 1000 }),
    expenseItem({ id: 'i3', productName: '현수막', event: { id: 'e2', name: '축제' } })], truncated: false }))
  const onSaved = vi.fn()
  render(<ExpenseFormDialog organizationId="o" viewerMembershipId="mf" events={[event(), event('e2')]} open expense={initial}
    onClose={() => {}} onSubmit={onSubmit} onSaved={onSaved} />)
  return { onSubmit, onSaved }
}
const fill = (dialog: HTMLElement, label: string, value: string) => fireEvent.change(within(dialog).getByLabelText(label), { target: { value } })

test('필수 칸이 맞아야 기록이 켜지고, 상시 운영과 빈 메모는 null로 보낸다', async () => {
  const { onSubmit, onSaved } = setup()
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  const save = within(dialog).getByRole('button', { name: '기록' })
  expect(save.hasAttribute('disabled')).toBe(true)
  fill(dialog, '사용처', ' 다이소 ')
  fill(dialog, '내용', '회의 다과')
  fill(dialog, '금액(원)', '12000')
  expect(save.hasAttribute('disabled')).toBe(false)
  fill(dialog, '금액(원)', '-1')
  expect(save.hasAttribute('disabled')).toBe(true)
  fill(dialog, '금액(원)', '12000')
  fill(dialog, '메모', '   ')
  fireEvent.click(save)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ eventId: null, vendor: ' 다이소 ', description: '회의 다과', amount: 12000,
    paidOn: todayInSeoul(), method: 'council_card', payerMembershipId: 'mf', note: null, itemIds: [], budgetLineId: null }))
  expect(onSaved).toHaveBeenCalledWith(expense())
})

test('행사를 고르면 그 행사의 연결 가능한 품목만 보이고, 행사를 바꾸면 고른 품목을 비운다', async () => {
  const { onSubmit } = setup()
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  expect(within(dialog).queryByRole('region', { name: '연결할 품목' })).toBeNull()
  fill(dialog, '행사', 'e')
  const items = await within(dialog).findByRole('region', { name: '연결할 품목' })
  fireEvent.click(await within(items).findByRole('checkbox', { name: '생수 · 3개 · 예상 3,000원 · 기획 테스터' }))
  expect(within(items).queryByText(/현수막/)).toBeNull()
  fill(dialog, '행사', 'e2')
  expect((await within(dialog).findByRole('checkbox', { name: /현수막/ }) as HTMLInputElement).checked).toBe(false)
  fill(dialog, '행사', 'e')
  expect((within(dialog).getByRole('checkbox', { name: /생수/ }) as HTMLInputElement).checked).toBe(false)
  fireEvent.click(within(dialog).getByRole('checkbox', { name: /생수/ }))
  fill(dialog, '결제한 사람', 'mp')
  fill(dialog, '결제 수단', 'personal')
  fill(dialog, '사용처', '쿠팡')
  fill(dialog, '내용', '생수')
  fill(dialog, '금액(원)', '3000')
  fireEvent.click(within(dialog).getByRole('button', { name: '기록' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e', itemIds: ['i2'], payerMembershipId: 'mp',
    method: 'personal' })))
})

test('수정은 원래 값과 연결 품목을 채우고, 결제한 사람을 소속으로 고른다', async () => {
  const initial = expense({ vendor: '쿠팡', amount: 9800, payer: { id: 'u', name: '기획 테스터' }, payerMembershipId: 'mp',
    items: [expenseItem({ id: 'i1', productName: '박스테이프' })] })
  const { onSubmit } = setup(initial)
  const dialog = await screen.findByRole('dialog', { name: '지출 수정' })
  expect((within(dialog).getByLabelText('사용처') as HTMLInputElement).value).toBe('쿠팡')
  expect((within(dialog).getByLabelText('결제한 사람') as HTMLSelectElement).value).toBe('mp')
  expect((within(dialog).getByRole('checkbox', { name: /박스테이프/ }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(within(dialog).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e', amount: 9800, payerMembershipId: 'mp',
    itemIds: ['i1'] })))
})

test('저장하지 못하면 대화상자 안에 알린다', async () => {
  setup(null, vi.fn(async (): Promise<ExpenseResult> => ({ ok: false, message: '결제한 사람을 학생회 구성원 중에서 골라 주세요.' })))
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  fill(dialog, '사용처', '다이소')
  fill(dialog, '내용', '다과')
  fill(dialog, '금액(원)', '1000')
  fireEvent.click(within(dialog).getByRole('button', { name: '기록' }))
  expect(await within(dialog).findByText('결제한 사람을 학생회 구성원 중에서 골라 주세요.')).toBeTruthy()
})

test('행사를 미리 고르면 그 행사의 품목만 보여 준다', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/members', () => json(members))
  api.on('GET', '/api/organizations/o/purchase-review/linkable-items', () => json({ items: [
    expenseItem({ id: 'i2', productName: '생수' }), expenseItem({ id: 'i3', productName: '현수막', event: { id: 'e2', name: '축제' } })], truncated: false }))
  render(<ExpenseFormDialog organizationId="o" viewerMembershipId="mf" events={[event(), event('e2')]} initialEventId="e2" open expense={null}
    onClose={() => {}} onSubmit={vi.fn()} onSaved={vi.fn()} />)
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  expect((within(dialog).getByLabelText('행사') as HTMLSelectElement).value).toBe('e2')
  expect(await within(dialog).findByText(/^현수막 · /)).toBeTruthy()
  expect(within(dialog).queryByText(/^생수 · /)).toBeNull()
})

test('상시 운영이면 결제일이 든 기간의 운영 항목을 고르고, 결제일이 다른 기간으로 가면 고른 것을 지운다', async () => {
  const { onSubmit } = setup()
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  fill(dialog, '사용처', '다이소')
  fill(dialog, '내용', '회의 다과')
  fill(dialog, '금액(원)', '12000')
  fill(dialog, '결제일', '2026-10-09')
  const pick = await within(dialog).findByLabelText('운영 항목') as HTMLSelectElement
  expect([...pick.options].map(option => option.textContent)).toEqual(['고르지 않음', '회의비'])
  fireEvent.change(pick, { target: { value: 'lo' } })
  fill(dialog, '결제일', '2027-03-02')
  expect((within(dialog).getByLabelText('운영 항목') as HTMLSelectElement).value).toBe('')
  fill(dialog, '결제일', '2026-10-09')
  fireEvent.change(within(dialog).getByLabelText('운영 항목'), { target: { value: 'lo' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '기록' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ eventId: null, paidOn: '2026-10-09', budgetLineId: 'lo' })))
  // 행사를 고르면 운영 항목 칸이 사라지고 null로 보낸다.
  fireEvent.change(within(dialog).getByLabelText('행사'), { target: { value: 'e' } })
  expect(within(dialog).queryByLabelText('운영 항목')).toBeNull()
})

test('기간이 없는 날짜면 운영 항목 칸이 없다', async () => {
  setup()
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  fill(dialog, '결제일', '2025-01-01')
  await waitFor(() => expect(within(dialog).queryByLabelText('운영 항목')).toBeNull())
})

test('상시 운영이고 결제일이 마감한 기간 안이면 알리고 저장을 끄며, 열린 기간 날짜나 행사 지출이면 막지 않는다', async () => {
  setup(null, undefined, [budgetPeriod({ closed: true }), budgetPeriod({ id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' })])
  const dialog = await screen.findByRole('dialog', { name: '지출 기록' })
  fill(dialog, '사용처', '다이소')
  fill(dialog, '내용', '회의 다과')
  fill(dialog, '금액(원)', '12000')
  fill(dialog, '결제일', '2026-10-09')
  expect(await within(dialog).findByText('결제일이 마감한 회계 기간(2026년 2학기) 안이에요.')).toBeTruthy()
  expect(within(dialog).getByRole('button', { name: '기록' }).hasAttribute('disabled')).toBe(true)
  fill(dialog, '결제일', '2027-03-02')
  expect(within(dialog).queryByText(/마감한 회계 기간/)).toBeNull()
  expect(within(dialog).getByRole('button', { name: '기록' }).hasAttribute('disabled')).toBe(false)
  // 행사 지출은 날짜가 아니라 행사 정산이 막는다.
  fill(dialog, '결제일', '2026-10-09')
  fill(dialog, '행사', 'e')
  expect(within(dialog).queryByText(/마감한 회계 기간/)).toBeNull()
  expect(within(dialog).getByRole('button', { name: '기록' }).hasAttribute('disabled')).toBe(false)
})
