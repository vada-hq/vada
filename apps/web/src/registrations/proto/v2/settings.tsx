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
import type { AccountItem } from '@vada/contracts'
import { momentLabel } from '@/events/event-view'
import type { FieldErrors } from '@/lib/use-form-check'
import { type FormValues } from '../../registration-form'
import type { BuilderProps } from '../builder-props'
import { FeeValue } from './fee'
import { ErrorLine, PropRow, invalid } from './parts'
import { size, type } from './tokens'

// 편집기 속성 줄 묶음: 값 자리를 그 자리에서 고친다(Notion 속성 b15, Luma 만들기 b07). 비면 '비어 있음'·기본값 뜻('바로', '제한 없음').
// 입력칸은 테두리 없이 글처럼 보이고, 올리면 옅은 면, 고치는 중이면 파란 고리. placeholder는 쓰지 않는다(값 자리 글은 입력칸 바깥 span).

type Change = (patch: Partial<FormValues>, key?: string) => void

const INLINE =
  'rounded-lg bg-transparent px-2 outline-none hover:bg-surface-muted focus:bg-surface-muted focus:ring-2 focus:ring-primary-emphasis aria-invalid:ring-2 aria-invalid:ring-danger-emphasis'

// 일시 값: 고치지 않을 때는 '11월 3일 (화) 18:00'처럼 글로, 누르면 날짜 고르기. 입력칸 글은 초점일 때만 보인다.
function DateValue({
  id,
  value,
  empty,
  error,
  onChange,
}: {
  id: string
  value: string
  empty: string
  error?: string | undefined
  onChange: (value: string) => void
}) {
  return (
    <>
      <div className="relative -ml-2 w-full max-w-72">
        <input
          id={id}
          type="datetime-local"
          value={value}
          {...invalid(id, error)}
          onClick={event => {
            try {
              event.currentTarget.showPicker()
            } catch {
              /* 고르기 창을 못 여는 브라우저는 글자로 친다 */
            }
          }}
          onChange={event => onChange(event.target.value)}
          className={`peer w-full ${size.row} ${type.body} text-transparent focus:text-fg-body ${INLINE} [&::-webkit-calendar-picker-indicator]:opacity-0`}
        />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-2 flex items-center peer-focus:hidden ${value ? 'text-fg-body' : 'text-fg-muted'}`}
        >
          {value ? momentLabel(value) : empty}
        </span>
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </>
  )
}

function CapacityValue({
  id,
  value,
  error,
  onChange,
}: {
  id: string
  value: string
  error?: string | undefined
  onChange: (value: string) => void
}) {
  return (
    <>
      <div className="relative -ml-2 flex items-center gap-1">
        <input
          id={id}
          inputMode="numeric"
          value={value}
          {...invalid(id, error)}
          onChange={event => onChange(event.target.value)}
          className={`peer min-w-8 field-sizing-content pointer-coarse:min-w-11 ${size.row} ${type.body} text-fg-body ${INLINE} ${value ? '' : 'w-32'}`}
        />
        {value ? (
          <span className="text-fg-body">명</span>
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-fg-muted peer-focus:hidden"
          >
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
  accounts,
  chosen,
  error,
  onPick,
}: {
  id: string
  accounts: AccountItem[]
  chosen: string | null
  error?: string | undefined
  onPick: (id: string | null) => void
}) {
  return (
    <>
      <div className="relative -ml-2 flex w-full max-w-120 items-center">
        <select
          id={id}
          value={chosen ?? ''}
          {...invalid(id, error)}
          onChange={event => onPick(event.target.value || null)}
          className={`w-full min-w-0 cursor-pointer appearance-none truncate pr-8 ${size.row} ${type.body} ${chosen ? 'text-fg-body' : 'text-fg-muted'} ${INLINE}`}
        >
          <option value="">비어 있음</option>
          {accounts.map(account => (
            <option key={account.id} value={account.id}>
              {accountText(account)}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 size-4 text-fg-muted"
        />
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </>
  )
}

function NoticeValue({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative -ml-2 w-full">
      <textarea
        id={id}
        rows={1}
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`peer block w-full resize-none field-sizing-content py-1.5 ${size.row} ${type.body} text-fg-body ${INLINE}`}
      />
      {!value && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-fg-muted peer-focus:hidden"
        >
          비어 있음
        </span>
      )}
    </div>
  )
}

type Props = {
  values: FormValues
  errors: FieldErrors
  accounts: AccountItem[]
  chosen: string | null
  data: BuilderProps['data']
  onChange: Change
  onPick: (id: string | null) => void
  onEditEvent: BuilderProps['onEditEvent']
}

export function SettingRows({
  values,
  errors,
  accounts,
  chosen,
  data,
  onChange,
  onPick,
  onEditEvent,
}: Props) {
  return (
    <div className="flex flex-col gap-2 sm:gap-0">
      <PropRow icon={CalendarDays} label="행사">
        <button
          type="button"
          onClick={() => onEditEvent('startsAt')}
          className={`-ml-2 inline-flex ${size.row} cursor-pointer items-center gap-1 self-start rounded-lg px-2 text-left text-fg-secondary hover:bg-surface-muted`}
        >
          <span className="wrap-anywhere">
            {data.eventText.when} · {data.eventText.place}
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-muted" />
        </button>
      </PropRow>
      <PropRow icon={Clock} label="신청 마감" mark="required" htmlFor="v2-closesAt">
        <DateValue
          id="v2-closesAt"
          value={values.closesAt}
          empty="비어 있음"
          error={errors.closesAt}
          onChange={closesAt => onChange({ closesAt }, 'closesAt')}
        />
      </PropRow>
      <PropRow icon={PlayCircle} label="신청 시작" mark="optional" htmlFor="v2-opensAt">
        <DateValue
          id="v2-opensAt"
          value={values.opensAt}
          empty="바로"
          error={errors.opensAt}
          onChange={opensAt => onChange({ opensAt }, 'opensAt')}
        />
      </PropRow>
      <PropRow icon={UserRound} label="정원" mark="optional" htmlFor="v2-capacity">
        <CapacityValue
          id="v2-capacity"
          value={values.capacity}
          error={errors.capacity}
          onChange={capacity => onChange({ capacity }, 'capacity')}
        />
      </PropRow>
      <PropRow icon={Wallet} label="참가비" mark="required">
        <FeeValue values={values} errors={errors} onChange={onChange} />
      </PropRow>
      {values.feeKind !== 'none' && (
        <PropRow icon={Landmark} label="참가비 받을 계좌" mark="required" htmlFor="v2-account">
          <AccountValue
            id="v2-account"
            accounts={accounts}
            chosen={chosen}
            error={errors.account}
            onPick={onPick}
          />
        </PropRow>
      )}
      <PropRow icon={MessageSquareText} label="안내" mark="optional" htmlFor="v2-notice">
        <NoticeValue
          id="v2-notice"
          value={values.notice}
          onChange={notice => onChange({ notice }, 'notice')}
        />
      </PropRow>
    </div>
  )
}
