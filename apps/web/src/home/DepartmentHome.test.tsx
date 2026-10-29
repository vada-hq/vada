// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import {
  departmentHome,
  emptyOps,
  eventLane,
  homeTask,
  noRooms,
  opsRow,
} from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import HomePage from './HomePage'

// 부장 홈(HOME-01D, 10/30): 회장단 홈과 같은 구역에 서버가 좁힌 데이터만 그린다. 화면은 역할을 다시 계산하지 않는다(DEC-38).

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})
const C = '01900000-0000-7000-8000-000000000001'
const department = { id: '01900000-0000-7000-8000-000000000003', name: '기획부' }

function open(home: HomeResponse) {
  const api = mockApi()
  api.on('GET', `/api/organizations/${C}/home`, () => json(home))
  render(
    <HomePage
      view={councilView(C, {
        councilRank: null,
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

const member = {
  memberId: 'm1',
  name: '한결',
  role: { kind: 'assignee' as const },
  tint: 2,
}

test('신호 있는 날: ① 우리 부서 줄은 담당자에게 묻고 부장이 배정할 일을 맨 아래에 두며, ②③⑤가 같은 배치로 놓인다', async () => {
  const { api } = open(
    departmentHome({
      ops: emptyOps({
        rows: [opsRow('t1', 'late', { title: '부스 배치안', days: 2, contact: member })],
        counts: { late: 1, today: 0, tomorrow: 0, approval: 0 },
        assign: { by: 'head', noAssignee: 2, departments: [department] },
        total: 3,
      }),
      lanes: { events: [eventLane('e1', { late: [{ department, overdue: 1 }] })], total: 1 },
      todo: {
        rows: [{ kind: 'task_today', task: homeTask('t2', 'today'), days: 0, owner: null }],
        counts: { minutes: 0, event_tidy: 0, task_late: 0, task_today: 1 },
        total: 1,
        meTint: 0,
      },
    }),
  )
  const ops = within(await screen.findByRole('region', { name: '확인이 필요한 운영 상황' }))
  expect(ops.getByText('부스 배치안')).toBeTruthy()
  expect(ops.getByText('한결 담당자에게 묻기')).toBeTruthy()
  expect(ops.getByText('부장이 배정할 일')).toBeTruthy()
  expect(ops.getByRole('button', { name: '담당자 없는 업무 2건' })).toBeTruthy()
  // 회장단 전용 갈래는 서버가 주지 않으니 없다.
  expect(ops.queryByText('회장단이 배정할 일')).toBeNull()
  expect(ops.queryByText(/부서 미정|미배정 구성원|재정 담당 없음/)).toBeNull()
  expect(screen.getByRole('region', { name: '행사' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '내가 할 일' })).toBeTruthy()
  expect(screen.getAllByText(/이번 주/).length).toBeGreaterThan(0)
  // 옛 부장 홈 카드와 별도 읽기는 없다.
  expect(screen.queryByRole('region', { name: '부서 구매 진행' })).toBeNull()
  api.assertNoUnexpectedRequests()
})

test('평소: ①이 0건이면 머리 한 문장으로 합치고, 예산 한 줄은 서버가 줄 때만 보인다', async () => {
  open(departmentHome())
  expect(await screen.findByText('김회장님, 확인이 필요한 운영 상황 없어요')).toBeTruthy()
  expect(screen.queryByRole('region', { name: '확인이 필요한 운영 상황' })).toBeNull()
  expect(screen.queryByRole('region', { name: '사용 가능' })).toBeNull()
  expect(screen.queryByRole('region', { name: '기말고사 간식행사 간식비' })).toBeNull()
})

test('시연 학생회의 우리 부서 예산 한 줄은 금액과 남음을 싣고 재정으로 간다', async () => {
  open(
    departmentHome({
      budget: { name: '기말고사 간식행사 간식비', amount: 300_000, remaining: 300_000 },
    }),
  )
  const line = await screen.findByRole('region', { name: '기말고사 간식행사 간식비' })
  expect(line.textContent).toContain('기말고사 간식행사 간식비 300,000원')
  expect(line.textContent).toContain('남음 300,000원')
  fireEvent.click(within(line).getByRole('button', { name: /재정 보기/ }))
  expect(window.location.pathname).toBe(`/finance/${C}`)
})
