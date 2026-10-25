// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { snapshotHtml } from '@/test-support/snapshot-html'
import Gallery from './Gallery'

// 부품 확인 화면을 파일로 나누기 전의 겉 모양을 그대로 적어 둔 특성 시험이다(docs/features/r01-maintainability.md 조각 10).
// 나눈 뒤에도 이 스냅숏 파일은 바뀌지 않아야 한다.
afterEach(cleanup)

test('처음 모양', () => {
  render(<Gallery />)
  expect(snapshotHtml()).toMatchSnapshot()
})

test.each([
  '대화상자 열기',
  '옆 메뉴 열기',
  '오른쪽 패널 열기',
  '확인 대화상자 열기',
  '일반 확인 대화상자 열기',
  '보내는 중 확인 대화상자 열기',
  '코드 바꾸기 확인 창 열기',
])('%s', name => {
  render(<Gallery />)
  fireEvent.click(screen.getByRole('button', { name }))
  expect(snapshotHtml()).toMatchSnapshot()
})
