// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { resetWindowHistory } from '@/lib/use-window-history'
import { ProductPanelSection } from './ProductSections'

afterEach(() => {
  cleanup()
  resetWindowHistory()
})

test.each([
  ['불러옴', '불러온 정보'],
  ['불러오는 중', '상품 정보 불러오는 중…'],
  ['실패', '상품 정보 없음'],
])('상품 패널 견본 %s을 열고 닫아 대화로 돌아온다', (state, text) => {
  render(<ProductPanelSection />)
  fireEvent.click(screen.getByRole('button', { name: `상품 정보 열기 (${state})` }))
  const panel = within(screen.getByRole('complementary', { name: '상품 정보' }))
  expect(panel.getByText(text)).toBeTruthy()
  expect(panel.getByRole('link', { name: '쿠팡에서 열기' })).toBeTruthy()
  fireEvent.click(panel.getByRole('button', { name: '닫기' }))
  expect(screen.queryByRole('complementary', { name: '상품 정보' })).toBeNull()
})
