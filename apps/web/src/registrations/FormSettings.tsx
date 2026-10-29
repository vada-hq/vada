import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock,
  Landmark,
  MessageSquareText,
  PlayCircle,
  UserRound,
  Wallet,
} from 'lucide-react'
import type { AccountItem, EventDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { DateTimeField } from '@/components/ui/date-time-field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { EventFieldFocus } from '@/events/EventFields'
import { whenLabel } from '@/events/event-view'
import { openAccounts } from '@/finance/account-form'
import type { FieldErrors } from '@/lib/use-form-check'
import { FEE_ACCOUNT_CLOSED, FEE_ACCOUNTS_FAILED } from '@/lib/registration-messages'
import { choiceId, choiceValue } from '@/tasks/task-form-options'
import { ErrorLine, PropRow, TextAction, invalid } from './DocParts'
import { fieldSurface, size, type } from './doc-look'
import { FeeValue } from './FormFee'
import type { FormValues } from './registration-form'
import type { FeeAccount } from './useFeeAccount'

// 편집기 속성 줄: 값 자리를 그 자리에서 고친다(Notion 속성, Luma 만들기). 고칠 수 있는 값은 쉴 때 글만, 올리면 옅은 면, 고치는 중 고리.
// 비면 '비어 있음'·기본값 뜻('바로', '제한 없음')을 입력칸 위에 겹친 글로 보인다(placeholder 아님). 읽기만 하는 '행사' 줄은 회색 글 + ›.

export type Change = (patch: Partial<FormValues>) => void
export type FieldIds = Record<
  | 'name'
  | 'closesAt'
  | 'opensAt'
  | 'capacity'
  | 'fee'
  | 'payerFee'
  | 'nonPayerFee'
  | 'account'
  | 'notice',
  string
>

const INLINE = `px-2.5 py-1.5 ${type.input} ${fieldSurface}`
// 빈 값 글(입력칸 위에 겹친 span). 왼쪽 여백을 입력칸 글과 맞춘다.
const OVERLAY = `pointer-events-none absolute inset-y-0 left-2.5 flex items-center ${type.input}`

// 행사 일시·장소는 행사 화면이 원천이다. 누르면 행사 고치기를 빈 칸(없으면 일시)에 초점을 두고 연다.
function EventValue({
  event,
  onEdit,
}: {
  event: EventDetail
  onEdit: (focus: EventFieldFocus) => void
}) {
  const text = `${whenLabel(event)} · ${event.place ?? '장소 미정'}`
  if (!event.actions.includes('event.update'))
    return <span className="px-2.5 text-fg-secondary wrap-anywhere">{text}</span>
  const focus: EventFieldFocus =
    event.startsAt !== null && event.place === null ? 'place' : 'startsAt'
  return (
    <TextAction
      className="self-start text-left font-normal whitespace-normal text-fg-secondary"
      onClick={() => onEdit(focus)}
    >
      <span className="wrap-anywhere">{text}</span>
      <ChevronRight aria-hidden className="text-fg-muted" />
    </TextAction>
  )
}

type ValueProps = {
  id: string
  value: string
  error?: string | undefined
  required?: boolean
  onChange: (value: string) => void
}

// 일시: 앱 달력(날짜)과 30분 목록(시각). 앱 어디서나 같은 날짜 칸이다(components/ui/date-time-field).
function DateValue({
  id,
  value,
  error,
  required,
  timeLabel,
  onChange,
}: ValueProps & { timeLabel: string }) {
  return (
    <>
      <div className="w-full max-w-80 py-1">
        <DateTimeField
          id={id}
          value={value}
          timeLabel={timeLabel}
          clearable={!required}
          aria-required={required || undefined}
          {...invalid(id, error)}
          onChange={onChange}
        />
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </>
  )
}

function CapacityValue({ id, value, error, onChange }: ValueProps) {
  return (
    <>
      <div className="relative flex items-center gap-1">
        <Input
          id={id}
          inputMode="numeric"
          value={value}
          {...invalid(id, error)}
          onChange={event => onChange(event.target.value)}
          className={`peer min-w-9 pointer-coarse:min-w-11 field-sizing-content ${value ? 'w-auto' : 'w-28'} ${size.row} ${INLINE}`}
        />
        {value ? (
          <span>명</span>
        ) : (
          <span aria-hidden="true" className={`${OVERLAY} text-fg-tertiary peer-focus:hidden`}>
            제한 없음
          </span>
        )}
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </>
  )
}

const accountText = (account: AccountItem) =>
  `${account.name} · ${account.bank} ${account.accountNumber}`

function AccountValue({
  id,
  account,
  error,
  onPick,
}: {
  id: string
  account: FeeAccount
  error: string | undefined
  onPick: (accountId: string | null) => void
}) {
  if (account.failed) return <StateMessage kind="error">{FEE_ACCOUNTS_FAILED}</StateMessage>
  const chosen = account.pick.id
  return (
    <>
      <div className="relative flex max-w-full min-w-0 items-center self-start">
        <NativeSelect
          id={id}
          value={choiceValue(chosen)}
          aria-required
          {...invalid(id, error)}
          onChange={event => onPick(choiceId(event.target.value))}
          className={`w-auto max-w-full min-w-0 shrink field-sizing-content appearance-none truncate ${size.row} ${chosen ? 'text-fg-body' : 'text-fg-tertiary'} ${INLINE} pr-8`}
        >
          <option value={choiceValue(null)}>비어 있음</option>
          {openAccounts(account.accounts ?? []).map(item => (
            <option key={item.id} value={item.id}>
              {accountText(item)}
            </option>
          ))}
        </NativeSelect>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 size-4 text-fg-tertiary"
        />
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
      {account.pick.closed && <StateMessage kind="error">{FEE_ACCOUNT_CLOSED}</StateMessage>}
    </>
  )
}

function NoticeValue({ id, value, error, onChange }: ValueProps) {
  return (
    <>
      <div className="relative w-full">
        <Textarea
          id={id}
          rows={1}
          value={value}
          {...invalid(id, error)}
          onChange={event => onChange(event.target.value)}
          className={`peer block w-full resize-none field-sizing-content ${size.row} ${INLINE}`}
        />
        {!value && (
          <span aria-hidden="true" className={`${OVERLAY} text-fg-tertiary peer-focus:hidden`}>
            비어 있음
          </span>
        )}
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </>
  )
}

type Props = {
  ids: FieldIds
  values: FormValues
  errors: FieldErrors
  // 초안은 마감을 비워 저장할 수 있다(활성화가 묻는다). 그때는 필수 별표를 달지 않는다.
  closesRequired: boolean
  account: FeeAccount
  event: EventDetail | null
  onChange: Change
  onPick: (accountId: string | null) => void
  onEditEvent: (focus: EventFieldFocus) => void
}

export function SettingRows({
  ids,
  values,
  errors,
  closesRequired,
  account,
  event,
  onChange,
  onPick,
  ...rest
}: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-1">
      {event && (
        <PropRow icon={CalendarDays} label="행사">
          <EventValue event={event} onEdit={rest.onEditEvent} />
        </PropRow>
      )}
      <PropRow
        icon={Clock}
        label="신청 마감"
        mark={closesRequired ? 'required' : undefined}
        htmlFor={ids.closesAt}
      >
        <DateValue
          id={ids.closesAt}
          value={values.closesAt}
          // 시각 칸 이름은 라벨 글을 담지 않는다. 라벨로 날짜 칸을 찾을 때 둘이 함께 걸리지 않게 한다.
          timeLabel="마감 시각"
          required={closesRequired}
          error={errors.closesAt}
          onChange={closesAt => onChange({ closesAt })}
        />
      </PropRow>
      <PropRow icon={PlayCircle} label="신청 시작" mark="optional" htmlFor={ids.opensAt}>
        <DateValue
          id={ids.opensAt}
          value={values.opensAt}
          timeLabel="시작 시각"
          error={errors.opensAt}
          onChange={opensAt => onChange({ opensAt })}
        />
      </PropRow>
      <PropRow icon={UserRound} label="정원" mark="optional" htmlFor={ids.capacity}>
        <CapacityValue
          id={ids.capacity}
          value={values.capacity}
          error={errors.capacity}
          onChange={capacity => onChange({ capacity })}
        />
      </PropRow>
      <PropRow icon={Wallet} label="참가비" mark="required">
        <FeeValue ids={ids} values={values} errors={errors} onChange={onChange} />
      </PropRow>
      {values.feeKind !== 'none' && (
        <PropRow icon={Landmark} label="참가비 받을 계좌" mark="required" htmlFor={ids.account}>
          <AccountValue id={ids.account} account={account} error={errors.account} onPick={onPick} />
        </PropRow>
      )}
      <PropRow icon={MessageSquareText} label="안내" mark="optional" htmlFor={ids.notice}>
        <NoticeValue
          id={ids.notice}
          value={values.notice}
          error={errors.notice}
          onChange={notice => onChange({ notice })}
        />
      </PropRow>
    </div>
  )
}
