// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Gallery from './Gallery'
import { asElement } from '@/test-support/elements'

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
    '인증 카드',
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

test('대화상자 예시는 열고 X 버튼으로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '대화상자 열기' }))
  expect(await screen.findByRole('dialog', { name: '새 행사' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('옆 메뉴 예시는 열고 닫기 버튼으로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '옆 메뉴 열기' }))
  expect(await screen.findByRole('dialog', { name: '예시 메뉴' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('오른쪽 패널 예시는 열고 패널 닫기로 닫을 수 있다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '오른쪽 패널 열기' }))
  const panel = await screen.findByRole('dialog', { name: '예시 패널' })
  expect(panel.className).toContain('right-0')
  fireEvent.click(within(panel).getByRole('button', { name: '패널 닫기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('동작 메뉴 예시는 키보드로 열고, 위험한 항목은 빨갛게 보인다', async () => {
  render(<Gallery />)
  fireEvent.keyDown(screen.getByRole('button', { name: '운영진 동작 예시' }), { key: 'Enter' })
  const menu = await screen.findByRole('menu')
  expect(
    within(menu)
      .getAllByRole('menuitem')
      .map(item => item.textContent),
  ).toEqual(['부서 배정', '부회장 직급 주기', '내보내기'])
  expect(within(menu).getByRole('menuitem', { name: '내보내기' }).className).toContain(
    'text-destructive',
  )
})

test('확인 대화상자 예시는 빨간 확인 버튼과 오류 문구를 보이고, 취소로 닫는다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  expect(within(dialog).getByRole('button', { name: '내보내기' }).className).toContain(
    'bg-destructive',
  )
  expect(within(dialog).getByRole('alert').textContent).toBe(
    '저장하지 못했어요. 다시 시도해 주세요.',
  )
  // 이름이 길어도 설명이 대화상자 밖으로 넘치지 않게 줄바꿈한다.
  expect(within(dialog).getByText(/^학생회 소속과 부서 소속이 함께 끝나요/).className).toContain(
    'wrap-anywhere',
  )
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('확인 대화상자의 일반 모양은 파란 확인 버튼이고 오류 문구가 없다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '일반 확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '이재정님에게 회장 직급을 넘길까요?' })
  const confirm = within(dialog).getByRole('button', { name: '넘기기' })
  expect(confirm.className).toContain('bg-primary')
  expect(confirm.className).not.toContain('bg-destructive')
  expect(within(dialog).queryByRole('alert')).toBeNull()
  fireEvent.click(confirm)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('확인 대화상자의 보내는 중 모양은 두 버튼이 꺼지고 Escape로 닫히지 않으며, 예시는 잠시 뒤 저절로 닫힌다', async () => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name: '보내는 중 확인 대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '박새내님을 내보낼까요?' })
  expect(
    asElement(within(dialog).getByRole('button', { name: '내보내기' }), HTMLButtonElement).disabled,
  ).toBe(true)
  expect(
    asElement(within(dialog).getByRole('button', { name: '취소' }), HTMLButtonElement).disabled,
  ).toBe(true)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog', { name: '박새내님을 내보낼까요?' })).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 4_000 })
})
