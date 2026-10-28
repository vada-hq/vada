// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { roomList } from '@/test-support/chat-fixtures'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { useCouncilData } from './useCouncilData'
import { useWorkspaceLists } from './useWorkspaceLists'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const COUNCIL_ID = '0199d1a0-0000-7000-8000-0000000000c1'
const OTHER_COUNCIL_ID = '0199d1a0-0000-7000-8000-0000000000c2'

type ReadRooms = () => Response | Promise<Response>

function serveCouncil(api: ReturnType<typeof mockApi>, councilId: string, readRooms: ReadRooms) {
  const base = `/api/organizations/${councilId}`
  api.on('GET', base, () => json(councilView(councilId)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, readRooms)
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
}

function open(readRooms: ReadRooms) {
  serveCouncil(mockApi(), COUNCIL_ID, readRooms)
  const onLost = vi.fn()
  const onChanged = vi.fn()
  return renderHook(() => {
    const data = useCouncilData(COUNCIL_ID, onLost, onChanged)
    return useWorkspaceLists(COUNCIL_ID, data)
  })
}

test('방 목록의 안 읽음 합계를 배지에 보내고 0으로 바뀌면 지운다', async () => {
  const setAppBadge = vi.fn(async () => {})
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge, clearAppBadge })
  let unreadTotal = 120
  const { result } = open(() => json(roomList({ unreadTotal })))
  await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(120))
  unreadTotal = 0
  await act(async () => {
    await result.current.lists.rooms.reload()
  })
  expect(clearAppBadge).toHaveBeenCalledOnce()
})

test('목록을 다시 읽으면 같은 합계도 보내 푸시 점 배지를 숫자로 되돌린다', async () => {
  const setAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge })
  const { result } = open(() => json(roomList({ unreadTotal: 3 })))
  await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(3))
  setAppBadge.mockClear()
  await act(async () => {
    await result.current.lists.rooms.reload()
  })
  expect(setAppBadge).toHaveBeenCalledWith(3)
})

test('읽기 전이나 읽기 실패를 0으로 간주해 배지를 지우지 않는다', async () => {
  const setAppBadge = vi.fn(async () => {})
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge, clearAppBadge })
  const pending = deferredResponse()
  const { result } = open(() => pending.promise)
  await waitFor(() => expect(result.current.lists.rooms.state.kind).toBe('loading'))
  expect(clearAppBadge).not.toHaveBeenCalled()
  await act(async () => {
    pending.resolve(json({ error: 'unavailable' }, 500))
  })
  await waitFor(() => expect(result.current.lists.rooms.state.kind).toBe('failed'))
  expect(clearAppBadge).not.toHaveBeenCalled()
  expect(setAppBadge).not.toHaveBeenCalled()
})

test('미지원 환경에서도 방 목록과 안 읽음 합계는 읽는다', async () => {
  vi.stubGlobal('navigator', {})
  const { result } = open(() => json(roomList({ unreadTotal: 3 })))
  await waitFor(() => expect(result.current.counts.unread).toBe(3))
})

// 작업 공간은 학생회마다 key로 새로 그려진다(Workspace.tsx).
function CouncilLists({ councilId }: { councilId: string }) {
  const data = useCouncilData(councilId, vi.fn(), vi.fn())
  useWorkspaceLists(councilId, data)
  return null
}

test('학생회를 바꾸면 새 목록을 읽기 전에 이전 학생회의 배지를 지운다', async () => {
  const setAppBadge = vi.fn(async () => {})
  const clearAppBadge = vi.fn(async () => {})
  vi.stubGlobal('navigator', { setAppBadge, clearAppBadge })
  const api = mockApi()
  serveCouncil(api, COUNCIL_ID, () => json(roomList({ unreadTotal: 5 })))
  const pending = deferredResponse()
  serveCouncil(api, OTHER_COUNCIL_ID, () => pending.promise)
  const view = render(<CouncilLists key={COUNCIL_ID} councilId={COUNCIL_ID} />)
  await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(5))
  view.rerender(<CouncilLists key={OTHER_COUNCIL_ID} councilId={OTHER_COUNCIL_ID} />)
  await waitFor(() => expect(clearAppBadge).toHaveBeenCalledOnce())
  await act(async () => {
    pending.resolve(json({ error: 'unavailable' }, 500))
  })
  expect(setAppBadge).toHaveBeenCalledOnce()
})
