// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { MeetingCreateSection, MeetingScheduledSection } from './MeetingSections'

afterEach(() => {
  cleanup()
  resetLeaveGuard()
})
test('예정 회의 견본은 취소 사유를 확인하고 취소 화면까지 열린다', async () => {
  render(<MeetingScheduledSection />)
  fireEvent.click(screen.getByRole('button', { name: '회의 취소' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '일정 변경' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '회의 취소' }))
  expect(await screen.findByText('취소 기록')).toBeTruthy()
})
test('만들기 견본 참가자 UUID는 실제 계약을 통과해 제출한다', async () => {
  render(<MeetingCreateSection />)
  await screen.findByRole('checkbox', { name: '김회장' })
  for (const [label, value] of [
    ['회의명', '견본 총회'],
    ['날짜', '2026-11-03'],
    ['시작', '14:00'],
    ['끝', '15:00'],
    ['장소', '학생회실'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  expect(await screen.findByText('회의 생성 완료')).toBeTruthy()
})
