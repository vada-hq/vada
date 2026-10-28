// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ScheduleAction } from '@vada/contracts'
import { windowHistoryIdle, resetWindowHistory } from '@/lib/use-window-history'
import { scheduleDetail } from '@/test-support/schedule-fixtures'
import { ScheduleDetail } from './ScheduleDetail'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  vi.useRealTimers()
})

test.each<{ actions: ScheduleAction[] }>([
  { actions: [] },
  { actions: ['schedule_item.update'] },
  { actions: ['schedule_item.cancel'] },
  { actions: ['schedule_item.update', 'schedule_item.cancel'] },
])('동작은 서버 actions만 따른다: %j', ({ actions }) => {
  render(
    <ScheduleDetail
      councilId="c1"
      item={scheduleDetail({ actions })}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(Boolean(screen.queryByRole('button', { name: '수정' }))).toBe(
    actions.includes('schedule_item.update'),
  )
  expect(Boolean(screen.queryByRole('button', { name: '일정 취소' }))).toBe(
    actions.includes('schedule_item.cancel'),
  )
  const link = screen.getByRole('link', { name: 'Google 캘린더에 추가' })
  expect(link.getAttribute('target')).toBe('_blank')
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  expect(new URL(link.getAttribute('href')!).searchParams.get('dates')).toBe('20261028/20261029')
})

test('일정 취소를 확인하기 전에는 취소 요청을 보내지 않는다', async () => {
  const onDelete = vi.fn(async () => null)
  render(
    <ScheduleDetail
      councilId="c1"
      item={scheduleDetail()}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={onDelete}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
  expect(screen.getByRole('dialog', { name: '이 일정을 취소할까요?' })).toBeTruthy()
  expect(onDelete).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
  expect(onDelete).toHaveBeenCalledTimes(1)
})

test('날짜·부서 공개·행사·메모·만든 사람을 보인다', () => {
  render(
    <ScheduleDetail
      councilId="c1"
      item={scheduleDetail({ start: '2026-10-25', end: '2026-10-27', visibility: 'department' })}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByText('10월 25일 (일) ~ 10월 27일 (화)')).toBeTruthy()
  expect(screen.getByText(/기획부.*이 부서만/)).toBeTruthy()
  expect(screen.getByRole('link', { name: '가을 축제' }).getAttribute('href')).toBe(
    '/events/c1/0199d1a0-0000-7000-8000-0000000000e1',
  )
  expect(screen.getByText('출입구 확인')).toBeTruthy()
  expect(screen.getByText(/김기획 · 10월 20일/)).toBeTruthy()
})
