// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import HomeProgress from './HomeProgress'

afterEach(cleanup)

// 진행 막대는 업무 수다. 행사 준비율이 아니라 %로 적지 않는다(DEC-95, 기획자 "준비 N%로 표기하지 않는다").
test('막대 옆 글은 업무 끝남/전체이고 %가 없다', () => {
  const { container } = render(<HomeProgress label="업무" done={2} total={5} />)
  expect(container.textContent).toBe('업무 2/5')
  expect(screen.getByRole('progressbar', { name: '업무 2/5' })).toBeTruthy()
})

test('업무가 없어도 막대가 깨지지 않는다', () => {
  const { container } = render(<HomeProgress label="부서 업무" done={0} total={0} />)
  expect(container.textContent).toBe('부서 업무 0/0')
  expect(screen.getByRole('progressbar').getAttribute('max')).toBe('1')
})
