// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PageColumn from './PageColumn'

afterEach(cleanup)

// 행사 상세(세로 flex) 안에 업무 화면이 자기 PageColumn을 또 둔다. 세로 flex 안의 mx-auto는
// 자식을 내용 폭으로 줄이므로, 폭을 꽉 채우라고 따로 적어야 탭 줄과 폭이 같다.
test('PageColumn은 안에 겹쳐 들어가도 폭을 꽉 채운다', () => {
  render(
    <PageColumn>
      <PageColumn data-testid="inner">업무</PageColumn>
    </PageColumn>,
  )
  expect(screen.getByTestId('inner').className).toContain('w-full')
})
