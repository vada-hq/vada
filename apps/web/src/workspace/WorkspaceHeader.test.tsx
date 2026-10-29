// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { eventTrail, trailOf } from './pages'
import WorkspaceHeader from './WorkspaceHeader'
import { financeTrail } from '@/finance/finance-text'

afterEach(cleanup)

const COUNCIL = '컴퓨터학부 학생회'

function show(trail = trailOf('events', COUNCIL, eventTrail('신입생 환영회', '업무'))) {
  render(<WorkspaceHeader width="default" crumbs={trail.crumbs} title={trail.title} />)
  const banner = screen.getByRole('banner')
  const path = within(banner).getByRole('list', { name: '경로' })
  return { banner, path, items: within(path).getAllByRole('listitem') }
}

// 머리글 배경은 끝까지, 내용은 본문과 같은 가운데 틀에 둔다(DEC-101).
// 제목이 두 줄이 되는 휴대폰에서는 그만큼 높아지므로 최소 높이다.
test('머리글은 높이가 h-16부터이고 안쪽 틀을 가운데 둔다', () => {
  const { banner } = show()
  expect(banner.className.split(' ')).toContain('min-h-16')
  expect(banner.className).not.toContain('max-w-')
  expect(banner.firstElementChild?.className).toContain('mx-auto')
})

test('경로 줄은 제목 위에 있고 칸을 > 아이콘으로 잇는다', () => {
  const { banner, path, items } = show()
  expect(items.map(item => item.textContent)).toEqual([COUNCIL, '행사', '신입생 환영회', '업무'])
  expect(path.querySelectorAll('svg')).toHaveLength(items.length - 1)
  const title = within(banner).getByRole('heading', { level: 1, name: '신입생 환영회' })
  expect(path.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('마지막 칸만 진하고, 칸은 누를 수 없다', () => {
  const { path, items } = show()
  const dark = items.map(item =>
    item.querySelector('span')!.className.includes('text-fg-secondary'),
  )
  expect(dark).toEqual([false, false, false, true])
  expect(path.className).toContain('text-fg-muted')
  expect(within(path).queryAllByRole('button')).toHaveLength(0)
  expect(within(path).queryAllByRole('link')).toHaveLength(0)
})

test('넘치면 학생회 이름과 행사명이 말줄임되고 올리면 전체 이름이다. 다른 칸은 줄지 않는다', () => {
  const { items } = show()
  const [council, events, event, tab] = items.map(item => item.querySelector('span')!)
  for (const crumb of [council!, event!]) {
    expect(crumb.className).toContain('truncate')
    expect(crumb.getAttribute('title')).toBe(crumb.textContent)
  }
  for (const crumb of [events!, tab!]) {
    expect(crumb.className).not.toContain('truncate')
    expect(crumb.closest('li')!.className).toContain('shrink-0')
  }
})

// 행사 화면에서 행사명 전체는 이 제목에만 있다. 휴대폰에서 끝까지 볼 수 있게 두 줄까지 줄바꿈하고,
// 넓은 화면(md 이상)은 한 줄 말줄임에 올리면 전체 이름이다. 제목 굵기는 와이어프레임대로 semibold다.
test('긴 행사명 제목은 휴대폰에서 두 줄까지 줄바꿈하고 넓은 화면은 한 줄 말줄임이다', () => {
  const name = '2026 소프트웨어융합대학 체육대회 및 신입생 환영 한마당'
  const { banner } = show(trailOf('events', COUNCIL, eventTrail(name, '개요')))
  const title = within(banner).getByRole('heading', { level: 1, name })
  const classes = title.className.split(' ')
  expect(classes).toEqual(
    expect.arrayContaining(['line-clamp-2', 'wrap-anywhere', 'md:line-clamp-1', 'font-semibold']),
  )
  expect(classes).not.toContain('truncate')
  expect(title.getAttribute('title')).toBe(name)
})

test('홈은 학생회 이름 한 칸이 마지막 칸이라 진하고 제목은 홈이다', () => {
  const { banner, items } = show(trailOf('home', COUNCIL, null))
  expect(items.map(item => item.textContent)).toEqual([COUNCIL])
  expect(items[0]!.querySelector('span')!.className).toContain('text-fg-secondary')
  expect(within(banner).getByRole('heading', { level: 1 }).textContent).toBe('홈')
})

test.each(['overview', 'ledger', 'closing'] as const)(
  '재정 %s 경로는 학생회 > 재정 > 탭이고 마지막 칸만 진하며 탭은 줄지 않는다',
  tab => {
    const labels = { overview: '예산 현황', ledger: '사용 내역', closing: '결산' }
    const council = '한양대학교 ERICA 소프트웨어융합대학 제38대 함께하는 내일 학생회'
    const { banner, items } = show(trailOf('finance', council, financeTrail(tab)))
    expect(items.map(item => item.textContent)).toEqual([council, '재정', labels[tab]])
    expect(
      items.map(item => item.querySelector('span')!.className.includes('text-fg-secondary')),
    ).toEqual([false, false, true])
    expect(items[0]!.querySelector('span')!.className).toContain('truncate')
    expect(items[0]!.className).toContain('min-w-0')
    expect(items[2]!.querySelector('span')!.className).not.toContain('truncate')
    expect(items[2]!.className).toContain('shrink-0')
    expect(within(banner).getByRole('heading', { level: 1, name: '재정' })).toBeTruthy()
  },
)

test('설정으로 옮긴 계좌 탭은 재정 경로 칸을 넘기지 않는다', () => {
  expect(financeTrail('accounts')).toEqual({ title: '재정', crumbs: [] })
})
