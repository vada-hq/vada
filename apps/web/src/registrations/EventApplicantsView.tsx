import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  EVENT_APPLICANT_PAGE_SIZE,
  koreanDateOf,
  type ApplicantChange,
  type BulkApplicantsResponse,
  type EventApplicantsQuery,
  type EventApplicantsResponse,
} from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { useNow } from '@/lib/use-now'
import {
  applicantFailure,
  EVENT_APPLICANTS,
  eventApplicantCount,
} from '@/lib/registration-messages'
import { ApplicantPeek } from './ApplicantPeek'
import { attentionFirst, eventStarted, isWhole, reasonOf, shownRows } from './applicant-summary'
import { sheet } from './doc-look'
import { EventApplicantActions } from './EventApplicantActions'
import { BulkBar, BulkResult, type BulkKind } from './EventApplicantsBulk'
import { EventApplicantsHead } from './EventApplicantsHead'
import { EventApplicantsList } from './EventApplicantsList'
import { EventApplicantsTable, type ListProps, type RowModel } from './EventApplicantsTable'
import { listSize, listType, sheetX } from './list-look'

type Props = {
  councilId: string
  data: EventApplicantsResponse
  // 행사 시작 시각(한국). 첫날부터 출석 기록 없음을 '불참'이라 한다. 모르면 null이다.
  startsAt?: string | null
  query?: Partial<EventApplicantsQuery>
  selected?: ReadonlySet<string>
  result?: BulkApplicantsResponse | null
  resultKind?: BulkKind
  resultNames?: ReadonlyMap<string, string>
  busy?: boolean
  submitting?: boolean
  onQuery?: (query: Partial<EventApplicantsQuery>) => void
  onPage?: (page: number) => void
  onToggle?: (id: string) => void
  onTogglePage?: () => void
  onUnselect?: () => void
  onBulk?: (kind: BulkKind) => void
  onChange?: (change: ApplicantChange) => void
  onReload?: () => void
  onForbidden?: () => void
  onLost?: (message: string) => void
}

type Full = Required<Props>
const noop = () => undefined
const DEFAULTS: Omit<Full, 'councilId' | 'data'> = {
  startsAt: null,
  query: {},
  selected: new Set(),
  result: null,
  resultKind: 'deposit',
  resultNames: new Map(),
  busy: false,
  submitting: false,
  onQuery: noop,
  onPage: noop,
  onToggle: noop,
  onTogglePage: noop,
  onUnselect: noop,
  onBulk: noop,
  onChange: noop,
  onReload: noop,
  onForbidden: noop,
  onLost: noop,
}

// 표는 데스크톱 창(Tailwind lg)에서, 명단 종이 폭이 열을 다 담을 때만 그린다. 그 밖은 두 줄 목록이다.
// 창 폭만 보면 1024px 창(단 약 736px)에 양식 열이 더해지거나 옆 1:1 칸이 열렸을 때 이름 열이 무너진다(Codex 검토).
// 폭을 모르면(matchMedia·ResizeObserver가 없는 환경) 표를 그린다.
const WIDE = '(min-width: 64rem)'
const media = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : null)
function subscribe(change: () => void) {
  const query = media()
  query?.addEventListener('change', change)
  return () => query?.removeEventListener('change', change)
}
const useWideWindow = () => useSyncExternalStore(subscribe, () => media()?.matches ?? true)

// 고정 열 합(px, list-look col): 체크 32 · 학번 112 · 신청 88 · 입금 192 · 참석 80 · ⋯ 48 + 이름 최소 160. 양식·소속 열은 128씩.
const TABLE_BASE_PX = 712
const SIDE_COLUMN_PX = 128

function useBoxWidth(box: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const element = box.current
    if (!element || typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? null))
    observer.observe(element)
    return () => observer.disconnect()
  }, [box])
  return width
}

function useWide(box: RefObject<HTMLElement | null>, data: EventApplicantsResponse) {
  const wideWindow = useWideWindow()
  const width = useBoxWidth(box)
  const need =
    TABLE_BASE_PX + (Number(data.showForm) + Number(data.showAffiliation)) * SIDE_COLUMN_PX
  return wideWindow && (width === null || width >= need)
}

// 쪽: 표 아래 오른쪽 회색 '1 / 3 ‹ ›'(50줄씩). 끝 쪽에서는 그 방향 단추를 두지 않는다(끄지 않는다).
function Pager({
  data,
  busy,
  onPage,
}: {
  data: EventApplicantsResponse
  busy: boolean
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(data.total / EVENT_APPLICANT_PAGE_SIZE))
  const arrow = `${listSize.hit} rounded-lg p-0 text-fg-muted`
  return (
    <nav
      aria-label={EVENT_APPLICANTS.pages}
      className={`flex items-center justify-end gap-1 ${sheetX} py-2`}
    >
      <span className={`${listType.small} ${listType.num} px-2 text-fg-muted`}>
        {data.page} / {pages}
      </span>
      {data.page > 1 && (
        <Button
          type="button"
          variant="ghost"
          aria-label={EVENT_APPLICANTS.previousPage}
          busy={busy}
          onClick={() => onPage(data.page - 1)}
          className={arrow}
        >
          <ChevronLeft aria-hidden />
        </Button>
      )}
      {data.page < pages && (
        <Button
          type="button"
          variant="ghost"
          aria-label={EVENT_APPLICANTS.nextPage}
          busy={busy}
          onClick={() => onPage(data.page + 1)}
          className={arrow}
        >
          <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  )
}

function Message({ children }: { children: string }) {
  return (
    <p
      className={`border-t border-border-default ${sheetX} py-10 text-center ${listType.body} text-fg-muted`}
    >
      {children}
    </p>
  )
}

function rowModels(props: Full): RowModel[] {
  const { data } = props
  const results = new Map(props.result?.results.map(item => [item.registrationId, item.error]))
  return attentionFirst(shownRows(data, props.query)).map(row => {
    const error = results.get(row.id)
    return {
      row,
      reason: reasonOf(row, data.applicants),
      picked: props.selected.has(row.id),
      result:
        error === undefined
          ? undefined
          : { kind: props.resultKind, failure: error === null ? null : applicantFailure(error) },
      actions: (
        <EventApplicantActions
          councilId={props.councilId}
          applicant={row}
          onChange={props.onChange}
          onGone={props.onReload}
          onForbidden={props.onForbidden}
          onLost={props.onLost}
        />
      ),
    }
  })
}

// 개인정보 열람 권한이 없으면 수만 보인다(서버가 명단을 주지 않는다).
function CountsOnly({ data }: { data: EventApplicantsResponse }) {
  return (
    <div className={`flex flex-wrap gap-4 ${sheetX} pb-5 ${listType.body} ${listType.num}`}>
      <p>{eventApplicantCount('applicants', data.counts.applicants)}</p>
      <p>{eventApplicantCount('attended', data.counts.attended)}</p>
    </div>
  )
}

function CountsOnlySheet({ data }: { data: EventApplicantsResponse }) {
  return (
    <section
      aria-label={EVENT_APPLICANTS.title}
      className={`flex min-w-0 flex-col break-keep ${sheet}`}
    >
      <h2 className={`${sheetX} pt-5 pb-3 sm:pt-6 ${listType.title} text-fg`}>
        {EVENT_APPLICANTS.title}
      </h2>
      <CountsOnly data={data} />
    </section>
  )
}

function Rows({ props, list, wide }: { props: Full; list: ListProps; wide: boolean }) {
  if (list.rows.length === 0)
    return (
      <Message>
        {isWhole(props.data, props.query) ? EVENT_APPLICANTS.empty : EVENT_APPLICANTS.noMatch}
      </Message>
    )
  return wide ? <EventApplicantsTable {...list} /> : <EventApplicantsList {...list} />
}

function Applicants({ props }: { props: Full }) {
  const { data } = props
  const box = useRef<HTMLElement>(null)
  const wide = useWide(box, data)
  const now = useNow()
  const [peek, setPeek] = useState<string | null>(null)
  const started = eventStarted(props.startsAt, koreanDateOf(now))
  const rows = rowModels(props)
  const list: ListProps = {
    data,
    rows,
    started,
    busy: props.busy,
    onToggle: props.onToggle,
    onTogglePage: props.onTogglePage,
    onOpen: setPeek,
  }
  const peekRow = data.applicants.find(row => row.id === peek)
  return (
    <>
      <section
        ref={box}
        aria-label={EVENT_APPLICANTS.title}
        className={`flex min-w-0 flex-col break-keep ${sheet}`}
      >
        <EventApplicantsHead
          data={data}
          query={props.query}
          busy={props.submitting}
          reloading={props.busy}
          onQuery={props.onQuery}
          onReload={props.onReload}
        />
        <Rows props={props} list={list} wide={wide} />
        <Pager data={data} busy={props.busy} onPage={props.onPage} />
        <BulkResult data={data} result={props.result} names={props.resultNames} />
      </section>
      {data.canManage && (
        <BulkBar
          count={props.selected.size}
          pageCount={rows.length}
          allPicked={rows.length > 0 && rows.every(model => model.picked)}
          busy={props.busy}
          wide={wide}
          onBulk={props.onBulk}
          onUnselect={props.onUnselect}
          onSelectPage={props.onTogglePage}
        />
      )}
      <ApplicantPeek
        row={peekRow}
        reason={peekRow ? reasonOf(peekRow, data.applicants) : null}
        showForm={data.showForm}
        started={started}
        now={now}
        onClose={() => setPeek(null)}
      />
    </>
  )
}

// 행사 참가자 명단(신청자 관리 화면, 10/30 확정 '문서 속 얇은 표 모양'): 위 양식 카드와 같은 흰 종이 한 장 안에 머리 줄 + 얇은 표.
// 체크·일괄 띠는 서버의 canManage, 줄 동작은 그 줄의 actions로만 보인다(DEC-38). 읽기는 canView 아래 모두 보인다.
export function EventApplicantsView(props: Props) {
  const full: Full = { ...DEFAULTS, ...props }
  if (!props.data.canView) return <CountsOnlySheet data={props.data} />
  return <Applicants props={full} />
}
