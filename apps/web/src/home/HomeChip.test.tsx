// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import HomeChip, { ScheduleTag } from './HomeChip'

test('가까운 마감은 지난 상태와 구별해 노란 일정 태그로 보인다', () => {
  render(<ScheduleTag label="마감" />)
  expect(screen.getByText('마감').className).toContain('text-warning')
  expect(screen.getByText('마감').className).toContain('border-transparent')
})

afterEach(cleanup)

// 같은 이름의 칩은 업무 보드와 같은 색이다(DEC-95 정한 것 21): '담당자 없음'은 와이어프레임 주황이 아니라 빨강.
test('지남과 담당자 없음은 업무 보드처럼 빨강이다', () => {
  render(
    <>
      <HomeChip label="지남" count={2} />
      <HomeChip label="담당자 없음" />
    </>,
  )
  expect(screen.getByText('지남 2').className).toContain('text-danger')
  expect(screen.getByText('담당자 없음').className).toContain('text-danger')
})
