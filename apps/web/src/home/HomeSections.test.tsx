// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeCouncil, HomeDepartment, HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import {
  homeEvent,
  homeRequest,
  homeResponse,
  homeTask,
  noTasks,
} from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function open(home: HomeResponse) {
  mockApi().on('GET', '/api/organizations/c1/home', () => json(home))
  const fns = {
    onOpenTask: vi.fn(),
    onOpenRequest: vi.fn(),
    onOpenEvent: vi.fn(),
    onOpenPage: vi.fn(),
  }
  render(<HomePage view={councilView('c1')} onForbidden={vi.fn()} {...fns} />)
  return fns
}

const council = (extra: Partial<HomeCouncil> = {}): HomeCouncil => ({
  events: [],
  truncated: false,
  endedTotal: 0,
  blocked: [],
  overdue: noTasks,
  ...extra,
})

const department: HomeDepartment = {
  id: 'd1',
  name: '기획부',
  counts: { todo: 3, inProgress: 2, overdue: 1, unassigned: 1 },
  overdue: { tasks: [homeTask('late', 'overdue')], total: 1 },
  unassigned: {
    tasks: [homeTask('free', 'soon', { assignee: null })],
    total: 1,
  },
}

const received = { requests: [homeRequest('r1')], total: 1, truncated: false }

test('부분은 받은 것, 학생회, 내 부서, 정산할 행사, 내 업무 차례로 있는 것만 보인다', async () => {
  open(
    homeResponse({
      received,
      council: council(),
      departments: [department],
      settling: { events: [], total: 0 },
    }),
  )
  await screen.findByText('내 업무')
  const titles = screen.getAllByRole('heading', { level: 2 }).map(item => item.textContent)
  expect(titles).toEqual(['받은 것 1개', '학생회', '기획부', '정산할 행사', '내 업무'])
})

test('부분이 없는 사람에게는 내 업무만 보인다', async () => {
  open(homeResponse())
  await screen.findByText('내 업무')
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
})

test('내 부서 카드에 수와 지난·담당자 없는 업무 줄이 보이고 줄을 누르면 그 업무가 열린다', async () => {
  const { onOpenTask, onOpenPage } = open(homeResponse({ departments: [department] }))
  expect(await screen.findByText(/할 일 3 · 진행 중 2 · 지남 1/)).toBeTruthy()
  const late = screen.getByRole('group', { name: '지난 업무 1개' })
  fireEvent.click(within(late).getByRole('button', { name: /업무 late/ }))
  expect(onOpenTask).toHaveBeenCalledWith('late')
  const free = screen.getByRole('group', { name: '담당자 없는 업무 1개' })
  expect(within(free).getByText('담당자 없음')).toBeTruthy()
  fireEvent.click(within(free).getByRole('button', { name: '모두 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('tasks')
})

test('끝나지 않은 업무가 없는 부서는 한 줄로 말한다', async () => {
  const empty = { ...department, counts: { todo: 0, inProgress: 0, overdue: 0, unassigned: 0 } }
  open(homeResponse({ departments: [{ ...empty, overdue: noTasks, unassigned: noTasks }] }))
  expect(await screen.findByText('끝나지 않은 업무가 없어요.')).toBeTruthy()
})

test('학생회 행사 카드: 끝난 행사는 예산·정산 탭으로, 그 밖은 개요로 열리고 정산 수가 보인다', async () => {
  const { onOpenEvent } = open(
    homeResponse({
      council: council({
        events: [
          {
            event: homeEvent('e1', { status: 'ended' }),
            tasks: { done: 1, total: 4, overdue: 2, unassigned: 1 },
            settlement: { remaining: 3, settled: false },
          },
          {
            event: homeEvent('e2', { status: 'ended' }),
            tasks: { done: 2, total: 2, overdue: 0, unassigned: 0 },
            settlement: { remaining: 0, settled: true },
          },
          {
            event: homeEvent('e3', { status: 'upcoming' }),
            tasks: { done: 0, total: 0, overdue: 0, unassigned: 0 },
          },
        ],
        endedTotal: 2,
      }),
    }),
  )
  expect(await screen.findByText('정산에 남은 것 3')).toBeTruthy()
  expect(screen.getByText('완료할 수 있어요')).toBeTruthy()
  expect(screen.getByText('업무 1/4')).toBeTruthy()
  expect(screen.getByText('지남 2')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '행사 e1' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e1', 'money')
  fireEvent.click(screen.getByRole('button', { name: '행사 e3' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e3')
})

test('부서별 막힌 곳의 부서 없음 줄은 학생회 업무로 쓰고 지난 업무에 부서 이름이 붙는다', async () => {
  const { onOpenTask } = open(
    homeResponse({
      council: council({
        blocked: [
          { department: { id: 'd1', name: '기획부' }, overdue: 2, unassigned: 0 },
          { department: null, overdue: 0, unassigned: 3 },
        ],
        overdue: {
          tasks: [homeTask('old', 'overdue', { department: { id: 'd1', name: '재정부' } })],
          total: 11,
        },
      }),
    }),
  )
  const blocked = await screen.findByRole('group', { name: '부서별 막힌 곳' })
  expect(within(blocked).getByText('학생회 업무')).toBeTruthy()
  expect(within(blocked).getByText('기획부')).toBeTruthy()
  const overdue = screen.getByRole('group', { name: '지난 업무 11개' })
  expect(within(overdue).getByText('재정부')).toBeTruthy()
  fireEvent.click(within(overdue).getByRole('button', { name: /업무 old/ }))
  expect(onOpenTask).toHaveBeenCalledWith('old')
})

test('끝난 행사가 더 있거나 행사가 잘렸으면 알리고 모두 보기가 행사 화면으로 간다', async () => {
  const { onOpenPage } = open(
    homeResponse({
      council: council({
        events: [
          {
            event: homeEvent('e1', { status: 'ended' }),
            tasks: { done: 0, total: 0, overdue: 0, unassigned: 0 },
            settlement: { remaining: 1, settled: false },
          },
        ],
        endedTotal: 14,
        truncated: true,
      }),
    }),
  )
  expect(await screen.findByText('끝난 행사 14개 가운데 10개만 보여요.')).toBeTruthy()
  expect(screen.getByText('행사가 많아서 일부만 보여요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '모두 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('행사가 없으면 새 행사로 간다', async () => {
  const { onOpenPage } = open(homeResponse({ council: council() }))
  expect(await screen.findByText('아직 행사가 없어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 행사' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('받은 것의 요청 줄을 누르면 그 요청이 열린다', async () => {
  const { onOpenRequest } = open(homeResponse({ received }))
  fireEvent.click(await screen.findByRole('button', { name: /요청 r1/ }))
  expect(onOpenRequest).toHaveBeenCalledWith('r1')
  expect(screen.getByText('박부원')).toBeTruthy()
  expect(screen.getByText('10월 20일')).toBeTruthy()
})

test('받은 것이 잘렸으면 이상이라 알리고 모두 보기가 재정 화면으로 간다', async () => {
  const { onOpenPage } = open(
    homeResponse({ received: { requests: [homeRequest('r1')], total: 50, truncated: true } }),
  )
  expect(await screen.findByRole('heading', { name: '받은 것 50개 이상' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '모두 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('finance')
})

test('받은 것과 정산할 행사가 비면 한 줄로 말한다', async () => {
  open(
    homeResponse({
      received: { requests: [], total: 0, truncated: false },
      settling: { events: [], total: 0 },
    }),
  )
  expect(await screen.findByText('받은 것이 없어요.')).toBeTruthy()
  expect(screen.getByText('정산할 행사가 없어요.')).toBeTruthy()
})

test('정산할 행사 줄을 누르면 그 행사의 예산·정산 탭이 열린다', async () => {
  const { onOpenEvent } = open(
    homeResponse({
      settling: {
        events: [
          {
            event: homeEvent('e9', { status: 'ended' }),
            settlement: { remaining: 2, settled: false },
          },
        ],
        total: 12,
      },
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: /행사 e9/ }))
  expect(onOpenEvent).toHaveBeenCalledWith('e9', 'money')
  expect(screen.getByText('정산에 남은 것 2')).toBeTruthy()
  expect(screen.getByRole('heading', { name: '정산할 행사 12개' })).toBeTruthy()
})
