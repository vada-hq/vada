// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { EVENT_ID } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { withTaskTab } from '@/lib/task-layout'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import TasksPage from './TasksPage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  vi.unstubAllGlobals()
})

function setup(eventId?: string) {
  const api = mockApi()
  const base = `/api/organizations/${COUNCIL_ID}`
  for (const view of ['all', 'mine', 'unassigned'])
    for (const event of ['', '&event=none', `&event=${EVENT_ID}`])
      api.on('GET', `${base}/tasks?view=${view}&status=open${event}`, () =>
        json({ tasks: [], truncated: false }),
      )
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  render(
    <TasksPage
      view={councilView(COUNCIL_ID)}
      eventId={eventId}
      onForbidden={() => {}}
      onChanged={() => {}}
    />,
  )
  return api
}

test('학생회 업무가 기본이고 행사 없는 업무를 서버에서 읽으며 내 업무 탭은 모든 내 업무다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const api = setup()
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['학생회 업무', '내 업무'])
  expect(screen.getByRole('tab', { name: '학생회 업무' }).getAttribute('aria-selected')).toBe(
    'true',
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('view=all&status=open&event=none'))).toBe(
      true,
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: '행사 업무 포함' }))
  await waitFor(() => expect(window.location.search).toBe('?events=include'))
  fireEvent.click(screen.getByRole('tab', { name: '내 업무' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=mine'))
  expect(api.calls.some(call => call.path.endsWith('view=mine&status=open'))).toBe(true)
  expect(withTaskTab('m1', {})).toEqual({ tab: 'mine' })
})

test('행사 업무에는 메뉴 탭과 행사 포함 칩 없이 전체 업무/내 업무 토글과 담당자 없음 칩이 있다', async () => {
  window.history.replaceState(null, '', `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks`)
  const api = setup(EVENT_ID)
  expect(screen.queryByRole('tablist', { name: '업무 보기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '행사 업무 포함' })).toBeNull()
  expect(screen.getByRole('button', { name: '담당자 없음' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '담당자 없음' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks&assignee=none'))
  fireEvent.click(screen.getByRole('button', { name: '내 업무' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks&view=mine&assignee=none'))
  expect(
    api.calls.some(call => call.path.endsWith(`view=mine&status=open&event=${EVENT_ID}`)),
  ).toBe(true)
  expect(api.calls.some(call => call.path.includes('event=none'))).toBe(false)
})

test('행사 개요의 옛 담당자 없음 주소도 칩이 켜져 있고 눌러 해제한다', async () => {
  window.history.replaceState(
    null,
    '',
    `/events/${COUNCIL_ID}/${EVENT_ID}?tab=tasks&view=unassigned`,
  )
  setup(EVENT_ID)
  const chip = screen.getByRole('button', { name: '담당자 없음' })
  expect(chip.getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(chip)
  await waitFor(() => expect(window.location.search).toBe('?tab=tasks'))
  expect(chip.getAttribute('aria-pressed')).toBe('false')
})

test('담당자 없음 칩은 목록 상한 전에 서버에서 거르고 해제하면 전체를 다시 읽는다', async () => {
  window.history.replaceState(null, '', `/tasks/${COUNCIL_ID}`)
  const api = setup()
  const path = `/api/organizations/${COUNCIL_ID}/tasks?view=unassigned&status=open&event=none`
  api.on('GET', path, () =>
    json({
      tasks: [taskDetail({ id: 'late', title: '301번째 담당자 없는 업무', assignee: null })],
      truncated: false,
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '담당자 없음' }))
  await waitFor(() => expect(api.calls.some(call => call.path === path)).toBe(true))
  expect(await screen.findByText('301번째 담당자 없는 업무')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '담당자 없음' }))
  await waitFor(() => expect(window.location.search).toBe(''))
  expect(screen.queryByText('301번째 담당자 없는 업무')).toBeNull()
})
