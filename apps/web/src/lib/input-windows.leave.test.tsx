// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CancelExpenseSchema } from '@vada/contracts'
import { CancelReasonDialog } from '@/components/CancelReasonDialog'
import { ExpenseUpdateDialog } from '@/finance/ExpenseUpdateDialog'
import { PeriodCreateDialog } from '@/finance/PeriodCreateDialog'
import { ShipmentFormDialog } from '@/finance/ShipmentFormDialog'
import { MeetingCancelDialog } from '@/meetings/MeetingCancelDialog'
import MyNameDialog from '@/profile/MyNameDialog'
import { ConfirmDepositDialog, RefundDialog } from '@/registrations/DepositDialogs'
import { NoticeMakeDialog } from '@/tasks/NoticeMakeDialog'
import { FeePaymentUploadDialog } from '@/team/FeePaymentUploadDialog'
import { resetAddress } from '@/test-support/address-reset'
import { expenseDetail } from '@/test-support/expense-fixtures'
import {
  expectAsksOnEveryExit,
  expectClosesQuietly,
  leaveWindow,
  showLeaveConfirm,
} from '@/test-support/leave-window'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'

// 입력을 받는 창이 모두 같은 공용 길(useWindowLeave)을 지나는지 본다. 맡은 화면의 시험은 그 화면에 있다.
const COUNCIL = '11111111-1111-4111-8111-111111111111'
const BASE = `/api/organizations/${COUNCIL}`
const TASK = '22222222-2222-4222-8222-222222222222'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

function serve() {
  const api = mockApi()
  api.on('GET', `${BASE}/events`, () => json({ events: [] }))
  api.on('GET', `${BASE}/accounts`, () => json({ accounts: [], actions: [] }))
  api.on('GET', `${BASE}/fiscal-periods`, () => json({ periods: [] }))
  api.on('GET', `${BASE}/rooms`, () =>
    json({ rooms: [], notices: [], unreadTotal: 0, mentionTotal: 0 }),
  )
  return api
}

const handlers = { onLost: () => {}, onForbidden: () => {} }
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

type Case = {
  name: string
  window: string
  show: (onClose: () => void) => ReactNode
  write: () => void
}

const CASES: Case[] = [
  {
    name: '회계 기간 만들기',
    window: '회계 기간 만들기',
    show: onClose => (
      <PeriodCreateDialog councilId={COUNCIL} onSaved={() => {}} onClose={onClose} {...handlers} />
    ),
    write: () => type('이름', '다른 이름'),
  },
  {
    name: '지출 고치기',
    window: '지출 고치기',
    show: onClose => (
      <ExpenseUpdateDialog
        councilId={COUNCIL}
        expense={expenseDetail()}
        busy={false}
        error={null}
        onForbidden={() => {}}
        onClose={onClose}
        onConfirm={() => {}}
      />
    ),
    write: () => type('사유', '바꾼 사유'),
  },
  {
    name: '송장 넣기',
    window: '송장 넣기',
    show: onClose => (
      <ShipmentFormDialog
        request={purchaseDetail()}
        busy={false}
        problem={null}
        onClose={onClose}
        onSave={() => {}}
      />
    ),
    write: () => type('송장 번호', '1234'),
  },
  {
    name: '납부자 명단 올리기',
    window: '납부자 명단 올리기',
    show: onClose => (
      <FeePaymentUploadDialog
        councilId={COUNCIL}
        onClose={onClose}
        onForbidden={() => {}}
        onLost={() => {}}
      />
    ),
    write: () => type('학번', '20260001'),
  },
  {
    name: '공지 만들기',
    window: '공지 만들기',
    show: onClose => (
      <NoticeMakeDialog
        councilId={COUNCIL}
        taskId={TASK}
        eventId={null}
        onClose={onClose}
        onMade={() => {}}
        {...handlers}
      />
    ),
    write: () => type('내용', '공지 글'),
  },
  {
    name: '내 이름',
    window: '내 이름',
    show: onClose => (
      <MyNameDialog
        name="김운영"
        email="kim@example.test"
        busy={false}
        error={null}
        onSave={() => {}}
        onClose={onClose}
        onWithdraw={() => {}}
      />
    ),
    write: () =>
      fireEvent.change(screen.getByRole('textbox', { name: /내 이름/ }), {
        target: { value: '김바뀜' },
      }),
  },
  {
    name: '회의 취소 사유',
    window: '회의 취소',
    show: onClose => <MeetingCancelDialog onClose={onClose} onCancel={async () => null} />,
    write: () => type('취소 사유', '일정이 바뀜'),
  },
  {
    name: '사유 한 칸 창',
    window: '이 지출을 취소할까요?',
    show: onClose => (
      <CancelReasonDialog
        title="이 지출을 취소할까요?"
        reasonLabel="취소 사유"
        confirmLabel="지출 취소"
        busy={false}
        error={null}
        parse={reason => CancelExpenseSchema.safeParse({ reason })}
        onClose={onClose}
        onConfirm={() => {}}
      />
    ),
    write: () => type('취소 사유', '잘못 적음'),
  },
  {
    name: '입금 확인 금액',
    window: '김신청님의 입금을 확인할까요?',
    show: onClose => (
      <ConfirmDepositDialog
        name="김신청"
        busy={false}
        error={null}
        appliedFee={10000}
        onClose={onClose}
        onSubmit={() => {}}
      />
    ),
    write: () => type('입금 금액(원)', '9000'),
  },
  {
    name: '환불 금액',
    window: '김신청님에게 환불했나요?',
    show: onClose => (
      <RefundDialog
        name="김신청"
        busy={false}
        error={null}
        deposited={10000}
        onClose={onClose}
        onSubmit={() => {}}
      />
    ),
    write: () => type('환불한 금액(원)', '5000'),
  },
]

const open = (item: Case) => {
  serve()
  showLeaveConfirm()
  const onClose = vi.fn(() => {
    cleanup()
  })
  render(item.show(onClose))
  return onClose
}

test.each(CASES)('$name: 쓴 값이 없으면 묻지 않고 닫는다', async item => {
  const onClose = open(item)
  await screen.findByRole('dialog', { name: item.window })
  await expectClosesQuietly(item.window)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test.each(CASES)('$name: 쓴 값이 있으면 닫는 길마다 묻고, 나가기면 닫는다', async item => {
  const onClose = open(item)
  await screen.findByRole('dialog', { name: item.window })
  item.write()
  await expectAsksOnEveryExit(item.window)
  expect(onClose).not.toHaveBeenCalled()
  await leaveWindow(item.window)
  expect(onClose).toHaveBeenCalledTimes(1)
})
