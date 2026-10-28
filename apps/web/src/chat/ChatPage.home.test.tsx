// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  BottomNavigationVisibility,
  useBottomNavigationHidden,
} from '@/components/BottomNavigationVisibility'
import { councilView } from '@/test-support/council-fixtures'
import { room, roomList } from '@/test-support/chat-fixtures'
import ChatPage, { type Screen } from './ChatPage'
import { navigationWidth } from '@/test-support/navigation-width'
import { savedRoom, saveSideRoom } from './last-room'

vi.mock('./RoomView', () => ({
  default: ({ roomId }: { roomId: string }) => <p>흐름 {roomId}</p>,
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
  saveSideRoom('c1', 'm1', null)
  vi.unstubAllGlobals()
})

const notice = room('notice', { unread: 2 })
const lead = room('lead', { type: 'leadership', unread: 1 })
const dept = room('dept', { type: 'department', name: '운영부', unread: 3 })
const direct = room('direct', { type: 'direct', name: '박새내' })
const event = room('event', { eventId: 'event1', eventName: '축제' })
const between = room('between', { type: 'inter_department', name: '기획부와 운영부' })
const allRooms = [notice, lead, dept, event, direct, between]

function Navigation() {
  return useBottomNavigationHidden() ? null : <nav aria-label="휴대폰 메뉴" />
}

function Harness({
  rooms = allRooms,
  initial = { kind: 'home' },
}: {
  rooms?: typeof allRooms
  initial?: Screen
}) {
  const [current, setCurrent] = useState<Screen>(initial)
  return (
    <BottomNavigationVisibility>
      <ChatPage
        councilId="c1"
        view={councilView('c1')}
        team={{} as never}
        rooms={{ state: { kind: 'ready', data: roomList({ rooms }) }, reload: async () => true }}
        screen={current}
        onScreen={setCurrent}
        onBack={() => setCurrent({ kind: 'home' })}
        onForbidden={() => {}}
        onOpenRequest={() => {}}
      />
      <Navigation />
    </BottomNavigationVisibility>
  )
}

test('메시지 첫 화면은 서버 학생회 방만 탭으로 보이고 회장단 흐름부터 연다', () => {
  render(<Harness />)
  expect(screen.getByRole('heading', { name: '메시지' })).toBeTruthy()
  const tabs = screen.getByRole('tablist', { name: '대화방' })
  expect(
    within(tabs)
      .getAllByRole('tab')
      .map(tab => tab.textContent?.trim()),
  ).toEqual(['공지방2', '회장단방1', '운영부 방3', '1:1'])
  expect(screen.getByText('흐름 lead')).toBeTruthy()
  expect(screen.getByText('학생회 · 회장단만 보는 방')).toBeTruthy()
  expect(screen.queryByRole('list', { name: '대화방' })).toBeNull()
  expect(screen.queryByText(/구매 후보/)).toBeNull()
  expect(screen.getByRole('navigation', { name: '휴대폰 메뉴' })).toBeTruthy()
})

test('탭을 바꾸면 흐름·범위와 기기 기억을 함께 바꾸고 다음에도 그 학생회 방을 연다', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('tab', { name: /운영부 방/ }))
  expect(screen.getByText('흐름 dept')).toBeTruthy()
  expect(screen.getByText('학생회 · 운영부만 보는 방')).toBeTruthy()
  cleanup()
  render(<Harness />)
  expect(screen.getByText('흐름 dept')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: /공지방/ }))
  expect(screen.getByText('학생회 · 모든 운영진')).toBeTruthy()
})

test('공지방 하나여도 휴대폰에는 1:1 탭이 있고 아래 메뉴를 유지한다', () => {
  render(<Harness rooms={[notice]} />)
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  expect(screen.getByText('흐름 notice')).toBeTruthy()
  expect(screen.getByRole('navigation', { name: '휴대폰 메뉴' })).toBeTruthy()
})

test.each([768, 1023])('%i 폭은 오른쪽 칸 대신 1:1 탭을 보인다', width => {
  navigationWidth(width)
  render(<Harness />)
  expect(screen.getByRole('tab', { name: /1:1/ })).toBeTruthy()
  expect(screen.queryByRole('complementary', { name: '1:1' })).toBeNull()
})

test('PC는 1:1 탭 기억을 무시하고 학생회 흐름을 열며 탭을 바꿔도 1:1 칸을 남긴다', () => {
  navigationWidth(1280)
  localStorage.setItem('vada.chat.direct-tab.c1', 'true')
  render(<Harness initial={{ kind: 'home', sideRoomId: 'direct' }} />)
  expect(screen.getByText('흐름 lead')).toBeTruthy()
  expect(screen.queryByRole('tab', { name: /1:1/ })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: /운영부 방/ }))
  expect(screen.getByText('흐름 dept')).toBeTruthy()
  expect(screen.getByText('흐름 direct')).toBeTruthy()
})

test('휴대폰 1:1 탭은 학생회 방 기억을 덮지 않고 새 학생회 방 주소가 오면 그 흐름을 연다', () => {
  navigationWidth(390)
  render(<Harness />)
  fireEvent.click(screen.getByRole('tab', { name: /1:1/ }))
  expect(savedRoom('c1')).toBe('lead')
  expect(screen.queryByText(/학생회 ·/)).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: /공지방/ }))
  expect(screen.getByText('흐름 notice')).toBeTruthy()
})

test('전체 보기에는 행사·1:1·부서 간 방까지 남고 1:1을 열 때 아래 메뉴를 숨긴다', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '전체 보기' }))
  expect(screen.getByRole('region', { name: '행사' })).toBeTruthy()
  expect(screen.getByRole('region', { name: '1:1 대화' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /기획부와 운영부/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /박새내/ }))
  expect(screen.getByText('흐름 direct')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: '휴대폰 메뉴' })).toBeNull()
})

// 공지 주소(업무 결과물·알림)로 연 방이 기억이 된다. 그 뒤 메뉴로 첫 화면에 오면 옛 기억이 아니라 그 방이다.
test('주소로 연 학생회 방을 기억해 메뉴로 다시 오면 그 탭을 연다', () => {
  localStorage.setItem('vada.chat.room.c1', 'dept')
  const page = (screenNow: Screen) => (
    <ChatPage
      councilId="c1"
      view={councilView('c1')}
      team={{} as never}
      rooms={{
        state: { kind: 'ready', data: roomList({ rooms: allRooms }) },
        reload: async () => true,
      }}
      screen={screenNow}
      onScreen={() => {}}
      onBack={() => {}}
      onForbidden={() => {}}
      onOpenRequest={() => {}}
    />
  )
  const { rerender } = render(page({ kind: 'home', roomId: 'notice' }))
  expect(screen.getByText('흐름 notice')).toBeTruthy()
  rerender(page({ kind: 'home' }))
  expect(screen.getByText('흐름 notice')).toBeTruthy()
})
