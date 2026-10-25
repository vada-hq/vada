// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ClipboardList } from 'lucide-react'
import FeaturedEvents from './FeaturedEvents'
import HomeFrame from './HomeFrame'
import HomeGreeting, { HomeShortcut } from './HomeGreeting'
import { CouncilLayout, GridLayout } from './HomeLayout'

afterEach(cleanup)

const before = (first: HTMLElement, second: HTMLElement) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

// 홈 틀(DEC-95): 맨 위 '부서 배정 전' 띠, 그 아래 알림 꺼짐 띠, 끼룩이 한 줄, 인사 카드, 배치 꼴.
test('띠 둘, 끼룩이 한 줄, 인사 카드, 카드 차례로 그린다', () => {
  render(
    <HomeFrame
      asOf="2026-10-26T05:05:00.000Z"
      today="2026-10-26"
      assignBand={<p>배정 띠</p>}
      pushBand={<p>알림 띠</p>}
      greeting={<p>인사 카드</p>}
    >
      <p>카드</p>
    </HomeFrame>,
  )
  const kkiruk = screen.getByText('끼룩이가 14:05 기준으로 정리했어요')
  const order = [screen.getByText('배정 띠'), screen.getByText('알림 띠'), kkiruk]
  order.push(screen.getByText('인사 카드'), screen.getByText('카드'))
  for (let index = 1; index < order.length; index += 1)
    expect(before(order[index - 1] as HTMLElement, order[index] as HTMLElement)).toBe(true)
})

test('띠가 없으면 끼룩이 한 줄부터다', () => {
  render(
    <HomeFrame asOf="2026-10-25T05:05:00.000Z" today="2026-10-26" greeting={null}>
      {null}
    </HomeFrame>,
  )
  expect(screen.getByText('끼룩이가 10월 25일 (일) 14:05 기준으로 정리했어요')).toBeTruthy()
})

// 인사 카드: 날짜, 인사, 설명 한 줄, 메시지함 자리, 주요 행사 타일 자리, 바로가기 자리. 인사 아래에 처리 건수를 붙이지 않는다.
test('인사 카드는 날짜, 인사, 설명과 받은 자리를 그린다', () => {
  const onOpen = vi.fn()
  render(
    <HomeGreeting
      today="2026-10-26"
      name="김바다"
      description="학생회 행사와 확인할 일을 봐요"
      inbox={<p>메시지함 자리</p>}
      shortcuts={<HomeShortcut icon={ClipboardList} label="내 업무 2" onOpen={onOpen} />}
      featured={<p>타일 자리</p>}
    />,
  )
  const card = screen.getByRole('region', { name: '김바다님, 안녕하세요' })
  expect(within(card).getByText('10월 26일 (월)')).toBeTruthy()
  expect(within(card).getByText('학생회 행사와 확인할 일을 봐요')).toBeTruthy()
  expect(within(card).getByText('메시지함 자리')).toBeTruthy()
  expect(within(card).getByText('타일 자리')).toBeTruthy()
  fireEvent.click(within(card).getByRole('button', { name: '내 업무 2' }))
  expect(onOpen).toHaveBeenCalledOnce()
})

// 한 단에서는 날짜·인사·설명 → 메시지함 → 바로가기 차례로 쌓인다(DEC-95 휴대폰 인사 카드). 회장단은 넓으면 메시지함이 오른쪽이다.
test('타일이 없는 인사 카드도 설명, 메시지함, 바로가기 차례다', () => {
  render(
    <HomeGreeting
      today="2026-10-26"
      name="김바다"
      description="설명"
      inbox={<p>메시지함 자리</p>}
      shortcuts={<HomeShortcut icon={ClipboardList} label="내 업무 2" onOpen={vi.fn()} />}
    />,
  )
  const order = [screen.getByText('설명'), screen.getByText('메시지함 자리')]
  order.push(screen.getByRole('button', { name: '내 업무 2' }))
  expect(before(order[0] as HTMLElement, order[1] as HTMLElement)).toBe(true)
  expect(before(order[1] as HTMLElement, order[2] as HTMLElement)).toBe(true)
})

const tile = (id: string, onOpen = vi.fn()) => ({
  id,
  name: `행사 ${id}`,
  chip: <span>기획 중</span>,
  when: '10월 30일 (금) · D-4',
  onOpen,
})

// 학생회 주요 행사 타일(DEC-95): 행사명, 상태 칩, '{날짜} · D-N'. 모르는 값은 '집계 전'이다.
test('주요 행사 타일은 수와 타일을 그리고 누르면 그 행사를 연다', () => {
  const onOpen = vi.fn()
  render(
    <FeaturedEvents read={{ kind: 'ready', tiles: [tile('a', onOpen), tile('b'), tile('c')] }} />,
  )
  const tiles = screen.getByRole('region', { name: '학생회 주요 행사' })
  expect(within(tiles).getByText('3개')).toBeTruthy()
  expect(within(tiles).getAllByText('10월 30일 (금) · D-4')).toHaveLength(3)
  fireEvent.click(within(tiles).getByRole('button', { name: '행사 a' }))
  expect(onOpen).toHaveBeenCalledOnce()
})

test('주요 행사를 읽기 전이면 집계 전이고 0이 없다', () => {
  render(<FeaturedEvents read={{ kind: 'loading' }} />)
  const tiles = screen.getByRole('region', { name: '학생회 주요 행사' })
  expect(within(tiles).getByText('집계 전')).toBeTruthy()
  expect(tiles.textContent).not.toMatch(/0/)
})

test('주요 행사가 없으면 빈 문구다', () => {
  render(<FeaturedEvents read={{ kind: 'ready', tiles: [] }} />)
  const tiles = screen.getByRole('region', { name: '학생회 주요 행사' })
  expect(within(tiles).getByText('진행할 행사 없음')).toBeTruthy()
  expect(tiles.textContent).not.toMatch(/0/)
})

// 배치 꼴 둘: 회장단은 가로 전체 카드 → 3열 → 한 줄, 나머지는 2×2. 한 단에서는 이 글 차례로 쌓인다.
test('회장단 배치는 가로 전체 카드, 3열, 한 줄 차례다', () => {
  render(
    <CouncilLayout
      top={<p>행사 현황</p>}
      columns={[<p key="a">확인 필요</p>, <p key="b">후속 정리</p>, <p key="c">일정</p>]}
      bottom={<p>재정 한 줄</p>}
    />,
  )
  const names = ['행사 현황', '확인 필요', '후속 정리', '일정', '재정 한 줄']
  const order = names.map(name => screen.getByText(name))
  for (let index = 1; index < order.length; index += 1)
    expect(before(order[index - 1] as HTMLElement, order[index] as HTMLElement)).toBe(true)
})

test('2×2 배치는 왼쪽 위, 오른쪽 위, 왼쪽 아래, 오른쪽 아래 차례이고 조건부 줄이 아래에 붙는다', () => {
  render(
    <GridLayout
      cards={[
        <p key="a">왼쪽 위</p>,
        <p key="b">오른쪽 위</p>,
        <p key="c">왼쪽 아래</p>,
        <p key="d">오른쪽 아래</p>,
      ]}
      below={<p>조건부 줄</p>}
    />,
  )
  const names = ['왼쪽 위', '오른쪽 위', '왼쪽 아래', '오른쪽 아래', '조건부 줄']
  const order = names.map(name => screen.getByText(name))
  for (let index = 1; index < order.length; index += 1)
    expect(before(order[index - 1] as HTMLElement, order[index] as HTMLElement)).toBe(true)
})
