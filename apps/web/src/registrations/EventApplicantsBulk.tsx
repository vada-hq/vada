import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import type { BulkApplicantsResponse, EventApplicantsResponse } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  applicantFailure,
  bulkApplicantsSummary,
  EVENT_APPLICANTS,
  eventApplicantSelectAll,
  eventApplicantSelected,
} from '@/lib/registration-messages'
import { listType, sheetX } from './list-look'

// ③ 일괄 띠: 고를 때만 뜨는 짙은 알약(Linear 아래 떠 있는 고르기 막대). '3명 선택 │ 입금 확인 · 참석 처리 │ ×'.
// [입금 확인]은 줄 메뉴·입금 창·입금 열 값과 같은 이름이다. [불참 처리]는 행사 첫날부터 보인다(그 전에는 아직 올지 모른다, DEC-93).
// 1280은 아래 가운데에 떠 있고, 390은 아래 꽉 찬 띠다(두 단추 같은 폭). 스크롤해도 화면 아래에 붙는다(sticky).

export type BulkKind = 'deposit' | 'attendance' | 'absence'
const BULK: { kind: BulkKind; label: string }[] = [
  { kind: 'deposit', label: EVENT_APPLICANTS.bulkDeposit },
  { kind: 'attendance', label: EVENT_APPLICANTS.bulkAttendance },
  { kind: 'absence', label: EVENT_APPLICANTS.bulkAbsence },
]

const onDark =
  'min-h-9 rounded-full border-0 bg-transparent px-3 text-sm font-medium text-white hover:bg-surface-inverse-hover hover:text-white pointer-coarse:min-h-11'

type Props = {
  count: number
  pageCount: number
  allPicked: boolean
  busy: boolean
  wide: boolean
  // [불참 처리]를 보일까(행사 첫날부터, 고른 줄에 불참 처리 동작이 있을 때)
  absence: boolean
  onBulk: (kind: BulkKind) => void
  onUnselect: () => void
  onSelectPage: () => void
}

function Frame({ wide, children }: { wide: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        'sticky z-20',
        wide ? 'pointer-events-none bottom-6 flex justify-center pt-4' : 'bottom-0 pt-3',
      )}
    >
      <div
        role="region"
        aria-label={EVENT_APPLICANTS.bulk}
        className={cn(
          'pointer-events-auto flex items-center gap-1 bg-surface-inverse text-white shadow-lg',
          wide
            ? 'h-12 rounded-full py-1 pr-1.5 pl-5'
            : 'min-h-14 flex-wrap rounded-2xl px-3 py-1.5',
        )}
      >
        {children}
      </div>
    </div>
  )
}

const Divider = () => <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-fg-tertiary" />

export function BulkBar(props: Props) {
  if (props.count === 0) return null
  const picked = (
    <span className={`${listType.body} font-semibold whitespace-nowrap`}>
      {eventApplicantSelected(props.count)}
    </span>
  )
  const actions = BULK.filter(item => item.kind !== 'absence' || props.absence).map(item => (
    <Button
      key={item.kind}
      type="button"
      busy={props.busy}
      onClick={() => props.onBulk(item.kind)}
      className={onDark}
    >
      {item.label}
    </Button>
  ))
  const unselect = (
    <Button
      type="button"
      aria-label={EVENT_APPLICANTS.unselect}
      onClick={props.onUnselect}
      className="size-9 rounded-full border-0 bg-transparent p-0 text-fg-inverse-muted hover:bg-surface-inverse-hover hover:text-white pointer-coarse:size-11"
    >
      <X aria-hidden />
    </Button>
  )
  if (props.wide)
    return (
      <Frame wide>
        {picked}
        <Divider />
        {actions}
        <Divider />
        {unselect}
      </Frame>
    )
  // 390: 한 줄에 다 들어가지 않아 '3명 선택 · 23명 모두 선택 … ×' / 단추들(같은 폭)로 쌓는다.
  return (
    <Frame wide={false}>
      <span className="flex w-full items-center gap-1 pl-1">
        <span className="pr-2">{picked}</span>
        {!props.allPicked && (
          <Button
            type="button"
            onClick={props.onSelectPage}
            className={`${onDark} underline underline-offset-2`}
          >
            {eventApplicantSelectAll(props.pageCount)}
          </Button>
        )}
        <span className="ml-auto">{unselect}</span>
      </span>
      <span
        className={cn(
          'grid w-full',
          actions.length === BULK.length ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        {actions}
      </span>
    </Frame>
  )
}

// 일괄 처리 결과: 몇 명 처리·실패와 실패한 사람마다 까닭. 다시 읽은 거르기에서 그 줄이 빠져도 처리 당시 이름으로 남는다.
export function BulkResult({
  data,
  result,
  names,
}: {
  data: EventApplicantsResponse
  result: BulkApplicantsResponse | null | undefined
  names: ReadonlyMap<string, string> | undefined
}) {
  if (!result) return null
  const failures = result.results.filter(item => item.error !== null)
  return (
    <div className={`flex flex-col gap-1 ${sheetX} pb-4 ${listType.body}`} role="status">
      <p className="font-medium text-fg-body">
        {bulkApplicantsSummary(result.results.length - failures.length, failures.length)}
      </p>
      {failures.map(item => (
        <p key={item.registrationId} className="text-danger wrap-anywhere">
          {names?.get(item.registrationId) ??
            data.applicants.find(row => row.id === item.registrationId)?.name ??
            EVENT_APPLICANTS.unknownApplicant}
          : {applicantFailure(item.error!)}
        </p>
      ))}
    </div>
  )
}
