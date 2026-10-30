import { useState } from 'react'
import {
  ACCOUNT_TYPES,
  CreateAccountSchema,
  UpdateAccountSchema,
  type AccountItem,
  type AccountType,
} from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useUnsavedInput, useWindowLeave } from '@/lib/leave-guard'
import { sameJson } from '@/lib/same-json'
import { requiredText, useFormCheck, withContract, type FieldErrors } from '@/lib/use-form-check'
import {
  ACCOUNT_TYPE_LABEL,
  emptyAccount,
  valuesOfAccount,
  type AccountValues,
} from './account-form'
import { accountPath, accountsPath } from './finance-api'
import { BudgetFormDialog } from './BudgetFormDialog'
import { useAccountChange, type AccountChangeHandlers } from './useAccountChange'

type Props = AccountChangeHandlers & {
  councilId: string
  // 있으면 고치기, 없으면 더하기다.
  account: AccountItem | null
  onClose: () => void
}

type TextKey = 'name' | 'bank' | 'accountNumber' | 'holder'

function TextField({
  label,
  field,
  values,
  disabled,
  errors,
  onChange,
}: {
  label: string
  field: TextKey
  values: AccountValues
  disabled: boolean
  errors: FieldErrors
  onChange: (values: AccountValues) => void
}) {
  return (
    <Field label={label} required error={errors[field]}>
      <Input
        value={values[field]}
        disabled={disabled}
        inputMode={field === 'accountNumber' ? 'tel' : undefined}
        onChange={event => onChange({ ...values, [field]: event.target.value })}
      />
    </Field>
  )
}

const ACCOUNT_NUMBER = /^[0-9-]*[0-9][0-9-]*$/

// 네 칸 모두 필수다. 계좌번호는 통장에 적힌 대로 숫자와 '-'만 받는다(계약과 같은 규칙).
const accountErrors = (values: AccountValues) => ({
  name: requiredText(values.name, '이름을'),
  bank: requiredText(values.bank, '은행을'),
  accountNumber:
    requiredText(values.accountNumber, '계좌번호를') ??
    (ACCOUNT_NUMBER.test(values.accountNumber.trim()) ? undefined : '숫자와 -만 입력해 주세요'),
  holder: requiredText(values.holder, '예금주를'),
})

// 계좌 더하기와 고치기. 고치기도 칸을 모두 보낸다. 계좌번호는 통장에 적힌 대로 숫자와 '-'만 받는다.
export function AccountFormDialog({ councilId, account, onClose, ...handlers }: Props) {
  const [initial] = useState(() => (account ? valuesOfAccount(account) : emptyAccount()))
  const [values, setValues] = useState(initial)
  const [saving, setSaving] = useState(false)
  const leave = useWindowLeave(onClose)
  // 보내는 동안은 풀어 둔다. 저장되면 그대로 닫히고, 실패하면 다시 지킨다.
  useUnsavedInput(!sameJson(values, initial) && !saving, leave.holder)
  const change = useAccountChange(
    account ? accountPath(councilId, account.id) : accountsPath(councilId),
    values,
    account ? UpdateAccountSchema : CreateAccountSchema,
    { ...handlers, setSaving },
  )
  const {
    formRef,
    errors: fieldErrors,
    attempt,
  } = useFormCheck(() => withContract(accountErrors(values), change.parsed))
  const shared = { values, disabled: saving, onChange: setValues, errors: fieldErrors }
  return (
    <BudgetFormDialog
      title={account ? '계좌 고치기' : '계좌 더하기'}
      submitLabel={account ? '고치기' : '더하기'}
      saving={saving}
      formRef={formRef}
      attempt={attempt}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={leave.close}
    >
      <TextField {...shared} label="이름" field="name" />
      <TextField {...shared} label="은행" field="bank" />
      <TextField {...shared} label="계좌번호" field="accountNumber" />
      <TextField {...shared} label="예금주" field="holder" />
      <Field label="종류" required>
        <NativeSelect
          value={values.type}
          disabled={saving}
          onChange={event => setValues({ ...values, type: event.target.value as AccountType })}
        >
          {ACCOUNT_TYPES.map(type => (
            <option key={type} value={type}>
              {ACCOUNT_TYPE_LABEL[type]}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </BudgetFormDialog>
  )
}
