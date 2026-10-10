// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Gallery from './Gallery'

afterEach(cleanup)

test('부품 확인 화면이 모든 부품 묶음을 보여 준다', () => {
  render(<Gallery />)
  for (const name of ['버튼', '입력', '칩', '숫자 묶음', '계좌 상자', '카드·배너', '메뉴·탭', '빈 화면·아바타·로고', '대화상자·옆 메뉴', '상태 문구', '인증 카드',
    '긴 글', '숨김']) {
    expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy()
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

test('숫자 묶음은 이름 붙은 영역에 숫자·설명·버튼을 두고, 위험 숫자는 빨갛게 보인다', () => {
  render(<Gallery />)
  const stats = screen.getByRole('region', { name: '예시 숫자' })
  expect(within(stats).getByText('금액을 모르는 품목 2개 제외')).toBeTruthy()
  expect(within(stats).getByText('120,000원 초과').className).toContain('text-destructive')
  expect(within(stats).getByRole('button', { name: '예산 정하기' })).toBeTruthy()
})

test('계좌 상자는 은행·번호·예금주와 계좌번호 복사 버튼을 보이고, 긴 예금주도 줄을 바꿔 보인다', () => {
  render(<Gallery />)
  const section = screen.getByRole('heading', { level: 2, name: '계좌 상자' }).closest('section')!
  for (const text of ['카카오뱅크', '3333-01-1234567']) expect(within(section).getByText(text)).toBeTruthy()
  expect(within(section).getByRole('button', { name: '계좌번호 복사' })).toBeTruthy()
})
