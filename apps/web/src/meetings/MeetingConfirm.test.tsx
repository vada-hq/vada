// @vitest-environment jsdom
import { useState } from 'react'
import type { MeetingDetail } from '@vada/contracts'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { councilView } from '@/test-support/council-fixtures'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { PageTrailProvider } from '@/components/PageHeading'
import { MeetingMinutes } from './MeetingMinutes'
import { resetKeptMinutes } from './minutes-drafts'
import { minutesSample } from './test-support/minutes-samples'
import { MEETING_COUNCIL, MEETING_MEMBER } from './test-support/meeting-samples'

const sample = (): MeetingDetail => ({
  ...minutesSample(),
  actions: ['meeting.minutes', 'meeting.confirm'],
})
const done = (meeting = sample()): MeetingDetail => ({
  ...meeting,
  status: 'done',
  minutesStatus: 'confirmed',
  actions: ['meeting.amend'],
  confirmedAt: '2026-10-29T07:30:00Z',
  confirmedBy: { id: MEETING_MEMBER, name: '박해랑', current: true },
})
const initial = sample()
const base = `/api/organizations/${MEETING_COUNCIL}/meetings/${initial.id}`
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  api = mockApi()
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
})
afterEach(() => {
  cleanup()
  resetLeaveGuard()
  resetKeptMinutes()
  vi.useRealTimers()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
})
const posts = () => api.calls.filter(call => call.method === 'POST')
function Minutes({ meeting: first }: { meeting: MeetingDetail }) {
  const [meeting, setMeeting] = useState(first)
  return (
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL)}
      memberId={MEETING_MEMBER}
      meeting={meeting}
      base={base}
      selectedId={null}
      onSelect={() => {}}
      onSaved={setMeeting}
    />
  )
}
const draw = (meeting: MeetingDetail) => render(<Minutes meeting={meeting} />)
const ask = () => fireEvent.click(screen.getByRole('button', { name: '회의록 확정' }))
const confirm = () =>
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확정' }))

test('다루는 사람에게만 요약과 확정 버튼이 있고 빈 안건도 확정한다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/confirm`, () => json({ meeting: done(meeting) }))
  const { unmount } = draw(meeting)
  expect(screen.getByText('결정 2 · 후속 업무 0 · 비어 있는 안건 1')).toBeTruthy()
  ask()
  confirm()
  expect(await screen.findByText('완료된 회의록')).toBeTruthy()
  expect(posts().map(call => call.path)).toEqual([`${base}/confirm`])
  unmount()
  draw({ ...sample(), actions: ['meeting.minutes'] })
  expect(screen.queryByRole('button', { name: '회의록 확정' })).toBeNull()
  expect(screen.queryByText(/비어 있는 안건/)).toBeNull()
})

test('확정은 모든 안건의 저장 중 요청과 이어 쓴 글까지 저장한 다음 보낸다', async () => {
  vi.useFakeTimers()
  const meeting = sample()
  const first = meeting.agenda[0]!
  const second = meeting.agenda[1]!
  const pending = deferredResponse()
  const firstPath = `${base}/agenda/${first.id}`
  api.on('POST', firstPath, () => pending.promise)
  const { rerender } = render(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL)}
      memberId={MEETING_MEMBER}
      meeting={meeting}
      base={base}
      selectedId={first.id}
      onSelect={() => {}}
      onSaved={() => {}}
    />,
  )

  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '처음 글' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '이어 쓴 글' } })
  rerender(
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL)}
      memberId={MEETING_MEMBER}
      meeting={meeting}
      base={base}
      selectedId={second.id}
      onSelect={() => {}}
      onSaved={() => {}}
    />,
  )
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '둘째 글' } })
  api.on('POST', `${base}/agenda/${second.id}`, () => json({ meeting }))
  api.on('POST', `${base}/confirm`, () => json({ meeting: done(meeting) }))
  ask()
  confirm()
  await act(async () => {})
  expect(posts().some(call => call.path.endsWith('/confirm'))).toBe(false)
  api.on('POST', firstPath, () =>
    json({
      meeting: {
        ...meeting,
        agenda: meeting.agenda.map(a => (a.id === first.id ? { ...a, versionNo: 3 } : a)),
      },
    }),
  )
  await act(async () => {
    pending.resolve(
      json({
        meeting: {
          ...meeting,
          agenda: meeting.agenda.map(a => (a.id === first.id ? { ...a, versionNo: 2 } : a)),
        },
      }),
    )
  })
  expect(posts().at(-1)!.path).toBe(`${base}/confirm`)
  const saves = posts().filter(call => call.path === firstPath)
  expect(saves.map(call => call.body)).toEqual([
    { notes: '처음 글', baseVersionNo: 1 },
    { notes: '이어 쓴 글', baseVersionNo: 2 },
  ])
})

test('공통 머리글에도 완료된 회의록 제목과 회의 이동 경로를 보낸다', () => {
  const send = vi.fn()
  const meeting = done()
  render(
    <PageTrailProvider value={send}>
      <Minutes meeting={meeting} />
    </PageTrailProvider>,
  )
  expect(send).toHaveBeenCalledWith({
    title: '완료된 회의록',
    crumbs: [{ label: meeting.title, truncate: true }],
  })
})

test('저장 실패·충돌 또는 쓰던 폼 글이 있으면 창 안에 오류를 보이고 확정하지 않는다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'FAILED' }, 500))
  const { unmount } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '저장 못 한 글' } })
  ask()
  confirm()
  const error = '저장하지 못한 글이 있어요. 저장한 뒤 확정해 주세요.'
  expect(await within(screen.getByRole('dialog')).findByText(error)).toBeTruthy()
  expect(posts().some(call => call.path.endsWith('/confirm'))).toBe(false)
  unmount()
  resetKeptMinutes()
  draw(sample())
  fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
  fireEvent.change(screen.getByLabelText('결정 내용'), { target: { value: '쓰던 결정' } })
  ask()
  confirm()
  expect(await within(screen.getByRole('dialog')).findByText(error)).toBeTruthy()
  expect(posts().some(call => call.path.endsWith('/confirm'))).toBe(false)
})

test('완료 회의록은 확정 사람·시각·결정·후속 업무를 모두 읽고 부원에게는 고치기만 없다', () => {
  const meeting = done()
  meeting.agenda[0]!.followUps = [
    {
      id: '0199d1a0-0000-7000-8000-000000000071',
      title: '연락망 정리',
      status: 'in_progress',
      dueDate: '2026-10-31',
      assignee: { id: MEETING_MEMBER, name: '김운영' },
    },
  ]
  draw({ ...meeting, actions: [] })
  expect(screen.getByText('완료된 회의록')).toBeTruthy()
  expect(screen.getByText('회의록 확정 완료')).toBeTruthy()
  expect(screen.getByText('10월 29일 (목) 16:30 박해랑 확정')).toBeTruthy()
  expect(screen.getAllByText('확정된 결정').length).toBe(2)
  expect(screen.getByText('후속 업무 진행 현황')).toBeTruthy()
  expect(screen.getByRole('button', { name: /연락망 정리/ })).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByRole('button', { name: '고치기' })).toBeNull()
})

test.each([
  { code: 'RECORD_CONFIRMED', status: 409, message: '확정된 회의록이에요. 새로 불러와 주세요.' },
  { code: 'REASON_REQUIRED', status: 400, message: '사유를 입력해 주세요.' },
  { code: 'FORBIDDEN', status: 403, message: '지금은 이 회의를 바꿀 수 없어요.' },
])(
  '다른 사람이 확정한 뒤 $code 저장 실패에도 초안과 폼 글이 남는다',
  async ({ code, status, message }: { code: string; status: number; message: string }) => {
    vi.useFakeTimers()
    const meeting = sample()
    const props = {
      view: councilView(MEETING_COUNCIL),
      memberId: MEETING_MEMBER,
      base,
      selectedId: null,
      onSelect: () => {},
      onSaved: () => {},
    }
    api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: code }, status))
    const { rerender } = render(<MeetingMinutes {...props} meeting={meeting} />)
    fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '확정 순간 내 글' } })
    fireEvent.click(screen.getByRole('button', { name: '결정 추가' }))
    fireEvent.change(screen.getByLabelText('결정 내용'), { target: { value: '쓰던 결정도 보존' } })
    await act(async () => {})
    rerender(<MeetingMinutes {...props} meeting={done(meeting)} />)
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect(screen.getByText('내가 쓴 글')).toBeTruthy()
    expect(screen.getByText('• 확정 순간 내 글')).toBeTruthy()
    expect(screen.getByText('쓰던 결정도 보존')).toBeTruthy()
    expect(screen.getByText(message)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  },
)

test.each(['agenda', 'decision'] as const)(
  '완료 회의록 %s 고치기는 사유를 칸 아래 확인한 뒤 저장한다',
  async (kind: 'agenda' | 'decision') => {
    const meeting = done()
    const agenda = meeting.agenda[0]!
    const itemId = kind === 'agenda' ? agenda.id : agenda.decisions[0]!.id
    const suffix = kind === 'agenda' ? `/agenda/${itemId}` : `/decisions/${itemId}`
    api.on('POST', `${base}${suffix}`, () => json({ meeting }))
    draw(meeting)
    const buttons = screen.getAllByRole('button', { name: '고치기' })
    fireEvent.click(buttons[kind === 'agenda' ? 0 : 1]!)
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    const reason = screen.getByLabelText<HTMLInputElement>('고친 사유')
    expect(reason.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('사유를 입력해 주세요')).toBeTruthy()
    expect(posts()).toHaveLength(0)
    fireEvent.change(reason, { target: { value: '회의 때 정한 내용을 바로잡음' } })
    if (kind === 'decision')
      fireEvent.change(screen.getByLabelText('근거'), { target: { value: '첫 근거\n다음 근거' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    await waitFor(() => expect(screen.queryByLabelText('고친 사유')).toBeNull())
    expect(posts()[0]!.path).toBe(`${base}${suffix}`)
    expect(posts()[0]!.body).toMatchObject({
      baseVersionNo: 1,
      reason: '회의 때 정한 내용을 바로잡음',
    })
    if (kind === 'decision')
      expect(posts()[0]!.body).toMatchObject({ rationale: '첫 근거\n다음 근거' })
  },
)

test('확정 요청 실패는 확인 창 안에 남는다', async () => {
  api.on('POST', `${base}/confirm`, () => json({ error: 'RECORD_CONFIRMED' }, 409))
  draw(sample())
  ask()
  confirm()
  expect(
    await within(screen.getByRole('dialog')).findByText('확정된 회의록이에요. 새로 불러와 주세요.'),
  ).toBeTruthy()
})

test('충돌한 논의 초안은 확정하지 않고 상대 글을 읽은 뒤에도 그대로 남긴다', async () => {
  const meeting = sample()
  const item = meeting.agenda[0]!
  api.on('POST', `${base}/agenda/${item.id}`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  api.on('GET', base, () =>
    json({
      meeting: {
        ...meeting,
        agenda: meeting.agenda.map(a => ({ ...a, notes: '상대 글', versionNo: 2 })),
      },
    }),
  )
  draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '충돌할 내 글' } })
  ask()
  confirm()
  expect(
    await within(screen.getByRole('dialog')).findByText(
      '저장하지 못한 글이 있어요. 저장한 뒤 확정해 주세요.',
    ),
  ).toBeTruthy()
  expect(posts().some(call => call.path.endsWith('/confirm'))).toBe(false)
  expect(screen.getByLabelText<HTMLTextAreaElement>('내가 쓴 글').value).toBe('충돌할 내 글')
})

test('완료 회의록 고치기 충돌·다시 그리기·다시 열기는 글과 처음 판을 보존한다', async () => {
  const meeting = done()
  const item = meeting.agenda[0]!
  const path = `${base}/agenda/${item.id}`
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  const fresh = {
    ...meeting,
    agenda: meeting.agenda.map(a => ({ ...a, title: '상대 제목', versionNo: 4 })),
  }
  api.on('GET', base, () => json({ meeting: fresh }))
  const { unmount } = draw(meeting)
  fireEvent.click(screen.getAllByRole('button', { name: '고치기' })[0]!)
  fireEvent.change(screen.getByLabelText('안건 제목'), { target: { value: '내가 고친 제목' } })
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '내가 고친 논의' } })
  fireEvent.change(screen.getByLabelText('고친 사유'), { target: { value: '설명 보완' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText(/다른 사람이 먼저 고쳤어요/)).toBeTruthy()
  expect(posts()[0]!.body).toMatchObject({
    baseVersionNo: 1,
    notes: '내가 고친 논의',
    reason: '설명 보완',
  })
  expect(screen.getByLabelText<HTMLInputElement>('안건 제목').value).toBe('내가 고친 제목')
  unmount()
  draw(fresh)
  fireEvent.click(screen.getAllByRole('button', { name: '고치기' })[0]!)
  expect(screen.getByLabelText<HTMLInputElement>('고친 사유').value).toBe('설명 보완')
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('내가 고친 논의')
  api.on('POST', path, () => json({ meeting: fresh }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByLabelText('고친 사유')).toBeNull())
  expect(posts()[1]!.body).toMatchObject({ baseVersionNo: 1, title: '내가 고친 제목' })
})

test('확정 순간 남은 초안으로 고치기를 시작하고 저장에 성공한 뒤에만 초안을 버린다', async () => {
  vi.useFakeTimers()
  const meeting = sample()
  const item = meeting.agenda[0]!
  const path = `${base}/agenda/${item.id}`
  api.on('POST', path, () => json({ error: 'RECORD_CONFIRMED' }, 409))
  const props = {
    view: councilView(MEETING_COUNCIL),
    memberId: MEETING_MEMBER,
    base,
    selectedId: null,
    onSelect: () => {},
    onSaved: () => {},
  }
  const { rerender } = render(<MeetingMinutes {...props} meeting={meeting} />)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '확정 순간의 논의' } })
  rerender(<MeetingMinutes {...props} meeting={done(meeting)} />)
  await act(() => vi.advanceTimersByTimeAsync(1500))
  fireEvent.click(screen.getAllByRole('button', { name: '고치기' })[0]!)
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('확정 순간의 논의')
  fireEvent.change(screen.getByLabelText('고친 사유'), { target: { value: '빠진 논의 반영' } })
  api.on('POST', path, () => json({ error: 'FAILED' }, 500))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe('확정 순간의 논의')
  api.on('POST', path, () => json({ meeting: done(meeting) }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await act(async () => {})
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByText('내가 쓴 글')).toBeNull()
})

test('완료 회의록으로 바뀌어도 열려 있던 후속 업무 창과 입력칸을 내리지 않는다', async () => {
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
  const props = {
    view: councilView(MEETING_COUNCIL),
    memberId: MEETING_MEMBER,
    base,
    selectedId: null,
    onSelect: () => {},
    onSaved: () => {},
  }
  const { rerender } = render(<MeetingMinutes {...props} meeting={meeting} />)
  fireEvent.click(await screen.findByRole('button', { name: '업무 만들기' }))
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^제목/ })
  fireEvent.change(input, { target: { value: '확정 때 쓰던 후속 업무' } })
  rerender(<MeetingMinutes {...props} meeting={done(meeting)} />)
  expect(screen.getByRole('dialog', { name: '업무 추가' })).toBeTruthy()
  expect(screen.getByRole('textbox', { name: /^제목/ })).toBe(input)
  expect(input.value).toBe('확정 때 쓰던 후속 업무')
})
