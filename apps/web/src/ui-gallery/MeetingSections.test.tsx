// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react'
import { resetLeaveGuard } from '@/lib/leave-guard'
import { pickDate } from '@/test-support/date-field'
import {
  MeetingCreateSection,
  MeetingScheduledSection,
  MeetingCancelledSection,
} from './MeetingSections'

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
  await pickDate(screen.getByLabelText('날짜'), '2026-11-03')
  for (const [label, value] of [
    ['회의명', '견본 총회'],
    ['시작', '14:00'],
    ['끝', '15:00'],
    ['장소', '학생회실'],
  ])
    fireEvent.change(screen.getByLabelText(label!), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: '만들기' }))
  expect(await screen.findByText('회의 생성 완료')).toBeTruthy()
})

test('확정 견본은 요약을 보이고 확인 창에서 완료 회의록으로 바뀐다', async () => {
  render(<MeetingCancelledSection />)
  const section = screen.getByRole('heading', { name: '회의록 확정 전' }).closest('section')!
  expect(within(section).getByText('결정 2 · 후속 업무 2 · 비어 있는 안건 1')).toBeTruthy()
  fireEvent.click(within(section).getByRole('button', { name: '회의록 확정' }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '회의록을 확정할까요?' })).getByRole('button', {
      name: '확정',
    }),
  )
  expect(await within(section).findByText('회의록 확정 완료')).toBeTruthy()
})

test('완료 회의록 고치기 견본은 실제 계약과 사유 확인을 거쳐 저장한다', async () => {
  render(<MeetingCancelledSection />)
  const section = screen.getByRole('heading', { name: '완료 회의록 고치기' }).closest('section')!
  fireEvent.click(within(section).getByRole('button', { name: '저장' }))
  expect(within(section).getByText('사유를 입력해 주세요')).toBeTruthy()
  fireEvent.change(within(section).getByLabelText('고친 사유'), { target: { value: '정정' } })
  fireEvent.click(within(section).getByRole('button', { name: '저장' }))
  await waitFor(() => expect(within(section).queryByLabelText('고친 사유')).toBeNull())
})
