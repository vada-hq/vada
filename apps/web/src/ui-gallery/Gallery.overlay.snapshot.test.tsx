// @vitest-environment jsdom
import type { ComponentType } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { windowHistoryIdle } from '@/lib/use-window-history'
import { snapshotHtml } from '@/test-support/snapshot-html'
import { ExpenseCreateSection } from './ExpenseCreateSections'
import { MyNameSection } from './JoinSections'
import { EventEditSection } from './EventEditSections'
import { CreateCouncilSection } from './OnboardingSections'
import { ConfirmSection, DialogSheetSection } from './OverlaySections'
import { ApplicantRowSection, EventApplicantsSection } from './RegistrationSections'
import { WithdrawSection } from './WithdrawSections'
import { CalendarSection } from './CalendarSections'

// 부품 확인 화면에서 대화상자를 연 모양. 시험마다 그 버튼이 있는 묶음만 그린다(전체 화면은 Gallery.snapshot.test.tsx).
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const openers: [string, ComponentType][] = [
  ['빈 일정 창 열기', CalendarSection],
  ['일정 오류 창 열기', CalendarSection],
  ['일정 상세 열기', CalendarSection],
  ['읽기 전용 일정 상세 열기', CalendarSection],
  ['대화상자 열기', DialogSheetSection],
  ['옆 메뉴 열기', DialogSheetSection],
  ['오른쪽 패널 열기', DialogSheetSection],
  ['확인 대화상자 열기', ConfirmSection],
  ['일반 확인 대화상자 열기', ConfirmSection],
  ['보내는 중 확인 대화상자 열기', ConfirmSection],
  ['코드 바꾸기 확인 창 열기', CreateCouncilSection],
  ['내 이름 창 열기', MyNameSection],
  ['기본정보 수정 패널 열기', EventEditSection],
  ['미정·양식 둘 패널 열기', EventEditSection],
  ['보내는 중 패널 열기', EventEditSection],
  ['저장 실패 패널 열기', EventEditSection],
  ['탈퇴 창 열기', WithdrawSection],
  ['다시 로그인 탈퇴 창 열기', WithdrawSection],
  ['회장 탈퇴 창 열기', WithdrawSection],
  ['보내는 중 탈퇴 창 열기', WithdrawSection],
  ['실패 탈퇴 창 열기', WithdrawSection],
]

test.each(openers)('%s', (name, Section) => {
  if (Section === CalendarSection) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T03:00:00Z'))
  }
  render(<Section />)
  fireEvent.click(screen.getByRole('button', { name }))
  expect(snapshotHtml()).toMatchSnapshot()
})

test('캘린더 견본은 수정 칸 검사와 취소 확인 창을 통과한다', async () => {
  render(<CalendarSection />)
  fireEvent.click(screen.getByRole('button', { name: '일정 상세 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '수정' }))
  expect(screen.getByLabelText<HTMLInputElement>('제목').value).toBe('학교 답사')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  fireEvent.click(screen.getByRole('button', { name: '일정 상세 열기' }))
  fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
  expect(screen.getByRole('dialog', { name: '이 일정을 취소할까요?' })).toBeTruthy()
})

test('학생회 만들기: 재정 이름 후보(국)', () => {
  render(<CreateCouncilSection />)
  const structure = screen.getAllByRole('form', { name: '학생회 만들기' })[3]!
  fireEvent.click(within(structure).getByRole('button', { name: '재정부 이름 바꾸기' }))
  expect(
    within(screen.getByRole('group', { name: '재정 부서 이름 후보' }))
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['총무국', '사무국', '재정국'])
  expect(snapshotHtml()).toMatchSnapshot()
  fireEvent.click(within(structure).getByRole('button', { name: '총무국' }))
  expect(within(structure).getByRole('button', { name: '총무국 동작' })).toBeTruthy()
  expect(screen.queryByRole('group', { name: '재정 부서 이름 후보' })).toBeNull()
})

// 신청자 줄의 [입금 확인]이 여는 창: 적용 참가비로 채운 금액 칸(DEC-68). 줄 여럿에 같은 버튼이 있어 첫 줄 것을 연다.
test('입금 확인 창(금액 칸)', () => {
  render(<ApplicantRowSection />)
  fireEvent.click(screen.getAllByRole('button', { name: '입금 확인' })[0]!)
  expect(screen.getByRole('dialog', { name: '김새내님의 입금을 확인할까요?' })).toBeTruthy()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('행사 참가자 표: 줄 동작에서 입금 금액 확인 창', async () => {
  render(<EventApplicantsSection />)
  fireEvent.keyDown(screen.getAllByRole('button', { name: '김새내 동작' })[0]!, {
    key: 'ArrowDown',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '입금 확인' }))
  expect(await screen.findByRole('dialog', { name: '김새내님의 입금을 확인할까요?' })).toBeTruthy()
  expect(snapshotHtml()).toMatchSnapshot()
})

test('지출 금액과 자릿수 확인 창', () => {
  render(<ExpenseCreateSection />)
  fireEvent.click(screen.getAllByRole('button', { name: '금액 확인 창 열기' })[0]!)
  expect(snapshotHtml()).toMatchSnapshot()
})
