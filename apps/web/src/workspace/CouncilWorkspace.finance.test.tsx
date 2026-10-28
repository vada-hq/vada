// @vitest-environment jsdom
import { resetAddress } from '@/test-support/address-reset'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { councilView, FINANCE_PERMISSIONS, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { closingFixture } from '@/test-support/closing-fixtures'
import { EVENT_ID, eventDetail, eventSummary } from '@/test-support/event-fixtures'
import { CURRENT_PERIOD, standardPeriods } from '@/test-support/income-fixtures'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import type { Page } from './pages'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}`
const pendingPath = `${base}/purchase-requests?view=pending`
const minePath = `${base}/purchase-requests?view=mine`
const tasksPath = `${base}/tasks?view=mine&status=open`

function open(options: { finance?: boolean; pending?: () => unknown; startPage?: Page } = {}) {
  const api = mockApi()
  const view = councilView(COUNCIL_ID, options.finance ? { permissions: FINANCE_PERMISSIONS } : {})
  api.on('GET', base, () => json(view))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', tasksPath, () => json({ tasks: [], truncated: false }))
  api.on('GET', pendingPath, () => json(options.pending?.() ?? { requests: [], truncated: false }))
  api.on('GET', minePath, () => json({ requests: [], truncated: false }))
  render(<WorkspaceAt startPage={options.startPage ?? 'chat'} />)
  return api
}

const pending =
  (count: number, truncated = false) =>
  () => ({
    requests: Array.from({ length: count }, (_, index) => purchaseSummary(`p${index}`)),
    truncated,
  })

// 재정 결재 대기 배지는 뗐다(DEC-96). 결재 대기는 재정부 홈 첫 카드가 맡는다(DEC-95).
test('재정부에게도 옆 메뉴 재정에 배지가 없고 옆 메뉴가 결재 대기를 읽지 않는다', async () => {
  const api = open({ finance: true, pending: pending(3, true) })
  await screen.findAllByText('재정')
  await waitFor(() => expect(api.calls.some(call => call.path === tasksPath)).toBe(true))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(api.calls.some(call => call.path === pendingPath)).toBe(false)
  const finance = screen.getAllByRole('button', { name: '재정' })[0]!
  expect(finance.textContent).toBe('재정')
})

test('옆 메뉴 재정을 누르면 재정 화면이 열린다', async () => {
  open()
  fireEvent.click((await screen.findAllByRole('button', { name: '재정' }))[0]!)
  expect(await screen.findByRole('tab', { name: '개요' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: '구매 요청' })).toBeNull()
  expect(screen.queryByRole('button', { name: '구매 요청 내기' })).toBeNull()
  expect(screen.getAllByText('재정').length).toBeGreaterThan(0)
})

test('재정부가 요청을 내도 옆 메뉴는 결재 대기를 읽지 않는다', async () => {
  window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}?view=mine`)
  const api = open({ finance: true, pending: pending(2), startPage: 'purchases' })
  api.on('POST', `${base}/purchase-requests`, () => json({ request: purchaseDetail() }, 201))
  fireEvent.click(await screen.findByRole('button', { name: '구매 요청 내기' }))
  fireEvent.change(await screen.findByLabelText('제목'), { target: { value: '테이프' } })
  fireEvent.change(screen.getByLabelText('품목 1 이름'), { target: { value: '테이프' } })
  fireEvent.click(screen.getByRole('button', { name: '내기' }))
  await waitFor(() =>
    expect(
      api.calls.some(call => call.method === 'POST' && call.path.endsWith('/purchase-requests')),
    ).toBe(true),
  )
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(api.calls.some(call => call.path === pendingPath)).toBe(false)
})

test('결산 점검의 행사 줄을 누르면 행사 화면에서 그 행사가 열린다', async () => {
  const api = open({ finance: true, startPage: 'finance' })
  api.on('GET', `${base}/fiscal-periods`, () => json(standardPeriods()))
  api.on('GET', `${base}/fiscal-periods/${CURRENT_PERIOD}/closing`, () =>
    json({
      closing: closingFixture({
        feePending: {
          blocking: [
            { event: { id: EVENT_ID, name: '신입생 환영회' }, depositCount: 1, amount: 1000 },
          ],
          nextPeriod: { eventCount: 0, depositCount: 0, amount: 0 },
        },
      }),
    }),
  )
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}`, () => json({ event: eventDetail() }))
  fireEvent.click(await screen.findByRole('tab', { name: '결산' }))
  fireEvent.click(await screen.findByRole('button', { name: '신입생 환영회' }))
  expect(await screen.findByRole('tab', { name: '개요' })).toBeTruthy()
  expect(screen.queryByRole('tab', { name: '결산' })).toBeNull()
})

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

test('다른 사람이 재정 역할을 주어 화면이 다시 보일 때 학생회를 다시 읽어도 옆 메뉴는 결재 대기를 읽지 않는다', async () => {
  const api = open()
  const viewCalls = () => api.calls.filter(call => call.path === base).length
  await screen.findAllByText('재정')
  await waitFor(() => expect(viewCalls()).toBe(1))

  api.on('GET', base, () => json(councilView(COUNCIL_ID, { permissions: FINANCE_PERMISSIONS })))
  setVisibility('hidden')
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(viewCalls()).toBe(1)

  setVisibility('visible')
  await waitFor(() => expect(viewCalls()).toBe(2))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(api.calls.some(call => call.path === pendingPath)).toBe(false)
})
