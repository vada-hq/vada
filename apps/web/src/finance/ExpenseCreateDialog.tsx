import { useState } from 'react'
import { koreanDateOf, type ExpenseDetail, type TeamResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUnsavedInput } from '@/lib/leave-guard'
import { EXPENSE_OPTIONS_FAILED } from '@/lib/messages'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { useTeam } from '@/team/useTeam'
import {
  emptyExpense,
  expenseErrors,
  expenseOf,
  linesTotal,
  withMode,
  needsAmountConfirm,
  type ExpenseStart,
} from './expense-form'
import type { ExpenseDialogHandlers } from './expense-requests'
import { ModeToggle, NameFields, PaymentFields, type FieldsProps } from './ExpenseFields'
import { ExpenseAmountConfirm } from './ExpenseAmountConfirm'
import { EventField } from './EventField'
import { ExpenseAccountSelect, useExpenseAccount } from './ExpenseAccountSelect'
import { ExpenseDirectFields } from './ExpenseDirectFields'
import { ExpensePayerFields } from './ExpensePayerFields'
import { ExpenseRequestFields } from './ExpenseRequestFields'
import { wonLabel } from './purchase-view'
import { useExpenseCreate } from './useExpenseCreate'
import { useExpenseValues } from './use-expense-values'

type Props = Pick<ExpenseDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  // 내 운영진 번호. 먼저 낸 사람 고르기에서 '나'로 보인다.
  memberId: string
  // 행사 화면에서 열면 그 행사로 채운다.
  eventId?: string | null
  // 대화의 메시지에서 열면 그 메시지로 채운 값(내역, 결제일, 먼저 낸 사람, 근거 메시지).
  start?: ExpenseStart | undefined
  // 열림 상태는 부모가 가진다([지출 적기] 버튼이 연다).
  open: boolean
  onClose: () => void
  // 적은 지출을 받는다. 부모가 목록을 다시 읽고 상세를 열어 사진을 붙이게 한다.
  onCreated: (expense: ExpenseDetail) => void
}

// 지출 적기 대화상자. 닫혀 있으면 아무것도 읽지 않는다.
export function ExpenseCreateDialog({ open, ...props }: Props) {
  if (!open) return null
  return <OpenCreateDialog {...props} />
}

type ModeProps = Omit<FieldsProps, 'today'> & {
  councilId: string
  team: TeamResponse
  onForbidden: () => void
  linkedRequestIds: readonly string[] | undefined
  onAuto: FieldsProps['onChange']
}

// 방식마다 다른 칸. 요청한 품목 결제는 요청과 품목을 고르고, 요청 없이는 금액과 예산 항목과 부탁한 사람을 적는다.
function ModeFields({ team, ...props }: ModeProps) {
  const { values, disabled, onChange } = props
  const modeFields =
    values.mode === 'direct' ? (
      <ExpenseDirectFields {...props} team={team} />
    ) : (
      <>
        <ExpenseRequestFields {...props} />
        <p className="text-sm text-gray-700">합계 {wonLabel(linesTotal(values.lines))}</p>
      </>
    )
  return (
    <>
      {modeFields}
      <EventField
        councilId={props.councilId}
        value={values.eventId}
        disabled={disabled}
        locked={values.eventLocked}
        onChange={eventId => onChange({ ...values, eventId })}
        onForbidden={props.onForbidden}
      />
    </>
  )
}

type FormProps = Omit<Props, 'open'> & {
  team: TeamResponse
  saving: boolean
  setSaving: (saving: boolean) => void
}

function CreateForm({ team, saving, setSaving, memberId, eventId, start, ...props }: FormProps) {
  const [today] = useState(() => koreanDateOf(new Date()))
  const { values, setValues, autoChange, dirty } = useExpenseValues(() =>
    emptyExpense(today, eventId ?? null, start),
  )
  const [confirming, setConfirming] = useState(false)
  // 쓰던 입력이 남았으면 새로고침이나 다른 곳으로 떠날 때 묻는다(떠날 때 확인).
  const settle = useUnsavedInput(dirty)
  const account = useExpenseAccount(props.councilId, props.onForbidden, values.accountId)
  const body = expenseOf({ ...values, accountId: account.pick.id })
  const create = useExpenseCreate(props.councilId, body, {
    ...props,
    onCreated: expense => {
      settle()
      props.onCreated(expense)
    },
    setSaving,
  })
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(expenseErrors(values, today), create.parsed))
  const shared = { values, disabled: saving, onChange: setValues, errors: fieldErrors }
  return (
    <>
      <form
        ref={formRef}
        noValidate
        aria-label="지출 적기"
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          if (!attempt()) return
          if (needsAmountConfirm(values)) setConfirming(true)
          else void create.submit()
        }}
      >
        <ModeToggle
          mode={values.mode}
          disabled={saving}
          onMode={mode => setValues(withMode(values, mode))}
        />
        <NameFields {...shared} />
        <ModeFields
          {...shared}
          team={team}
          councilId={props.councilId}
          onForbidden={props.onForbidden}
          linkedRequestIds={start?.linkedRequestIds}
          onAuto={autoChange}
        />
        <PaymentFields {...shared} today={today} />
        <ExpenseAccountSelect
          account={account}
          disabled={saving}
          onPick={accountId => setValues({ ...values, accountId })}
        />
        <ExpensePayerFields {...shared} team={team} memberId={memberId} />
        {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
        <DialogFooter>
          <Button type="button" variant="outline" busy={saving} onClick={props.onClose}>
            닫기
          </Button>
          <Button type="submit" busy={saving}>
            적기
          </Button>
        </DialogFooter>
      </form>
      {confirming && (
        <ExpenseAmountConfirm
          busy={saving}
          error={create.problem}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            if (attempt()) void create.submit()
            else setConfirming(false)
          }}
        />
      )}
    </>
  )
}

function OpenCreateDialog(props: Omit<Props, 'open'>) {
  const team = useTeam(props.councilId, props.onForbidden)
  const [saving, setSaving] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) props.onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>지출 적기</DialogTitle>
        </DialogHeader>
        {team.data ? (
          <CreateForm {...props} team={team.data} saving={saving} setSaving={setSaving} />
        ) : (
          <StateMessage kind={team.loadFailed ? 'error' : 'loading'}>
            {team.loadFailed ? EXPENSE_OPTIONS_FAILED : '불러오는 중이에요'}
          </StateMessage>
        )}
      </DialogContent>
    </Dialog>
  )
}
