// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { homeResponse, onHomeExtras } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { resetWindowHistory, windowHistoryIdle } from '@/lib/use-window-history'
import { MEETING_ID, meetingSample } from '@/meetings/test-support/meeting-samples'
import type { Page } from './pages'

const base = `/api/organizations/${COUNCIL_ID}`
const SECOND = '0199d1a0-0000-7000-8000-0000000000f2'

let api: ReturnType<typeof mockApi>
function setup() {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const first = meeting.agenda[0]!
  meeting.agenda = [first, { ...first, id: SECOND, position: 2, title: '둘째 안건' }]
  api = mockApi()
  onHomeExtras(api, {}, COUNCIL_ID)
  api.on('GET', base, () => json(councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () => json(roomList()))
  api.on('GET', `${base}/home`, () => json(homeResponse()))
  api.on('GET', `${base}/meetings/${MEETING_ID}`, () => json({ meeting }))
  api.on('POST', `${base}/meetings/${MEETING_ID}/agenda/${first.id}`, () =>
    json({ error: 'FAILED' }, 500),
  )
  window.history.replaceState(null, '', `/meetings/${COUNCIL_ID}/${MEETING_ID}?mode=minutes`)
  return render(<WorkspaceAt startPage={'meetings' satisfies Page} />)
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  resetLeaveGuard()
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  resetLeaveGuard()
  window.history.replaceState(null, '', '/')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('회의록에서 안건을 바꿔도 회의 화면을 새로 열지 않아 저장 못 한 초안이 남는다', async () => {
  setup()
  const notes = await screen.findByLabelText<HTMLTextAreaElement>('논의 내용')
  fireEvent.change(notes, { target: { value: '저장 못 한 글' } })
  fireEvent.click(screen.getAllByRole('button', { name: /둘째 안건/ })[0]!)
  await waitFor(() => expect(window.location.search).toContain(`agenda=${SECOND}`))
  await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(1))
  await act(async () => {})
  const reads = api.calls.filter(c => c.method === 'GET' && c.path.endsWith(MEETING_ID))
  expect(reads).toHaveLength(1)
  fireEvent.click(screen.getAllByRole('button', { name: /부서별 준비 상황/ })[0]!)
  expect((await screen.findByLabelText<HTMLTextAreaElement>('논의 내용')).value).toBe(
    '저장 못 한 글',
  )
})
