// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeDepartmentBoard } from '@vada/contracts'
import { councilView, LEADER_PERMISSIONS } from '@/test-support/council-fixtures'
import { homeResponse, homeTask, homeRequest, noRooms } from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { settle } from '@/test-support/settle'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
const C = '01900000-0000-7000-8000-000000000001'
const M = '01900000-0000-7000-8000-000000000002'
const department = { id: '01900000-0000-7000-8000-000000000003', name: '기획부' }
const board = (extra: Partial<HomeDepartmentBoard> = {}): HomeDepartmentBoard => ({
  departments: [department],
  purchases: { requests: [], total: 0 },
  ownedEnded: [],
  attention: { items: [], total: 0 },
  congestion: null,
  ...extra,
})
function open(data = board()) {
  const api = mockApi()
  api.on('GET', `/api/organizations/${C}/home`, () => json(homeResponse({ departmentBoard: data })))
  render(
    <HomePage
      view={councilView(C, {
        councilRank: null,
        permissions: LEADER_PERMISSIONS,
        departments: [{ ...department, role: null, rank: 'head' }],
      })}
      rooms={noRooms}
      onForbidden={vi.fn()}
      onOpenEvent={vi.fn()}
      onOpenPage={vi.fn()}
    />,
  )
  return { api }
}
test('부서장 홈은 인사와 네 카드만 보이고 별도 읽기가 없으며 빈 참여 행사에서 만들 수 있다', async () => {
  const { api } = open()
  await screen.findByRole('region', { name: '확인이 필요한 일' })
  expect(screen.getByText('학생회 주요 행사와 기획부의 행사·일정·구매를 봐요')).toBeTruthy()
  for (const name of [
    '우리 부서 참여 행사',
    '가까운 일정·마감',
    '부서 구매 진행',
    '확인이 필요한 일',
  ])
    expect(screen.getByRole('region', { name })).toBeTruthy()
  expect(screen.queryByRole('region', { name: '지금 볼 것' })).toBeNull()
  expect(screen.getByRole('button', { name: '새 행사' })).toBeTruthy()
  await settle()
  expect(api.calls.map(call => call.path)).toEqual([`/api/organizations/${C}/home`])
})
test('책임 행사 네 줄 모두와 업무 앞 세 줄을 함께 보이고 합한 수·다중 부서·구매 요청 구분을 보인다', async () => {
  const items = Array.from({ length: 5 }, (_, i) => ({
    task: homeTask(`t${i}`, 'overdue', { department }),
    reason: 'overdue' as const,
  }))
  const ownedEnded = Array.from({ length: 4 }, (_, i) => ({
    event: {
      id: `e${i}`,
      name: `책임 행사 ${i}`,
      status: 'ended' as const,
      startsAt: null,
      endsAt: null,
    },
    endedDays: 7,
    remaining: { tasks: 1, settlement: 2 },
  }))
  open(
    board({
      departments: [department, { id: 'd2', name: '소통부' }],
      ownedEnded,
      attention: { items, total: 5 },
      purchases: { requests: [homeRequest('r1')], total: 1 },
    }),
  )
  const card = within(await screen.findByRole('region', { name: '확인이 필요한 일' }))
  expect(card.getAllByText(/책임 행사/)).toHaveLength(4)
  expect(card.getByText('업무 t2')).toBeTruthy()
  expect(card.queryByText('업무 t3')).toBeNull()
  expect(card.getByText('9건')).toBeTruthy()
  expect(card.getByRole('button', { name: '업무 전체 보기' })).toBeTruthy()
  expect(screen.getByText('학생회 주요 행사와 우리 부서의 행사·일정·구매를 봐요')).toBeTruthy()
  expect(screen.getByText('부서 요청 · 박부원')).toBeTruthy()
})

test('마감 몰림을 누르면 직급 부서·담당자·7일 안 거르기가 주소에 남는다', async () => {
  open(
    board({
      congestion: {
        member: { id: M, name: '정하늘' },
        departmentIds: [department.id],
        count: 3,
        firstDue: '2026-10-25',
        lastDue: '2026-11-01',
      },
    }),
  )
  fireEvent.click(await screen.findByRole('button', { name: /마감 몰림/ }))
  const query = new URLSearchParams(window.location.search)
  expect(window.location.pathname).toBe(`/tasks/${C}`)
  expect(query.get('assignee')).toBe(M)
  expect(query.get('dept')).toBe(department.id)
  expect(query.get('heads')).toBe('true')
  expect(query.get('due')).toBe('week')
})

test('구매 전체 보기는 홈과 같은 부서 구매 보기로 간다', async () => {
  open(board({ purchases: { requests: [homeRequest('r1')], total: 4 } }))
  const card = within(await screen.findByRole('region', { name: '부서 구매 진행' }))
  fireEvent.click(card.getByRole('button', { name: '전체 4건 보기' }))
  expect(window.location.pathname).toBe(`/finance/${C}`)
  expect(new URLSearchParams(window.location.search).get('view')).toBe('department')
})
