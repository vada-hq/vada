// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CancelExpenseSchema } from '@vada/contracts'
import { CancelReasonDialog } from './CancelReasonDialog'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

// 나가는 버튼은 화면의 [닫기]다(오른쪽 위 X도 같은 이름이라 첫 번째가 푸터의 것이다).
const exit = () => within(screen.getByRole('dialog')).getAllByRole('button', { name: '닫기' })[0]!

test('나가는 버튼은 늘 닫기이고 취소가 아니다', () => {
  const onClose = vi.fn()
  render(
    <ConfirmDialog title="제목" confirmLabel="신청 취소" onConfirm={vi.fn()} onClose={onClose} />,
  )
  expect(screen.queryByRole('button', { name: '취소' })).toBeNull()
  fireEvent.click(exit())
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('보내는 동안 두 버튼이 막히고 Esc로도 닫히지 않는다', () => {
  const onClose = vi.fn()
  const onConfirm = vi.fn()
  render(
    <ConfirmDialog title="제목" confirmLabel="확인" busy onConfirm={onConfirm} onClose={onClose} />,
  )
  fireEvent.click(exit())
  fireEvent.click(screen.getByRole('button', { name: '확인' }))
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(onConfirm).not.toHaveBeenCalled()
})

test('사유가 꼭인 창은 비우거나 길게 쓰고 누르면 칸 아래에 알리고 보내지 않는다', () => {
  const onConfirm = vi.fn()
  // 실제 계약이 내는 문제로 확인한다(text()는 code가 custom이다).
  const parse = (reason: string) => CancelExpenseSchema.safeParse({ reason })
  render(
    <CancelReasonDialog
      title="제목"
      reasonLabel="취소 사유"
      confirmLabel="지출 취소"
      busy={false}
      error={null}
      parse={parse}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  const dialog = screen.getByRole('dialog')
  const confirm = within(dialog).getByRole('button', { name: '지출 취소' })
  expect(within(dialog).getByLabelText('취소 사유').getAttribute('aria-required')).toBe('true')
  fireEvent.click(confirm)
  expect(within(dialog).getByText('취소 사유를 입력해 주세요')).toBeTruthy()
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), {
    target: { value: '가'.repeat(501) },
  })
  fireEvent.click(confirm)
  expect(within(dialog).getByText('더 짧게 입력해 주세요')).toBeTruthy()
  expect(onConfirm).not.toHaveBeenCalled()
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '123' } })
  fireEvent.click(confirm)
  expect(onConfirm).toHaveBeenCalledWith('123')
})

test('사유가 선택인 창은 비워도 보낸다', () => {
  const onConfirm = vi.fn()
  render(
    <CancelReasonDialog
      title="제목"
      reasonLabel="사유"
      confirmLabel="완료"
      optional
      busy={false}
      error={null}
      parse={() => ({ success: true })}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  )
  expect(screen.getByText('(선택)')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '완료' }))
  expect(onConfirm).toHaveBeenCalledWith('')
})
