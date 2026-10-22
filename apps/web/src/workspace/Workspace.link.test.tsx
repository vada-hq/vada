// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { councilView, myCouncil, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { homeResponse } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import Workspace from './Workspace'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const R1 = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function props(councils: ReturnType<typeof myCouncil>[]) {
  return {
    councils,
    chatLink: { councilId: 'c1', requestId: R1, seq: 0 },
    user: { name: '김회장' },
    logoutBusy: false,
    onLogout: () => {},
    onCouncilsChanged: () => {},
    onCouncilLost: () => {},
  }
}

test('링크로 연 학생회를 잃어 다른 학생회로 넘어가면 그 요청은 열리지 않는다', async () => {
  const api = mockApi()
  for (const id of ['c1', 'c2']) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(roomList()))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    api.on('GET', `/api/organizations/${id}/tasks?view=mine&status=open`, () =>
      json({ tasks: [], truncated: false }),
    )
    api.on('GET', `/api/organizations/${id}/purchase-requests?view=mine`, () =>
      json({ requests: [], truncated: false }),
    )
    api.on('GET', `/api/organizations/${id}/purchase-requests/${R1}`, () =>
      json({ request: purchaseDetail(R1, { title: '테이프 구매' }) }),
    )
  }
  const both = [myCouncil('c1'), myCouncil('c2', '다른 학생회')]
  const { rerender } = render(<Workspace {...props(both)} />)
  await waitFor(() =>
    expect(within(screen.getByRole('dialog')).getByText('테이프 구매')).toBeTruthy(),
  )
  rerender(<Workspace {...props([both[1]!])} />)
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(
    api.calls.some(call => call.path.startsWith('/api/organizations/c2/purchase-requests')),
  ).toBe(false)
})
