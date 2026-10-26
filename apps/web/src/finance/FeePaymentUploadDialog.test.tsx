// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { FeePaymentUploadDialog } from './FeePaymentUploadDialog'
import { json, mockApi } from '@/test-support/mock-api'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const path = '/api/organizations/11111111-1111-4111-8111-111111111111/fee-payments'
function show() {
  const api = mockApi()
  api.on('GET', path.replace('/fee-payments', '/fiscal-periods'), () =>
    json({
      periods: [
        {
          id: 'period-1',
          name: '2026년 1학기',
          startsOn: '2026-01-01',
          endsOn: '2026-06-30',
          current: true,
        },
      ],
    }),
  )
  render(
    <FeePaymentUploadDialog
      councilId="11111111-1111-4111-8111-111111111111"
      onClose={vi.fn()}
      onForbidden={vi.fn()}
      onLost={vi.fn()}
    />,
  )
  return api
}

test('학기를 고르면 회계 기간 날짜를 보내고 직접 입력에서만 날짜 칸을 보인다', async () => {
  const api = show()
  api.on('POST', path, () => json({ added: 1, skipped: 0 }))
  await screen.findByRole('option', { name: '2026년 1학기' })
  fireEvent.change(screen.getByLabelText('학기'), { target: { value: 'period-1' } })
  expect(screen.queryByLabelText('납부 시작일')).toBeNull()
  fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } })
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  await screen.findByText('명단 올리기 완료')
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({
    paidFrom: '2026-01-01',
    paidUntil: '2026-06-30',
    students: '20260001',
  })
})

test('서버가 같은 기간을 알리면 바꾸기 확인 전에는 교체하지 않고, 확인 후에만 명시해서 보낸다', async () => {
  const api = show()
  api.on('POST', path, () => json({ error: 'FEE_PAYMENT_REPLACE_REQUIRED' }, 409))
  await screen.findByRole('option', { name: '2026년 1학기' })
  fireEvent.change(screen.getByLabelText('학기'), { target: { value: 'period-1' } })
  fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } })
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  const confirm = await screen.findByRole('dialog', { name: '납부자 명단 바꾸기' })
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
  api.on('POST', path, () => json({ added: 1, skipped: 0 }))
  fireEvent.click(within(confirm).getByRole('button', { name: '바꾸기' }))
  await waitFor(() => expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(2))
  expect(api.calls.filter(call => call.method === 'POST')[1]?.body).toMatchObject({ replace: true })
})

test('CSV 파일을 기기에서 읽고 이름 없이 학번만 보내며, 직접 입력도 된다', async () => {
  const api = show()
  api.on('POST', path, () => json({ added: 1, skipped: 0 }))
  await screen.findByRole('option', { name: '2026년 1학기' })
  fireEvent.change(screen.getByLabelText('학기'), { target: { value: 'manual' } })
  fireEvent.change(screen.getByLabelText('납부 시작일'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('납부 끝일'), { target: { value: '2029-12-31' } })
  fireEvent.change(screen.getByLabelText('명단 파일'), {
    target: { files: [new File(['이름,학번\n김학생,20260001'], '명단.csv', { type: 'text/csv' })] },
  })
  await waitFor(() =>
    expect(screen.getByLabelText<HTMLTextAreaElement>('학번').value).toBe('20260001'),
  )
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  await screen.findByText('명단 올리기 완료')
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([
    { paidFrom: '2026-01-01', paidUntil: '2029-12-31', students: '20260001' },
  ])
})

test('교체 확인을 닫으면 보내지 않고 입력이 남는다', async () => {
  const api = show()
  api.on('POST', path, () => json({ error: 'FEE_PAYMENT_REPLACE_REQUIRED' }, 409))
  await screen.findByRole('option', { name: '2026년 1학기' })
  fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } })
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  const confirm = await screen.findByRole('dialog', { name: '납부자 명단 바꾸기' })
  fireEvent.click(within(confirm).getAllByRole('button', { name: '닫기' })[0]!)
  expect((await screen.findByLabelText<HTMLTextAreaElement>('학번')).value).toBe('20260001')
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(1)
})

test('학번 열이 없는 파일을 고르면 이전 학번을 비우고 아무것도 보내지 않는다', async () => {
  const api = show()
  await screen.findByRole('option', { name: '2026년 1학기' })
  fireEvent.change(screen.getByLabelText('학번'), { target: { value: '20260001' } })
  fireEvent.change(screen.getByLabelText('명단 파일'), {
    target: { files: [new File(['이름,번호\n김학생,20260002'], '명단.csv')] },
  })
  await screen.findByText('학번 열이 있는 UTF-8 CSV·TSV 파일을 골라 주세요.')
  fireEvent.click(screen.getByRole('button', { name: '올리기' }))
  expect(screen.getByText('학번을 입력해 주세요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(0)
})
