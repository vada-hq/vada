// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Action } from '@vada/contracts'
import { budgetWithPeriod } from '@/test-support/budget-fixtures'
import { councilView } from '@/test-support/council-fixtures'
import { eventDetail } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { EventMoneyAdd } from './EventMoneyAdd'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const ORG = '/api/organizations/c1'
const ALL: Action[] = ['council.view', 'finance.manage', 'purchase.request']

function setup() {
  const api = mockApi()
  api.on('GET', `${ORG}/events`, () => json({ events: [], truncated: false }))
  api.on('GET', `${ORG}/budget`, () => json(budgetWithPeriod()))
  const handlers = { onLost: vi.fn(), onForbidden: vi.fn(), onAdded: vi.fn() }
  const ui = (permissions: Action[], status: 'upcoming' | 'completed') => (
    <EventMoneyAdd
      view={councilView('c1', { permissions })}
      event={eventDetail({ id: 'e1', status })}
      budgetNames={[]}
      {...handlers}
    />
  )
  const view = render(ui(ALL, 'upcoming'))
  return { ...view, ui }
}

test('열어 둔 사이 재정 권한을 잃으면 창이 닫히고, 권한이 돌아와도 다시 열리지 않는다', async () => {
  const { rerender, ui } = setup()
  fireEvent.click(screen.getByRole('button', { name: '예산 편성' }))
  await screen.findByRole('dialog')
  rerender(ui(['council.view', 'purchase.request'], 'upcoming'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  rerender(ui(ALL, 'upcoming'))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('열어 둔 사이 요청 권한을 잃으면 요청 창이 닫힌다', async () => {
  const { rerender, ui } = setup()
  fireEvent.click(screen.getByRole('button', { name: '구매 요청 내기' }))
  await screen.findByRole('dialog')
  rerender(ui(['council.view', 'finance.manage'], 'upcoming'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('열어 둔 사이 행사가 완료되면 창이 닫히고, 완료를 취소해도 다시 열리지 않는다', async () => {
  const { rerender, ui } = setup()
  fireEvent.click(screen.getByRole('button', { name: '지출 적기' }))
  await screen.findByRole('dialog')
  rerender(ui(ALL, 'completed'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  rerender(ui(ALL, 'upcoming'))
  expect(screen.queryByRole('dialog')).toBeNull()
})
