// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { EventSummary } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { event } from '../test-support/workflow-fixtures'
import EventCompletionControl from './EventCompletionControl'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const path = '/api/organizations/o/events/e/completion'
// 지난 행사(정리 중)
const ended = (): EventSummary => ({ ...event(), startsAt: '2026-09-20T10:00', endsAt: '2026-09-20T18:00' })
function setup(target: EventSummary) {
  const api = mockApi()
  const onChanged = vi.fn()
  const onStale = vi.fn()
  render(<EventCompletionControl event={target} onChanged={onChanged} onStale={onStale} />)
  return { api, onChanged, onStale }
}
async function openDialog(name: string, title: string) {
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.findByRole('dialog', { name: title })
}

test('정산 전이면 이유를 보이고 완료하기를 끈다. 남은 업무와 끝나지 않은 행사는 알리기만 한다', async () => {
  const { api } = setup(event())
  api.on('GET', path, () => json({ settled: false, openTasks: 2 }))
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  expect(await within(dialog).findByText('재정 탭에서 먼저 정산해 주세요.')).toBeTruthy()
  expect(within(dialog).getByText('끝나지 않은 업무 2개는 그대로 남아요.')).toBeTruthy()
  expect(within(dialog).getByText('아직 행사가 끝나지 않았어요.')).toBeTruthy()
  expect((within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement).disabled).toBe(true)
  api.assertNoUnexpectedRequests()
})

test('날짜 없는 행사도 정산했으면 완료할 수 있다. 끝나지 않았다는 알림만 보인다', async () => {
  const { api } = setup(event())
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  expect(within(dialog).getByText('아직 행사가 끝나지 않았어요.')).toBeTruthy()
  expect(within(dialog).queryByText(/끝나지 않은 업무/)).toBeNull()
})

test('정산한 행사를 완료하면 바뀐 행사를 넘기고 닫는다', async () => {
  const target = ended()
  const { api, onChanged } = setup(target)
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  api.on('POST', path, () => json({ event: { ...target, version: 2, completedAt: '2026-10-12T01:00:00.000Z' } }))
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  expect(within(dialog).queryByText('아직 행사가 끝나지 않았어요.')).toBeNull()
  fireEvent.click(confirm)
  await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ id: 'e', completedAt: '2026-10-12T01:00:00.000Z' })))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 1 })
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('완료한 행사는 완료 취소를 묻고 되돌린다', async () => {
  const target = { ...ended(), version: 2, completedAt: '2026-10-12T01:00:00.000Z' }
  const { api, onChanged } = setup(target)
  api.on('POST', `${path}/cancel`, () => json({ event: { ...target, version: 3, completedAt: null } }))
  const dialog = await openDialog('완료 취소', '완료를 취소할까요?')
  fireEvent.click(within(dialog).getByRole('button', { name: '완료 취소' }))
  await vi.waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ completedAt: null, version: 3 })))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ version: 2 })
  api.assertNoUnexpectedRequests()
})

test('남이 먼저 바꿨으면 이유를 보이고 행사 목록을 새로 받게 한다', async () => {
  const target = ended()
  const { api, onStale, onChanged } = setup(target)
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  fireEvent.click(confirm)
  expect(await within(dialog).findByText('다른 곳에서 행사가 먼저 바뀌었어요. 행사 목록을 새로 불러왔어요.')).toBeTruthy()
  expect(onStale).toHaveBeenCalled()
  expect(onChanged).not.toHaveBeenCalled()
})

// 행사 목록을 다시 받는 것처럼 onStale이 행사를 새 값으로 바꾼다(Workspace와 같다).
function Stateful({ initial, refreshed }: { initial: EventSummary; refreshed: EventSummary }) {
  const [current, setCurrent] = useState(initial)
  return <EventCompletionControl event={current} onChanged={setCurrent} onStale={() => setCurrent(refreshed)} />
}

test('다른 회장단이 먼저 완료했으면 대화상자가 완료 취소로 바뀌지 않고 이미 완료했다고 알린다', async () => {
  const target = ended()
  const api = mockApi()
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  api.on('POST', path, () => json({ error: 'VERSION_CONFLICT' }, 409))
  render(<Stateful initial={target} refreshed={{ ...target, version: 2, completedAt: '2026-10-12T01:00:00.000Z' }} />)
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  const confirm = within(dialog).getByRole('button', { name: '완료하기' }) as HTMLButtonElement
  await vi.waitFor(() => expect(confirm.disabled).toBe(false))
  fireEvent.click(confirm)
  const current = await screen.findByRole('dialog', { name: '행사를 완료할까요?' })
  expect(await within(current).findByText('다른 회장단이 이미 완료했어요.')).toBeTruthy()
  expect(within(current).queryByRole('button', { name: '완료 취소' })).toBeNull()
  expect(within(current).queryByRole('button', { name: '완료하기' })).toBeNull()
  // 대화상자 위의 닫기(X)와 아래 [닫기] 둘이다.
  expect(within(current).getAllByRole('button', { name: '닫기' }).length).toBeGreaterThan(0)
})

test('다른 회장단이 먼저 완료를 취소했으면 완료하기로 바뀌지 않고 이미 취소했다고 알린다', async () => {
  const target = { ...ended(), version: 2, completedAt: '2026-10-12T01:00:00.000Z' }
  const api = mockApi()
  api.on('POST', `${path}/cancel`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  render(<Stateful initial={target} refreshed={{ ...target, version: 3, completedAt: null }} />)
  const dialog = await openDialog('완료 취소', '완료를 취소할까요?')
  fireEvent.click(within(dialog).getByRole('button', { name: '완료 취소' }))
  const current = await screen.findByRole('dialog', { name: '완료를 취소할까요?' })
  expect(await within(current).findByText('다른 회장단이 이미 완료를 취소했어요.')).toBeTruthy()
  expect(within(current).queryByRole('button', { name: '완료하기' })).toBeNull()
  expect(within(current).queryByRole('button', { name: '완료 취소' })).toBeNull()
})

test('완료 대화상자는 결과보고서가 행사 기록으로 저절로 채워진다고 알린다', async () => {
  const { api } = setup(ended())
  api.on('GET', path, () => json({ settled: true, openTasks: 0 }))
  const dialog = await openDialog('완료하기', '행사를 완료할까요?')
  expect(within(dialog).getByText(/결과보고서는 행사 기록으로 저절로 채워져요\./)).toBeTruthy()
})
