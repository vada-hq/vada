// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CreateBudgetPeriodRequest } from '@vada/contracts'
import PeriodDialog from './PeriodDialog'
import type { BudgetResult } from './useBudget'

afterEach(() => { cleanup(); vi.useRealTimers() })

test('기본값은 가장 늦은 기간 다음 학기이고, 날짜가 거꾸로면 만들기가 꺼진다', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-10T03:00:00Z'))
  const onCreate = vi.fn(async (_input: CreateBudgetPeriodRequest): Promise<BudgetResult> => ({ ok: false, message: '같은 이름의 회계 기간이 있어요.' }))
  render(<PeriodDialog open periods={[{ endsOn: '2027-02-28' }]} onClose={() => {}} onCreate={onCreate} />)
  const dialog = await screen.findByRole('dialog', { name: '회계 기간 만들기' })
  expect((within(dialog).getByLabelText('이름') as HTMLInputElement).value).toBe('2027년 1학기')
  expect((within(dialog).getByLabelText('시작일') as HTMLInputElement).value).toBe('2027-03-01')
  expect((within(dialog).getByLabelText('끝일') as HTMLInputElement).value).toBe('2027-08-31')
  const create = within(dialog).getByRole('button', { name: '만들기' })
  fireEvent.change(within(dialog).getByLabelText('끝일'), { target: { value: '2027-02-01' } })
  expect(create.hasAttribute('disabled')).toBe(true)
  fireEvent.change(within(dialog).getByLabelText('끝일'), { target: { value: '2027-08-31' } })
  fireEvent.click(create)
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ name: '2027년 1학기', startsOn: '2027-03-01', endsOn: '2027-08-31' }))
  expect(await within(dialog).findByText('같은 이름의 회계 기간이 있어요.')).toBeTruthy()
})
