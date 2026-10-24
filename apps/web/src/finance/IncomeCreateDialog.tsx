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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { INCOME_PERIOD_NOT_STARTED } from '@/lib/messages'
import { requiredText, useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { ExpenseAccountSelect, useExpenseAccount } from './ExpenseAccountSelect'
import { wonOf } from './budget-form'
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
  errors: FieldErrors
}

// 금액은 1 이상의 정수(쉼표는 받는다), 받은 날은 그 회계 기간 안이고 오늘 뒤가 아니다(계약과 서버가 같은 규칙으로 막는다).
function incomeErrors(values: IncomeValues, range: { min: string; max: string }) {
  const amount = values.amount.trim()
  return {
    amount:
      requiredText(amount, '금액을') ??
      (wonOf(amount) > 0 ? undefined : '1 이상의 숫자를 입력해 주세요'),
    receivedOn:
      requiredText(values.receivedOn, '받은 날을') ??
      (values.receivedOn < range.min || values.receivedOn > range.max
        ? `${range.min}부터 ${range.max} 사이의 날짜를 입력해 주세요`
        : undefined),
  }
}

function SourceAndAmount({ values, disabled, onChange, errors }: FieldsProps) {
  return (
    <>
      <Field label="출처" required>
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
      </Field>
      <Field label="금액(원)" required error={errors.amount}>
        <Input
          inputMode="numeric"
          value={values.amount}
          disabled={disabled}
          onChange={event => onChange({ ...values, amount: event.target.value })}
        />
      </Field>
    </>
  )
}

function DateAndNote({
  values,
  disabled,
  range,
  onChange,
  errors,
}: FieldsProps & { range: { min: string; max: string } }) {
  return (
    <>
      <Field label="받은 날" required error={errors.receivedOn}>
        <Input
          type="date"
          {...range}
          value={values.receivedOn}
          disabled={disabled}
          onChange={event => onChange({ ...values, receivedOn: event.target.value })}
        />
      </Field>
      <Field label="내용" optional>
        <Input
          value={values.description}
          disabled={disabled}
          onChange={event => onChange({ ...values, description: event.target.value })}
        />
      </Field>
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
  onClose,
}: {
  notStarted: boolean
  problem: string | null
  saving: boolean
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
        <Button type="submit" disabled={saving}>
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
  const { formRef, errors: fieldErrors, attempt } = useFormCheck(() => incomeErrors(values, range))
  const shared = { values, disabled: saving, onChange: setValues, errors: fieldErrors }
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="수입 적기"
      className="flex flex-col gap-4"
      onSubmit={event => {
        event.preventDefault()
        if (attempt()) void create.submit()
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
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{`수입 적기 · ${props.period.name}`}</DialogTitle>
        </DialogHeader>
        <CreateForm {...props} saving={saving} setSaving={setSaving} />
      </DialogContent>
    </Dialog>
  )
}
