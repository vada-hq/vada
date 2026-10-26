// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PageColumn from './PageColumn'

afterEach(cleanup)

// 행사 상세(세로 flex) 안에 업무 화면이 자기 PageColumn을 또 둔다. 세로 flex 안의 자식은
// 내용 폭으로 줄 수 있으므로, 폭을 꽉 채우라고 따로 적어야 탭 줄과 폭이 같다.
test('PageColumn은 안에 겹쳐 들어가도 폭을 꽉 채운다', () => {
  render(
    <PageColumn>
      <PageColumn data-testid="inner">업무</PageColumn>
    </PageColumn>,
  )
  expect(screen.getByTestId('inner').className).toContain('w-full')
})

// 본문은 머리글과 같은 왼쪽 줄에 붙는다(DEC-96). 넓은 화면에서 끝없이 넓어지지 않게 기본 최대 폭은 1024px이다.
test('기본 최대 폭은 1024px이고 가운데로 모으지 않는다', () => {
  render(<PageColumn data-testid="column">본문</PageColumn>)
  const { className } = screen.getByTestId('column')
  expect(className).toContain('max-w-5xl')
  expect(className).not.toContain('mx-auto')
})

test('화면이 와이어프레임 폭을 넘기면 그 폭이다', () => {
  render(
    <PageColumn data-testid="column" width="max-w-3xl">
      본문
    </PageColumn>,
  )
  const { className } = screen.getByTestId('column')
  expect(className).toContain('max-w-3xl')
  expect(className).not.toContain('max-w-5xl')
})
