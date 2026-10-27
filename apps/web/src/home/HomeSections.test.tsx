// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  CouncilView,
  EventSummary,
  HomeCouncil,
  HomeDepartment,
  HomeResponse,
} from '@vada/contracts'
import {
  councilView,
  FINANCE_PERMISSIONS,
  MEMBER_PERMISSIONS,
  PRESIDENT_PERMISSIONS,
} from '@/test-support/council-fixtures'
import {
  homeEvent,
  homeRequest,
  homeResponse,
  homeTask,
  noTasks,
  noRooms,
  onHomeExtras,
} from '@/test-support/home-fixtures'
import { eventDetail } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const pathNow = () => window.location.pathname + window.location.search

// 학생회 읽기(권한)와 홈 밖에서 같이 읽는 행사 목록은 시험마다 바꾼다. eventsRead는 행사 목록 응답을 통째로 바꾼다(잘림, 실패).
function open(
  home: HomeResponse,
  options: { view?: CouncilView; events?: EventSummary[]; eventsRead?: () => Response } = {},
) {
  const councilId = options.view?.council.id ?? 'c1'
  const api = mockApi()
  api.on('GET', `/api/organizations/${councilId}/home`, () => json(home))
  onHomeExtras(api, { events: options.events ?? [] }, councilId)
  if (options.eventsRead)
    api.on('GET', `/api/organizations/${councilId}/events`, options.eventsRead)
  const fns = {
    onOpenEvent: vi.fn(),
    onOpenPage: vi.fn(),
  }
  render(
    <HomePage
      view={options.view ?? councilView('c1')}
      rooms={noRooms}
      onForbidden={vi.fn()}
      {...fns}
    />,
  )
  return { ...fns, api }
}

const council = (extra: Partial<HomeCouncil> = {}): HomeCouncil => ({
  events: [],
  truncated: false,
  endedTotal: 0,
  blocked: [],
  overdue: noTasks,
  unassignedMembers: 0,
  ...extra,
})

test('기존 배치의 회장단 겸직 홈도 학생회 부분 맨 위에 미배정 줄을 두고 사람으로 연다', async () => {
  const { onOpenPage } = open(
    homeResponse({ kind: 'finance', council: council({ unassignedMembers: 2 }) }),
  )
  const row = await screen.findByRole('button', { name: '미배정 구성원 2명' })
  fireEvent.click(row)
  expect(onOpenPage).toHaveBeenCalledWith('people')
})

test.each([0, 2])('회장단 부분이 없거나 미배정이 0이면 줄이 없다(%s)', async count => {
  open(homeResponse(count === 0 ? { council: council() } : {}), {
    view: councilView('c1', { councilRank: null }),
  })
  await screen.findByText('오늘까지 할 업무 없음')
  expect(screen.queryByRole('button', { name: /미배정 구성원/ })).toBeNull()
})

test('기존 배치도 부서 배정 전 띠를 두고 소속을 다시 읽어 배정되면 거둔다', async () => {
  const home = homeResponse()
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(home))
  onHomeExtras(api)
  const props = { rooms: noRooms, onForbidden: vi.fn(), onOpenEvent: vi.fn(), onOpenPage: vi.fn() }
  const shown = render(<HomePage {...props} view={councilView('c1', { councilRank: null })} />)
  const band = await screen.findByText('부서 배정 전')
  expect(band.closest('[role="status"]')?.textContent).toBe('부서 배정 전 부서는 회장단이 정해요.')
  shown.rerender(
    <HomePage
      {...props}
      view={councilView('c1', {
        councilRank: null,
        departments: [{ id: 'd1', name: '기획부', role: null, rank: null }],
      })}
    />,
  )
  expect(screen.queryByText('부서 배정 전')).toBeNull()
})

// 부서 거르기는 주소에 uuid로 남는다.
const DEPT = '0199d1a0-0000-7000-8000-0000000000d1'
const department: HomeDepartment = {
  id: DEPT,
  name: '기획부',
  counts: { todo: 3, inProgress: 2, overdue: 1, unassigned: 1 },
  overdue: { tasks: [homeTask('late', 'overdue')], total: 1 },
  unassigned: {
    tasks: [homeTask('free', 'soon', { assignee: null })],
    total: 1,
  },
}

const received = { requests: [homeRequest('r1')], total: 1, truncated: false }
const regions = () => screen.getAllByRole('region').map(item => item.getAttribute('aria-label'))

test('맨 위 숫자 카드 다음 받은 것, 학생회 행사, 내 부서, 정산할 행사, 내 업무 차례로 있는 것만 보인다', async () => {
  open(
    homeResponse({
      received,
      council: council(),
      departments: [department],
      settling: { events: [], total: 0 },
    }),
  )
  await screen.findByRole('region', { name: '내 업무' })
  expect(regions()).toEqual(['지금 볼 것', '받은 것', '행사', '기획부', '정산할 행사', '내 업무'])
})

// 행사 목록 읽기가 끝난 뒤에 단언한다(읽기 전이면 빈 상태가 아직 없어 늘 통과한다).
async function eventsRead(api: ReturnType<typeof open>['api'], councilId = 'c1') {
  const path = `/api/organizations/${councilId}/events`
  await waitFor(() => expect(api.calls.some(call => call.path === path)).toBe(true))
  await settle()
}

// 시험의 학생회 읽기는 event.create가 있는 회장이다. 행사 빈 상태의 [새 행사] 자리는 부장 홈(내 부서 부분)에만 있다.
test('부분이 없는 사람에게는 숫자 카드와 내 업무만 보인다(행사 목록을 다 읽은 뒤에도)', async () => {
  const { api } = open(homeResponse())
  await screen.findByRole('region', { name: '내 업무' })
  await eventsRead(api)
  expect(regions()).toEqual(['지금 볼 것', '내 업무'])
})

test('내 부서: 머리에 진행 중과 막힌 수, 줄에 지난 업무와 담당자 없는 업무. 줄을 누르면 그 업무가 열린다', async () => {
  open(homeResponse({ departments: [department] }))
  const section = await screen.findByRole('region', { name: '기획부' })
  expect(within(section).getByText('진행 중 2')).toBeTruthy()
  expect(within(section).getByText('지남 1')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: /업무 late/ }))
  expect(pathNow()).toBe('/tasks/c1/late')
  expect(within(section).getByRole('button', { name: /업무 free/ })).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  expect(pathNow()).toBe(`/tasks/c1?view=department&dept=${DEPT}`)
})

test('내 업무에 이미 있는 업무는 내 부서 줄에서 뺀다', async () => {
  const late = homeTask('late', 'overdue')
  open(
    homeResponse({
      departments: [department],
      mine: { tasks: [late], counts: { overdue: 1, today: 0, soon: 0, later: 0, noDue: 0 } },
    }),
  )
  const section = await screen.findByRole('region', { name: '기획부' })
  expect(within(section).queryByRole('button', { name: /업무 late/ })).toBeNull()
  expect(
    within(screen.getByRole('region', { name: '내 업무' })).getByText('업무 late'),
  ).toBeTruthy()
})

test('막힌 업무가 없는 부서는 한 줄로 말한다', async () => {
  const empty = { ...department, counts: { todo: 0, inProgress: 0, overdue: 0, unassigned: 0 } }
  open(homeResponse({ departments: [{ ...empty, overdue: noTasks, unassigned: noTasks }] }))
  expect(await screen.findByText('막힌 업무 없음')).toBeTruthy()
})

test('학생회 행사: 막힌 행사가 먼저, 정산이 남은 행사는 뒤. 끝난 행사는 재정 탭으로 열린다', async () => {
  const { onOpenEvent } = open(
    homeResponse({
      council: council({
        events: [
          {
            event: homeEvent('e1', { status: 'ended' }),
            tasks: { done: 1, total: 4, overdue: 0, unassigned: 0 },
            settlement: { remaining: 3, settled: false },
          },
          {
            event: homeEvent('e2', { status: 'ended' }),
            tasks: { done: 2, total: 2, overdue: 0, unassigned: 0 },
            settlement: { remaining: 0, settled: true },
          },
          {
            event: homeEvent('e3', { status: 'upcoming', startsAt: '2026-10-26T18:00' }),
            tasks: { done: 0, total: 5, overdue: 2, unassigned: 0 },
          },
        ],
        endedTotal: 2,
      }),
    }),
  )
  const section = await screen.findByRole('region', { name: '행사' })
  const names = within(section)
    .getAllByRole('button', { name: /행사 e/ })
    .map(item => item.textContent)
  expect(names).toEqual(['행사 e3', '행사 e1', '행사 e2'])
  expect(within(section).getByText('정산 남은 것 3')).toBeTruthy()
  expect(within(section).getByText('완료 가능')).toBeTruthy()
  expect(within(section).getByText('지남 2')).toBeTruthy()
  expect(within(section).getByText('D-3')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '행사 e1' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e1', 'money')
  fireEvent.click(within(section).getByRole('button', { name: '행사 e3' }))
  expect(onOpenEvent).toHaveBeenLastCalledWith('e3')
})

test('부서별 막힌 곳은 0이 아닌 수만, 지난 업무에는 부서와 담당자가 붙는다', async () => {
  open(
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
  const blocked = await screen.findByRole('region', { name: '부서별 막힌 곳' })
  expect(within(blocked).getByText('학생회 업무')).toBeTruthy()
  expect(within(blocked).getByText('지남 2')).toBeTruthy()
  expect(within(blocked).queryByText('지남 0')).toBeNull()
  const overdue = screen.getByRole('region', { name: '지난 업무' })
  expect(within(overdue).getByText('11')).toBeTruthy()
  expect(within(overdue).getByText('재정부')).toBeTruthy()
  fireEvent.click(within(overdue).getByRole('button', { name: /업무 old/ }))
  expect(pathNow()).toBe('/tasks/c1/old')
})

test('학생회의 지난 업무에서 내 업무에 있는 것을 빼고 센다', async () => {
  const mineLate = homeTask('mine', 'overdue')
  open(
    homeResponse({
      mine: { tasks: [mineLate], counts: { overdue: 1, today: 0, soon: 0, later: 0, noDue: 0 } },
      council: council({ overdue: { tasks: [mineLate, homeTask('other', 'overdue')], total: 2 } }),
    }),
  )
  const overdue = await screen.findByRole('region', { name: '지난 업무' })
  expect(within(overdue).getByText('1')).toBeTruthy()
  expect(within(overdue).queryByRole('button', { name: /업무 mine/ })).toBeNull()
})

test('행사가 없으면 한 줄로 말하고 모두 보기가 행사 화면으로 간다', async () => {
  const { onOpenPage } = open(homeResponse({ council: council() }))
  const section = await screen.findByRole('region', { name: '행사' })
  expect(within(section).getByText('진행할 행사 없음')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  expect(onOpenPage).toHaveBeenCalledWith('events')
})

test('받은 것의 요청 줄을 누르면 그 요청이 열린다', async () => {
  open(homeResponse({ received }))
  fireEvent.click(await screen.findByRole('button', { name: /요청 r1/ }))
  expect(pathNow()).toBe('/purchases/c1/r1')
  expect(screen.getByText('박부원')).toBeTruthy()
  expect(screen.getByText('10월 20일 요청')).toBeTruthy()
})

test('받은 것이 잘렸으면 수에 +를 붙이고 모두 보기가 결재 대기 거르기로 재정 화면을 연다', async () => {
  open(homeResponse({ received: { requests: [homeRequest('r1')], total: 50, truncated: true } }))
  const section = await screen.findByRole('region', { name: '받은 것' })
  expect(within(section).getByText('50+')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
  // 재정부의 재정 첫 화면은 개요라서 구매 요청 탭을 적어 연다.
  expect(pathNow()).toBe('/finance/c1?tab=requests&view=pending')
})

test('받은 것과 정산할 행사가 비면 한 줄로 말한다', async () => {
  open(
    homeResponse({
      received: { requests: [], total: 0, truncated: false },
      settling: { events: [], total: 0 },
    }),
  )
  expect(await screen.findByText('받은 것 없음')).toBeTruthy()
  expect(screen.getByText('정산할 행사 없음')).toBeTruthy()
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
  const section = screen.getByRole('region', { name: '정산할 행사' })
  expect(within(section).getByText('정산 남은 것 2')).toBeTruthy()
  expect(within(section).getByText('12')).toBeTruthy()
})

test('정산할 행사의 모두 보기는 그 학생회의 재정 행사 정산 탭을 연다', async () => {
  const settling = {
    events: [
      { event: homeEvent('e9', { status: 'ended' }), settlement: { remaining: 2, settled: false } },
    ],
    total: 12,
  }
  for (const councilId of ['c1', 'c2']) {
    open(homeResponse({ settling }), { view: councilView(councilId) })
    const section = await screen.findByRole('region', { name: '정산할 행사' })
    fireEvent.click(within(section).getByRole('button', { name: '모두 보기' }))
    expect(pathNow()).toBe(`/finance/${councilId}?tab=settlements`)
    cleanup()
  }
})

// 행사 빈 상태의 [새 행사](DEC-93 만드는 사람, DEC-78 이동 규칙 9). 학생회 읽기의 event.create로만 정한다.
const withoutCreate = (permissions: CouncilView['permissions']) =>
  permissions.filter(action => action !== 'event.create')
// 부장·부부장: 학생회 직급은 없고 어느 부서든 부서 직급(부부장 포함)이라 서버가 event.create를 준다.
const head = (rank: 'head' | 'vice_head' = 'head') =>
  councilView('c1', {
    councilRank: null,
    departments: [{ id: DEPT, name: '기획부', role: null, rank }],
    permissions: [...MEMBER_PERMISSIONS, 'event.create'],
  })

test('행사가 없는 학생회의 회장 홈 행사 부분에 진행할 행사 없음과 새 행사가 있고, 누르면 새 행사 창이 열려 만든 행사로 간다', async () => {
  const { api } = open(homeResponse({ council: council() }))
  const section = await screen.findByRole('region', { name: '행사' })
  expect(within(section).getByText('진행할 행사 없음')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '새 행사' }))
  const form = await screen.findByRole('form', { name: '새 행사' })
  api.on('POST', '/api/organizations/c1/events', () =>
    json({ event: eventDetail({ id: 'e7', name: '봄 축제' }) }, 201),
  )
  fireEvent.change(within(form).getByLabelText('행사명'), { target: { value: '봄 축제' } })
  fireEvent.click(within(form).getByRole('button', { name: '만들기' }))
  await waitFor(() => expect(pathNow()).toBe('/events/c1/e7?tab=overview'))
  expect(screen.queryByRole('form', { name: '새 행사' })).toBeNull()
})

test('행사를 만들 수 없는 회장단과 행사가 있는 회장단에게는 새 행사가 없다', async () => {
  open(homeResponse({ council: council() }), {
    view: councilView('c1', { permissions: withoutCreate(PRESIDENT_PERMISSIONS) }),
  })
  const section = await screen.findByRole('region', { name: '행사' })
  expect(within(section).getByText('진행할 행사 없음')).toBeTruthy()
  expect(within(section).queryByRole('button', { name: '새 행사' })).toBeNull()
  cleanup()
  open(
    homeResponse({
      council: council({
        events: [
          {
            event: homeEvent('e1', { status: 'tbd', startsAt: null, endsAt: null }),
            tasks: { done: 0, total: 0, overdue: 0, unassigned: 0 },
          },
        ],
      }),
    }),
  )
  await screen.findByRole('button', { name: '행사 e1' })
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('진행할 행사가 없는 학생회의 부장·부부장 홈 이번 주 행사 자리에 진행할 행사 없음과 새 행사가 있다(완료한 행사만 있어도)', async () => {
  for (const rank of ['head', 'vice_head'] as const) {
    open(homeResponse({ departments: [department] }), {
      view: head(rank),
      events: [homeEvent('done', { status: 'completed' })],
    })
    const section = await screen.findByRole('region', { name: '이번 주 행사' })
    expect(within(section).getByText('진행할 행사 없음')).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: '새 행사' }))
    expect(await screen.findByRole('form', { name: '새 행사' })).toBeTruthy()
    cleanup()
  }
})

test('행사 목록이 잘렸거나 읽지 못하면 진행할 행사가 없는지 몰라 부장 홈에 새 행사를 두지 않는다', async () => {
  const reads = [
    () => json({ events: [homeEvent('done', { status: 'completed' })], truncated: true }),
    () => json({ error: 'INTERNAL' }, 500),
  ]
  for (const read of reads) {
    const { api } = open(homeResponse({ departments: [department] }), {
      view: head(),
      eventsRead: read,
    })
    await screen.findByRole('region', { name: '기획부' })
    await eventsRead(api)
    expect(screen.queryByRole('region', { name: '이번 주 행사' })).toBeNull()
    expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
    cleanup()
  }
})

test('학생회에 진행할 행사가 하나라도 있으면 부장 홈에 새 행사가 없다', async () => {
  const { api } = open(homeResponse({ departments: [department] }), {
    view: head(),
    events: [homeEvent('later', { status: 'upcoming', startsAt: '2026-12-01T10:00' })],
  })
  await screen.findByRole('region', { name: '기획부' })
  await eventsRead(api)
  expect(screen.queryByRole('region', { name: '이번 주 행사' })).toBeNull()
  expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
})

test('부원과 재정부원 홈에는 행사가 없어도 새 행사가 없다', async () => {
  for (const permissions of [MEMBER_PERMISSIONS, FINANCE_PERMISSIONS]) {
    const { api } = open(homeResponse({ settling: { events: [], total: 0 } }), {
      view: councilView('c1', { councilRank: null, permissions }),
    })
    await screen.findByRole('region', { name: '내 업무' })
    await eventsRead(api)
    expect(screen.queryByRole('button', { name: '새 행사' })).toBeNull()
    expect(screen.queryByText('진행할 행사 없음')).toBeNull()
    cleanup()
  }
})
