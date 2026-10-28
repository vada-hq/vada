// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { eventTrail, trailOf } from './pages'
import WorkspaceHeader from './WorkspaceHeader'

afterEach(cleanup)

const COUNCIL = '컴퓨터학부 학생회'

function show(trail = trailOf('events', COUNCIL, eventTrail('신입생 환영회', '업무'))) {
  render(<WorkspaceHeader width="full" crumbs={trail.crumbs} title={trail.title} />)
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
  const dark = items.map(item => item.querySelector('span')!.className.includes('text-gray-700'))
  expect(dark).toEqual([false, false, false, true])
  expect(path.className).toContain('text-gray-500')
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
  expect(items[0]!.querySelector('span')!.className).toContain('text-gray-700')
  expect(within(banner).getByRole('heading', { level: 1 }).textContent).toBe('홈')
})
