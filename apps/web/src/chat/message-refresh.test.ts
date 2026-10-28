import { afterEach, expect, test, vi } from 'vitest'
import { message, messagePage } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { readRoomUpdates } from './message-refresh'

afterEach(() => vi.unstubAllGlobals())

const where = { councilId: 'c1', roomId: 'r1' }
const base = '/api/organizations/c1/rooms/r1/messages'
const cursor = { firstId: 'a1', lastId: 'a2' }

test('새 글을 읽는 사이 화면을 떠나면 삭제 확인 요청을 시작하지 않는다', async () => {
  const api = mockApi()
  api.on('GET', `${base}?after=a2`, () => json(messagePage([])))
  const onPage = vi.fn(() => false)
  const onRefresh = vi.fn(() => true)
  expect(await readRoomUpdates(where, cursor, onPage, onRefresh)).toBe('done')
  expect(api.calls.map(call => call.path)).toEqual([`${base}?after=a2`])
  expect(onPage).toHaveBeenCalledTimes(1)
  expect(onRefresh).not.toHaveBeenCalled()
})

test('삭제 확인 중 화면을 떠나면 남은 옛 쪽을 요청하지 않는다', async () => {
  const api = mockApi()
  api.on('GET', `${base}?after=a2`, () => json(messagePage([])))
  api.on('GET', base, () => json(messagePage([message('a2', '최근 글')], { hasOlder: true })))
  const onPage = vi.fn(() => true)
  const onRefresh = vi.fn(() => false)
  expect(await readRoomUpdates(where, cursor, onPage, onRefresh)).toBe('done')
  expect(api.calls.map(call => call.path)).toEqual([`${base}?after=a2`, base])
  expect(onPage).toHaveBeenCalledTimes(1)
  expect(onRefresh).toHaveBeenCalledTimes(1)
})
