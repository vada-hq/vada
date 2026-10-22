import { useState } from 'react'
import {
  ACCOUNT_TYPES,
  CreateAccountSchema,
  UpdateAccountSchema,
  type AccountItem,
  type AccountType,
} from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
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
  hint,
  field,
  values,
  disabled,
  onChange,
}: {
  label: string
  hint?: string
  field: TextKey
  values: AccountValues
  disabled: boolean
  onChange: (values: AccountValues) => void
}) {
  return (
    <Label className="flex flex-col gap-2">
      {label}
      <Input
        value={values[field]}
        disabled={disabled}
        inputMode={field === 'accountNumber' ? 'tel' : undefined}
        placeholder={hint}
        onChange={event => onChange({ ...values, [field]: event.target.value })}
      />
    </Label>
  )
}

// 계좌 더하기와 고치기. 고치기도 칸을 모두 보낸다. 계좌번호는 통장에 적힌 대로 숫자와 '-'만 받는다.
export function AccountFormDialog({ councilId, account, onClose, ...handlers }: Props) {
  const [values, setValues] = useState(() => (account ? valuesOfAccount(account) : emptyAccount()))
  const [saving, setSaving] = useState(false)
  const change = useAccountChange(
    account ? accountPath(councilId, account.id) : accountsPath(councilId),
    values,
    account ? UpdateAccountSchema : CreateAccountSchema,
    { ...handlers, setSaving },
  )
  const shared = { values, disabled: saving, onChange: setValues }
  return (
    <BudgetFormDialog
      title={account ? '계좌 고치기' : '계좌 더하기'}
      description="통장에 적힌 대로 적어요. 지출을 적을 때 돈이 나간 계좌로 고를 수 있어요."
      submitLabel={account ? '고치기' : '더하기'}
      saving={saving}
      valid={change.valid}
      problem={change.problem}
      onSubmit={() => void change.submit()}
      onClose={onClose}
    >
      <TextField {...shared} label="이름" field="name" hint="예: 학생회비 통장" />
      <TextField {...shared} label="은행" field="bank" />
      <TextField {...shared} label="계좌번호" field="accountNumber" hint="숫자와 -만" />
      <TextField {...shared} label="예금주" field="holder" />
      <Label className="flex flex-col gap-2">
        종류
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
      </Label>
    </BudgetFormDialog>
  )
}
