// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CreateIncomeRequest, IncomeDetail } from '@vada/contracts'
import IncomeFormDialog from './IncomeFormDialog'
import { incomeDetail } from './budget-fixtures'
import type { IncomeResult } from './useIncomes'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T03:00:00Z')) })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const period = { startsOn: '2026-09-01', endsOn: '2027-02-28' }
const lines = [{ id: 'li', name: '학생회비' }, { id: 'lg', name: '지원금' }]
function setup({ income = null, result = { ok: true, income: incomeDetail() }, choices = lines, range = period }: { income?: IncomeDetail | null
  result?: IncomeResult; choices?: { id: string; name: string }[]; range?: typeof period } = {}) {
  const onSubmit = vi.fn(async (_input: CreateIncomeRequest) => result)
  const onSaved = vi.fn()
  render(<IncomeFormDialog open period={range} lines={choices} income={income} onClose={() => {}} onSubmit={onSubmit} onSaved={onSaved} />)
  return { onSubmit, onSaved, dialog: screen.getByRole('dialog', { name: income ? '수입 수정' : '수입 기록' }) }
}
const field = (dialog: HTMLElement, label: string) => within(dialog).getByLabelText(label) as HTMLInputElement
const button = (dialog: HTMLElement, name: string) => within(dialog).getByRole('button', { name })

test('수입을 기록하면 쉼표를 지운 금액과 고른 수입 항목을 보내고, 저장한 수입을 넘긴다', async () => {
  const { onSubmit, onSaved, dialog } = setup()
  expect(field(dialog, '받은 날').value).toBe('2026-10-10')
  expect(button(dialog, '기록').hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '수입 항목'), { target: { value: 'li' } })
  fireEvent.change(field(dialog, '내용'), { target: { value: '2학기 학생회비' } })
  fireEvent.change(field(dialog, '금액(원)'), { target: { value: '750,000' } })
  fireEvent.change(field(dialog, '메모'), { target: { value: '학교 지급' } })
  fireEvent.click(button(dialog, '기록'))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ description: '2학기 학생회비', amount: 750000, receivedOn: '2026-10-10', budgetLineId: 'li',
    note: '학교 지급' }))
  expect(onSaved).toHaveBeenCalledWith(incomeDetail())
})

test('받은 날이 기간 밖이면 안내하고 저장을 끄며, 기본값은 오늘에서 가까운 쪽 끝날이다', () => {
  const { dialog } = setup({ range: { startsOn: '2027-03-01', endsOn: '2027-08-31' } })
  expect(field(dialog, '받은 날').value).toBe('2027-03-01')
  fireEvent.change(field(dialog, '내용'), { target: { value: '학생회비' } })
  fireEvent.change(field(dialog, '금액(원)'), { target: { value: '1000' } })
  expect(button(dialog, '기록').hasAttribute('disabled')).toBe(false)
  fireEvent.change(field(dialog, '받은 날'), { target: { value: '2027-09-01' } })
  expect(within(dialog).getByText('이 기간(2027.3.1 ~ 2027.8.31) 안의 날짜를 골라 주세요.')).toBeTruthy()
  expect(button(dialog, '기록').hasAttribute('disabled')).toBe(true)
})

test('수입 줄이 없으면 항목 고르기를 두지 않고 null로 보내며, 금액이 숫자가 아니면 저장을 끈다', async () => {
  const { onSubmit, dialog } = setup({ choices: [] })
  expect(within(dialog).queryByLabelText('수입 항목')).toBeNull()
  fireEvent.change(field(dialog, '내용'), { target: { value: '후원금' } })
  fireEvent.change(field(dialog, '금액(원)'), { target: { value: '3만' } })
  expect(button(dialog, '기록').hasAttribute('disabled')).toBe(true)
  fireEvent.change(field(dialog, '금액(원)'), { target: { value: '30000원' } })
  fireEvent.click(button(dialog, '기록'))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ description: '후원금', amount: 30000, receivedOn: '2026-10-10', budgetLineId: null, note: null }))
})

test('수정은 원래 값으로 열고 저장이며, 실패하면 문구를 보인다', async () => {
  const { onSubmit, onSaved, dialog } = setup({ income: incomeDetail({ note: '학교 지급' }),
    result: { ok: false, message: '받은 날이 이 회계 기간 밖이에요.' } })
  expect([field(dialog, '수입 항목').value, field(dialog, '내용').value, field(dialog, '받은 날').value, field(dialog, '금액(원)').value,
    field(dialog, '메모').value]).toEqual(['li', '2학기 학생회비', '2026-09-15', '750,000', '학교 지급'])
  fireEvent.change(field(dialog, '수입 항목'), { target: { value: '' } })
  fireEvent.click(button(dialog, '저장'))
  expect(await within(dialog).findByText('받은 날이 이 회계 기간 밖이에요.')).toBeTruthy()
  expect(onSubmit).toHaveBeenCalledWith({ description: '2학기 학생회비', amount: 750000, receivedOn: '2026-09-15', budgetLineId: null, note: '학교 지급' })
  expect(onSaved).not.toHaveBeenCalled()
})
