// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { meetingSample, MEETING_COUNCIL, MEETING_ID } from './test-support/meeting-samples'
import { MeetingMinutes } from './MeetingMinutes'
import { MeetingList } from './MeetingList'
import { hasDirtyEntry } from './minutes-entry'
import { resetLeaveGuard } from '@/lib/leave-guard'

const base = `/api/organizations/${MEETING_COUNCIL}/meetings/${MEETING_ID}`
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
  vi.useFakeTimers()
  changed.mockClear()
  select.mockClear()
})
afterEach(() => {
  cleanup()
  resetLeaveGuard()
  vi.useRealTimers()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
})
const posts = () => api.calls.filter(c => c.method === 'POST')
const draw = (meeting = sample()) =>
  render(
    <MeetingMinutes
      meeting={meeting}
      base={base}
      selectedId={null}
      onSelect={select}
      onSaved={changed}
    />,
  )

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
      meeting={readonly}
      base={base}
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
      meeting={{ ...meeting, agenda: meeting.agenda.map(a => ({ ...a, notes: '서버 글' })) }}
      base={base}
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
      meeting={fresh}
      base={base}
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

test('저장 실패한 초안은 화면을 다시 열면 남지 않는다(다른 계정에 새지 않음)', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'FAILED' }, 500))
  const first = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '앞사람 초안' } })
  await act(() => vi.advanceTimersByTimeAsync(1500))
  first.unmount()
  await act(async () => {})
  draw(meeting)
  expect(screen.getByLabelText<HTMLTextAreaElement>('논의 내용').value).toBe(
    meeting.agenda[0]!.notes ?? '',
  )
})

test('다른 사람이 뺀 안건에 쓰던 글은 옮겨 쓸 수 있게 남는다', async () => {
  const meeting = sample()
  api.on('POST', `${base}/agenda/${meeting.agenda[0]!.id}`, () => json({ error: 'NOT_FOUND' }, 404))
  const { rerender } = draw(meeting)
  fireEvent.change(screen.getByLabelText('논의 내용'), { target: { value: '빠진 곳의 글' } })
  rerender(
    <MeetingMinutes
      meeting={{ ...meeting, agenda: [meeting.agenda[1]!] }}
      base={base}
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
      meeting={{ ...meeting, actions: [] }}
      base={base}
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
