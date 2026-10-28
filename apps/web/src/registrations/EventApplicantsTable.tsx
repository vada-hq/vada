import { TriangleAlert } from 'lucide-react'
import type { ApplicantChange, EventApplicant, EventApplicantsResponse } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { EventApplicantActions } from './EventApplicantActions'
import { DEPOSIT_LABEL, EVENT_APPLICANTS, eventApplicantSelect } from '@/lib/registration-messages'

type Props = EventDialogHandlers & {
  councilId: string
  data: EventApplicantsResponse
  selected: ReadonlySet<string>
  busy: boolean
  onToggle: (id: string) => void
  onTogglePage: () => void
  onChange: (change: ApplicantChange) => void
  onReload: () => void
}

function Check({
  label,
  checked,
  onChange,
  busy,
}: {
  label: string
  checked: boolean
  onChange: () => void
  busy: boolean
}) {
  return (
    <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-4 accent-blue-600"
        aria-label={label}
        checked={checked}
        disabled={busy}
        onChange={onChange}
      />
    </label>
  )
}

function StatusCells({ row }: { row: EventApplicant }) {
  const deposited = row.deposit.status === 'confirmed'
  return (
    <>
      <td className="px-2 py-3">
        <Badge tone={row.cancelled ? 'neutral' : 'success'}>
          {row.cancelled ? EVENT_APPLICANTS.cancelled : EVENT_APPLICANTS.active}
        </Badge>
      </td>
      <td className="px-2 py-3">
        <Badge
          tone={
            row.deposit.status === 'refund_pending' ? 'warning' : deposited ? 'success' : 'neutral'
          }
        >
          {row.appliedFee === 0 && row.deposit.status === 'none'
            ? EVENT_APPLICANTS.free
            : DEPOSIT_LABEL[row.deposit.status]}
        </Badge>
      </td>
      <td className="px-2 py-3">
        <Badge tone={row.attended ? 'info' : 'neutral'}>
          {row.attended ? EVENT_APPLICANTS.attended : EVENT_APPLICANTS.notAttended}
        </Badge>
      </td>
    </>
  )
}

function ApplicantCells({ row, props }: { row: EventApplicant; props: Props }) {
  return (
    <>
      {props.data.canManage && (
        <td className="w-11">
          <Check
            label={eventApplicantSelect(row.name)}
            checked={props.selected.has(row.id)}
            onChange={() => props.onToggle(row.id)}
            busy={props.busy}
          />
        </td>
      )}
      <td className="min-w-0 px-2 py-3 @max-2xl:basis-3/4 @max-2xl:grow">
        <span className="flex min-w-0 items-start gap-1.5">
          <span className="line-clamp-2 min-w-0 font-medium wrap-anywhere">{row.name}</span>
          {row.needsAttention && (
            <TriangleAlert
              aria-label={EVENT_APPLICANTS.attention}
              className="size-4 shrink-0 text-amber-600"
            />
          )}
        </span>
      </td>
      <td className="px-2 py-3 tabular-nums wrap-anywhere @max-2xl:basis-1/2 @max-2xl:py-1">
        <span className="hidden text-xs text-muted-foreground @max-2xl:inline">
          {EVENT_APPLICANTS.studentId}{' '}
        </span>
        {row.studentId ?? '—'}
      </td>
      {props.data.showAffiliation && (
        <td className="max-w-40 px-2 py-3 wrap-anywhere @max-2xl:basis-1/2 @max-2xl:py-1">
          {row.affiliation ?? '—'}
        </td>
      )}
      {props.data.showForm && (
        <td className="max-w-40 px-2 py-3 wrap-anywhere @max-2xl:basis-1/2 @max-2xl:py-1">
          {row.formTitle}
        </td>
      )}
      <StatusCells row={row} />
      <td className="w-11 px-1 @max-2xl:ml-auto">
        <EventApplicantActions
          councilId={props.councilId}
          applicant={row}
          onChange={props.onChange}
          onGone={props.onReload}
          onForbidden={props.onForbidden}
          onLost={props.onLost}
        />
      </td>
    </>
  )
}

// 업무 표와 같은 카드·기본 표를 쓰고, 작은 컨테이너에서는 각 줄을 목록 모양으로 펼친다.
export function EventApplicantsTable(props: Props) {
  const { data, selected } = props
  const all = data.applicants.length > 0 && data.applicants.every(row => selected.has(row.id))
  return (
    <div className={cn(cardClass, 'overflow-hidden')}>
      <table
        aria-label={EVENT_APPLICANTS.title}
        className="w-full table-fixed border-collapse text-left text-sm @max-2xl:block"
      >
        <thead className="text-xs font-medium text-muted-foreground @max-2xl:hidden">
          <tr>
            {data.canManage && (
              <th scope="col" className="w-11">
                <Check
                  label={EVENT_APPLICANTS.selectPage}
                  checked={all}
                  onChange={props.onTogglePage}
                  busy={props.busy}
                />
              </th>
            )}
            <th scope="col" className="px-2 py-3">
              {EVENT_APPLICANTS.name}
            </th>
            <th scope="col" className="w-28 px-2 py-3">
              {EVENT_APPLICANTS.studentId}
            </th>
            {data.showAffiliation && (
              <th scope="col" className="px-2 py-3">
                {EVENT_APPLICANTS.affiliation}
              </th>
            )}
            {data.showForm && (
              <th scope="col" className="px-2 py-3">
                {EVENT_APPLICANTS.form}
              </th>
            )}
            <th scope="col" className="w-16 px-2 py-3">
              {EVENT_APPLICANTS.active}
            </th>
            <th scope="col" className="w-26 px-2 py-3">
              {EVENT_APPLICANTS.depositColumn}
            </th>
            <th scope="col" className="w-20 px-2 py-3">
              {EVENT_APPLICANTS.attended}
            </th>
            <th scope="col" className="w-11">
              <span className="sr-only">{EVENT_APPLICANTS.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody className="@max-2xl:block">
          {data.applicants.map(row => (
            <tr
              key={row.id}
              className={cn(
                'border-t align-middle @max-2xl:flex @max-2xl:flex-wrap @max-2xl:items-center @max-2xl:p-2',
                row.needsAttention && 'bg-amber-50',
              )}
            >
              <ApplicantCells row={row} props={props} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
