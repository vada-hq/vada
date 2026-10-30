// @vitest-environment jsdom
import { useState } from 'react'
import type { MeetingDetail, MeetingPerson } from '@vada/contracts'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { councilView } from '@/test-support/council-fixtures'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { meetingSample, MEETING_COUNCIL, MEETING_ID } from './test-support/meeting-samples'
import { MeetingMinutes } from './MeetingMinutes'
import { resetKeptMinutes } from './minutes-drafts'

const base = `/api/organizations/${MEETING_COUNCIL}/meetings/${MEETING_ID}`
const ME: MeetingPerson = {
  id: '0199d1a0-0000-7000-8000-00000000aaa1',
  name: '김회장',
  current: true,
}
const OTHER: MeetingPerson = {
  id: '0199d1a0-0000-7000-8000-00000000bbb1',
  name: '정하늘',
  current: true,
}
const CONFLICT = /먼저 고쳤어요/
let api: ReturnType<typeof mockApi>
beforeEach(() => {
  api = mockApi()
  api.on('GET', `/api/organizations/${MEETING_COUNCIL}/tasks/options`, () =>
    json({ departments: [], linkableEvents: [] }),
  )
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  resetLeaveGuard()
  resetKeptMinutes()
  vi.useRealTimers()
  api.assertNoUnexpectedRequests()
  vi.unstubAllGlobals()
})

type Sent = { baseVersionNo: number; [field: string]: unknown }
// 서버처럼 안건 하나의 판을 지킨다. 제목·설명·논의가 판을 같이 쓰고, 옛 판으로 오면 409다.
function agendaServer(notes: string | null = null) {
  const sample = meetingSample({ status: 'in_progress', actions: ['meeting.minutes'] })
  let meeting: MeetingDetail = { ...sample, agenda: [{ ...sample.agenda[0]!, notes }] }
  const item = () => meeting.agenda[0]!
  const path = `${base}/agenda/${item().id}`
  const edit = (patch: object, by: MeetingPerson) => {
    const versionNo = item().versionNo + 1
    meeting = { ...meeting, agenda: [{ ...item(), ...patch, versionNo, updatedBy: by }] }
  }
  const answer = ({ body }: { body: unknown }) => {
    const { baseVersionNo, ...patch } = body as Sent
    if (baseVersionNo !== item().versionNo) return json({ error: 'VERSION_CONFLICT' }, 409)
    edit(patch, ME)
    return json({ meeting })
  }
  api.on('POST', path, answer)
  api.on('GET', base, () => json({ meeting }))
  return { path, answer, edit, meeting: () => meeting }
}
function Live({ start }: { start: MeetingDetail }) {
  const [meeting, setMeeting] = useState(start)
  return (
    <MeetingMinutes
      view={councilView(MEETING_COUNCIL, { memberId: ME.id })}
      meeting={meeting}
      base={base}
      memberId={ME.id}
      selectedId={null}
      onSelect={() => {}}
      onSaved={setMeeting}
    />
  )
}
const flushed = () =>
  act(async () => {
    for (let turn = 0; turn < 10; turn += 1) await vi.advanceTimersByTimeAsync(0)
  })
const autosave = async () => {
  await act(() => vi.advanceTimersByTimeAsync(1500))
  await flushed()
}
const leaveMinutes = async (view: ReturnType<typeof render>) => {
  view.unmount()
  await flushed()
}
const notesField = () => screen.getByLabelText<HTMLTextAreaElement>('논의 내용')
const writeNotes = (value: string) => fireEvent.change(notesField(), { target: { value } })
const titleField = () => screen.getByLabelText<HTMLTextAreaElement>(/안건 제목/)
const openTitle = (value: string) => {
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  fireEvent.change(titleField(), { target: { value } })
}
const saveTitle = async (value: string) => {
  openTitle(value)
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await flushed()
}
const sent = () => api.calls.filter(c => c.method === 'POST').map(c => c.body as Sent)
const sentWith = (field: 'title' | 'notes') => sent().filter(body => field in body)
const reads = () => api.calls.filter(c => c.method === 'GET' && c.path === base)

test('논의를 쓰는 중 제목을 저장하면 논의는 충돌 없이 새 판으로 저장된다', async () => {
  const server = agendaServer()
  render(<Live start={server.meeting()} />)
  writeNotes('쓰던 논의')
  await saveTitle('고친 제목')
  await autosave()
  expect(sent()).toEqual([
    expect.objectContaining({ title: '고친 제목', baseVersionNo: 1 }),
    { notes: '쓰던 논의', baseVersionNo: 2 },
  ])
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(notesField().value).toBe('쓰던 논의')
  expect(reads()).toHaveLength(0)
  expect(server.meeting().agenda[0]!.notes).toBe('쓰던 논의')
})

test('제목 저장과 엇갈린 자동 저장이 409를 받아도 논의가 그대로면 새 판으로 다시 보낸다', async () => {
  const server = agendaServer()
  const late = deferredResponse()
  api.on('POST', server.path, async call => {
    if ('notes' in (call.body as Sent)) await late.promise
    return server.answer(call)
  })
  render(<Live start={server.meeting()} />)
  writeNotes('엇갈린 논의')
  await autosave()
  await saveTitle('고친 제목')
  late.resolve(json({}))
  api.on('POST', server.path, server.answer)
  await flushed()
  expect(sentWith('notes').map(body => body.baseVersionNo)).toEqual([1, 2])
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(notesField().value).toBe('엇갈린 논의')
  expect(server.meeting().agenda[0]!.notes).toBe('엇갈린 논의')
})

test('안건 고치기 폼을 연 채 논의가 자동 저장돼도 제목 저장이 거절되지 않는다', async () => {
  const server = agendaServer()
  render(<Live start={server.meeting()} />)
  openTitle('고친 제목')
  writeNotes('자동 저장된 논의')
  await autosave()
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await flushed()
  expect(sent().at(-1)).toMatchObject({ title: '고친 제목', baseVersionNo: 2 })
  expect(sentWith('title')).toHaveLength(1)
  expect(reads()).toHaveLength(0)
  expect(screen.queryByLabelText(/안건 제목/)).toBeNull()
  expect(screen.queryByText(CONFLICT)).toBeNull()
})

test('자동 저장과 엇갈린 제목 저장이 409를 받아도 폼의 칸이 그대로면 새 판으로 다시 보낸다', async () => {
  const server = agendaServer()
  const late = deferredResponse()
  api.on('POST', server.path, async call => {
    if ('title' in (call.body as Sent)) await late.promise
    return server.answer(call)
  })
  render(<Live start={server.meeting()} />)
  openTitle('엇갈린 제목')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  writeNotes('먼저 닿은 논의')
  await autosave()
  late.resolve(json({}))
  api.on('POST', server.path, server.answer)
  await flushed()
  expect(sentWith('title').map(body => body.baseVersionNo)).toEqual([1, 2])
  expect(screen.queryByLabelText(/안건 제목/)).toBeNull()
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(server.meeting().agenda[0]).toMatchObject({
    title: '엇갈린 제목',
    notes: '먼저 닿은 논의',
  })
})

test('다른 사람이 제목만 고친 판을 읽어도 쓰던 논의는 충돌이 아니다', async () => {
  const server = agendaServer('처음 논의')
  const { rerender } = render(<Live key="minutes" start={server.meeting()} />)
  writeNotes('처음 논의에 더한 글')
  server.edit({ title: '상대 제목' }, OTHER)
  rerender(
    <MeetingMinutes
      key="minutes"
      view={councilView(MEETING_COUNCIL, { memberId: ME.id })}
      meeting={server.meeting()}
      base={base}
      memberId={ME.id}
      selectedId={null}
      onSelect={() => {}}
      onSaved={() => {}}
    />,
  )
  await autosave()
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(sent().at(-1)).toEqual({ notes: '처음 논의에 더한 글', baseVersionNo: 2 })
})

test.each([
  ['내 글로 덮기', '내 글', '내 글'],
  ['상대 글 쓰기', '상대 논의', '상대 논의'],
] as const)(
  '상대가 논의를 고친 뒤 내가 제목을 고쳐도 진짜 충돌로 보이고 내 글이 남아 [%s]을 고른다',
  async (button, finalText, finalServer) => {
    const server = agendaServer('처음 논의')
    render(<Live start={server.meeting()} />)
    writeNotes('내 글')
    server.edit({ notes: '상대 논의' }, OTHER)
    await saveTitle('고친 제목')
    await autosave()
    // 마지막으로 고친 사람은 나지만 충돌한 글은 상대 것이다. 내 이름을 상대로 보이지 않는다.
    expect(server.meeting().agenda[0]!.updatedBy?.id).toBe(ME.id)
    expect(screen.getByText('다른 사람이 먼저 고쳤어요')).toBeTruthy()
    expect(screen.getByLabelText<HTMLTextAreaElement>('내가 쓴 글').value).toBe('내 글')
    expect(screen.getByText('• 상대 논의')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: button }))
    await autosave()
    expect(notesField().value).toBe(finalText)
    expect(server.meeting().agenda[0]!.notes).toBe(finalServer)
    expect(screen.queryByText(CONFLICT)).toBeNull()
  },
)

test('충돌 중 나갔다 돌아와도 내 글이 남고 상대 글을 덮지 않은 채 충돌로 다시 보인다', async () => {
  const server = agendaServer('처음 논의')
  server.edit({ notes: '상대 논의' }, OTHER)
  const stale = {
    ...server.meeting(),
    agenda: [{ ...server.meeting().agenda[0]!, notes: '처음 논의', versionNo: 1 }],
  }
  const first = render(<Live start={stale} />)
  writeNotes('내 글')
  await autosave()
  expect(screen.getByText('정하늘님이 먼저 고쳤어요')).toBeTruthy()
  await leaveMinutes(first)
  render(<Live start={server.meeting()} />)
  await autosave()
  expect(screen.getByText('정하늘님이 먼저 고쳤어요')).toBeTruthy()
  expect(screen.getByLabelText<HTMLTextAreaElement>('내가 쓴 글').value).toBe('내 글')
  expect(server.meeting().agenda[0]!.notes).toBe('상대 논의')
  fireEvent.click(screen.getByRole('button', { name: '내 글로 덮기' }))
  await autosave()
  expect(sent().at(-1)).toEqual({ notes: '내 글', baseVersionNo: 2 })
  expect(server.meeting().agenda[0]!.notes).toBe('내 글')
})

test('저장 못 한 글을 두고 나간 사이 제목만 바뀌었으면 돌아와 충돌 없이 새 판으로 저장한다', async () => {
  const server = agendaServer('처음 논의')
  api.on('POST', server.path, () => json({ error: 'FAILED' }, 500))
  const first = render(<Live start={server.meeting()} />)
  writeNotes('남겨 둔 글')
  await autosave()
  await leaveMinutes(first)
  server.edit({ title: '바뀐 제목' }, ME)
  api.on('POST', server.path, server.answer)
  render(<Live start={server.meeting()} />)
  await autosave()
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(sent().at(-1)).toEqual({ notes: '남겨 둔 글', baseVersionNo: 2 })
  expect(server.meeting().agenda[0]!.notes).toBe('남겨 둔 글')
})

test('저장이 서버에 닿고 응답만 잃은 글을 다시 보내도 같은 글이면 충돌이 아니다', async () => {
  const server = agendaServer()
  api.on('POST', server.path, call => {
    server.answer(call)
    return json({ error: 'FAILED' }, 500)
  })
  render(<Live start={server.meeting()} />)
  writeNotes('닿았던 글')
  await autosave()
  api.on('POST', server.path, server.answer)
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }))
  await flushed()
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(screen.queryByRole('button', { name: '다시 저장' })).toBeNull()
  expect(notesField().value).toBe('닿았던 글')
  expect(sent()).toHaveLength(2)
})

test('409 뒤 읽기가 실패해도 글을 지키고, 다시 저장 때 논의가 그대로면 새 판으로 보낸다', async () => {
  const server = agendaServer('처음 논의')
  const fresh = server.meeting()
  server.edit({ title: '내 제목' }, ME)
  api.on('GET', base, () => json({ error: 'FAILED' }, 500))
  render(<Live start={fresh} />)
  writeNotes('지킬 글')
  await autosave()
  expect(notesField().value).toBe('지킬 글')
  api.on('GET', base, () => json({ meeting: server.meeting() }))
  fireEvent.click(screen.getByRole('button', { name: '다시 저장' }))
  await flushed()
  expect(screen.queryByText(CONFLICT)).toBeNull()
  expect(sent().at(-1)).toEqual({ notes: '지킬 글', baseVersionNo: 2 })
  expect(server.meeting().agenda[0]!.notes).toBe('지킬 글')
})

test('다시 연 안건 고치기 폼도 논의 저장으로 오른 판을 이어 받는다', async () => {
  const server = agendaServer()
  const first = render(<Live start={server.meeting()} />)
  openTitle('남겨 둔 제목')
  await leaveMinutes(first)
  server.edit({ notes: '그사이 저장된 논의' }, ME)
  render(<Live start={server.meeting()} />)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  expect(titleField().value).toBe('남겨 둔 제목')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await flushed()
  expect(sent().at(-1)).toMatchObject({ title: '남겨 둔 제목', baseVersionNo: 2 })
  expect(screen.queryByLabelText(/안건 제목/)).toBeNull()
  expect(reads()).toHaveLength(0)
})

test('409 뒤 다시 읽는 사이 화면을 떠나면 제목을 다시 보내지 않고 쓰던 글을 남긴다', async () => {
  const server = agendaServer()
  const stale = server.meeting()
  server.edit({ notes: '그사이 저장된 논의' }, ME)
  const slow = deferredResponse()
  api.on('GET', base, () => slow.promise)
  const first = render(<Live start={stale} />)
  openTitle('남길 제목')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await flushed()
  await leaveMinutes(first)
  slow.resolve(json({ meeting: server.meeting() }))
  await flushed()
  expect(sentWith('title')).toHaveLength(1)
  expect(server.meeting().agenda[0]!.title).not.toBe('남길 제목')
  render(<Live start={server.meeting()} />)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  expect(titleField().value).toBe('남길 제목')
})

test('다시 연 안건 고치기 폼은 상대가 제목을 고쳤으면 판을 잇지 않고 상대 제목을 덮지 않는다', async () => {
  const server = agendaServer()
  const first = render(<Live start={server.meeting()} />)
  openTitle('내 제목')
  await leaveMinutes(first)
  server.edit({ title: '상대 제목' }, OTHER)
  render(<Live start={server.meeting()} />)
  fireEvent.click(screen.getByRole('button', { name: '안건 고치기' }))
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await flushed()
  expect(sentWith('title').map(body => body.baseVersionNo)).toEqual([1])
  expect(server.meeting().agenda[0]!.title).toBe('상대 제목')
  expect(titleField().value).toBe('내 제목')
  expect(screen.getByText(CONFLICT)).toBeTruthy()
})
