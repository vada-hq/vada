import { useState } from 'react'
import {
  INCOME_SOURCES,
  koreanDateOf,
  type CreateIncome,
  type FiscalPeriodSummary,
  type IncomeDetail,
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
import { INCOME_PERIOD_NOT_STARTED } from '@/lib/messages'
import { ExpenseAccountSelect, useExpenseAccount } from './ExpenseAccountSelect'
import { emptyIncome, incomeOf, receivedRange, type IncomeValues } from './income-form'
import type { IncomeDialogHandlers } from './income-requests'
import { SOURCE_LABEL } from './income-view'
import { IncomeItemSelect } from './IncomeItemSelect'
import { useIncomeCreate } from './useIncomeCreate'

type Props = Pick<IncomeDialogHandlers, 'onLost' | 'onForbidden'> & {
  councilId: string
  // 받은 날은 이 기간 안에서 고른다. 서버가 받은 날로 기간을 고르기 때문이다.
  period: FiscalPeriodSummary
  // 열림 상태는 부모가 가진다([수입 적기] 버튼이 연다).
  open: boolean
  onClose: () => void
  // 적은 수입을 받는다. 부모가 목록을 다시 읽고 닫는다.
  onCreated: (income: IncomeDetail) => void
}

// 수입 적기 대화상자. 닫혀 있으면 아무것도 읽지 않는다.
export function IncomeCreateDialog({ open, ...props }: Props) {
  if (!open) return null
  return <OpenCreateDialog {...props} />
}

type FieldsProps = {
  values: IncomeValues
  disabled: boolean
  onChange: (values: IncomeValues) => void
}

function SourceAndAmount({ values, disabled, onChange }: FieldsProps) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        출처
        <NativeSelect
          value={values.source}
          disabled={disabled}
          onChange={event =>
            onChange({ ...values, source: event.target.value as CreateIncome['source'] })
          }
        >
          {INCOME_SOURCES.map(source => (
            <option key={source} value={source}>
              {SOURCE_LABEL[source]}
            </option>
          ))}
        </NativeSelect>
      </Label>
      <Label className="flex flex-col gap-2">
        금액(원)
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={disabled}
          onChange={event => onChange({ ...values, amount: event.target.value })}
        />
      </Label>
    </>
  )
}

function DateAndNote({
  values,
  disabled,
  range,
  onChange,
}: FieldsProps & { range: { min: string; max: string } }) {
  return (
    <>
      <Label className="flex flex-col gap-2">
        받은 날
        <Input
          type="date"
          {...range}
          value={values.receivedOn}
          disabled={disabled}
          onChange={event => onChange({ ...values, receivedOn: event.target.value })}
        />
      </Label>
      <Label className="flex flex-col gap-2">
        내용(선택)
        <Input
          value={values.description}
          disabled={disabled}
          onChange={event => onChange({ ...values, description: event.target.value })}
        />
      </Label>
    </>
  )
}

type FormProps = Omit<Props, 'open'> & {
  saving: boolean
  setSaving: (saving: boolean) => void
}

function FormFooter({
  notStarted,
  problem,
  saving,
  canSubmit,
  onClose,
}: {
  notStarted: boolean
  problem: string | null
  saving: boolean
  canSubmit: boolean
  onClose: () => void
}) {
  return (
    <>
      {notStarted && <StateMessage kind="notice">{INCOME_PERIOD_NOT_STARTED}</StateMessage>}
      {problem && <StateMessage kind="error">{problem}</StateMessage>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
          닫기
        </Button>
        <Button type="submit" disabled={!canSubmit || saving}>
          적기
        </Button>
      </DialogFooter>
    </>
  )
}

function CreateForm({ saving, setSaving, period, ...props }: FormProps) {
  const [today] = useState(() => koreanDateOf(new Date()))
  const [values, setValues] = useState(() => emptyIncome(period, today))
  const account = useExpenseAccount(props.councilId, props.onForbidden, values.accountId)
  const range = receivedRange(period, today)
  const create = useIncomeCreate(
    props.councilId,
    incomeOf({ ...values, accountId: account.pick.id }),
    { ...props, setSaving },
  )
  const inRange = values.receivedOn >= range.min && values.receivedOn <= range.max
  const shared = { values, disabled: saving, onChange: setValues }
  return (
    <form
      aria-label="수입 적기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        void create.submit()
      }}
    >
      <SourceAndAmount {...shared} />
      <DateAndNote {...shared} range={range} />
      {period.current && (
        <IncomeItemSelect
          councilId={props.councilId}
          value={values.budgetItemId}
          disabled={saving}
          onChange={budgetItemId => setValues(before => ({ ...before, budgetItemId }))}
          onForbidden={props.onForbidden}
        />
      )}
      <ExpenseAccountSelect
        account={account}
        disabled={saving}
        onPick={accountId => setValues({ ...values, accountId })}
      />
      <FormFooter
        notStarted={range.min > range.max}
        problem={create.problem}
        saving={saving}
        canSubmit={create.valid && inRange}
        onClose={props.onClose}
      />
    </form>
  )
}

function OpenCreateDialog(props: Omit<Props, 'open'>) {
  const [saving, setSaving] = useState(false)
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !saving) props.onClose()
      }}
    >
      <DialogContent aria-describedby="income-create-description">
        <DialogHeader>
          <DialogTitle>수입 적기</DialogTitle>
          <DialogDescription id="income-create-description">
            {props.period.name}에 받은 수입이에요. 적은 수입은 고칠 수 없고 취소하고 다시 적어요.
          </DialogDescription>
        </DialogHeader>
        <CreateForm {...props} saving={saving} setSaving={setSaving} />
      </DialogContent>
    </Dialog>
  )
}
