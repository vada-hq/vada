// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { BudgetPlanResponse } from '@vada/contracts'
import { ClosingChecklist, PeriodStatus } from './PeriodClosing'
import { budgetEventLine, budgetPlan } from './budget-fixtures'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const next = (overrides: Partial<NonNullable<BudgetPlanResponse['closing']['next']>> = {}) =>
  ({ id: 'p2', name: '2027년 1학기', startsOn: '2027-03-01', closed: false, incomes: [], ...overrides })
// 2027.3.5 재정이 마감하고 88,000원을 2027년 1학기로 넘긴 기간
const closedPlan = (closing: Partial<BudgetPlanResponse['closing']> = {}) => budgetPlan({
  period: { ...budgetPlan().period, version: 3, closed: { by: { id: 'f', name: '재정' }, at: '2027-03-04T15:30:00.000Z' } },
  closing: { ...budgetPlan().closing, ended: true, next: next(), carriedOver: { period: { id: 'p2', name: '2027년 1학기' }, amount: 88000 }, ...closing } })
// 끝났고 마감할 수 있는 열린 기간. 남은 돈 88,000원을 넘길 다음 기간에 수입 줄이 둘 있다.
const endedPlan = (overrides: Partial<BudgetPlanResponse> = {}) => budgetPlan({ events: [budgetEventLine({ settled: true })],
  totals: { ...budgetPlan().totals, balance: 88000 },
  closing: { ...budgetPlan().closing, ended: true, next: next({ incomes: [{ id: 'l1', name: '학생회비' }, { id: 'l2', name: '전기 이월금' }] }) },
  ...overrides })

test('마감 상태: 마감한 날·사람과 넘긴 돈을 보이고, 재정 권한자는 사유를 적어야 다시 열 수 있다', async () => {
  const onReopen = vi.fn(async () => ({ ok: true as const, plan: budgetPlan() }))
  render(<PeriodStatus plan={closedPlan()} finance onReopen={onReopen} />)
  const status = screen.getByRole('region', { name: '마감 상태' })
  for (const text of ['마감', '2027.3.5 · 재정', '남은 돈 88,000원을 2027년 1학기 수입으로 넘겼어요.']) expect(within(status).getByText(text)).toBeTruthy()
  fireEvent.click(within(status).getByRole('button', { name: '마감 다시 열기' }))
  expect(within(status).getByText('다시 열면 넘긴 이월금 88,000원이 취소되고, 이 기간의 편성·수입·지출을 바꿀 수 있어요.')).toBeTruthy()
  const reopen = within(status).getByRole('button', { name: '다시 열기' })
  expect(reopen.hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(status).getByLabelText('다시 여는 사유'), { target: { value: '영수증 빠짐' } })
  fireEvent.click(reopen)
  await waitFor(() => expect(onReopen).toHaveBeenCalledWith({ version: 3, reason: '영수증 빠짐' }))
  await waitFor(() => expect(within(status).queryByLabelText('다시 여는 사유')).toBeNull())
})

test('마감 상태: 넘긴 돈이 없으면 그렇게 적고, 다시 열지 못하면 문구를 남긴다', async () => {
  const onReopen = vi.fn(async () => ({ ok: false as const, message: '다음 기간이 마감돼 있어 다시 열 수 없어요.' }))
  render(<PeriodStatus plan={closedPlan({ carriedOver: null })} finance onReopen={onReopen} />)
  const status = screen.getByRole('region', { name: '마감 상태' })
  expect(within(status).getByText('넘긴 돈이 없어요.')).toBeTruthy()
  fireEvent.click(within(status).getByRole('button', { name: '마감 다시 열기' }))
  expect(within(status).getByText('다시 열면 이 기간의 편성·수입·지출을 바꿀 수 있어요.')).toBeTruthy()
  fireEvent.change(within(status).getByLabelText('다시 여는 사유'), { target: { value: '정정' } })
  fireEvent.click(within(status).getByRole('button', { name: '다시 열기' }))
  expect(await within(status).findByText('다음 기간이 마감돼 있어 다시 열 수 없어요.')).toBeTruthy()
  expect(within(status).getByLabelText('다시 여는 사유')).toBeTruthy()
})

test('마감 상태: 다음 기간이 마감됐으면 다시 열기 대신 안내하고, 재정 권한이 없으면 버튼도 안내도 없다', () => {
  render(<PeriodStatus plan={closedPlan({ next: next({ closed: true }) })} finance onReopen={vi.fn()} />)
  expect(screen.getByText('다음 기간(2027년 1학기)이 마감돼 있어 다시 열 수 없어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '마감 다시 열기' })).toBeNull()
  cleanup()
  render(<PeriodStatus plan={closedPlan({ next: next({ closed: true }) })} finance={false} onReopen={vi.fn()} />)
  expect(screen.getByText('남은 돈 88,000원을 2027년 1학기 수입으로 넘겼어요.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '마감 다시 열기' })).toBeNull()
  expect(screen.queryByText(/마감돼 있어 다시 열 수 없어요/)).toBeNull()
})

test('마감하려면: 맞은 조건은 체크로, 안 맞은 조건은 해결 방법과 함께 보이고, 하나라도 안 맞으면 기간 마감이 꺼진다', () => {
  render(<ClosingChecklist plan={endedPlan({ events: [budgetEventLine()] })} onClose={vi.fn()} />)
  const section = screen.getByRole('region', { name: '마감하려면' })
  for (const text of ['앞 기간이 모두 마감됐어요', '정산하지 않은 행사 1개: 체육대회', '행사 재정 탭에서 정산해 주세요.', '남은 돈을 넘길 기간: 2027년 1학기']) {
    expect(within(section).getByText(text)).toBeTruthy()
  }
  expect(within(section).queryByText('앞 기간부터 마감해 주세요.')).toBeNull()
  expect(within(section).getByRole('button', { name: '기간 마감' }).hasAttribute('disabled')).toBe(true)
})

test('마감 확인: 넘어갈 돈과 이월금 수입 항목("이월"이 든 줄이 기본)을 보이고, 그대로 두기로 돌아가며, 고른 대로 보낸다', async () => {
  const onClose = vi.fn(async () => ({ ok: true as const, plan: budgetPlan() }))
  render(<ClosingChecklist plan={endedPlan()} onClose={onClose} />)
  const section = screen.getByRole('region', { name: '마감하려면' })
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  expect(within(section).getByText('마감하면 이 기간의 편성·수입·지출을 바꿀 수 없어요.')).toBeTruthy()
  expect(within(section).getByText('남은 돈 88,000원은 2027년 1학기 수입으로 넘어가요.')).toBeTruthy()
  expect((within(section).getByLabelText('이월금 수입 항목') as HTMLSelectElement).value).toBe('l2')
  fireEvent.click(within(section).getByRole('button', { name: '그대로 두기' }))
  expect(within(section).queryByLabelText('이월금 수입 항목')).toBeNull()
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledWith({ version: 2, carryoverLineId: 'l2' }))
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  fireEvent.change(within(section).getByLabelText('이월금 수입 항목'), { target: { value: '' } })
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  await waitFor(() => expect(onClose).toHaveBeenLastCalledWith({ version: 2, carryoverLineId: null }))
})

test('마감 확인: 남은 돈이 0원이면 수입 항목 없이 넘기는 돈이 없다고 알리고, 마감하지 못하면 문구를 보인다', async () => {
  const onClose = vi.fn(async () => ({ ok: false as const, message: '아직 마감할 수 없어요. 남은 항목을 확인해 주세요.' }))
  render(<ClosingChecklist plan={endedPlan({ totals: { ...budgetPlan().totals, balance: 0 } })} onClose={onClose} />)
  const section = screen.getByRole('region', { name: '마감하려면' })
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  expect(within(section).getByText('남은 돈이 없어 넘기는 돈은 없어요.')).toBeTruthy()
  expect(within(section).queryByLabelText('이월금 수입 항목')).toBeNull()
  fireEvent.click(within(section).getByRole('button', { name: '기간 마감' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledWith({ version: 2, carryoverLineId: null }))
  expect(await within(section).findByText('아직 마감할 수 없어요. 남은 항목을 확인해 주세요.')).toBeTruthy()
})
