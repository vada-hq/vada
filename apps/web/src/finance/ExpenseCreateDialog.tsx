import { useState } from 'react'
import {
  EXPENSE_METHODS,
  koreanDateOf,
  type ExpenseDetail,
  type ExpenseMethod,
  type TeamResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { EXPENSE_OPTIONS_FAILED } from '@/lib/messages'
import { ChoiceSelect } from '@/tasks/ChoiceSelect'
import { useTeam } from '@/team/useTeam'
import {
  emptyExpense,
  expenseOf,
  linesTotal,
  withMode,
  type ExpenseMode,
  type ExpenseStart,
  type ExpenseValues,
} from './expense-form'
import type { ExpenseDialogHandlers } from './expense-requests'
import { METHOD_LABEL } from './expense-view'
import { EventField } from './EventField'
import { ExpenseAccountSelect, useExpenseAccount } from './ExpenseAccountSelect'
import { ExpenseDirectFields } from './ExpenseDirectFields'
import { ExpenseRequestFields } from './ExpenseRequestFields'
import { wonLabel } from './purchase-view'
import { useExpenseCreate } from './useExpenseCreate'

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

const MODE_LABEL: Record<ExpenseMode, string> = {
  request: '요청한 품목 결제',
  direct: '요청 없이',
}

function ModeToggle({
  mode,
  disabled,
  onMode,
}: {
  mode: ExpenseMode
  disabled: boolean
  onMode: (mode: ExpenseMode) => void
}) {
  return (
    <div role="group" aria-label="지출 방식" className="flex flex-wrap gap-2">
      {(Object.keys(MODE_LABEL) as ExpenseMode[]).map(item => (
        <Button
          key={item}
          type="button"
          size="sm"
          variant={mode === item ? 'secondary' : 'outline'}
          aria-pressed={mode === item}
          disabled={disabled}
          onClick={() => item !== mode && onMode(item)}
        >
          {MODE_LABEL[item]}
        </Button>
      ))}
    </div>
  )
}

// 먼저 낸 사람: 학생회 돈, 나, 다른 운영진.
function paidByChoices(team: TeamResponse, memberId: string) {
  return [
    { id: null, label: '학생회 돈' },
    { id: memberId, label: '나' },
    ...team.members.filter(m => m.id !== memberId).map(m => ({ id: m.id, label: m.name })),
  ]
}

type FieldsProps = {
  values: ExpenseValues
  disabled: boolean
  today: string
  onChange: (values: ExpenseValues) => void
}

// 사용처와 내역(위쪽 두 칸).
function NameFields({ values, disabled, onChange }: Omit<FieldsProps, 'today'>) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        사용처
        <Input
          value={values.vendor}
          disabled={disabled}
          onChange={event => onChange({ ...values, vendor: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        내역
        <Input
          value={values.description}
          disabled={disabled}
          onChange={event => onChange({ ...values, description: event.target.value })}
        />
      </Label>
    </>
  )
}

// 결제일(오늘 뒤는 못 고른다), 결제 수단, 사유(아래쪽 칸).
function PaymentFields({ values, disabled, today, onChange }: FieldsProps) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        결제일
        <Input
          type="date"
          max={today}
          value={values.paidOn}
          disabled={disabled}
          onChange={event => onChange({ ...values, paidOn: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        결제 수단
        <NativeSelect
          value={values.method}
          disabled={disabled}
          onChange={event => onChange({ ...values, method: event.target.value as ExpenseMethod })}
        >
          {EXPENSE_METHODS.map(method => (
            <option key={method} value={method}>
              {METHOD_LABEL[method]}
            </option>
          ))}
        </NativeSelect>
      </Label>
    </>
  )
}

type ModeProps = Omit<FieldsProps, 'today'> & {
  councilId: string
  team: TeamResponse
  onForbidden: () => void
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

// 먼저 낸 사람(학생회 돈, 나, 다른 운영진)과 사유(아래쪽 칸).
function PayerFields({
  team,
  memberId,
  values,
  disabled,
  onChange,
}: Omit<FieldsProps, 'today'> & { team: TeamResponse; memberId: string }) {
  return (
    <>
      <ChoiceSelect
        label="먼저 낸 사람"
        choices={paidByChoices(team, memberId)}
        value={values.paidBy}
        disabled={disabled}
        onChange={paidBy => onChange({ ...values, paidBy })}
      />
      <Label className="flex flex-col gap-2">
        사유(선택)
        <Textarea
          value={values.reason}
          disabled={disabled}
          onChange={event => onChange({ ...values, reason: event.target.value })}
        />
      </Label>
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
  const [values, setValues] = useState(() => emptyExpense(today, eventId ?? null, start))
  const account = useExpenseAccount(props.councilId, props.onForbidden, values.accountId)
  const body = expenseOf({ ...values, accountId: account.pick.id })
  const create = useExpenseCreate(props.councilId, body, { ...props, setSaving })
  const shared = { values, disabled: saving, onChange: setValues }
  return (
    <form
      aria-label="지출 적기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        void create.submit()
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
      />
      <PaymentFields {...shared} today={today} />
      <ExpenseAccountSelect
        account={account}
        disabled={saving}
        onPick={accountId => setValues({ ...values, accountId })}
      />
      <PayerFields {...shared} team={team} memberId={memberId} />
      {create.problem && <StateMessage kind="error">{create.problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={props.onClose}>
          닫기
        </Button>
        <Button type="submit" disabled={!create.valid || values.paidOn > today || saving}>
          적기
        </Button>
      </DialogFooter>
    </form>
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
      <DialogContent aria-describedby="expense-create-description">
        <DialogHeader>
          <DialogTitle>지출 적기</DialogTitle>
          <DialogDescription id="expense-create-description">
            적고 나면 영수증 사진을 붙일 수 있어요.
          </DialogDescription>
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
