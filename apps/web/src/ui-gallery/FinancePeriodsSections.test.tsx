// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { UpdateAccountSchema } from '@vada/contracts'
import { resetAddress } from '@/test-support/address-reset'
import { json, mockApi } from '@/test-support/mock-api'
import { FinancePeriodsSection } from './FinancePeriodsSections'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

test.each([0, 1])('계좌 견본 %i는 실제 계약 검사를 통과해 저장하고 창을 닫는다', async index => {
  const api = mockApi()
  const path =
    '/api/organizations/11111111-1111-4111-8111-111111111111/accounts/22222222-2222-4222-8222-222222222222'
  api.on('POST', path, () => json({}))
  render(<FinancePeriodsSection />)
  fireEvent.click(screen.getAllByRole('button', { name: '고치기' })[index]!)
  const dialog = await screen.findByRole('dialog', { name: '계좌 고치기' })
  fireEvent.click(within(dialog).getByRole('button', { name: '고치기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const sent = api.calls.find(call => call.method === 'POST')
  expect(sent?.path).toBe(path)
  expect(UpdateAccountSchema.safeParse(sent?.body).success).toBe(true)
  api.assertNoUnexpectedRequests()
})
