// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { navigate } from '@/lib/app-location'
import {
  meetingSample,
  meetingOptions,
  MEETING_COUNCIL,
  MEETING_ID,
  MEETING_MEMBER,
  MEETING_DEPARTMENT,
} from './test-support/meeting-samples'
import MeetingsPage from './MeetingsPage'

const base = `/api/organizations/${MEETING_COUNCIL}/meetings`
let api: ReturnType<typeof mockApi>
const forbidden = vi.fn()
const page = (permissions: 'meeting.create'[] = []) => (
  <MeetingsPage
    view={councilView(MEETING_COUNCIL, { permissions, memberId: MEETING_MEMBER })}
    onForbidden={forbidden}
  />
)
const posts = () => api.calls.filter(call => call.method === 'POST')
beforeEach(() => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}`)
  api = mockApi()
  api.on('GET', `${base}?view=council`, () =>
    json({ meetings: [meetingSample()], truncated: false }),
  )
  api.on('GET', `${base}/options`, () => json(meetingOptions))
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting: meetingSample() }))
})
afterEach(() => {
  cleanup()
  api.assertNoUnexpectedRequests()
  resetLeaveGuard()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

test('같은 목록은 권한과 관계없이 같고 새 회의 버튼만 달라진다', async () => {
  const { rerender } = render(page())
  expect(await screen.findByText('학생회 정기 총회')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '새 회의' })).toBeNull()
  rerender(page(['meeting.create']))
  expect(screen.getAllByText('학생회 정기 총회')).toHaveLength(1)
  expect(screen.getByRole('button', { name: '새 회의' })).toBeTruthy()
  expect(screen.queryByRole('tab')).toBeNull()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없음' } })
  expect(screen.getByText('맞는 회의 없음')).toBeTruthy()
  expect(window.location.search).toBe('')
})

test('상태를 주소에 유지하고 취소 회의만 보인다', async () => {
  api.on('GET', `${base}?view=council`, () =>
    json({
      meetings: [
        meetingSample(),
        meetingSample({ id: MEETING_DEPARTMENT, title: '취소 총회', status: 'cancelled' }),
      ],
      truncated: true,
    }),
  )
  render(page())
  await screen.findByText('학생회 정기 총회')
  fireEvent.change(screen.getByLabelText('상태'), { target: { value: 'cancelled' } })
  expect(screen.queryByText('학생회 정기 총회')).toBeNull()
  expect(screen.getByText('취소 총회')).toBeTruthy()
  expect(window.location.search).toBe('?status=cancelled')
  expect(screen.getByText('최근 300건만 보여요')).toBeTruthy()
})

test('만들기 빈 칸은 요청 없이 오류와 첫 칸 초점을 보인다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/new`)
  render(page(['meeting.create']))
  await screen.findByLabelText('회의명')
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('회의명')))
  for (const label of ['회의명', '날짜', '시작', '끝', '장소'])
    expect(screen.getByLabelText(label).getAttribute('aria-required')).toBe('true')
  expect(posts()).toEqual([])
})

test('부서를 바꾸면 서버 기본 참가자로 채우고 직접 고친 뒤에는 보존하며 만들면 기록으로 이동한다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/new`)
  api.on('GET', `${base}/options?hostDepartment=${MEETING_DEPARTMENT}`, () =>
    json({ ...meetingOptions, defaultAttendeeIds: [MEETING_MEMBER] }),
  )
  api.on('POST', base, () => json({ meeting: meetingSample() }))
  render(page(['meeting.create']))
  const other = await screen.findByRole('checkbox', { name: '이기획' })
  expect((other as HTMLInputElement).checked).toBe(true)
  fireEvent.change(screen.getByLabelText('주관 부서'), { target: { value: MEETING_DEPARTMENT } })
  await waitFor(() => expect((other as HTMLInputElement).checked).toBe(false))
  fireEvent.click(other)
  fireEvent.change(screen.getByLabelText('주관 부서'), { target: { value: '' } })
  await waitFor(() => expect((other as HTMLInputElement).checked).toBe(true))
  for (const [label, value] of [
    ['회의명', '새 총회'],
    ['날짜', '2026-11-03'],
    ['시작', '14:00'],
    ['끝', '15:30'],
    ['장소', '학생회실'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  await waitFor(() =>
    expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}/${MEETING_ID}`),
  )
  expect(posts()[0]!.body).toMatchObject({
    title: '새 총회',
    heldAt: '2026-11-03T14:00',
    endsAt: '2026-11-03T15:30',
  })
})

test('동작이 없으면 고치기 주소에서도 읽기는 보이고 동작 버튼은 없다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}?mode=edit`)
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting: meetingSample({ actions: [] }) }))
  render(page())
  expect(await screen.findByText('학생회 정기 총회')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '회의 취소' })).toBeNull()
  expect(screen.queryByLabelText('회의명')).toBeNull()
})

test('취소 사유가 비면 보내지 않고 성공 응답을 취소 기록으로 보인다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  api.on('POST', `${base}/${MEETING_ID}/cancel`, () =>
    json({
      meeting: meetingSample({
        status: 'cancelled',
        actions: [],
        cancelReason: '일정 변경',
        cancelledAt: '2026-10-29T02:20:00Z',
      }),
    }),
  )
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의 취소' }))
  fireEvent.click(screen.getAllByRole('button', { name: '회의 취소' }).at(-1)!)
  expect(posts()).toEqual([])
  fireEvent.change(screen.getByLabelText('취소 사유'), { target: { value: '일정 변경' } })
  fireEvent.click(screen.getAllByRole('button', { name: '회의 취소' }).at(-1)!)
  expect(await screen.findByText('취소 기록')).toBeTruthy()
  expect(screen.getByText('10월 29일 (목) 11:20')).toBeTruthy()
  expect(posts()[0]!.body).toEqual({ reason: '일정 변경' })
})

test.each([403, 404])('기록 %i는 볼 수 없음과 목록 길을 보인다', async status => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  api.on('GET', `${base}/${MEETING_ID}`, () =>
    json({ error: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND' }, status),
  )
  render(page())
  expect(await screen.findByText('이 회의를 볼 수 없어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '회의 목록' }))
  await waitFor(() => expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}`))
})

test('고치기는 바뀐 칸과 판 번호만 보내고 참가자를 이어서 저장한다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}?mode=edit`)
  api.on('POST', `${base}/${MEETING_ID}`, () =>
    json({ meeting: meetingSample({ title: '고친 총회', versionNo: 2 }) }),
  )
  api.on('POST', `${base}/${MEETING_ID}/attendees`, () =>
    json({
      meeting: meetingSample({
        title: '고친 총회',
        versionNo: 2,
        attendees: [meetingOptions.members[0]!],
      }),
    }),
  )
  render(page())
  fireEvent.change(await screen.findByLabelText('회의명'), { target: { value: '고친 총회' } })
  expect(screen.queryByRole('button', { name: '안건 추가' })).toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: '이기획' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(posts()).toHaveLength(2))
  expect(posts()[0]!.body).toEqual({ title: '고친 총회', baseVersionNo: 1 })
  expect(posts()[1]!.body).toEqual({ attendeeIds: [] })
})

test('판 충돌은 다시 읽어도 쓰던 글을 남긴다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}?mode=edit`)
  api.on('POST', `${base}/${MEETING_ID}`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  render(page())
  fireEvent.change(await screen.findByLabelText('회의명'), { target: { value: '내가 쓰던 총회' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText(/다른 사람이 먼저/)).toBeTruthy()
  expect(screen.getByLabelText<HTMLInputElement>('회의명').value).toBe('내가 쓰던 총회')
})

test('만들기 페이지에서 글을 쓰고 목록으로 가면 나가기 확인을 남긴다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/new`)
  render(page(['meeting.create']))
  fireEvent.change(await screen.findByLabelText('회의명'), { target: { value: '쓰던 글' } })
  navigate(`/meetings/${MEETING_COUNCIL}`)
  expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}/new`)
})

test('읽기 전과 실패에는 0건을 지어내지 않고 다시 시도할 수 있다', async () => {
  const pending = deferredResponse()
  api.on('GET', `${base}?view=council`, () => pending.promise)
  render(page())
  expect(screen.getByText('회의 불러오는 중…')).toBeTruthy()
  expect(screen.queryByText('0건')).toBeNull()
  pending.resolve(json({ error: 'FAILED' }, 500))
  await screen.findByRole('button', { name: '다시 시도' })
  api.on('GET', `${base}?view=council`, () => json({ meetings: [], truncated: false }))
  fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('회의 없음')).toBeTruthy()
})

test.each(['MEETING_HAS_TASKS', 'MEETING_CANCELLED'])(
  '취소 거절 %s는 확인 창 안에 남긴다',
  async code => {
    window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
    api.on('POST', `${base}/${MEETING_ID}/cancel`, () => json({ error: code }, 409))
    render(page())
    fireEvent.click(await screen.findByRole('button', { name: '회의 취소' }))
    fireEvent.change(screen.getByLabelText('취소 사유'), { target: { value: '일정 변경' } })
    fireEvent.click(screen.getAllByRole('button', { name: '회의 취소' }).at(-1)!)
    const problem =
      code === 'MEETING_HAS_TASKS'
        ? '후속 업무가 있는 회의는 취소할 수 없어요.'
        : '이미 취소된 회의예요. 새로 불러와 주세요.'
    expect(await screen.findByText(problem)).toBeTruthy()
    expect(screen.getByRole('dialog').contains(screen.getByText(problem))).toBe(true)
  },
)
