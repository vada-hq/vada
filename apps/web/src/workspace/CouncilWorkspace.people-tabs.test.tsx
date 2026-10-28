// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { Action } from '@vada/contracts'
import { resetAddress } from '@/test-support/address-reset'
import {
  councilView,
  FINANCE_PERMISSIONS,
  LEADER_PERMISSIONS,
  MEMBER_PERMISSIONS,
  teamResponse,
} from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { windowHistoryIdle } from '@/lib/use-window-history'

const base = `/api/organizations/${COUNCIL_ID}`
const pathNow = () => window.location.pathname + window.location.search
let api: ReturnType<typeof mockApi>

function show(path: string, permissions: Action[] = FINANCE_PERMISSIONS) {
  window.history.replaceState(null, '', path)
  api = mockApi()
  api.on('GET', base, () => json(councilView(COUNCIL_ID, { permissions })))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
  api.on('GET', `${base}/fee-payments`, () => json({ periods: [], matches: [] }))
  render(<WorkspaceAt startPage="people" />)
  return api
}

afterEach(async () => {
  cleanup()
  api.assertNoUnexpectedRequests()
  await resetAddress()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test.each([{ permissions: FINANCE_PERMISSIONS }, { permissions: LEADER_PERMISSIONS }])(
  '읽기 권한이 있으면 조직 탭 둘과 탭 경로를 보이고 기록 없이 전환한다: %j',
  async ({ permissions }) => {
    show(`/people/${COUNCIL_ID}`, permissions)
    const tabs = await screen.findByRole('tablist', { name: '조직 보기' })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map(tab => tab.textContent),
    ).toEqual(['부서 및 구성원', '납부자 명단'])
    await screen.findByRole('heading', { name: '회장단' })
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.click(within(tabs).getByRole('tab', { name: '납부자 명단' }))
    await screen.findByText('납부자 명단 없음')
    expect(pathNow()).toBe(`/people/${COUNCIL_ID}?tab=fees`)
    expect(screen.getByLabelText('경로').textContent).toContain('조직납부자 명단')
    expect(screen.queryByRole('heading', { name: '회장단' })).toBeNull()
    expect(Boolean(screen.queryByRole('button', { name: '납부자 올리기' }))).toBe(
      permissions.includes('fee_payment.manage'),
    )
    fireEvent.click(within(tabs).getByRole('tab', { name: '부서 및 구성원' }))
    await screen.findByRole('heading', { name: '회장단' })
    expect(pathNow()).toBe(`/people/${COUNCIL_ID}`)
    expect(push).not.toHaveBeenCalled()
  },
)

test.each([`/people/${COUNCIL_ID}`, `/people/${COUNCIL_ID}?tab=fees`])(
  '읽기 권한이 없으면 탭 줄 없이 첫 화면이고 권한 없는 주소를 바꿔 쓴다: %s',
  async path => {
    const push = vi.spyOn(window.history, 'pushState')
    const api = show(path, MEMBER_PERMISSIONS)
    await screen.findByRole('heading', { name: '회장단' })
    await waitFor(() => expect(pathNow()).toBe(`/people/${COUNCIL_ID}`))
    expect(screen.queryByRole('tablist', { name: '조직 보기' })).toBeNull()
    expect(screen.getByLabelText('경로').textContent).toMatch(/조직$/)
    expect(api.calls.some(call => call.path.includes('fee-payments'))).toBe(false)
    expect(push).not.toHaveBeenCalled()
  },
)

test('옛 부서 주소도 첫 조직 탭이다', async () => {
  show(`/departments/${COUNCIL_ID}`)
  expect(
    (await screen.findByRole('tab', { name: '부서 및 구성원' })).getAttribute('aria-selected'),
  ).toBe('true')
  await screen.findByRole('heading', { name: '회장단' })
})

test('옛 재정 납부자 주소를 조직으로 바꾸고 뒤로 가면 이전 화면이다', async () => {
  window.history.replaceState(null, '', `/people/${COUNCIL_ID}`)
  window.history.pushState(null, '', `/finance/${COUNCIL_ID}?tab=fees`)
  const push = vi.spyOn(window.history, 'pushState')
  show(`/finance/${COUNCIL_ID}?tab=fees`)
  await screen.findByText('납부자 명단 없음')
  expect(pathNow()).toBe(`/people/${COUNCIL_ID}?tab=fees`)
  expect(
    (await screen.findByRole('tab', { name: '납부자 명단' })).getAttribute('aria-selected'),
  ).toBe('true')
  expect(push).not.toHaveBeenCalled()
  act(() => window.history.back())
  await act(() => windowHistoryIdle())
  await waitFor(() => expect(pathNow()).toBe(`/people/${COUNCIL_ID}`))
})
