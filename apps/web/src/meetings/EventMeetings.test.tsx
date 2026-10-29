// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { json, mockApi } from '@/test-support/mock-api'
import { EventMeetings } from './EventMeetings'
import { MEETING_COUNCIL, MEETING_ID, meetingSample } from './test-support/meeting-samples'

const EVENT = '0199d1a0-0000-7000-8000-0000000000e1'
const read = `/api/organizations/${MEETING_COUNCIL}/meetings?view=council&event=${EVENT}`
let api: ReturnType<typeof mockApi>
const forbidden = vi.fn()
const tab = () => (
  <EventMeetings
    councilId={MEETING_COUNCIL}
    eventId={EVENT}
    referenceTime="2026-10-29T12:00"
    onForbidden={forbidden}
  />
)
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  api = mockApi()
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('행사 회의는 상태별 수와 카드로 보이고 카드는 그 회의, [전체 회의 보기]는 회의 메뉴를 연다', async () => {
  api.on('GET', read, () =>
    json({
      meetings: [
        meetingSample({
          id: '0199d1a0-0000-7000-8000-0000000000aa',
          title: '지난 점검 회의',
          status: 'done',
          heldAt: '2026-10-20T10:00',
          endsAt: '2026-10-20T11:00',
        }),
        meetingSample({ id: MEETING_ID, title: '안전 관리 회의', actions: [] }),
        meetingSample({
          id: '0199d1a0-0000-7000-8000-0000000000a9',
          title: '운영 점검 회의',
          status: 'in_progress',
          heldAt: '2026-10-29T11:00',
          endsAt: '2026-10-29T13:00',
        }),
      ],
      truncated: false,
    }),
  )
  render(tab())
  const region = await screen.findByRole('region', { name: '관련 회의' })
  expect(region.textContent).toContain('진행 중 1건 · 예정 1건 · 정리 중 0건 · 완료 1건')
  expect(screen.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual([
    '운영 점검 회의',
    '안전 관리 회의',
    '지난 점검 회의',
  ])
  expect(screen.queryByRole('button', { name: '새 회의' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '안전 관리 회의' }))
  expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  fireEvent.click(screen.getByRole('button', { name: '전체 회의 보기' }))
  expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}`)
})

test('이은 회의가 없으면 회의 없음이고, 권한이 없다는 읽기는 알린다', async () => {
  api.on('GET', read, () => json({ meetings: [], truncated: false }))
  render(tab())
  expect(await screen.findByText('회의 없음')).toBeTruthy()
  cleanup()
  api.on('GET', read, () => json({ code: 'FORBIDDEN' }, 403))
  render(tab())
  await vi.waitFor(() => expect(forbidden).toHaveBeenCalled())
})

test('서버가 목록을 잘랐으면 행사 회의 탭도 일부만 보인다고 알린다', async () => {
  api.on('GET', read, () => json({ meetings: [meetingSample()], truncated: true }))
  render(tab())
  expect(await screen.findByText('오래된 회의부터 300건만 보여요')).toBeTruthy()
})
