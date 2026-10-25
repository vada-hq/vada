// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { HomeResponse } from '@vada/contracts'
import { councilView } from '@/test-support/council-fixtures'
import {
  homeEvent,
  homeNotice,
  homeRequest,
  homeResponse,
  noTasks,
  onHomeExtras,
} from '@/test-support/home-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import HomePage from './HomePage'

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

// 홈 응답 밖에서 읽는 부분: 내 요청, 공지, 이번 주 행사, 그리고 맨 위 숫자 카드.
function open(home: HomeResponse, extras: Parameters<typeof onHomeExtras>[1] = {}) {
  const api = mockApi()
  api.on('GET', '/api/organizations/c1/home', () => json(home))
  onHomeExtras(api, extras)
  const fns = {
    onOpenRequest: vi.fn(),
    onOpenEvent: vi.fn(),
    onOpenPage: vi.fn(),
  }
  render(<HomePage view={councilView('c1')} onForbidden={vi.fn()} {...fns} />)
  return fns
}

const council = { events: [], truncated: false, endedTotal: 0, blocked: [], overdue: noTasks }

test('내 요청: 반려를 먼저, 결재 대기는 오래된 순. 끝난 요청은 뺀다', async () => {
  const { onOpenRequest } = open(homeResponse(), {
    requests: [
      { ...homeRequest('new'), createdAt: '2026-10-22T03:00:00.000Z' },
      { ...homeRequest('old'), createdAt: '2026-10-18T03:00:00.000Z' },
      { ...homeRequest('no'), status: 'rejected', createdAt: '2026-10-21T03:00:00.000Z' },
      { ...homeRequest('done'), status: 'approved' },
    ],
  })
  const section = await screen.findByRole('region', { name: '내 요청' })
  const titles = within(section)
    .getAllByRole('button', { name: /요청 / })
    .map(item => item.textContent)
  expect(titles).toEqual(['요청 no', '요청 old', '요청 new'])
  expect(within(section).getByText('반려')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '요청 no' }))
  expect(onOpenRequest).toHaveBeenCalledWith('no')
})

test('볼 요청, 공지, 이번 주 행사가 없으면 그 부분을 두지 않는다', async () => {
  open(homeResponse())
  await screen.findByRole('region', { name: '내 업무' })
  expect(screen.queryByRole('region', { name: '내 요청' })).toBeNull()
  expect(screen.queryByRole('region', { name: '공지' })).toBeNull()
  expect(screen.queryByRole('region', { name: '이번 주 행사' })).toBeNull()
})

test('공지는 7일 안의 것을 최근 것부터 첫 줄로 보이고, 누르면 대화로 간다', async () => {
  const { onOpenPage } = open(homeResponse(), {
    notices: [
      homeNotice('a', { body: '회의 장소 변경\n학생회실', sentAt: '2026-10-22T03:00:00.000Z' }),
      homeNotice('b', { body: '오래된 공지', sentAt: '2026-10-01T03:00:00.000Z' }),
    ],
  })
  const section = await screen.findByRole('region', { name: '공지' })
  expect(within(section).getByText('회의 장소 변경')).toBeTruthy()
  expect(within(section).queryByText('오래된 공지')).toBeNull()
  fireEvent.click(within(section).getByRole('button', { name: '회의 장소 변경' }))
  expect(onOpenPage).toHaveBeenCalledWith('chat')
})

test('이번 주 행사는 진행 중이거나 7일 안에 시작하는 행사다', async () => {
  const { onOpenEvent } = open(homeResponse(), {
    events: [
      homeEvent('soon', { status: 'upcoming', startsAt: '2026-10-25T18:00', endsAt: null }),
      homeEvent('now', { status: 'ongoing' }),
      homeEvent('far', { status: 'upcoming', startsAt: '2026-11-20T18:00', endsAt: null }),
    ],
  })
  const section = await screen.findByRole('region', { name: '이번 주 행사' })
  expect(within(section).getByText('D-2')).toBeTruthy()
  expect(within(section).getByText('진행 중')).toBeTruthy()
  expect(within(section).queryByRole('button', { name: '행사 far' })).toBeNull()
  fireEvent.click(within(section).getByRole('button', { name: '행사 soon' }))
  expect(onOpenEvent).toHaveBeenCalledWith('soon')
})

test('회장단은 공지와 이번 주 행사를 두지 않고 행사 목록을 읽지 않는다', async () => {
  open(homeResponse({ council }), {
    notices: [homeNotice('a')],
    events: [homeEvent('now', { status: 'ongoing' })],
  })
  await screen.findByRole('region', { name: '행사' })
  expect(screen.queryByRole('region', { name: '공지' })).toBeNull()
  expect(screen.queryByRole('region', { name: '이번 주 행사' })).toBeNull()
})

test('숫자 카드는 그 사람의 것을 네 칸까지, 0도 같은 자리에 둔다', async () => {
  open(homeResponse(), {
    requests: [{ ...homeRequest('no'), status: 'rejected', createdAt: '2026-10-21T03:00:00.000Z' }],
  })
  const tiles = await screen.findByRole('region', { name: '지금 볼 것' })
  await within(tiles).findByRole('button', { name: /반려된 요청\s*1/ })
  const labels = within(tiles)
    .getAllByRole('button')
    .map(item => item.textContent)
  expect(labels).toEqual(['지난 내 업무0', '오늘 마감0', '반려된 요청1', '이번 주 행사0'])
})

test('회장단의 숫자 카드는 막힌 곳과 지난 업무부터다', async () => {
  open(
    homeResponse({
      council: {
        ...council,
        blocked: [{ department: null, overdue: 1, unassigned: 0 }],
      },
    }),
  )
  const tiles = await screen.findByRole('region', { name: '지금 볼 것' })
  const labels = within(tiles)
    .getAllByRole('button')
    .map(item => item.textContent)
  expect(labels).toEqual(['막힌 곳1', '지난 업무0', '지난 내 업무0', '오늘 마감0'])
})
