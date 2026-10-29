// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CreateScheduleItemSchema, type UpdateScheduleItemRequest } from '@vada/contracts'
import { windowHistoryIdle, resetWindowHistory } from '@/lib/use-window-history'
import { DEPARTMENT_ID, EVENT_ID, scheduleDetail } from '@/test-support/schedule-fixtures'
import { ScheduleDialog } from './ScheduleDialog'
import { pickDate } from '@/test-support/date-field'

afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
})

const setup = (extra: Partial<ComponentProps<typeof ScheduleDialog>> = {}) => {
  const onSave = vi.fn(async (_body: UpdateScheduleItemRequest) => null)
  render(
    <ScheduleDialog
      initialDate="2026-10-28"
      departments={[{ id: DEPARTMENT_ID, name: '기획부' }]}
      events={[{ id: EVENT_ID, name: '가을 축제' }]}
      onSave={onSave}
      onClose={vi.fn()}
      {...extra}
    />,
  )
  return onSave
}

test('누를 때 필수 칸 문제를 칸 아래에 보이고 첫 칸에 초점을 둔다', async () => {
  const onSave = setup({ initialDate: '' })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByText('제목을 입력해 주세요')).toBeTruthy()
  expect(screen.getByText('시작 날짜를 입력해 주세요')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('제목')))
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: '저장' }).hasAttribute('disabled')).toBe(false)
  expect(document.querySelector('[placeholder]')).toBeNull()
})

test('기타·종일 기본값과 고른 날짜로 계약에 맞는 본문을 보낸다', async () => {
  const onSave = setup()
  expect(screen.getByLabelText<HTMLInputElement>('종일').checked).toBe(true)
  expect(screen.getByRole('radio', { name: '기타' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '답사' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  const body = onSave.mock.calls[0]![0]
  expect(CreateScheduleItemSchema.safeParse(body).success).toBe(true)
  expect(body).toMatchObject({
    title: '답사',
    type: 'other',
    when: { allDay: true, startsOn: '2026-10-28', endsOn: null },
    visibility: 'council',
  })
})

test('종일을 끄면 시각 칸, 부서를 고르면 세로 공개 범위를 보인다', () => {
  setup()
  expect(screen.queryByLabelText('공개 범위')).toBeNull()
  fireEvent.click(screen.getByLabelText('종일'))
  expect(screen.getByRole('combobox', { name: '시작 시각' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: '시작 시간' })).toBeTruthy()
  expect(screen.getByLabelText('끝 시각')).toBeTruthy()
  expect(screen.queryByLabelText('시작 날짜')).toBeNull()
  fireEvent.change(screen.getByLabelText('부서'), { target: { value: DEPARTMENT_ID } })
  expect(screen.getByRole('radio', { name: '전체 운영진' }).getAttribute('aria-checked')).toBe(
    'true',
  )
  expect(screen.getByRole('radio', { name: '이 부서만' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('부서'), { target: { value: '' } })
  expect(screen.queryByRole('radiogroup', { name: '공개 범위' })).toBeNull()
})

test('끝이 시작보다 앞이면 전송하지 않고 끝 칸에 문제를 보인다', async () => {
  const onSave = setup({ item: scheduleDetail() })
  await pickDate(screen.getByLabelText('끝 날짜'), '2026-10-27')
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(screen.getByLabelText('끝 날짜').getAttribute('aria-invalid')).toBe('true')
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('끝 날짜')))
  expect(onSave).not.toHaveBeenCalled()
})

test('서버 부서 오류를 부서 칸에 보이고 초점을 옮긴다', async () => {
  setup({
    item: scheduleDetail(),
    onSave: async () => ({ departmentId: '이 부서는 고를 수 없어요.' }),
  })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  expect(await screen.findByText('이 부서는 고를 수 없어요.')).toBeTruthy()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('부서')))
})
