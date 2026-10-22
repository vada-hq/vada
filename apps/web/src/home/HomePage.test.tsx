// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { homeResponse, homeTask, homeWithTasks } from '@/test-support/home-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const path = '/api/organizations/c1/home'

function open(handler: () => Response | Promise<Response>) {
  const api = mockApi()
  api.on('GET', path, handler)
  const onOpenTask = vi.fn()
  const onOpenPage = vi.fn()
  const onForbidden = vi.fn()
  render(
    <HomePage
      view={councilView('c1')}
      onOpenTask={onOpenTask}
      onOpenPage={onOpenPage}
      onForbidden={onForbidden}
    />,
  )
  return { api, onOpenTask, onOpenPage, onForbidden }
}

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

test('불러오는 동안 안내가 보인다', () => {
  open(() => deferredResponse().promise)
  expect(screen.getByText('홈 불러오는 중…')).toBeTruthy()
})

test('내 업무가 지남·오늘·7일 안 묶음으로 수와 함께 보이고 줄을 누르면 그 업무가 열린다', async () => {
  const { onOpenTask, onOpenPage } = open(() =>
    json(
      homeWithTasks(
        [
          homeTask('a', 'overdue'),
          homeTask('b', 'today', { event: { id: 'e1', name: '신입생 환영회' } }),
          homeTask('c', 'soon'),
        ],
        { later: 4 },
      ),
    ),
  )
  const overdue = await screen.findByRole('group', { name: /지남/ })
  fireEvent.click(within(overdue).getByRole('button', { name: /업무 a/ }))
  expect(onOpenTask).toHaveBeenCalledWith('a')
  const today = screen.getByRole('group', { name: /오늘/ })
  expect(within(today).getByText('신입생 환영회')).toBeTruthy()
  expect(screen.getByRole('group', { name: /7일 안/ })).toBeTruthy()
  expect(screen.getByText('그 뒤 4개')).toBeTruthy()
  fireEvent.click(within(today).getByRole('button', { name: '모두 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('tasks')
})

test('줄보다 수가 많으면 묶음의 수는 전체 수다', async () => {
  open(() => json(homeWithTasks([homeTask('a', 'overdue')], { overdue: 12 })))
  const overdue = await screen.findByRole('group', { name: '지남 12개' })
  expect(overdue).toBeTruthy()
})

test('내 업무가 없으면 한 줄로 말한다', async () => {
  open(() => json(homeResponse()))
  expect(await screen.findByText('지금 할 업무가 없어요.')).toBeTruthy()
  expect(screen.queryByRole('group')).toBeNull()
})

test('마감이 먼 업무와 마감 없는 업무만 있으면 수만 보인다', async () => {
  open(() =>
    json(
      homeResponse({
        mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 2, noDue: 1 } },
      }),
    ),
  )
  expect(await screen.findByText('그 뒤 2개')).toBeTruthy()
  expect(screen.getByText('마감 없음 1개')).toBeTruthy()
  expect(screen.queryByText('지금 할 업무가 없어요.')).toBeNull()
})

test('실패하면 다시 불러오기로 새로 읽는다', async () => {
  let calls = 0
  open(() => {
    calls += 1
    return calls === 1 ? json({ code: 'INTERNAL' }, 500) : json(homeResponse())
  })
  fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))
  expect(await screen.findByText('지금 할 업무가 없어요.')).toBeTruthy()
})

test('다시 불러오는 동안 [다시 불러오기]는 막혀 한 번만 읽는다', async () => {
  let calls = 0
  const retry = deferredResponse()
  open(() => {
    calls += 1
    return calls === 1 ? json({ code: 'INTERNAL' }, 500) : retry.promise
  })
  const button = await screen.findByRole('button', { name: '다시 불러오기' })
  fireEvent.click(button)
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true))
  fireEvent.click(button)
  expect(calls).toBe(2)
})

test('403이면 학생회를 다시 읽게 한다', async () => {
  const { onForbidden } = open(() => json({ code: 'FORBIDDEN' }, 403))
  await waitFor(() => expect(onForbidden).toHaveBeenCalled())
})

test('404면 불러오지 못했다고 하고 다시 불러오기를 준다', async () => {
  const { onForbidden } = open(() => json({ code: 'NOT_FOUND' }, 404))
  expect(await screen.findByRole('button', { name: '다시 불러오기' })).toBeTruthy()
  expect(onForbidden).not.toHaveBeenCalled()
})

test('화면이 다시 보이면 새로 읽고, 읽다 실패해도 보이던 것은 그대로다', async () => {
  let calls = 0
  open(() => {
    calls += 1
    return calls === 1 ? json(homeWithTasks([homeTask('a', 'today')])) : json({}, 500)
  })
  await screen.findByRole('button', { name: /업무 a/ })
  setVisibility('visible')
  await waitFor(() => expect(calls).toBe(2))
  expect(screen.getByRole('button', { name: /업무 a/ })).toBeTruthy()
})

test('보이지 않게 될 때는 읽지 않는다', async () => {
  let calls = 0
  open(() => {
    calls += 1
    return json(homeResponse())
  })
  await screen.findByText('지금 할 업무가 없어요.')
  setVisibility('hidden')
  expect(calls).toBe(1)
})
