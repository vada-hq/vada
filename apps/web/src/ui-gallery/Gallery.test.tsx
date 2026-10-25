// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import Gallery from './Gallery'

// 대화상자·옆 메뉴·확인 창의 동작은 Gallery.overlay.test.tsx가 그 묶음만 그려 본다(시험마다 전체를 그리면 느리다).
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('부품 확인 화면이 모든 부품 묶음을 보여 준다', () => {
  render(<Gallery />)
  for (const name of [
    '버튼',
    '입력',
    '칩',
    '카드·배너',
    '메뉴·탭',
    '동작 메뉴',
    '빈 화면·아바타·로고',
    '대화상자·옆 메뉴',
    '확인 대화상자',
    '상태 문구',
    '휴대폰 알림',
    '행사 목록 줄·상태 배지',
    '행사 예산·정산 탭',
    '재정 행사 정산 탭',
    '업무 줄·수 배지',
    '참가 신청 화면',
    '수입 카드',
    '인증 카드',
    '학생회 만들기 단계',
    '초대 확인',
    '내 이름 창',
    '탈퇴 창',
    '가입 동의',
    '카톡 안 로그인',
    '긴 글',
    '숨김',
  ]) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
  }
})

// 페이지의 주소와 클립보드를 감시용 가짜로 바꿔 둔다. 예시가 자기 가짜 주소·가짜 복사 대신 이것들을 쓰면 주소가 바뀌거나 복사가 불린다.
test('카톡 안 로그인 예시는 그려도 페이지를 넘기지 않고, 버튼을 눌러도 가짜 주소와 가짜 복사만 쓴다', async () => {
  const page = { href: 'https://vada.test/ui.html' }
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
