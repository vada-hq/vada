import type { ReactNode } from 'react'
import type { AccountItem } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { momentLabel } from '@/events/event-view'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { collectsStudentId, hasFee, type FormValues } from '../../registration-form'
import { LockedLine, SwitchRow } from './parts'
import { radius, type } from './tokens'

// 편집기 카드 셋(모집·참가비·받는 항목)의 칸과 접힌 한 줄 요약.

type Set = (patch: Partial<FormValues>) => void
type SectionProps = { values: FormValues; errors: FieldErrors; set: Set }

const won = (value: string) => `${Number(value).toLocaleString('ko-KR')}원`
const blank = (value: string) => value.trim() === ''

// ── 모집 ──
export const basicMissing = (values: FormValues) =>
  Number(blank(values.name)) + Number(values.closesAt === '')

export function basicSummary(values: FormValues) {
  return [
    values.name.trim(),
    values.opensAt && `시작 ${momentLabel(values.opensAt)}`,
    values.closesAt && `마감 ${momentLabel(values.closesAt)}`,
    !blank(values.capacity) && `정원 ${values.capacity}명`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function BasicFields({ values, errors, set }: SectionProps) {
  return (
    <>
      <Field label="양식 이름" required error={errors.name}>
        <Input value={values.name} onChange={event => set({ name: event.target.value })} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="신청 마감" required error={errors.closesAt}>
          <Input
            type="datetime-local"
            value={values.closesAt}
            onChange={event => set({ closesAt: event.target.value })}
          />
        </Field>
        <Field label="신청 시작" optional error={errors.opensAt}>
          <Input
            type="datetime-local"
            value={values.opensAt}
            onChange={event => set({ opensAt: event.target.value })}
          />
        </Field>
      </div>
      <Field label="정원(명)" optional error={errors.capacity} className="sm:max-w-40">
        <Input
          inputMode="numeric"
          value={values.capacity}
          onChange={event => set({ capacity: event.target.value })}
        />
      </Field>
      <Field label="안내" optional>
        <Textarea value={values.notice} onChange={event => set({ notice: event.target.value })} />
      </Field>
    </>
  )
}

// ── 참가비 ──
export function feeMissing(values: FormValues, accountId: string | null) {
  if (values.feeKind === 'none') return 0
  const amounts =
    values.feeKind === 'one'
      ? Number(blank(values.fee))
      : Number(blank(values.payerFee)) + Number(blank(values.nonPayerFee))
  return amounts + Number(hasFee(values) && accountId === null)
}

export function feeSummary(values: FormValues, account: AccountItem | undefined) {
  if (values.feeKind === 'none') return '없음'
  const amounts =
    values.feeKind === 'one'
      ? [!blank(values.fee) && won(values.fee)]
      : [
          !blank(values.payerFee) && `납부자 ${won(values.payerFee)}`,
          !blank(values.nonPayerFee) && `미납자 ${won(values.nonPayerFee)}`,
        ]
  return [...amounts, account?.name].filter(Boolean).join(' · ')
}

function Radio({
  name,
  label,
  checked,
  onPick,
  children,
}: {
  name: string
  label: string
  checked: boolean
  onPick: () => void
  children?: ReactNode
}) {
  return (
    <label
      className={cn('flex min-h-11 cursor-pointer items-center gap-2.5 text-fg-body', type.body)}
    >
      <input
        type="radio"
        name={name}
        className="size-4 accent-primary-emphasis"
        checked={checked}
        onChange={onPick}
      />
      {children ?? label}
    </label>
  )
}

function AccountPick({
  accounts,
  chosen,
  error,
  onPick,
}: {
  accounts: AccountItem[]
  chosen: string | null
  error: string | undefined
  onPick: (id: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 flex items-baseline gap-1 text-xs font-medium text-fg-secondary">
        참가비 받을 계좌
        <span aria-hidden className="text-sm leading-4 text-danger-emphasis">
          *
        </span>
      </legend>
      {accounts.map(account => (
        <label
          key={account.id}
          className={cn(
            'flex min-h-14 cursor-pointer items-center gap-3 border px-3 py-2',
            radius.inner,
            chosen === account.id
              ? 'border-primary-border-selected bg-primary-surface'
              : 'border-border-default bg-white hover:bg-surface-subtle',
          )}
        >
          <input
            type="radio"
            name="fee-account"
            className="size-4 accent-primary-emphasis"
            checked={chosen === account.id}
            onChange={() => onPick(account.id)}
          />
          <span className="flex min-w-0 flex-col">
            <span className={cn('font-medium text-fg', type.body)}>{account.name}</span>
            <span className={cn('text-fg-tertiary', type.small)}>
              {account.bank} {account.accountNumber}
            </span>
          </span>
        </label>
      ))}
      {error && <p className="text-xs text-danger-emphasis">{error}</p>}
    </fieldset>
  )
}

function Amounts({ values, errors, set }: SectionProps) {
  const amount = (label: string, key: 'fee' | 'payerFee' | 'nonPayerFee') => (
    <Field label={label} required error={errors[key]}>
      <Input
        inputMode="numeric"
        value={values[key]}
        onChange={event => set({ [key]: event.target.value })}
      />
    </Field>
  )
  if (values.feeKind === 'one')
    return <div className="sm:max-w-56">{amount('참가비(원)', 'fee')}</div>
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {amount('납부자 참가비(원)', 'payerFee')}
      {amount('미납자 참가비(원)', 'nonPayerFee')}
    </div>
  )
}

export function FeeFields({
  values,
  errors,
  set,
  accounts,
  chosen,
  onPick,
}: SectionProps & {
  accounts: AccountItem[]
  chosen: string | null
  onPick: (id: string) => void
}) {
  const paid = values.feeKind !== 'none'
  return (
    <>
      <div className="flex flex-col">
        <Radio
          name="fee-kind"
          label="없음"
          checked={!paid}
          onPick={() => set({ feeKind: 'none' })}
        />
        <Radio name="fee-kind" label="있음" checked={paid} onPick={() => set({ feeKind: 'one' })} />
      </div>
      {paid && (
        <div className="flex flex-col gap-5 border-l-2 border-border-subtle pl-4">
          <label
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2.5 text-fg-body',
              type.body,
            )}
          >
            <input
              type="checkbox"
              className="size-4 accent-primary-emphasis"
              checked={values.feeKind === 'split'}
              onChange={event => set({ feeKind: event.target.checked ? 'split' : 'one' })}
            />
            학생회비 납부자 별도 금액
          </label>
          <Amounts values={values} errors={errors} set={set} />
          <AccountPick accounts={accounts} chosen={chosen} error={errors.account} onPick={onPick} />
        </div>
      )}
    </>
  )
}

// ── 받는 항목 ──
export const collectSummary = (values: FormValues) =>
  ['이름', collectsStudentId(values) && '학번', values.collectsPhone && '휴대폰']
    .filter(Boolean)
    .join(' · ')

export function CollectFields({
  values,
  set,
  locked,
}: Omit<SectionProps, 'errors'> & { locked: boolean }) {
  const split = values.feeKind === 'split'
  return (
    <div className="flex flex-col gap-2">
      {locked && <LockedLine>신청이 있어 항목은 바꿀 수 없어요</LockedLine>}
      <div className="flex flex-col divide-y divide-border-subtle">
        <SwitchRow label="이름" checked locked />
        <SwitchRow
          label="학번"
          checked={collectsStudentId(values)}
          locked={locked || split}
          onChange={checked => set({ collectsStudentId: checked })}
        />
        <SwitchRow
          label="휴대폰 번호"
          checked={values.collectsPhone}
          locked={locked}
          onChange={checked => set({ collectsPhone: checked })}
        />
      </div>
      {split && !locked && <LockedLine>납부자 금액이 달라 학번은 늘 받아요</LockedLine>}
    </div>
  )
}
