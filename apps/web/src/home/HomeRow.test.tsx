// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import FeaturedEvents from './FeaturedEvents'
import HomeRow from './HomeRow'
import HomeSection from './HomeSection'

afterEach(cleanup)

const tokens = (element: Element) => element.className.split(' ')
// 넓은 화면에서 보이는 class만(휴대폰 높이와 키보드 초점 링을 뺀 것)
const desktopTokens = (element: Element) =>
  tokens(element).filter(
    token => !token.startsWith('max-sm:') && !token.startsWith('has-focus-visible:'),
  )

// 줄 전체가 누르는 자리다(Bootstrap stretched link): 제목 단추의 ::after가 relative 줄 상자를 덮는다.
// jsdom에는 배치가 없어 '메타 글을 누르면 열림'은 class 계약으로 보고, 실제 누름은 390 브라우저에서 잰다.
test('홈 줄은 제목 단추 하나가 줄 전체를 덮고 휴대폰에서 44px 이상이며 초점 링이 줄에 그려진다', () => {
  const onOpen = vi.fn()
  render(
    <ul>
      <HomeRow
        card
        title="부스 배치안 확정"
        meta={['10월 30일 (금)', '체육대회']}
        onOpen={onOpen}
      />
    </ul>,
  )
  const row = screen.getByRole('listitem')
  const buttons = within(row).getAllByRole('button')
  expect(buttons).toHaveLength(1)
  expect(buttons[0]?.textContent).toBe('부스 배치안 확정')
  expect(tokens(row)).toEqual(
    expect.arrayContaining([
      'relative',
      'max-sm:min-h-11',
      'has-focus-visible:ring-2',
      'has-focus-visible:ring-inset',
    ]),
  )
  expect(tokens(buttons[0] as Element)).toEqual(
    expect.arrayContaining(['after:absolute', 'after:inset-0', 'focus-visible:ring-0']),
  )
  // 넓은 화면 모양은 그대로다.
  expect(desktopTokens(row)).toEqual([
    'relative',
    'flex',
    'items-center',
    'gap-3',
    'transition-colors',
    'hover:bg-surface-subtle',
    'px-5',
    'py-2.5',
  ])
  fireEvent.click(buttons[0] as Element)
  expect(onOpen).toHaveBeenCalledOnce()
})

test('홈 부분 머리의 모두 보기는 휴대폰에서 44px 이상이고 첫 줄과 겹치지 않는다', () => {
  const onSeeAll = vi.fn()
  render(
    <HomeSection title="내 업무" onSeeAll={onSeeAll}>
      <li>줄</li>
    </HomeSection>,
  )
  const seeAll = screen.getByRole('button', { name: '모두 보기' })
  expect(tokens(seeAll)).toContain('max-sm:min-h-11')
  // 키운 단추가 머리 아래로 12px(-my-3) 나오므로 목록과의 틈도 12px라 첫 줄 덮개와 겹치지 않는다(390에서 잰 틈 0px).
  expect(tokens(seeAll)).toContain('max-sm:-my-3')
  expect(tokens(screen.getByRole('region', { name: '내 업무' }))).toContain('max-sm:gap-3')
  fireEvent.click(seeAll)
  expect(onSeeAll).toHaveBeenCalledOnce()
})

test('주요 행사 타일도 이름 단추 하나가 타일 전체를 덮고 초점 링이 타일에 그려진다', () => {
  render(
    <FeaturedEvents
      read={{
        kind: 'ready',
        tiles: [
          { id: 'a', name: '체육대회', chip: <span>기획 중</span>, when: '미정', onOpen: vi.fn() },
        ],
      }}
    />,
  )
  const tile = screen.getByRole('listitem')
  expect(within(tile).getAllByRole('button')).toHaveLength(1)
  expect(tokens(tile)).toEqual(
    expect.arrayContaining(['relative', 'max-sm:min-h-11', 'has-focus-visible:ring-2']),
  )
})
