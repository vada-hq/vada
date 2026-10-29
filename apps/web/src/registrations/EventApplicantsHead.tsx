import { useId, useState } from 'react'
import { RotateCw, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  DEPOSIT_STATUSES,
  EventApplicantsQuerySchema,
  type EventApplicantsQuery,
  type EventApplicantsResponse,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  clearApplicantFilter,
  DEPOSIT_LABEL,
  EVENT_APPLICANTS,
  eventApplicantTotal,
  QUICK_FILTER_LABEL,
} from '@/lib/registration-messages'
import { quickFilters, statusOf, STATUS_KEYS, type Quick } from './applicant-summary'
import { listSize, listType, sheetX } from './list-look'

// ① 머리와 거르기: '행사 참가자' + 수 붙은 빠른 거르기(Luma 상태 탭의 수, 고르면 진한 글 + 밑줄) … 찾기 · 거르기 · 새로 읽기.
// 자세한 거르기(신청·입금·참석)는 한 단계 안(팝오버)에 두고, 건 조건은 문장 알약('입금: 입금 안 함 ×', Linear 거르기 문장)으로 보인다.

type Query = Partial<EventApplicantsQuery>
type Props = {
  data: EventApplicantsResponse
  query: Query
  busy: boolean
  reloading: boolean
  onQuery: (query: Query) => void
  onReload: () => void
}

const DETAIL = {
  registration: {
    label: EVENT_APPLICANTS.registration,
    options: [
      ['active', EVENT_APPLICANTS.active],
      ['cancelled', EVENT_APPLICANTS.cancelled],
    ],
  },
  deposit: {
    label: EVENT_APPLICANTS.deposit,
    options: DEPOSIT_STATUSES.map(status => [status, DEPOSIT_LABEL[status]] as const),
  },
  attendance: {
    label: EVENT_APPLICANTS.attendance,
    options: [
      ['attended', EVENT_APPLICANTS.attended],
      ['not_attended', EVENT_APPLICANTS.notAttended],
    ],
  },
} as const
type DetailKey = keyof typeof DETAIL
const DETAIL_KEYS = Object.keys(DETAIL) as DetailKey[]

const clearStatus = Object.fromEntries(STATUS_KEYS.map(key => [key, undefined])) as Query

const ghost = `${listSize.text} gap-1.5 rounded-lg px-2 py-0 ${listType.body} font-medium text-fg-secondary hover:bg-surface-muted hover:text-fg-secondary pointer-coarse:px-3`

function quickLabel(quick: Quick) {
  if (quick.key === 'all')
    return quick.count === null ? EVENT_APPLICANTS.filterAll : eventApplicantTotal(quick.count)
  const label = QUICK_FILTER_LABEL[quick.key]
  return quick.count === null ? label : `${label} ${quick.count}`
}

function QuickFilters({ data, query, busy, onQuery }: Props) {
  return (
    <div
      role="group"
      aria-label={EVENT_APPLICANTS.quickFilters}
      className="flex flex-wrap items-end gap-x-4"
    >
      {quickFilters(data, query).map(quick => (
        <Button
          key={quick.key}
          type="button"
          variant="ghost"
          aria-pressed={quick.active}
          busy={busy}
          onClick={() => onQuery({ ...clearStatus, ...quick.query })}
          className={cn(
            `-mb-px ${listSize.text} gap-1.5 rounded-none border-0 border-b-2 px-0 py-0 ${listType.body} ${listType.num} hover:bg-transparent pointer-coarse:min-w-11`,
            quick.active
              ? 'border-primary-emphasis font-semibold text-fg hover:text-fg'
              : 'border-transparent font-normal text-fg-muted hover:text-fg-secondary',
          )}
        >
          {quick.key === 'attention' && (
            <span aria-hidden="true" className="size-1.5 rounded-full bg-attention-icon" />
          )}
          {quickLabel(quick)}
        </Button>
      ))}
    </div>
  )
}

function ApplicantSearch({ query, busy, onQuery }: Props) {
  const [value, setValue] = useState(query.search ?? '')
  const [invalid, setInvalid] = useState(false)
  const errorId = useId()
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 lg:w-56 lg:flex-none">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
        />
        <Input
          type="search"
          className="h-9 rounded-lg border-0 bg-surface-muted pl-9 focus-visible:bg-white pointer-coarse:h-11"
          aria-label={EVENT_APPLICANTS.search}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          disabled={busy}
          // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내다.
          placeholder={EVENT_APPLICANTS.searchHint}
          value={value}
          onChange={event => {
            const next = event.target.value
            setValue(next)
            const parsed = EventApplicantsQuerySchema.shape.search.safeParse(
              next.trim() || undefined,
            )
            setInvalid(!parsed.success)
            if (parsed.success) onQuery({ search: parsed.data })
          }}
        />
      </div>
      {invalid && (
        <p id={errorId} className={`${listType.small} text-danger`}>
          {EVENT_APPLICANTS.searchInvalid}
        </p>
      )}
    </div>
  )
}

function FilterPopover({ query, busy, onQuery }: Props) {
  const count = DETAIL_KEYS.filter(key => query[key] !== undefined).length
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className={ghost}>
          <SlidersHorizontal aria-hidden className="text-fg-muted" />
          {EVENT_APPLICANTS.filter}
          {count > 0 && <span className="font-semibold text-primary-strong">{count}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-3 p-3">
        {DETAIL_KEYS.map(key => (
          <label key={key} className={`flex flex-col gap-1 ${listType.label} text-fg-muted`}>
            {DETAIL[key].label}
            <NativeSelect
              disabled={busy}
              value={query[key] ?? ''}
              onChange={event => onQuery({ [key]: event.target.value || undefined })}
            >
              <option value="">{EVENT_APPLICANTS.filterAll}</option>
              {DETAIL[key].options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

type Pill = { key: (typeof STATUS_KEYS)[number]; label: string; text: string | null }

function pillsOf(query: Query, quicks: Quick[]): Pill[] {
  if (quicks.some(quick => quick.active)) return []
  const status = statusOf(query)
  return STATUS_KEYS.flatMap((key): Pill[] => {
    const value = status[key]
    if (value === undefined) return []
    if (key === 'needsAttention')
      return value ? [{ key, label: EVENT_APPLICANTS.attention, text: null }] : []
    const option = (DETAIL[key].options as readonly (readonly [string, string])[]).find(
      ([v]) => v === value,
    )
    return [{ key, label: DETAIL[key].label, text: option?.[1] ?? String(value) }]
  })
}

// 빠른 거르기로 설명되지 않는 자세한 거르기만 알약으로 보인다. ×로 그 조건만 푼다.
function FilterPills(props: Props) {
  const pills = pillsOf(props.query, quickFilters(props.data, props.query))
  if (!pills.length) return null
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {pills.map(pill => (
        <span
          key={pill.key}
          className={`inline-flex items-center gap-1 rounded-full bg-primary-surface py-0.5 pr-0.5 pl-3 ${listType.small} text-primary-strong`}
        >
          {pill.text === null ? (
            pill.label
          ) : (
            <>
              <span className="text-fg-tertiary">{pill.label}:</span>
              {pill.text}
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            aria-label={clearApplicantFilter(pill.label)}
            busy={props.busy}
            onClick={() => props.onQuery({ [pill.key]: undefined })}
            className="size-6 rounded-full p-0 text-primary-strong hover:bg-primary-border hover:text-primary-strong pointer-coarse:size-11"
          >
            <X aria-hidden />
          </Button>
        </span>
      ))}
    </div>
  )
}

// 1280: 한 줄 — 머리 · 수 거르기 … 찾기 · 거르기 · 새로 읽기. 390: 머리 / 찾기 · 거르기 · 새로 읽기 / 수 거르기.
export function EventApplicantsHead(props: Props) {
  return (
    <div className={`${sheetX} pt-5 pb-1 sm:pt-6`}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h2 className={`${listType.title} pb-1 text-fg`}>{EVENT_APPLICANTS.title}</h2>
        <div className="order-3 basis-full lg:order-none lg:basis-auto">
          <QuickFilters {...props} />
        </div>
        <div className="flex basis-full items-start gap-1 lg:ml-auto lg:basis-auto">
          <ApplicantSearch {...props} />
          <FilterPopover {...props} />
          <Button
            type="button"
            variant="ghost"
            aria-label={EVENT_APPLICANTS.reload}
            title={EVENT_APPLICANTS.reload}
            busy={props.reloading}
            onClick={props.onReload}
            className={`${listSize.hit} rounded-lg p-0 text-fg-muted`}
          >
            <RotateCw aria-hidden />
          </Button>
        </div>
      </div>
      <FilterPills {...props} />
    </div>
  )
}
