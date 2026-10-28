// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MyTasksPreview } from './MyTasksPreview'

afterEach(cleanup)

test('갤러리 MY-01은 다섯 묶음·결과물과 완료 이동을 확인할 수 있다', () => {
  render(<MyTasksPreview />)
  expect(screen.getAllByRole('region').map(section => section.getAttribute('aria-label'))).toEqual([
    '지남',
    '오늘',
    '7일 안',
    '나중',
    '마감 없음',
  ])
  const overdue = screen.getByRole('region', { name: '지남' })
  expect(within(overdue).getByText('구매 요청 · 진행 중 외 1')).toBeTruthy()
  fireEvent.click(within(overdue).getByRole('button', { name: '끝내기' }))
  expect(screen.queryByText('간식 구매')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: '완료된 업무' }))
  expect(screen.getByText('간식 구매')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '끝내기' })).toBeNull()
})

test('갤러리 필터 빈 상태는 초기화하면 같은 화면에 업무를 보인다', () => {
  render(<MyTasksPreview filtered />)
  expect(screen.getByText('조건에 맞는 업무 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '필터 초기화' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(5)
})
