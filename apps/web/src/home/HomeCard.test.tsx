// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CalendarDays } from 'lucide-react'
import HomeCard, { type CardRead } from './HomeCard'

afterEach(cleanup)

const rowsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => <li key={index}>{`줄 ${index + 1}`}</li>)
const ready = (total: number): CardRead => ({ kind: 'ready', total, rows: rowsOf(total) })

function show(read: CardRead, extra: Partial<Parameters<typeof HomeCard>[0]> = {}) {
  render(
    <HomeCard
      title="확인할 일"
      icon={CalendarDays}
      read={read}
      empty="확인할 일 없음"
      {...extra}
    />,
  )
  return screen.getByRole('region', { name: '확인할 일' })
}
const head = (card: HTMLElement) =>
  within(card).getByRole('heading', { name: '확인할 일' }).parentElement as HTMLElement
const shownRows = (card: HTMLElement) =>
  within(card)
    .queryAllByRole('listitem')
    .map(item => item.textContent)

// 카드 머리 규칙(DEC-95): 3건 이하면 회색 '{n}건', 넘으면 파란 '전체 {n}건 보기'와 앞 3줄, 0건이면 가운데 빈 문구.
test('3건이면 머리에 회색 수가 있고 세 줄을 모두 그린다', () => {
  const card = show(ready(3), { onSeeAll: vi.fn() })
  expect(within(head(card)).getByText('3건').className).toContain('text-gray-500')
  expect(within(card).queryByRole('button', { name: /전체/ })).toBeNull()
  expect(shownRows(card)).toEqual(['줄 1', '줄 2', '줄 3'])
})

test('5건이면 파란 전체 보기 링크와 앞 3줄만 그린다', () => {
  const onSeeAll = vi.fn()
  const card = show(ready(5), { onSeeAll })
  const link = within(head(card)).getByRole('button', { name: '전체 5건 보기' })
  expect(link.className).toContain('text-blue-700')
  // 휴대폰에서 누르는 영역은 44px 이상이다(WCAG 2.5.8 권장).
  expect(link.className).toContain('max-sm:min-h-11')
  expect(shownRows(card)).toEqual(['줄 1', '줄 2', '줄 3'])
  fireEvent.click(link)
  expect(onSeeAll).toHaveBeenCalledOnce()
})

test('전체 보기 도착이 없는 카드는 3건을 넘어도 수만 둔다', () => {
  const card = show(ready(5))
  expect(within(head(card)).getByText('5건')).toBeTruthy()
  expect(within(card).queryByRole('button')).toBeNull()
})

test('단위를 바꿀 수 있다', () => {
  const card = show(ready(2), { unit: '개' })
  expect(within(head(card)).getByText('2개')).toBeTruthy()
})

// 읽었고 0이면 머리에 회색 '0건'을 둬 '집계 전'과 가른다(와이어프레임 HomePrototypeCount, DEC-95).
test('0건이면 카드를 두고 가운데 빈 문구와 머리에 회색 0건을 쓴다', () => {
  const card = show(ready(0), {
    emptyAction: <button type="button">새 행사</button>,
  })
  expect(within(card).getByText('확인할 일 없음')).toBeTruthy()
  expect(within(card).getByRole('button', { name: '새 행사' })).toBeTruthy()
  expect(within(head(card)).getByText('0건').className).toContain('text-gray-500')
})

// 모르는 값은 0이 아니라 '집계 전'이다(기획자 D-11 ③). 실패면 다시 불러온다.
test('읽기 전이면 수와 빈 문구 대신 집계 전이고 0이 없다', () => {
  const card = show({ kind: 'loading' }, { onSeeAll: vi.fn() })
  expect(within(head(card)).getByText('집계 전')).toBeTruthy()
  expect(within(card).queryByText('확인할 일 없음')).toBeNull()
  expect(within(card).queryByRole('button')).toBeNull()
  expect(card.textContent).not.toMatch(/0/)
})

test('읽기에 실패하면 집계 전과 다시 불러오기가 있다', () => {
  const onRetry = vi.fn()
  const card = show({ kind: 'failed', onRetry })
  expect(within(head(card)).getByText('집계 전')).toBeTruthy()
  expect(within(card).queryByText('확인할 일 없음')).toBeNull()
  expect(card.textContent).not.toMatch(/0/)
  fireEvent.click(within(card).getByRole('button', { name: '다시 불러오기' }))
  expect(onRetry).toHaveBeenCalledOnce()
})

// 회장단 행사 머리는 상태별 수와 '전체 n개 보기'를 함께 둔다(DEC-95). 모르면 그래도 '집계 전'만이다.
test('머리 글은 전체 보기와 함께 나오고 읽기 전이면 집계 전이다', () => {
  const card = show(ready(5), { aside: <span>기획 중 2 · 진행 중 1</span>, onSeeAll: vi.fn() })
  expect(within(head(card)).getByText('기획 중 2 · 진행 중 1')).toBeTruthy()
  expect(within(head(card)).getByRole('button', { name: '전체 5건 보기' })).toBeTruthy()
  cleanup()
  const loading = show({ kind: 'loading' }, { aside: <span>기획 중 2</span> })
  expect(within(head(loading)).getByText('집계 전')).toBeTruthy()
  expect(within(head(loading)).queryByText('기획 중 2')).toBeNull()
})

// 가로 전체 카드(회장단 '전체 행사 진행 현황')는 줄 대신 칸 카드를 늘어놓아도 앞 3개만 그린다.
test('칸으로 늘어놓아도 앞 3개만 그린다', () => {
  const card = show(ready(5), { tiles: true })
  expect(shownRows(card)).toEqual(['줄 1', '줄 2', '줄 3'])
})

// 조건부 줄(미배정 구성원, 마감 몰림)은 대상이 있을 때만 카드 아래에 붙는다.
test('조건부 줄은 대상이 없으면 없다', () => {
  const card = show(ready(1), { footnote: null })
  expect(within(card).queryByRole('button')).toBeNull()
})

test('읽지 못한 카드에는 조건부 줄도 없다', () => {
  const footnote = { label: '미배정 구성원', text: '2명', onOpen: vi.fn() }
  const card = show({ kind: 'failed', onRetry: vi.fn() }, { footnote })
  expect(within(card).queryByText('미배정 구성원')).toBeNull()
})

test('조건부 줄이 있으면 카드 아래에서 누를 수 있다', () => {
  const onOpen = vi.fn()
  const card = show(ready(1), {
    footnote: { label: '미배정 구성원', text: '2명', onOpen },
  })
  fireEvent.click(within(card).getByRole('button', { name: /미배정 구성원.*2명/ }))
  expect(onOpen).toHaveBeenCalledOnce()
})
