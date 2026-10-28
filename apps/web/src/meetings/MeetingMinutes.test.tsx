// @vitest-environment jsdom
import { StrictMode, useState } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { meetingSample, MEETING_COUNCIL, MEETING_ID } from './test-support/meeting-samples'
import { councilView } from '@/test-support/council-fixtures'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { MeetingMinutes } from './MeetingMinutes'
import { MeetingList } from './MeetingList'
import { hasDirtyEntry } from './minutes-entry'
import { resetKeptMinutes } from './minutes-drafts'
import { hasUnsavedInput, resetLeaveGuard } from '@/lib/leave-guard'
import { LEAVE_CONFIRM, LEAVE_TITLE, PERMISSION_CHANGED } from '@/lib/messages'

const base = `/api/organizations/${MEETING_COUNCIL}/meetings/${MEETING_ID}`
const ME = '0199d1a0-0000-7000-8000-00000000aaa1'
const sample = () => {
  const meeting = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  const first = meeting.agenda[0]!
  return {
    ...meeting,
    agenda: [
      first,
      { ...first, id: '0199d1a0-0000-7000-8000-0000000000f2', position: 2, title: '둘째 안건' },
    ],
  }
}
let api: ReturnType<typeof mockApi>
const changed = vi.fn()
const select = vi.fn()
beforeEach(() => {
  api = mockApi()
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
  vi.useFakeTimers()
  changed.mockClear()
  select.mockClear()
})
afterEach(() => {
  cleanup()
  resetLeaveGuard()
  resetKeptMinutes()
  vi.useRealTimers()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
})
const posts = () => api.calls.filter(c => c.method === 'POST')
const minutes = (meeting: MeetingDetail, selectedId: string | null = null) => (
  <MeetingMinutes
    view={councilView(MEETING_COUNCIL, { memberId: ME })}
    meeting={meeting}
    base={base}
    memberId={ME}
    selectedId={selectedId}
    onSelect={select}
    onSaved={changed}
  />
)
const draw = (meeting = sample()) => render(minutes(meeting))

const tasksBase = `/api/organizations/${MEETING_COUNCIL}/tasks`
const optionsCalls = () => api.calls.filter(call => call.path.startsWith(`${tasksBase}/options`))
function followUpOptions(meeting: MeetingDetail) {
  const eventId = meeting.event?.id
  api.on('GET', `${tasksBase}/options${eventId ? `?event=${eventId}` : ''}`, () =>
    json({
      departments: [{ id: null, name: null, assignees: [{ id: null, name: null }] }],
      linkableEvents: [{ departmentId: null, eventIds: eventId ? [eventId] : [] }],
    }),
  )
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/events`, () =>
    json({ events: [], truncated: false }),
  )
}

test.each(['권한', '고른 안건', '마지막 안건', '행사'] as const)(
  '%s 변경으로 회의를 다시 읽어도 열린 업무 창의 입력과 처음 출처를 남긴다',
  async change => {
    vi.useRealTimers()
    const meeting = sample()
    meeting.event = { id: '0199d1a0-0000-7000-8000-0000000000e1', name: '가을 축제' }
    if (change === '마지막 안건') meeting.agenda = [meeting.agenda[0]!]
    followUpOptions(meeting)
    api.on('POST', tasksBase, () =>
      json(
        { error: change === '권한' ? 'FORBIDDEN' : 'RECORD_CONFIRMED' },
        change === '권한' ? 403 : 409,
      ),
    )
    const { rerender } = draw(meeting)
    fireEvent.click(await screen.findByRole('button', { name: '업무 만들기' }))
    const title = screen.getByRole<HTMLInputElement>('textbox', { name: /^제목/ })
    fireEvent.change(title, { target: { value: '다시 읽어도 남길 업무' } })
    const fresh: MeetingDetail = {
      ...meeting,
      ...(change === '권한' ? { actions: [] } : {}),
      ...(change.includes('안건') ? { agenda: meeting.agenda.slice(1) } : {}),
      ...(change === '행사'
        ? { event: { id: '0199d1a0-0000-7000-8000-0000000000e2', name: '다른 행사' } }
        : {}),
    }
    rerender(minutes(fresh))
    await act(async () => {})
    expect(screen.getByRole('dialog', { name: '업무 추가' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: /^제목/ })).toBe(title)
    expect(title.value).toBe('다시 읽어도 남길 업무')
    expect(optionsCalls()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '업무 추가' }))
    await act(async () => {})
    expect(posts().at(-1)!.body).toMatchObject({
      title: '다시 읽어도 남길 업무',
      agendaItemId: meeting.agenda[0]!.id,
      eventId: meeting.event.id,
    })
    expect(screen.getByRole('dialog', { name: '업무 추가' })).toBeTruthy()
    expect(title.value).toBe('다시 읽어도 남길 업무')
    if (change === '권한') expect(screen.getByText(PERMISSION_CHANGED)).toBeTruthy()
    else expect(screen.getByText('확정된 회의록에는 후속 업무를 만들 수 없어요.')).toBeTruthy()
  },
)

test('안건을 오가도 업무 선택지는 다시 읽지 않고 새 창은 고른 안건에서 만든다', async () => {
  vi.useRealTimers()
  const meeting = sample()
  followUpOptions(meeting)
  api.on('POST', tasksBase, () => json({ task: taskDetail() }, 201))
  api.on('GET', base, () => json({ meeting }))
  const { rerender } = draw(meeting)
  await screen.findByRole('button', { name: '업무 만들기' })
  for (const selected of [meeting.agenda[1]!.id, meeting.agenda[0]!.id, meeting.agenda[1]!.id]) {
    rerender(minutes(meeting, selected))
    await act(async () => {})
  }
  expect(optionsCalls()).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '업무 만들기' }))
  fireEvent.change(screen.getByRole('textbox', { name: /^제목/ }), {
    target: { value: '둘째 안건의 업무' },
  })
  rerender(minutes(meeting, meeting.agenda[0]!.id))
  fireEvent.click(screen.getByRole('button', { name: '업무 추가' }))
  await waitFor(() => expect(changed).toHaveBeenCalledWith(meeting))
  expect(posts().at(-1)!.body).toMatchObject({ agendaItemId: meeting.agenda[1]!.id })
  expect(screen.queryByRole('dialog', { name: '업무 추가' })).toBeNull()
  expect(optionsCalls()).toHaveLength(1)
})

test('회의록을 읽기만 하거나 안건이 없으면 업무 선택지를 읽지 않는다', async () => {
  const meeting = sample()
  const { rerender } = draw({ ...meeting, actions: [] })
  await act(async () => {})
  expect(optionsCalls()).toHaveLength(0)
  rerender(minutes({ ...meeting, agenda: [] }))
  await act(async () => {})
  expect(optionsCalls()).toHaveLength(0)
})

test('업무 만들기는 행사·주관 부서를 미리 채우고 상세 갱신 뒤에도 쓰던 논의 글을 남긴다', async () => {
  vi.useRealTimers()
  const meeting = sample()
  meeting.hostDepartment = { id: '0199d1a0-0000-7000-8000-0000000000d1', name: '기획부' }
  meeting.event = { id: '0199d1a0-0000-7000-8000-0000000000e1', name: '가을 축제' }
  const tasksBase = `/api/organizations/${MEETING_COUNCIL}/tasks`
  api.on('GET', `${tasksBase}/options?event=${meeting.event.id}`, () =>
    json({
      departments: [{ ...meeting.hostDepartment, assignees: [{ id: ME, name: '나' }] }],
      linkableEvents: [{ departmentId: meeting.hostDepartment!.id, eventIds: [meeting.event!.id] }],
    }),
  )
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/events`, () =>
    json({ events: [], truncated: false }),
  )
  const task = taskDetail({ id: '0199d1a0-0000-7000-8000-000000000071', title: '연락망 정리' })
  api.on('POST', tasksBase, () => json({ task }, 201))
  const fresh = {
    ...meeting,
    agenda: meeting.agenda.map((a, index) =>
      index
        ? a
        : {
            ...a,
            followUps: [{ id: task.id, title: task.title, status: task.status, assignee: null }],
          },
    ),
  }
  api.on('GET', base, () => json({ meeting: fresh }))
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ meeting: fresh }))
  function Example() {
    const [current, setCurrent] = useState(meeting)
    return (
      <MeetingMinutes
        view={councilView(MEETING_COUNCIL, { memberId: ME })}
        meeting={current}
        base={base}
        memberId={ME}
        selectedId={null}
        onSelect={select}
        onSaved={setCurrent}
      />
    )
  }
  render(<Example />)
  fireEvent.change(screen.getByLabelText('논의 내용'), {
    target: { value: '업무 창을 열기 전에 쓴 논의' },
  })
  fireEvent.click(await screen.findByRole('button', { name: '업무 만들기' }))
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /^담당 부서/ }).value).toBe(
    meeting.hostDepartment.id,
  )
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /^행사/ }).value).toBe(
    meeting.event.id,
  )
  const title = screen.getByRole<HTMLInputElement>('textbox', { name: /^제목/ })
  expect(title.value).toBe('')
  fireEvent.change(title, { target: { value: task.title } })
  fireEvent.click(screen.getByRole('button', { name: '업무 추가' }))
  expect(await screen.findByRole('button', { name: /연락망 정리/ })).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: '업무 추가' })).toBeNull()
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe(
    '업무 창을 열기 전에 쓴 논의',
  )
  expect(posts().find(call => call.path === tasksBase)!.body).toMatchObject({
    agendaItemId: meeting.agenda[0]!.id,
    departmentId: meeting.hostDepartment.id,
    eventId: meeting.event.id,
  })
  expect(screen.getByText('업무 1')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '안건 빼기' })).toBeNull()
})

const FOLLOW_UP_ID = '0199d1a0-0000-7000-8000-0000000000c1'
test('회의 쓰기 동작이나 업무 선택지가 없으면 만들기만 숨기고 후속 업무는 업무 보드로 연다', async () => {
  vi.useRealTimers()
  const meeting = sample()
  meeting.actions = []
  meeting.agenda[0]!.followUps = [
    {
      id: FOLLOW_UP_ID,
      title: '읽는 후속 업무',
      status: 'in_progress',
      dueDate: null,
      assignee: { id: ME, name: '김운영' },
    },
  ]
  const { rerender } = draw(meeting)
  expect(screen.queryByRole('button', { name: '업무 만들기' })).toBeNull()
  expect(screen.getByText('김운영')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /읽는 후속 업무/ }))
  await waitFor(() =>
    expect(window.location.pathname).toBe(`/tasks/${MEETING_COUNCIL}/${FOLLOW_UP_ID}`),
  )
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={{ ...meeting, actions: ['meeting.minutes'] }}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('/tasks/options'))).toBe(true),
  )
  expect(screen.queryByRole('button', { name: '업무 만들기' })).toBeNull()
  expect(screen.getByRole('button', { name: /읽는 후속 업무/ })).toBeTruthy()
})

test('실패한 논의를 남겨 둔 채 빈 업무 창을 닫거나 업무 입력만 버려도 회의록 나가기 지킴을 유지한다', async () => {
  const meeting = sample()
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
    json({
      departments: [{ id: null, name: null, assignees: [{ id: null, name: null }] }],
      linkableEvents: [],
    }),
  )
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/events`, () =>
    json({ events: [], truncated: false }),
  )
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'FAILED' }, 500))
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '실패해도 남길 논의' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(hasUnsavedInput()).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '업무 만들기' }))
  await act(async () => {})
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  expect(screen.queryByRole('dialog', { name: LEAVE_TITLE })).toBeNull()
  expect(screen.queryByRole('dialog', { name: '업무 추가' })).toBeNull()
  expect(hasUnsavedInput()).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '업무 만들기' }))
  fireEvent.change(screen.getByRole('textbox', { name: /^제목/ }), {
    target: { value: '버릴 업무' },
  })
  fireEvent.click(screen.getAllByRole('button', { name: '닫기' })[0]!)
  expect(screen.getByRole('dialog', { name: LEAVE_TITLE })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: LEAVE_CONFIRM }))
  expect(hasUnsavedInput()).toBe(true)
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('실패해도 남길 논의')
})

test('1.5초 뒤 한 번 자동 저장하고 안건을 바꾸면 즉시 저장한다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ meeting }))
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '한 줄' } })
  await act(() => vi.advanceTimersByTimeAsync(1499))
  expect(posts()).toHaveLength(0)
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(posts()).toHaveLength(1)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '다음 줄' } })
  fireEvent.click(screen.getAllByRole('button', { name: /둘째 안건/ })[0]!)
  await act(async () => {})
  expect(posts()).toHaveLength(2)
})

test('409 뒤 상대 글을 읽어도 내 글이 남고 새 판으로 덮는다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  const fresh = {
    ...meeting,
    agenda: [
      {
        ...meeting.agenda[0]!,
        notes: '상대 글',
        versionNo: 2,
        updatedBy: { id: 'other', name: '정하늘', current: true },
      },
      meeting.agenda[1]!,
    ],
  }
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () => json({ meeting: fresh }))
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '내 초안' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(screen.getByText('정하늘님이 먼저 고쳤어요')).toBeTruthy()
  expect(screen.getByLabelText<HTMLTextAreaElement>('내가 쓴 글').value).toBe('내 초안')
  expect(screen.getByText('• 상대 글')).toBeTruthy()
  api.on('POST', path, () => json({ meeting: fresh }))
  fireEvent.click(screen.getByRole('button', { name: '내 글로 덮기' }))
  await act(async () => {})
  expect(posts().at(-1)!.body).toEqual({ notes: '내 초안', baseVersionNo: 2 })
})

test('읽기만 하는 사람도 논의·결정·결정 수를 보고 줄마다 점을 본다', () => {
  const meeting = sample()
  meeting.actions = []
  meeting.agenda[0]!.notes = '첫 줄\n\n둘째 줄'
  meeting.agenda[0]!.decisions = [
    {
      id: '0199d1a0-0000-7000-8000-0000000000d9',
      content: '함께 진행',
      rationale: null,
      decidedBy: null,
      decidedAt: meeting.createdAt,
      versionNo: 1,
    },
  ]
  draw(meeting)
  expect(screen.queryByRole('textbox')).toBeNull()
  for (const name of ['결정 추가', '안건 더하기', '안건 고치기', '안건 빼기'])
    expect(screen.queryByRole('button', { name })).toBeNull()
  expect(screen.getByText('• 첫 줄')).toBeTruthy()
  expect(screen.getByText('함께 진행')).toBeTruthy()
  expect(screen.getAllByText('결정 1').length).toBeGreaterThan(0)
})

test('쓰는 중 동작이 빠져도 내 초안은 글로 남고 입력칸과 쓰기 버튼은 사라진다', async () => {
  const meeting = sample()
  const readonly = { ...meeting, actions: [] }
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () =>
    json({
      meeting: {
        ...readonly,
        agenda: readonly.agenda.map(a => ({ ...a, notes: '보존할 초안', versionNo: 2 })),
      },
    }),
  )
  const { rerender } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '보존할 초안' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={readonly}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText('내가 쓴 글')).toBeTruthy()
  expect(screen.getByText('• 보존할 초안')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '결정 추가' })).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(1500))
})

test('409 뒤 상세 읽기가 실패해도 쓴 글을 보존하고 다시 읽어 충돌을 푼다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () =>
    json({ error: 'VERSION_CONFLICT' }, 409),
  )
  api.on('GET', base, () => json({ error: 'FAILED' }, 500))
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '보존할 글' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '계속 쓴 글' } })
  api.on('GET', base, () =>
    json({
      meeting: {
        ...meeting,
        agenda: meeting.agenda.map(a => ({ ...a, notes: '다른 글', versionNo: 4 })),
      },
    }),
  )
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }))
  await act(async () => {})
  expect(screen.getByLabelText<HTMLTextAreaElement>('내가 쓴 글').value).toBe('계속 쓴 글')
  expect(posts()).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: '상대 글 쓰기' }))
})

test('주기적 다시 읽기는 저장 안 된 글을 덮지 않고, 저장 중 입력은 이어 보낸다', async () => {
  const meeting = sample()
  const pending = deferredResponse()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  api.on('POST', path, () => pending.promise)
  const { rerender } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '첫 입력' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '계속 입력' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={{ ...meeting, agenda: meeting.agenda.map(a => ({ ...a, notes: '서버 글' })) }}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('계속 입력')
  const saved = {
    ...meeting,
    agenda: meeting.agenda.map(a => ({ ...a, notes: '첫 입력', versionNo: 2 })),
  }
  api.on('POST', path, () => json({ meeting: saved }))
  await act(async () => {
    pending.resolve(json({ meeting: saved }))
  })
  expect(posts()).toHaveLength(2)
  expect(posts()[1]!.body).toEqual({ notes: '계속 입력', baseVersionNo: 2 })
})

test('컴포넌트를 떠나면 지연 없이 저장하고 pagehide는 keepalive 요청을 보낸다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  api.on('POST', path, () => json({ meeting }))
  const { unmount } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '떠날 때 글' } })
  unmount()
  await act(async () => {})
  expect(posts()).toHaveLength(1)
  const second = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '창 닫을 때 글' } })
  await act(async () => {
    window.dispatchEvent(new Event('pagehide'))
  })
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.keepalive === true)).toBe(true)
  second.unmount()
  await act(async () => {})
})

test('안건 빼기를 확인하면 그 안건의 미저장 타이머와 초안을 거둔다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}/cancel`
  api.on('POST', path, () => json({ meeting: { ...meeting, agenda: [meeting.agenda[1]!] } }))
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '빼려는 안건의 초안' } })
  fireEvent.click(screen.getByRole('button', { name: '안건 빼기' }))
  fireEvent.click(screen.getAllByRole('button', { name: '안건 빼기' }).at(-1)!)
  await act(async () => {})
  await act(() => vi.advanceTimersByTimeAsync(1500))
  expect(posts()).toHaveLength(1)
  expect(posts()[0]!.path).toBe(path)
})

test('충돌의 상대 글 쓰기는 내 초안을 바꾸고 자동 저장 요청을 더 보내지 않는다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () =>
    json({
      meeting: {
        ...meeting,
        agenda: meeting.agenda.map(a => ({ ...a, notes: '상대가 쓴 글', versionNo: 8 })),
      },
    }),
  )
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '내 글' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.click(screen.getByRole('button', { name: '상대 글 쓰기' }))
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('상대가 쓴 글')
  await act(() => vi.advanceTimersByTimeAsync(3000))
  expect(posts()).toHaveLength(1)
})

test('안건 제목을 고치는 중 다시 읽기는 기준 판을 올리지 않고 충돌 뒤 다시 저장할 때만 새 판을 쓴다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  const fresh = {
    ...meeting,
    agenda: meeting.agenda.map(a => ({ ...a, title: '상대 제목', versionNo: 3 })),
  }
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () => json({ meeting: fresh }))
  const { rerender } = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  fireEvent.change(screen.getByLabelText('안건 제목'), { target: { value: '내 제목' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={fresh}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  expect(posts()[0]!.body).toMatchObject({ title: '내 제목', baseVersionNo: 1 })
  expect(screen.getByLabelText<HTMLTextAreaElement>('안건 제목').value).toBe('내 제목')
  api.on('POST', path, () => json({ meeting: fresh }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  expect(posts()[1]!.body).toMatchObject({ title: '내 제목', baseVersionNo: 3 })
})

test.each([
  ['scheduled', true, '상세 보기'],
  ['in_progress', true, '회의록 쓰기'],
  ['wrapping_up', true, '회의록 정리'],
  ['done', false, '회의록 보기'],
  ['cancelled', false, '취소 내용 보기'],
  ['in_progress', false, '회의록 보기'],
  ['wrapping_up', false, '회의록 보기'],
] as const)('목록 %s·쓰기 %s의 버튼은 %s', (status, writable, label) => {
  render(
    <MeetingList
      data={{
        meetings: [meetingSample({ status, actions: writable ? ['meeting.minutes'] : [] })],
        truncated: false,
      }}
      status={null}
      onStatus={() => {}}
      onOpen={() => {}}
      referenceTime="2026-10-29T12:00"
    />,
  )
  expect(screen.getByRole('button', { name: label })).toBeTruthy()
})

test('저장 실패한 초안은 같은 사람이 다시 열면 되살아나고 다른 계정에는 보이지 않는다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'FAILED' }, 500))
  const first = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '앞사람 초안' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  first.unmount()
  await act(async () => {})
  const other = render(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={meeting}
      base={base}
      memberId="0199d1a0-0000-7000-8000-00000000bbb1"
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe(
    meeting.agenda[0]!.notes ?? '',
  )
  other.unmount()
  await act(async () => {})
  draw(meeting)
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('앞사람 초안')
  cleanup()
  await act(async () => {})
})

test('다른 사람이 뺀 안건에 쓰던 글은 옮겨 쓸 수 있게 남는다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'NOT_FOUND' }, 404))
  const { rerender } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '빠진 곳의 글' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={{ ...meeting, agenda: [meeting.agenda[1]!] }}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  expect(screen.getByText('빠진 안건에 쓰던 글')).toBeTruthy()
  expect(screen.getByText('빠진 곳의 글')).toBeTruthy()
  cleanup()
  await act(async () => {})
})

test('결정 폼은 저장 중 잠기고, 쓰는 동안 떠날 때 확인을 걸며, 쓰기 동작이 빠져도 남는다', async () => {
  const meeting = sample()
  const pending = deferredResponse()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}/decisions`, () => pending.promise)
  const { rerender } = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  expect(hasDirtyEntry()).toBe(false)
  fireEvent.change(screen.getByLabelText(/결정 내용/), { target: { value: '함께 진행' } })
  expect(hasDirtyEntry()).toBe(true)
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={{ ...meeting, actions: [] }}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  const field = screen.getByLabelText<HTMLTextAreaElement>(/결정 내용/)
  expect(field.value).toBe('함께 진행')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  expect(field.readOnly).toBe(true)
  pending.resolve(json({ error: 'FORBIDDEN' }, 403))
  await act(async () => {})
  expect(field.readOnly).toBe(false)
  expect(field.value).toBe('함께 진행')
})

test('결정 폼은 한 번에 하나라 쓰는 동안 다른 결정의 고치기와 결정 추가를 숨긴다', () => {
  const meeting = sample()
  meeting.agenda[0]!.decisions = [
    {
      id: '0199d1a0-0000-7000-8000-0000000000d9',
      content: '함께 진행',
      rationale: null,
      decidedBy: null,
      decidedAt: meeting.createdAt,
      versionNo: 1,
    },
  ]
  draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  expect(screen.queryByRole('button', { name: '결정 추가' })).toBeNull()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
})

test('결정을 쓰는 중 다른 사람이 안건을 빼면 쓰던 결정도 옮겨 쓸 글로 남는다', async () => {
  const meeting = sample()
  const { rerender } = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  fireEvent.change(screen.getByLabelText(/결정 내용/), { target: { value: '쓰던 결정' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME })}
      meeting={{ ...meeting, agenda: [meeting.agenda[1]!] }}
      base={base}
      memberId={ME}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )
  expect(screen.getByText('빠진 안건에 쓰던 글')).toBeTruthy()
  expect(screen.getByText(/쓰던 결정/)).toBeTruthy()
})

test('남겨 둔 안건 고치기 글은 처음 본 판으로 보내 상대가 그사이 고친 것을 덮지 않는다', async () => {
  const meeting = sample()
  const first = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  fireEvent.change(screen.getByLabelText(/안건 제목/), { target: { value: '내가 고친 제목' } })
  first.unmount()
  await act(async () => {})
  const newer = {
    ...meeting,
    agenda: [
      { ...meeting.agenda[0]!, title: '상대가 고친 제목', versionNo: 2 },
      meeting.agenda[1]!,
    ],
  }
  const path = `${base}/agenda/${meeting.agenda[0]!.id}`
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () => json({ meeting: newer }))
  draw(newer)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  expect(screen.getByLabelText<HTMLTextAreaElement>(/안건 제목/).value).toBe('내가 고친 제목')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  const sent = posts().filter(c => c.path === path)
  expect(sent.at(-1)!.body).toMatchObject({ title: '내가 고친 제목', baseVersionNo: 1 })
  cleanup()
  await act(async () => {})
})

test('개발용 StrictMode에서도 저장 실패한 논의 초안을 다시 열면 되살린다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'FAILED' }, 500))
  const strict = () => (
    <StrictMode>
      <MeetingMinutes
        view={councilView(MEETING_COUNCIL, { memberId: ME })}
        meeting={meeting}
        base={base}
        memberId={ME}
        selectedId={null}
        onSelect={select}
        onSaved={changed}
      />
    </StrictMode>
  )
  const first = render(strict())
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '엄격 모드 초안' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  first.unmount()
  await act(async () => {})
  render(strict())
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('엄격 모드 초안')
  cleanup()
  await act(async () => {})
})

test('앞 폼의 늦은 저장 성공은 다시 연 폼이 남긴 새 글을 지우지 않는다', async () => {
  const meeting = sample()
  const path = `${base}/agenda/${meeting.agenda[0]!.id}/decisions`
  const late = deferredResponse()
  api.on('POST', path, () => late.promise)
  const first = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  fireEvent.change(screen.getByLabelText(/결정 내용/), { target: { value: '앞 결정' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  first.unmount()
  const second = draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  fireEvent.change(screen.getByLabelText(/결정 내용/), { target: { value: '새 결정' } })
  late.resolve(json({ meeting }))
  await act(async () => {})
  second.unmount()
  draw(meeting)
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  expect(screen.getByLabelText<HTMLTextAreaElement>(/결정 내용/).value).toBe('새 결정')
})
