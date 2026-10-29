import { cn } from '@/lib/utils'
import { EVENT_APPLICANTS, eventApplicantSelect } from '@/lib/registration-messages'
import {
  AttendanceMark,
  AttentionMark,
  DepositMark,
  RegistrationMark,
  ResultMark,
} from './ApplicantMarks'
import { Button } from '@/components/ui/button'
import { CheckBox, rowSurface, type ListProps, type RowModel } from './EventApplicantsTable'
import { listType } from './list-look'

// ② 390 명단: 열 이름 줄 없는 두 줄 목록(Shopify 표 → 줄 목록). 1줄 이름 + 학번(회색) (+양식) … '⋯',
// 확인 필요면 ⚠ 까닭 한 줄, 마지막 줄에 입금·참석 점 + 글(취소함이면 그것도). 줄 글 전체가 한 사람 보기를 여는 단추다(44px 이상).
// 관리 권한자에게 줄 왼쪽 체크(44px)가 늘 보인다.
// 행사 전에는 참석 칸을 두지 않는다(열 이름이 없어 '—'가 혼자 뜻이 없다). 출석하면 '참석'이 생긴다.

function Facts({ model, props }: { model: RowModel; props: ListProps }) {
  const { row } = model
  return (
    <span className="flex max-w-full flex-wrap items-baseline gap-x-2">
      <span className={`${listType.body} font-semibold text-fg wrap-anywhere`}>{row.name}</span>
      <span className={`${listType.small} ${listType.num} text-fg-muted`}>
        <span className="sr-only">{EVENT_APPLICANTS.studentId} </span>
        {row.studentId ?? '—'}
      </span>
      {props.data.showAffiliation && row.affiliation && (
        <span className={`${listType.small} text-fg-muted wrap-anywhere`}>{row.affiliation}</span>
      )}
      {props.data.showForm && (
        <span className={`${listType.small} text-fg-muted wrap-anywhere`}>{row.formTitle}</span>
      )}
    </span>
  )
}

function Statuses({ model, started }: { model: RowModel; started: boolean }) {
  const { row, result } = model
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <DepositMark row={row} />
      {(started || row.attended) && <AttendanceMark row={row} started={started} />}
      {row.cancelled && <RegistrationMark row={row} />}
      {result && <ResultMark failure={result.failure} />}
    </span>
  )
}

function Item({ model, props }: { model: RowModel; props: ListProps }) {
  const { row } = model
  const manage = props.data.canManage
  return (
    <li
      className={cn(
        'flex min-h-16 items-center gap-1 border-b border-border-subtle py-2 pr-1 pl-4',
        !manage && 'sm:pl-8',
        rowSurface(model),
      )}
    >
      {manage && (
        <span className="-ml-3 shrink-0">
          <CheckBox
            label={eventApplicantSelect(row.name)}
            checked={model.picked}
            busy={props.busy}
            onChange={() => props.onToggle(row.id)}
          />
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => props.onOpen(row.id)}
        className="h-auto min-h-11 min-w-0 flex-1 flex-col items-start justify-center gap-1 rounded-none border-0 p-0 text-left font-normal whitespace-normal hover:bg-transparent"
      >
        <Facts model={model} props={props} />
        {row.needsAttention && <AttentionMark reason={model.reason} />}
        <Statuses model={model} started={props.started} />
      </Button>
      {model.actions}
    </li>
  )
}

export function EventApplicantsList(props: ListProps) {
  return (
    <ul aria-label={EVENT_APPLICANTS.title} className="border-t border-border-default">
      {props.rows.map(model => (
        <Item key={model.row.id} model={model} props={props} />
      ))}
    </ul>
  )
}
