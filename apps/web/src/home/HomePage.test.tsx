// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { councilView } from '@/test-support/council-fixtures'
import { homeResponse, homeTask, homeWithTasks, onHomeExtras } from '@/test-support/home-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const pathNow = () => window.location.pathname + window.location.search

const path = '/api/organizations/c1/home'

function open(handler: () => Response | Promise<Response>) {
  const api = mockApi()
  api.on('GET', path, handler)
  onHomeExtras(api)
  const onOpenPage = vi.fn()
  const onOpenRequest = vi.fn()
  const onOpenEvent = vi.fn()
  const onForbidden = vi.fn()
  render(
    <HomePage
      view={councilView('c1')}
      onOpenRequest={onOpenRequest}
      onOpenEvent={onOpenEvent}
      onOpenPage={onOpenPage}
      onForbidden={onForbidden}
    />,
  )
  return { api, onOpenPage, onOpenRequest, onOpenEvent, onForbidden }
}

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

test('불러오는 동안 안내가 보인다', () => {
  open(() => deferredResponse().promise)
  expect(screen.getByText('홈 불러오는 중…')).toBeTruthy()
})

test('내 업무는 지남과 오늘만 줄로 보이고 그 뒤는 수만 둔다. 줄을 누르면 그 업무가 열린다', async () => {
  open(() =>
    json(
      homeWithTasks(
        [
          homeTask('a', 'overdue', { dueDate: '2026-10-21' }),
          homeTask('b', 'today', {
            dueDate: '2026-10-23',
            event: { id: 'e1', name: '신입생 환영회' },
          }),
          homeTask('c', 'soon'),
        ],
        { later: 4 },
      ),
    ),
  )
  const mine = await screen.findByRole('region', { name: '내 업무' })
  fireEvent.click(within(mine).getByRole('button', { name: /업무 a/ }))
  expect(pathNow()).toBe('/tasks/c1/a')
  expect(within(mine).getByText('2일 지남')).toBeTruthy()
  expect(within(mine).getByText('오늘')).toBeTruthy()
  expect(within(mine).getByText('신입생 환영회')).toBeTruthy()
  expect(within(mine).queryByRole('button', { name: /업무 c/ })).toBeNull()
  expect(screen.getByText('7일 안 1 · 나중 4')).toBeTruthy()
  fireEvent.click(within(mine).getByRole('button', { name: '모두 보기' }))
  expect(pathNow()).toBe('/tasks/c1')
})

test('맨 위 숫자 카드는 줄 수가 아니라 전체 수다', async () => {
  open(() => json(homeWithTasks([homeTask('a', 'overdue')], { overdue: 12 })))
  const tiles = await screen.findByRole('region', { name: '지금 볼 것' })
  expect(within(tiles).getByRole('button', { name: /지난 내 업무\s*12/ })).toBeTruthy()
})

test('오늘까지 할 업무가 없으면 한 줄로 말하고 그 뒤 수를 둔다', async () => {
  open(() =>
    json(
      homeResponse({
        mine: { tasks: [], counts: { overdue: 0, today: 0, soon: 0, later: 2, noDue: 1 } },
      }),
    ),
  )
  expect(await screen.findByText('오늘까지 할 업무 없음')).toBeTruthy()
  expect(screen.getByText('나중 2 · 마감 없음 1')).toBeTruthy()
})

test('실패하면 다시 불러오기로 새로 읽는다', async () => {
  let calls = 0
  open(() => {
    calls += 1
    return calls === 1 ? json({ code: 'INTERNAL' }, 500) : json(homeResponse())
  })
  fireEvent.click(await screen.findByRole('button', { name: '다시 불러오기' }))
  expect(await screen.findByText('오늘까지 할 업무 없음')).toBeTruthy()
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
  await screen.findByText('오늘까지 할 업무 없음')
  setVisibility('hidden')
  expect(calls).toBe(1)
})
