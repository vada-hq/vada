import { useId, useState } from 'react'
import { EventApplicantsQuerySchema, type EventApplicantsQuery } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { EVENT_APPLICANTS, DEPOSIT_LABEL } from '@/lib/registration-messages'

type Props = {
  query: Partial<EventApplicantsQuery>
  onQuery: (query: Partial<EventApplicantsQuery>) => void
  busy: boolean
}

function ApplicantSearch({ query, onQuery, busy }: Props) {
  const [value, setValue] = useState(query.search ?? '')
  const [invalid, setInvalid] = useState(false)
  const errorId = useId()
  return (
    <div className="flex min-w-0 grow basis-52 flex-col gap-1">
      <Input
        className="max-sm:min-h-11"
        aria-label={EVENT_APPLICANTS.search}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        disabled={busy}
        // oxlint-disable-next-line react/forbid-component-props -- 제출과 칸 확인이 없는 검색칸의 짧은 안내다.
        placeholder={EVENT_APPLICANTS.search}
        value={value}
        onChange={event => {
          const next = event.target.value
          setValue(next)
          const parsed = EventApplicantsQuerySchema.shape.search.safeParse(next.trim() || undefined)
          setInvalid(!parsed.success)
          if (parsed.success) onQuery({ search: parsed.data })
        }}
      />
      {invalid && (
        <p id={errorId} className="text-xs text-destructive">
          {EVENT_APPLICANTS.searchInvalid}
        </p>
      )}
    </div>
  )
}

export function EventApplicantsFilters({ query, onQuery, busy }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        className="w-auto max-w-full max-sm:min-h-11"
        aria-label={EVENT_APPLICANTS.registration}
        disabled={busy}
        value={query.registration ?? ''}
        onChange={event =>
          onQuery({
            registration: (event.target.value as EventApplicantsQuery['registration']) || undefined,
          })
        }
      >
        <option value="">{EVENT_APPLICANTS.allRegistrations}</option>
        <option value="active">{EVENT_APPLICANTS.active}</option>
        <option value="cancelled">{EVENT_APPLICANTS.cancelled}</option>
      </NativeSelect>
      <NativeSelect
        className="w-auto max-w-full max-sm:min-h-11"
        aria-label={EVENT_APPLICANTS.deposit}
        disabled={busy}
        value={query.deposit ?? ''}
        onChange={event =>
          onQuery({ deposit: (event.target.value as EventApplicantsQuery['deposit']) || undefined })
        }
      >
        <option value="">{EVENT_APPLICANTS.allDeposits}</option>
        <option value="none">{DEPOSIT_LABEL.none}</option>
        <option value="confirmed">{DEPOSIT_LABEL.confirmed}</option>
        <option value="refund_pending">{DEPOSIT_LABEL.refund_pending}</option>
        <option value="refunded">{DEPOSIT_LABEL.refunded}</option>
      </NativeSelect>
      <NativeSelect
        className="w-auto max-w-full max-sm:min-h-11"
        aria-label={EVENT_APPLICANTS.attendance}
        disabled={busy}
        value={query.attendance ?? ''}
        onChange={event =>
          onQuery({
            attendance: (event.target.value as EventApplicantsQuery['attendance']) || undefined,
          })
        }
      >
        <option value="">{EVENT_APPLICANTS.allAttendance}</option>
        <option value="attended">{EVENT_APPLICANTS.attended}</option>
        <option value="not_attended">{EVENT_APPLICANTS.notAttended}</option>
      </NativeSelect>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-primary-emphasis"
          checked={query.needsAttention ?? false}
          disabled={busy}
          onChange={event => onQuery({ needsAttention: event.target.checked || undefined })}
        />
        {EVENT_APPLICANTS.attention}
      </label>
      <ApplicantSearch query={query} onQuery={onQuery} busy={busy} />
    </div>
  )
}
