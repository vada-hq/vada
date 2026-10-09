// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { SaveBudgetPlanRequest } from '@vada/contracts'
import BudgetPlanForm from './BudgetPlanForm'
import { budgetEventLine, budgetPlan } from './budget-fixtures'
import type { BudgetResult } from './useBudget'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
function setup(plan = budgetPlan(), result: BudgetResult = { ok: true, plan: budgetPlan() }) {
  const onSave = vi.fn(async (_input: SaveBudgetPlanRequest) => result)
  const onCancel = vi.fn()
  render(<BudgetPlanForm plan={plan} onCancel={onCancel} onSave={onSave} />)
  return { onSave, onCancel, form: screen.getByRole('region', { name: '편성 수정' }) }
}
const section = (name: string) => screen.getByRole('region', { name })
const saveButton = () => screen.getByRole('button', { name: '저장' })

test('줄을 더하고 지우면 합계 미리 보기가 바뀌고, 보낸 본문은 화면 순서를 따른다', async () => {
  const { onSave } = setup()
  const incomes = section('수입 예산')
  fireEvent.click(within(incomes).getByRole('button', { name: '수입 추가' }))
  const added = within(incomes).getByRole('listitem', { name: '수입 예산 2' })
  fireEvent.change(within(added).getByLabelText('이름'), { target: { value: '학교 지원금' } })
  expect(saveButton().hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(added).getByLabelText('금액(원)'), { target: { value: '500,000' } })
  const preview = screen.getByRole('region', { name: '합계 미리 보기' })
  for (const text of ['1,300,000원', '400,000원', '900,000원']) expect(within(preview).getByText(text)).toBeTruthy()
  fireEvent.click(saveButton())
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ version: 2, name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28',
    incomes: [{ id: 'li', name: '학생회비', amount: 800000 }, { id: null, name: '학교 지원금', amount: 500000 }],
    operating: [{ id: 'lo', name: '회의비', amount: 100000 }], events: [{ eventId: 'e', version: 1 }] }))
})

test('배정이 수입보다 많으면 배정 안 한 돈을 초과로 보여 준다', () => {
  setup()
  const row = within(section('행사 예산')).getByRole('listitem', { name: '체육대회' })
  fireEvent.change(within(row).getByLabelText('예산(원)'), { target: { value: '900000' } })
  expect(within(screen.getByRole('region', { name: '합계 미리 보기' })).getByText('200,000원 초과').className).toContain('text-destructive')
})

test('지출이 고른 운영 줄은 지울 수 없고 이유를 적는다', () => {
  setup(budgetPlan({ operating: [{ id: 'lo', name: '회의비', amount: 100000, spent: 12000, remaining: 88000, expenseCount: 1 },
    { id: 'lo2', name: '소모품', amount: 50000, spent: 0, remaining: 50000, expenseCount: 0 }] }))
  const operating = section('운영 예산')
  const used = within(operating).getByRole('listitem', { name: '운영 예산 1' })
  expect(within(used).getByRole('button', { name: '지우기' }).hasAttribute('disabled')).toBe(true)
  expect(within(used).getByText('이 항목을 고른 지출이 있어요')).toBeTruthy()
  fireEvent.click(within(within(operating).getByRole('listitem', { name: '운영 예산 2' })).getByRole('button', { name: '지우기' }))
  expect(within(operating).queryByRole('listitem', { name: '운영 예산 2' })).toBeNull()
})

test('행사를 넣고 빼며, 뺀 행사를 다시 넣을 수 있고, 정산된 행사는 예산 칸 없이 보인다', async () => {
  const { onSave } = setup(budgetPlan({ events: [budgetEventLine(), budgetEventLine({ eventId: 'e3', name: '개강총회', budget: 200000, settled: true, version: 2 })] }))
  const events = section('행사 예산')
  const settled = within(events).getByRole('listitem', { name: '개강총회' })
  expect(within(settled).queryByLabelText('예산(원)')).toBeNull()
  expect(within(settled).getByText('정산 완료')).toBeTruthy()
  fireEvent.click(within(within(events).getByRole('listitem', { name: '체육대회' })).getByRole('button', { name: '빼기' }))
  const pick = within(events).getByLabelText('넣을 행사') as HTMLSelectElement
  expect([...pick.options].map(option => option.textContent)).toEqual(['—', '체육대회', '축제'])
  fireEvent.change(pick, { target: { value: 'e2' } })
  fireEvent.click(within(events).getByRole('button', { name: '넣기' }))
  fireEvent.change(within(within(events).getByRole('listitem', { name: '축제' })).getByLabelText('예산(원)'), { target: { value: '100000' } })
  fireEvent.click(saveButton())
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    events: [{ eventId: 'e3', version: 2 }, { eventId: 'e2', version: 0, budget: 100000 }] })))
})

test('저장에 실패하면 문구를 보여 주고, 취소하면 부르는 쪽에 알린다', async () => {
  const { onCancel } = setup(budgetPlan(), { ok: false, message: '다른 회계 기간과 날짜가 겹쳐요.' })
  fireEvent.change(screen.getByLabelText('끝일'), { target: { value: '2027-03-31' } })
  fireEvent.click(saveButton())
  expect(await screen.findByText('다른 회계 기간과 날짜가 겹쳐요.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2027-04-01' } })
  expect(saveButton().hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(onCancel).toHaveBeenCalled()
})
