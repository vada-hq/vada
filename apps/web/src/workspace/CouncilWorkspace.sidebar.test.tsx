// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { CouncilView } from '@vada/contracts'
import { councilView, teamResponse } from '@/test-support/council-fixtures'
import { roomList } from '@/test-support/chat-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { COUNCIL_ID, WorkspaceAt } from '@/test-support/workspace-at'

// 옆 메뉴 틀(기능 028 조각 3, 와이어프레임 사이드바 v6.2 US-MSG-01 옆 메뉴, DEC-96).
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

const base = `/api/organizations/${COUNCIL_ID}`

function open(options: { view?: CouncilView; unread?: number } = {}) {
  const api = mockApi()
  api.on('GET', base, () => json(options.view ?? councilView(COUNCIL_ID)))
  api.on('GET', `${base}/members`, () => json(teamResponse()))
  api.on('GET', `${base}/rooms`, () =>
    json(roomList(options.unread === undefined ? {} : { unreadTotal: options.unread })),
  )
  api.on('GET', `${base}/tasks?view=mine&status=open`, () => json({ tasks: [], truncated: false }))
  api.on('GET', `${base}/events/open`, () => json({ events: [], more: false }))
  render(<WorkspaceAt startPage="home" />)
  return api
}

const nav = () => screen.findByRole('navigation', { name: '학생회 메뉴' })
// 최상위 칸(공간 묶음 앞)
const topItems = async () =>
  within(await nav())
    .getAllByRole('button')
    .slice(0, 6)

test('최상위 차례가 홈 · 메시지 · 업무 · 캘린더 · 재정 · 조직이며 아이콘도 같은 차례다', async () => {
  open()
  const items = await topItems()
  expect(items.map(item => item.textContent)).toEqual([
    '홈',
    '메시지',
    '업무',
    '캘린더',
    '재정',
    '조직',
  ])
  expect(items.map(item => item.querySelector('svg')?.getAttribute('class'))).toEqual([
    expect.stringContaining('lucide-house'),
    expect.stringContaining('lucide-message-square'),
    expect.stringContaining('lucide-clipboard'),
    expect.stringContaining('lucide-calendar-days'),
    expect.stringContaining('lucide-chart-no-axes-column'),
    expect.stringContaining('lucide-users'),
  ])
})

test('메뉴 칸은 와이어프레임 꼴이다: 아이콘과 글 gap-3, rounded, 칸 아래 mb-0.5, 올리면 gray-50', async () => {
  open()
  for (const item of await topItems()) {
    expect(item.className).toContain('gap-3')
    expect(item.className).toContain('rounded')
    expect(item.className).toContain('mb-0.5')
    expect(item.className).toContain('hover:bg-gray-50')
  }
})

test("'운영진' 머리가 없다", async () => {
  open()
  await nav()
  expect(screen.queryByText('운영진')).toBeNull()
})

test('안 읽은 메시지가 120개면 메시지 옆 빨간 99+, 0이면 배지가 없다', async () => {
  open({ unread: 120 })
  const badge = await within(await nav()).findByLabelText('안 읽은 메시지 120개')
  expect(badge.textContent).toBe('99+')
  expect(badge.className).toContain('bg-red-600')
  cleanup()
  const api = open({ unread: 0 })
  await waitFor(() => expect(api.calls.some(call => call.path === `${base}/rooms`)).toBe(true))
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(within(await nav()).queryByLabelText(/안 읽은 메시지/)).toBeNull()
})

test('머리 칸 전체가 학생회 메뉴 단추이고 Vada와 학생회 이름 두 줄이며 키보드로 열린다', async () => {
  open()
  const head = await screen.findByRole('button', { name: 'Vada 컴퓨터학부 학생회 학생회 메뉴' })
  expect(head.textContent).toContain('Vada')
  expect(head.textContent).toContain('컴퓨터학부 학생회')
  expect(head.textContent).toContain('V')
  fireEvent.keyDown(head, { key: 'Enter' })
  expect(await screen.findByRole('menuitem', { name: '설정' })).toBeTruthy()
})

test('부서가 둘인 부장의 발 둘째 줄은 부서를 가운뎃점으로 잇고 직급을 붙인다', async () => {
  open({
    view: councilView(COUNCIL_ID, {
      councilRank: null,
      departments: [
        { id: 'd2', name: '기획부', role: null, rank: 'head' },
        { id: 'd3', name: '홍보부', role: null, rank: 'head' },
      ],
    }),
  })
  const user = await screen.findByRole('button', { name: /^내 이름: 김회장/ })
  expect(user.textContent).toContain('기획부 · 홍보부 · 부장')
})

test('부서 없는 회장은 직급만, 부서도 직급도 없으면 둘째 줄이 없다', async () => {
  open()
  const president = await screen.findByRole('button', { name: /^내 이름: 김회장/ })
  expect(president.textContent).toBe('김회장회장')
  cleanup()
  open({ view: councilView(COUNCIL_ID, { councilRank: null, departments: [] }) })
  const plain = await screen.findByRole('button', { name: '내 이름: 김회장' })
  expect(plain.textContent).toBe('김회장')
})

test("사용자 줄을 누르면 '내 이름' 창이 열린다", async () => {
  open()
  fireEvent.click(await screen.findByRole('button', { name: /^내 이름: 김회장/ }))
  expect(await screen.findByRole('dialog', { name: '내 이름' })).toBeTruthy()
})

// 흰 바탕과 gray-50에서 gray-500은 4.5:1을 넘고 gray-400은 약 2.5:1이다. 수 배지는 red-600 위 흰 글(약 4.8:1)이다(WCAG 1.4.3, DEC-96).
test('옆 메뉴의 작은 글은 gray-400이 아니고, 작은 회색 글이 있는 칸은 올렸을 때 바탕이 gray-50이다', async () => {
  open({ unread: 3 })
  await within(await nav()).findByLabelText('안 읽은 메시지 3개')
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  expect(aside.innerHTML).not.toContain('text-gray-400')
  const head = within(aside).getByRole('button', { name: /학생회 메뉴$/ })
  const user = within(aside).getByRole('button', { name: /^내 이름/ })
  for (const item of [head, user]) {
    expect(item.className).toContain('hover:bg-gray-50')
    expect(item.className).not.toContain('hover:bg-gray-100')
  }
})

test('휴대폰 서랍도 같은 틀이고 머리 단추는 닫기 단추 자리를 비운다', async () => {
  open({ unread: 120 })
  await nav()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  const items = within(within(sheet).getByRole('navigation', { name: '학생회 메뉴' }))
    .getAllByRole('button')
    .slice(0, 6)
  expect(items.map(item => item.textContent)).toEqual([
    '홈',
    '메시지99+',
    '업무',
    '캘린더',
    '재정',
    '조직',
  ])
  const head = within(sheet).getByRole('button', { name: 'Vada 컴퓨터학부 학생회 학생회 메뉴' })
  expect(head.className).toContain('pr-12')
  expect(within(sheet).getByRole('button', { name: /^내 이름: 김회장/ })).toBeTruthy()
})
