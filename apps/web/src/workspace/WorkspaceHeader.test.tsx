// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { pageTitles, type Page } from './pages'
import WorkspaceHeader from './WorkspaceHeader'

afterEach(cleanup)

function show(page: Page) {
  const { section, title } = pageTitles[page]
  render(
    <WorkspaceHeader
      councilName="컴퓨터학부 학생회"
      section={section}
      title={title}
      onMenu={() => {}}
    />,
  )
  return screen.getByRole('banner')
}

// 경로는 옆 메뉴의 무리를 그대로 보인다. 옆 메뉴에서 대화·행사·업무·재정·조직은 무리 없이 나란하다(DEC-96).
test.each<Page>(['chat', 'events', 'tasks', 'finance', 'people', 'departments'])(
  '무리가 없는 쪽(%s)은 경로에 학생회 이름만 있다',
  page => {
    const banner = show(page)
    expect(banner.querySelector('p')?.textContent).toBe('컴퓨터학부 학생회')
  },
)

test.each<[Page, string]>([['settings', '설정']])(
  '무리가 있는 쪽(%s)은 학생회 이름 뒤에 무리 이름이 있다',
  (page, section) => {
    const banner = show(page)
    expect(banner.querySelector('p')?.textContent).toBe(`컴퓨터학부 학생회${section}`)
  },
)

test('사람과 옛 부서 주소는 같은 조직 화면이라 제목이 조직이다', () => {
  expect([pageTitles.people.title, pageTitles.departments.title]).toEqual(['조직', '조직'])
})
