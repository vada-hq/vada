// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { IncomeDetail } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import IncomeDetailDialog from './IncomeDetailDialog'
import { incomeDetail } from './budget-fixtures'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const detail = '/api/organizations/o/budget/periods/p1/incomes/i1'
function setup(initial: IncomeDetail = incomeDetail(), finance = true) {
  const api = mockApi()
  api.on('GET', detail, () => json({ income: initial }))
  const onChanged = vi.fn()
  const onEdit = vi.fn()
  render(<IncomeDetailDialog organizationId="o" periodId="p1" incomeId="i1" finance={finance} onClose={() => {}} onChanged={onChanged} onEdit={onEdit} />)
  return { api, onChanged, onEdit }
}

test('상세는 받은 날·수입 항목·메모·기록한 사람·처리 기록을 보여 주고, 재정 권한자는 수정을 연다', async () => {
  const { onEdit } = setup(incomeDetail({ note: '학교 지급' }))
  const dialog = await screen.findByRole('dialog', { name: '2학기 학생회비 · 750,000원' })
  for (const text of ['받은 날 2026-09-15', '학생회비', '학교 지급', '재정']) expect(within(dialog).getAllByText(text).length).toBeGreaterThan(0)
  expect(within(dialog).getByText(/^재정 · .+ · 기록$/)).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '수정' }))
  expect(onEdit).toHaveBeenCalledWith(incomeDetail({ note: '학교 지급' }))
})

test('수입을 취소하면 사유를 보내고, 취소됨을 보이며 버튼을 감추고 바뀌었다고 알린다', async () => {
  const { api, onChanged } = setup()
  const bodies: unknown[] = []
  api.on('POST', `${detail}/void`, call => {
    bodies.push(call.body)
    return json({ income: incomeDetail({ version: 2, voided: { by: { id: 'f', name: '재정' }, at: '2026-10-10T03:00:00.000Z', reason: '중복 입금' } }) })
  })
  const dialog = await screen.findByRole('dialog', { name: '2학기 학생회비 · 750,000원' })
  fireEvent.click(within(dialog).getByRole('button', { name: '수입 취소' }))
  expect(within(dialog).getByRole('button', { name: '취소하기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '중복 입금' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '취소하기' }))
  expect(await within(dialog).findByText('취소됨 · 재정 · 중복 입금')).toBeTruthy()
  expect(bodies).toEqual([{ version: 1, reason: '중복 입금' }])
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(within(dialog).queryByRole('button', { name: '수정' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
})

test('재정 권한이 없으면 수정·취소 버튼이 없다', async () => {
  setup(incomeDetail(), false)
  const dialog = await screen.findByRole('dialog', { name: '2학기 학생회비 · 750,000원' })
  expect(within(dialog).queryByRole('button', { name: '수정' })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: '수입 취소' })).toBeNull()
})
