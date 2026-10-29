import type {
  ApplicantChange,
  BulkApplicantsResponse,
  EventApplicantsQuery,
  EventApplicantsResponse,
} from '@vada/contracts'
import { EVENT_APPLICANT_PAGE_SIZE } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import {
  applicantFailure,
  eventApplicantTotal,
  eventApplicantSelected,
  eventApplicantCount,
  bulkApplicantsSummary,
  EVENT_APPLICANTS,
} from '@/lib/registration-messages'
import { EventApplicantsFilters } from './EventApplicantsFilters'
import { EventApplicantsTable } from './EventApplicantsTable'

type Props = {
  councilId: string
  data: EventApplicantsResponse
  query?: Partial<EventApplicantsQuery>
  selected?: ReadonlySet<string>
  result?: BulkApplicantsResponse | null
  resultNames?: ReadonlyMap<string, string>
  busy?: boolean
  submitting?: boolean
  onQuery?: (query: Partial<EventApplicantsQuery>) => void
  onPage?: (page: number) => void
  onToggle?: (id: string) => void
  onTogglePage?: () => void
  onBulk?: (kind: 'deposit' | 'attendance') => void
  onChange?: (change: ApplicantChange) => void
  onReload?: () => void
  onForbidden?: () => void
  onLost?: (message: string) => void
}

const noop = () => undefined
const emptySelection: ReadonlySet<string> = new Set()

function BulkResult({
  data,
  result,
  names,
}: {
  data: EventApplicantsResponse
  result: Props['result']
  names: Props['resultNames']
}) {
  if (!result) return null
  const failures = result.results.filter(item => item.error !== null)
  return (
    <div className="flex flex-col gap-1 text-sm" role="status">
      <p>{bulkApplicantsSummary(result.results.length - failures.length, failures.length)}</p>
      {failures.map(item => (
        <p key={item.registrationId} className="text-destructive wrap-anywhere">
          {names?.get(item.registrationId) ??
            data.applicants.find(row => row.id === item.registrationId)?.name ??
            EVENT_APPLICANTS.unknownApplicant}
          : {applicantFailure(item.error!)}
        </p>
      ))}
    </div>
  )
}

function BulkBar(props: Props) {
  const count = props.selected?.size ?? 0
  if (!props.data.canManage || count === 0)
    return <BulkResult data={props.data} result={props.result} names={props.resultNames} />
  return (
    <div className="sticky bottom-0 flex flex-col gap-3 rounded-md border border-primary-border bg-primary-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-medium tabular-nums">{eventApplicantSelected(count)}</p>
        <Button
          size="sm"
          touch
          busy={props.busy ?? false}
          onClick={() => props.onBulk?.('deposit')}
        >
          {EVENT_APPLICANTS.bulkDeposit}
        </Button>
        <Button
          size="sm"
          variant="outline"
          touch
          busy={props.busy ?? false}
          onClick={() => props.onBulk?.('attendance')}
        >
          {EVENT_APPLICANTS.bulkAttendance}
        </Button>
      </div>
      <BulkResult data={props.data} result={props.result} names={props.resultNames} />
    </div>
  )
}

function Pagination({
  data,
  busy,
  onPage,
}: {
  data: EventApplicantsResponse
  busy: Props['busy']
  onPage: Props['onPage']
}) {
  const pages = Math.max(1, Math.ceil(data.total / EVENT_APPLICANT_PAGE_SIZE))
  return (
    <nav aria-label={EVENT_APPLICANTS.pages} className="flex items-center justify-end gap-2">
      {data.page > 1 && (
        <Button
          size="sm"
          variant="outline"
          touch
          busy={busy ?? false}
          onClick={() => onPage?.(data.page - 1)}
        >
          {EVENT_APPLICANTS.previousPage}
        </Button>
      )}
      <span className="text-sm tabular-nums text-muted-foreground">
        {data.page} / {pages}
      </span>
      {data.page < pages && (
        <Button
          size="sm"
          variant="outline"
          touch
          busy={busy ?? false}
          onClick={() => onPage?.(data.page + 1)}
        >
          {EVENT_APPLICANTS.nextPage}
        </Button>
      )}
    </nav>
  )
}

function tablePropsOf(props: Props) {
  return {
    councilId: props.councilId,
    data: props.data,
    selected: props.selected ?? emptySelection,
    busy: props.busy ?? false,
    onToggle: props.onToggle ?? noop,
    onTogglePage: props.onTogglePage ?? noop,
    onChange: props.onChange ?? noop,
    onReload: props.onReload ?? noop,
    onForbidden: props.onForbidden ?? noop,
    onLost: props.onLost ?? noop,
  }
}

export function EventApplicantsView(props: Props) {
  const { data } = props
  return (
    <section
      aria-label={EVENT_APPLICANTS.title}
      className="@container flex min-w-0 flex-col gap-3 break-keep"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{EVENT_APPLICANTS.title}</h2>
        {data.canView && (
          <div className="flex items-center gap-2">
            <p className="text-sm tabular-nums text-muted-foreground">
              {eventApplicantTotal(data.total)}
            </p>
            <Button
              variant="ghost"
              size="sm"
              touch
              busy={props.busy ?? false}
              onClick={props.onReload}
            >
              {EVENT_APPLICANTS.reload}
            </Button>
          </div>
        )}
      </div>
      {!data.canView ? (
        <div className="flex flex-wrap gap-4 text-sm tabular-nums">
          <p>{eventApplicantCount('applicants', data.counts.applicants)}</p>
          <p>{eventApplicantCount('attended', data.counts.attended)}</p>
        </div>
      ) : (
        <>
          <EventApplicantsFilters
            query={props.query ?? {}}
            onQuery={props.onQuery ?? noop}
            busy={props.submitting ?? false}
          />
          {data.applicants.length === 0 ? (
            <StateMessage kind="empty">{EVENT_APPLICANTS.empty}</StateMessage>
          ) : (
            <EventApplicantsTable {...tablePropsOf(props)} />
          )}
          <Pagination data={data} busy={props.busy ?? false} onPage={props.onPage} />
          <BulkBar {...props} />
        </>
      )}
    </section>
  )
}
