import { ChevronRight, CircleAlert, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rKind, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'

// v2: 이유로 나누고 수를 앞세운 묶음(갈래 2: Linear 상태 묶음 머리, Logixboard 이유별 수, PatternFly 묶음 머리 수).
// 이유(마감 지남·마감 임박·결재 대기·배정 필요)와 그 수를 묶음 머리에서 한 번 말하고, 줄은 머리에 없는 차이만 왼쪽 칸에 둔다
// (결재 대기 D-3 → 'D-3'). 지남·오늘은 사실 글 그대로 둔다: 위험 색은 객관적 사실 글에만 쓰고(명세 6절),
// '3일'만으로는 다른 묶음의 'D-3'과 헷갈린다.
// 줄 = 사실 칸 + 제목(+행사) + 연락할 사람(누르면 묻기). 줄 전체를 누르면 일 보기, 배정 줄은 배정하기.

const HEAD_ID = 'c1r-v2-head'
const WRAP = 'break-keep wrap-anywhere'

type Group = { label: string; kinds: C1rKind[] }
const GROUPS: Group[] = [
  { label: '마감 지남', kinds: ['late'] },
  { label: '마감 임박', kinds: ['today', 'tomorrow'] },
  { label: '결재 대기', kinds: ['approval'] },
  { label: '배정 필요', kinds: ['no-department', 'unassigned'] },
]

type Shown = { label: string; count: number; rows: C1rRow[] }

// 상한 5줄을 묶음에 나눈다: 먼저 묶음마다 한 줄씩(어느 이유도 통째로 가려지지 않게), 남은 자리는 차례대로.
// 묶음 머리 수는 그 묶음의 전체 수이고, 가려진 줄은 머리에 'n건 더'로 적는다.
function pick(rows: C1rRow[]): Shown[] {
  const groups = GROUPS.map(g => ({
    label: g.label,
    all: rows.filter(row => g.kinds.includes(row.kind)),
  })).filter(g => g.all.length > 0)
  let left = C1R_SHOWN - Math.min(groups.length, C1R_SHOWN)
  return groups.map((g, i) => {
    const first = i < C1R_SHOWN ? 1 : 0
    const more = Math.min(left, g.all.length - first)
    left -= more
    return { label: g.label, count: g.all.length, rows: g.all.slice(0, first + more) }
  })
}

// 줄 왼쪽 칸: 머리가 이미 말한 이유를 빼고 남는 사실(결재 대기 D-3 → D-3). 위험 사실(지남·오늘)은 글 그대로 둔다.
// 칸을 비우지 않는다: 비면 제목만 오른쪽으로 떠 보인다(미배정 줄).
function factOf(row: C1rRow, label: string) {
  if (!row.danger && row.fact.startsWith(`${label} `)) return row.fact.slice(label.length + 1)
  return row.fact
}

function Head({ total, onSeeAll }: { total: number; onSeeAll: () => void }) {
  return (
    <div
      className={cn('flex items-center gap-2 px-4 py-3', total > 0 && 'border-b border-gray-200')}
    >
      <CircleAlert aria-hidden className="size-4 shrink-0 text-gray-500" />
      <h2 id={HEAD_ID} className={cn('min-w-0 text-sm font-semibold text-gray-900', WRAP)}>
        {C1R_TITLE}
      </h2>
      {total === 0 ? (
        <span className="ml-auto text-xs text-gray-500">없음</span>
      ) : (
        <span className="text-sm font-semibold text-gray-500 tabular-nums">{total}</span>
      )}
      {total > C1R_SHOWN && (
        <Button
          variant="link"
          className={cn('ml-auto h-auto shrink-0 gap-0.5 p-0 text-xs', headLinkTouch)}
          onClick={onSeeAll}
        >
          {`전체 ${total}건 보기`}
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

const LINK_XS = cn('relative z-10 h-auto p-0 text-xs', headLinkTouch)

// 연락할 사람(누르면 묻기)과 물어본 상태(누르면 그 대화). 넓은 폭에서는 사람을 줄 오른쪽 끝에 세워 아래로 훑게 한다.
function Contact({
  row,
  onAsk,
  onOpenAsked,
}: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onOpenAsked'>) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 @2xl:shrink-0 @2xl:flex-nowrap">
      {row.person ? (
        <Button
          variant="link"
          size="sm"
          touch={false}
          className={cn(LINK_XS, 'gap-1 font-medium @2xl:order-2')}
          aria-label={`${row.contact}에게 묻기`}
          onClick={() => onAsk(row)}
        >
          <MessageCircle aria-hidden />
          {row.contact}
        </Button>
      ) : (
        <span className="text-xs whitespace-nowrap text-gray-500 @2xl:order-2">{row.contact}</span>
      )}
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn(
            LINK_XS,
            'font-normal text-gray-600 underline decoration-gray-300 @2xl:order-1',
          )}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && (
          <span className="min-w-0 truncate text-xs text-gray-500 @2xl:hidden">{row.event}</span>
        )
      )}
    </div>
  )
}

type RowProps = { row: C1rRow; label: string } & Pick<
  C1rProps,
  'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'
>

function Row({ row, label, onOpen, onAsk, onOpenAsked, onAssign }: RowProps) {
  const fact = factOf(row, label)
  return (
    <li className={cn('flex items-baseline gap-3 px-4 py-2.5 hover:bg-gray-50', rowLinkBox)}>
      <span
        className={cn(
          'w-16 shrink-0 text-xs font-medium whitespace-nowrap tabular-nums',
          row.danger ? 'text-red-700' : 'text-gray-700',
        )}
      >
        {fact}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 @2xl:flex-row @2xl:items-center @2xl:gap-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <Button
            variant="link"
            touch={false}
            className={cn(
              'h-auto max-w-full shrink-0 justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 hover:no-underline',
              rowLinkTarget,
            )}
            onClick={() => (row.person ? onOpen(row) : onAssign(row))}
          >
            <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
          </Button>
          {row.event && (
            <span className="hidden min-w-0 flex-1 truncate text-xs text-gray-500 @2xl:block">
              {row.event}
            </span>
          )}
        </div>
        <Contact row={row} onAsk={onAsk} onOpenAsked={onOpenAsked} />
      </div>
    </li>
  )
}

export default function C1rV2({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const groups = pick(data.rows)
  return (
    <section aria-labelledby={HEAD_ID} className={cn(cardClass, 'overflow-hidden bg-white')}>
      <Head total={data.total} onSeeAll={onSeeAll} />
      {groups.map((g, i) => (
        <div key={g.label} className={cn('pb-1.5', i > 0 && 'border-t border-gray-100')}>
          <div className="flex items-baseline gap-2 px-4 pt-3 pb-1">
            <h3 className="text-xs font-semibold text-gray-900">{g.label}</h3>
            <span className="text-xs font-semibold text-gray-500 tabular-nums">{g.count}</span>
            {g.count > g.rows.length && (
              <span className="text-xs text-gray-500">{`${g.count - g.rows.length}건 더`}</span>
            )}
          </div>
          <ul>
            {g.rows.map(row => (
              <Row
                key={row.id}
                row={row}
                label={g.label}
                onOpen={onOpen}
                onAsk={onAsk}
                onOpenAsked={onOpenAsked}
                onAssign={onAssign}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
