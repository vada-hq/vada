// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import Gallery from './Gallery'

// 대화상자·옆 메뉴·확인 창의 동작은 Gallery.overlay.test.tsx가 그 묶음만 그려 본다(시험마다 전체를 그리면 느리다).
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  history.replaceState(null, '', '/ui.html')
})

test('부품 확인 화면이 모든 부품 묶음을 보여 준다', () => {
  render(<Gallery />)
  const sections = [...document.querySelectorAll('main > section')]
  const headings = sections.map(section => section.querySelector('h2')!.textContent)
  expect(headings).toEqual(
    expect.arrayContaining([
      '버튼',
      '입력',
      '칩',
      '카드·배너',
      '메뉴·탭',
      '옆 메뉴 · 틀과 수 배지',
      '옆 메뉴 · 행사 묶음',
      '동작 메뉴',
      '대화 목록 줄',
      '메시지 말풍선',
      '빈 화면·아바타·로고',
      '대화상자·옆 메뉴',
      '확인 대화상자',
      '상태 문구',
      '휴대폰 알림',
      '행사 목록 줄·상태 배지',
      '행사 머리',
      '행사 메시지 탭',
      '대화 목록의 행사·1:1 묶음',
      '행사 재정 탭',
      '재정 행사 정산 탭',
      '업무 줄',
      '홈 틀·인사 카드·카드',
      '조직 화면',
      '부서 색상',
      '참가 신청 화면',
      '수입 카드',
      '재정 개요 탭',
      '인증 카드',
      '학생회 만들기 단계',
      '학생회 고르기·둘째 학생회·미배정 안내',
      '초대 확인',
      '내 이름 창',
      '탈퇴 창',
      '가입 동의',
      '카톡 안 로그인',
      '긴 글',
      '숨김',
    ]),
  )
  const navigation = document.querySelector('nav[aria-label="구역 목록"]')!
  expect([...navigation.querySelectorAll('a')].map(link => link.textContent)).toEqual([
    '모든 구역',
    ...headings,
  ])
  for (const section of sections) {
    const link = section.querySelector('a[href^="/ui.html?"]')!
    expect(link.textContent).toBe('이것만 열기')
    expect(new URL(link.getAttribute('href')!, location.href).searchParams.get('section')).toBe(
      section.querySelector('h2')!.textContent,
    )
  }
})

test('주소에서 고른 구역만 보이고 전체 구역 목록에서 다시 이동할 수 있다', () => {
  history.replaceState(null, '', '/ui.html?section=메뉴·탭&frame=dialog')
  render(<Gallery />)
  expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual([
    '메뉴·탭',
  ])
  const navigation = screen.getByRole('navigation', { name: '구역 목록' })
  expect(within(navigation).getByRole('link', { name: '모든 구역' }).getAttribute('href')).toBe(
    '/ui.html',
  )
  expect(
    within(navigation).getByRole('link', { name: '메뉴·탭' }).getAttribute('aria-current'),
  ).toBe('page')
  const other = within(navigation).getByRole('link', { name: '카드·배너' })
  expect(new URL(other.getAttribute('href')!, location.href).searchParams.get('section')).toBe(
    '카드·배너',
  )
  expect(screen.queryByText('그런 구역이 없어요')).toBeNull()
})

test.each(['메뉴', '', '없는 구역'])('일치하지 않는 구역 %j는 안내와 목록만 보인다', section => {
  history.replaceState(null, '', `/ui.html?${new URLSearchParams({ section })}`)
  render(<Gallery />)
  expect(
    screen.queryAllByRole('heading', { level: 2 }).map(heading => heading.textContent),
  ).toEqual([])
  expect(screen.getByText('그런 구역이 없어요')).toBeTruthy()
  expect(
    within(screen.getByRole('navigation', { name: '구역 목록' })).getByRole('link', {
      name: '버튼',
    }),
  ).toBeTruthy()
})

// 페이지의 주소와 클립보드를 감시용 가짜로 바꿔 둔다. 예시가 자기 가짜 주소·가짜 복사 대신 이것들을 쓰면 주소가 바뀌거나 복사가 불린다.
test('카톡 안 로그인 예시는 그려도 페이지를 넘기지 않고, 버튼을 눌러도 가짜 주소와 가짜 복사만 쓴다', async () => {
  const page = { href: 'https://vada.test/ui.html', search: '?section=카톡 안 로그인' }
  const writeText = vi.fn(async (_text: string) => {})
  vi.stubGlobal('location', page)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  try {
    render(<Gallery />)
    expect(page.href).toBe('https://vada.test/ui.html')
    const section = screen
      .getByRole('heading', { level: 2, name: '카톡 안 로그인' })
      .closest('section')!
    expect(
      within(section).getByText(
        '카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.',
      ),
    ).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: '바깥 브라우저로 열기' }))
    fireEvent.click(within(section).getByRole('button', { name: '주소 복사' }))
    expect(
      await within(section).findByText('주소를 복사했어요. 사파리나 Chrome에 붙여 넣어 주세요.'),
    ).toBeTruthy()
    expect(page.href).toBe('https://vada.test/ui.html')
    expect(writeText).not.toHaveBeenCalled()
  } finally {
    // defineProperty로 단 것은 vi.unstubAllGlobals()가 돌려놓지 못한다.
    delete (navigator as unknown as Record<string, unknown>).clipboard
  }
})
