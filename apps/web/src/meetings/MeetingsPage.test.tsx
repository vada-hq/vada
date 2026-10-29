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
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
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
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['학생회 회의', '내 회의'])
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '없음' } })
  expect(screen.getByText('맞는 회의 없음')).toBeTruthy()
  expect(window.location.search).toBe('')
})

const mine = [
  meetingSample({
    id: '0199d1a0-0000-7000-8000-0000000000a7',
    title: '정기 운영회의',
    status: 'scheduled',
    actions: [],
  }),
  meetingSample({
    id: MEETING_ID,
    title: '축제 기획회의',
    status: 'wrapping_up',
    heldAt: '2026-10-27T16:00',
    event: { id: '0199d1a0-0000-7000-8000-0000000000e1', name: '가을 축제' },
  }),
  meetingSample({
    id: '0199d1a0-0000-7000-8000-0000000000a8',
    title: '운영 점검 회의',
    status: 'in_progress',
  }),
]
test('내 회의 탭은 내 회의만 읽어 할 일 문구 셋으로 보이고, 줄은 회의를 연다', async () => {
  api.on('GET', `${base}?view=mine`, () => json({ meetings: mine, truncated: false }))
  render(page())
  fireEvent.click(await screen.findByRole('tab', { name: '내 회의' }))
  expect(window.location.search).toBe('?tab=mine')
  const list = await screen.findByRole('region', { name: '내 회의' })
  expect(list.textContent).toContain('가을 축제')
  expect(list.textContent).toContain('학생회')
  const todos = ['진행 중', '회의록 정리 필요', '참석 예정']
  for (const todo of todos) expect(screen.getByText(todo)).toBeTruthy()
  expect(list.textContent).not.toContain('진행 권한')
  expect(screen.queryByRole('searchbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /축제 기획회의/ }))
  expect(window.location.pathname).toBe(`/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
})

test('내 회의는 주소로 바로 열리고 [학생회 회의 전체]로 첫 탭에 돌아간다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}?tab=mine`)
  api.on('GET', `${base}?view=mine`, () => json({ meetings: [], truncated: false }))
  render(page(['meeting.create']))
  expect(await screen.findByText('내 회의 없음')).toBeTruthy()
  expect(screen.getByRole('tab', { name: '내 회의' }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '학생회 회의 전체' }))
  expect(window.location.search).toBe('')
  expect(await screen.findByText('학생회 정기 총회')).toBeTruthy()
})

test('예정 회의의 회의록 쓰기는 동작이 있을 때 열고 안건을 주소에 남긴다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의록 쓰기' }))
  expect(window.location.search).toBe('?mode=minutes')
  expect(await screen.findByLabelText('논의 내용')).toBeTruthy()
})

test('예정 회의에 회의록 쓰기 동작이 없으면 본문은 보이고 버튼만 없다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting: meetingSample({ actions: [] }) }))
  render(page())
  expect(await screen.findByText('부서별 준비 상황')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '회의록 쓰기' })).toBeNull()
})

test.each(['in_progress', 'wrapping_up', 'done'] as const)(
  '%s 회의는 쓰기 권한 없이도 회의록을 읽는다',
  async status => {
    window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
    const meeting = meetingSample({ status, actions: [] })
    meeting.agenda[0]!.notes = '모두 읽는 회의록'
    api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
    render(page())
    expect(await screen.findByText('• 모두 읽는 회의록')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  },
)

test('완료 회의 카드의 회의록 보기로 완료 회의록을 연다', async () => {
  const meeting = meetingSample({
    status: 'done',
    minutesStatus: 'confirmed',
    actions: [],
    confirmedAt: '2026-10-29T07:30:00Z',
  })
  meeting.agenda[0]!.notes = '확정한 회의록'
  api.on('GET', `${base}?view=council`, () => json({ meetings: [meeting], truncated: false }))
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의록 보기' }))
  expect(await screen.findByText('완료된 회의록')).toBeTruthy()
  expect(screen.getByText('• 확정한 회의록')).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})

test('예정·취소 회의도 적힌 회의록은 읽는 사람이 회의록 보기로 연다', async () => {
  for (const status of ['scheduled', 'cancelled'] as const) {
    window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
    const meeting = meetingSample({ status, actions: [] })
    meeting.agenda[0]!.notes = '미리 적은 회의록'
    api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
    render(page())
    fireEvent.click(await screen.findByRole('button', { name: '회의록 보기' }))
    expect(window.location.search).toBe('?mode=minutes')
    expect(await screen.findByText('• 미리 적은 회의록')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    cleanup()
  }
})

test('취소 회의는 회의록이 비어도 안건이 있으면 회의록 보기로 안건을 읽는다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  const meeting = meetingSample({ status: 'cancelled', actions: [] })
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의록 보기' }))
  expect(await screen.findByText('논의 내용 없음')).toBeTruthy()
})

test('안건 없는 취소 회의도 회의록 보기로 참가자를 읽는다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  const meeting = { ...meetingSample({ status: 'cancelled', actions: [] }), agenda: [] }
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의록 보기' }))
  expect(await screen.findByText('참가 현황')).toBeTruthy()
  expect(screen.getByText(meeting.attendees[0]!.name)).toBeTruthy()
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
  expect(screen.getByText('오래된 회의부터 300건만 보여요')).toBeTruthy()
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
  // 선택지가 그려진 뒤 기본 참가자를 채운다.
  await waitFor(() => expect((other as HTMLInputElement).checked).toBe(true))
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

test('고치기는 참가자를 먼저 저장하고 바뀐 칸과 판 번호만 보낸다', async () => {
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
  expect(posts()[0]!.path).toBe(`${base}/${MEETING_ID}/attendees`)
  expect(posts()[0]!.body).toEqual({ attendeeIds: [] })
  expect(posts()[1]!.body).toEqual({ title: '고친 총회', baseVersionNo: 1 })
})

test('취소된 회의도 서버가 준 동작 버튼은 그대로 보인다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  api.on('GET', `${base}/${MEETING_ID}`, () =>
    json({
      meeting: meetingSample({
        status: 'cancelled',
        actions: ['meeting.edit'],
        cancelReason: '일정 변경',
        cancelledAt: '2026-10-29T02:20:00Z',
      }),
    }),
  )
  render(page())
  expect(await screen.findByText('취소 기록')).toBeTruthy()
  expect(screen.getByRole('button', { name: '고치기' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '회의 취소' })).toBeNull()
})

test('고치는 중 다시 읽기에서 고칠 동작이 빠져도 쓰던 글을 남긴다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}?mode=edit`)
  render(page())
  fireEvent.change(await screen.findByLabelText('회의명'), { target: { value: '내가 쓰던 총회' } })
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting: meetingSample({ actions: [] }) }))
  const reads = () => api.calls.filter(call => call.path === `${base}/${MEETING_ID}`).length
  const before = reads()
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(screen.getByLabelText<HTMLInputElement>('회의명').value).toBe('내가 쓰던 총회')
})

test('참가자를 저장한 뒤 고치기가 막히면 참가자는 저장했다고 알린다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}?mode=edit`)
  api.on('POST', `${base}/${MEETING_ID}/attendees`, () => json({ meeting: meetingSample() }))
  api.on('POST', `${base}/${MEETING_ID}`, () => json({ error: 'EVENT_COMPLETED' }, 409))
  render(page())
  fireEvent.change(await screen.findByLabelText('회의명'), { target: { value: '고친 총회' } })
  fireEvent.click(screen.getByRole('checkbox', { name: '이기획' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText(/^참가자는 저장했어요\. 완료한 행사에는/)).toBeTruthy()
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

test('진행 중 회의록 화면에서도 다루는 사람은 고치기와 회의 취소를 연다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  const meeting = meetingSample({
    status: 'in_progress',
    actions: ['meeting.edit', 'meeting.cancel', 'meeting.minutes'],
  })
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
  render(page())
  expect(await screen.findByLabelText('논의 내용')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '고치기' }))
  expect(window.location.search).toBe('?mode=edit')
  cleanup()
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의 취소' }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
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

test('예정 회의에 후속 업무만 있어도 읽는 사람이 회의록 보기로 그 업무를 찾는다', async () => {
  window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
  const meeting = meetingSample({ status: 'scheduled', actions: [] })
  meeting.agenda[0]!.followUps = [
    {
      id: '0199d1a0-0000-7000-8000-0000000000d1',
      title: '미리 만든 후속 업무',
      status: 'todo',
      dueDate: null,
      assignee: null,
    },
  ]
  api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting }))
  render(page())
  fireEvent.click(await screen.findByRole('button', { name: '회의록 보기' }))
  expect(await screen.findByText('미리 만든 후속 업무')).toBeTruthy()
})

test('회의록을 연 뒤 회의가 취소·예정으로 바뀌어 다시 읽혀도 쓰던 업무 창을 내리지 않는다', async () => {
  for (const status of ['cancelled', 'scheduled'] as const) {
    window.history.replaceState(null, '', `/meetings/${MEETING_COUNCIL}/${MEETING_ID}`)
    let current = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
    api.on('GET', `${base}/${MEETING_ID}`, () => json({ meeting: current }))
    api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
      json({
        departments: [{ id: null, name: null, assignees: [{ id: null, name: null }] }],
        linkableEvents: [],
      }),
    )
    api.on('GET', `/api/organizations/${MEETING_COUNCIL}/events`, () =>
      json({ events: [], truncated: false }),
    )
    render(page())
    fireEvent.click(await screen.findByRole('button', { name: '업무 만들기' }))
    const title = await screen.findByLabelText(/업무 이름|제목/)
    fireEvent.change(title, { target: { value: '쓰던 후속 업무' } })
    current = meetingSample({ status, actions: [] })
    window.dispatchEvent(new Event('vada:push-arrived'))
    await waitFor(() =>
      expect(api.calls.filter(call => call.path === `${base}/${MEETING_ID}`).length).toBe(2),
    )
    await waitFor(() => expect(screen.queryByRole('button', { name: '업무 만들기' })).toBeNull())
    expect(screen.getByDisplayValue('쓰던 후속 업무')).toBeTruthy()
    cleanup()
    api.calls.length = 0
    resetLeaveGuard()
  }
})
