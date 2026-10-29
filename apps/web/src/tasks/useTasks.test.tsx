// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { taskDetail } from '@/test-support/task-detail-fixtures'
import { useTasks } from './useTasks'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const base = '/api/organizations/c1/tasks?view=all&status=open'

test('거르기를 바꾼 뒤 이전 거르기의 다시 읽기가 끝나도 지금 거르기의 목록을 읽는다', async () => {
  const api = mockApi()
  const now = deferredResponse()
  api.on('GET', `${base}&due=overdue`, () => json({ tasks: [], truncated: false }))
  // 지금 거르기의 읽기는 둘(처음 읽기와 옛 reload)이고 같은 답을 받는다.
  api.on('GET', `${base}&due=none`, () => now.promise.then(response => response.clone()))
  const { result, rerender } = renderHook(
    ({ due }) => useTasks('c1', { view: 'all', filter: 'open', narrow: { due } }, () => {}),
    {
      initialProps: { due: 'overdue' },
    },
  )
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  const oldReload = result.current.reload
  rerender({ due: 'none' })
  // 바꾸기 전에 보낸 변경이 끝나 옛 다시 읽기를 부른다. 지금 거르기의 읽기가 아직 오는 중이다.
  const reloaded = oldReload()
  now.resolve(json({ tasks: [taskDetail({ title: '마감 없는 업무' })], truncated: false }))
  await act(async () => {
    await reloaded
  })
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  const { state } = result.current
  expect(state.kind === 'ready' && state.tasks.map(task => task.title)).toEqual(['마감 없는 업무'])
  api.assertNoUnexpectedRequests()
})

test('꺼져 있을 때 받은 reload를 켜진 뒤 늦게 불러도 지금 읽기가 남는다', async () => {
  const api = mockApi()
  const now = deferredResponse()
  api.on('GET', base, () => now.promise.then(response => response.clone()))
  const { result, rerender } = renderHook(
    ({ enabled }) => useTasks('c1', { view: 'all', filter: 'open' }, () => {}, enabled),
    { initialProps: { enabled: false } },
  )
  const oldReload = result.current.reload
  rerender({ enabled: true })
  const reloaded = oldReload()
  now.resolve(json({ tasks: [taskDetail({ title: '켜진 뒤 업무' })], truncated: false }))
  await act(async () => {
    await reloaded
  })
  await waitFor(() => expect(result.current.state.kind).toBe('ready'))
  api.assertNoUnexpectedRequests()
})
