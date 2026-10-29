import { useState, type ComponentType } from 'react'
import { AlarmClock, CalendarClock, Check, ChevronRight, Signature, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rKind, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { AskAvatar, EmptySeat, Face, ReasonTile } from './parts'
import { FACE_GAP, PANEL, ROW_DIVIDER_INSET, ROW_META, ROW_TITLE } from './tokens'

// f2 이유별 타일(c1f 형태 '나', 레퍼런스 f04 리마인더 홈 · f05 델타 탑승권 타일).
// 회색 판 위에 이유 타일(아이콘 + 큰 수 + 이유 이름)을 놓고, 그 아래 흰 목록 면에 급한 순 5줄을 둔다.
// 가장 급한 이유(지남·오늘)의 타일만 넓고 옅은 위험 면이라 첫눈의 초점이 하나다. 나머지 타일은 흰 중립 면.
// 타일을 누르면 아래 목록이 그 이유로 걸러지고, 한 번 더 누르면 풀린다. 줄 앞 사람 아바타가 묻기다.

const HEAD_ID = 'c1r-f2-head'
const WRAP = 'break-keep wrap-anywhere'

type Reason = { key: string; kinds: C1rKind[]; label: string; icon: ComponentType; danger: boolean }
// 타일 넷의 수를 더하면 전체 건수다(미배정 줄도 1건, 명세 K6과 같은 셈).
const REASONS: Reason[] = [
  { key: 'urgent', kinds: ['late', 'today'], label: '지남·오늘 마감', icon: AlarmClock, danger: true },
  { key: 'soon', kinds: ['tomorrow'], label: '내일 마감', icon: CalendarClock, danger: false },
  { key: 'approval', kinds: ['approval'], label: '결재 대기', icon: Signature, danger: false },
  { key: 'assign', kinds: ['no-department', 'unassigned'], label: '배정 필요', icon: UserPlus, danger: false },
]
// 타일은 이유를 고르는 거르개라 이유가 둘 이상일 때만 둔다(첫날처럼 한 갈래면 타일이 목록을 되풀이할 뿐이다).
const MIN_REASONS_FOR_TILES = 2

function Head({ total, more, onSeeAll }: { total: number; more: boolean; onSeeAll: () => void }) {
  return (
    <div className="flex min-h-7 items-center gap-2 px-1">
      <h2 id={HEAD_ID} className={cn('text-[17px] leading-6 font-bold tracking-tight text-fg @2xl:text-lg', WRAP)}>
        {C1R_TITLE}
      </h2>
      {total === 0 ? (
        <span className="flex items-center gap-1 rounded-full bg-card py-0.5 pr-2.5 pl-2 text-sm leading-5 font-medium text-fg-secondary [&_svg]:size-3.5">
          <Check aria-hidden />
          없음
        </span>
      ) : (
        <span className="rounded-full bg-card px-2 text-sm leading-6 font-bold text-fg tabular-nums">{total}</span>
      )}
      {more && (
        <Button
          variant="link"
          className={cn('ml-auto hidden h-auto gap-0.5 p-0 text-sm text-primary-strong @2xl:inline-flex', headLinkTouch)}
          onClick={onSeeAll}
        >
          {`전체 ${total}건 보기`}
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

// 둘째 줄: 누구(연락할 사람) + 물어본 상태(누르면 그 대화) 또는 행사. 가운뎃점은 한 줄에 하나.
function Meta({ row, onOpenAsked }: { row: C1rRow; onOpenAsked: (row: C1rRow) => void }) {
  return (
    <p className={cn('mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-fg-muted', ROW_META)}>
      <span className="font-medium text-fg-secondary">{row.contact}</span>
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn('relative z-10 h-auto p-0 text-[13px] font-normal text-primary-strong', headLinkTouch)}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && (
          <span className="flex min-w-0 flex-1 gap-x-1.5">
            <span aria-hidden>·</span>
            <span className="truncate">{row.event}</span>
          </span>
        )
      )}
    </p>
  )
}

function Row({ row, onOpen, onAsk, onOpenAsked, onAssign }: { row: C1rRow } & Omit<C1rProps, 'data' | 'onSeeAll'>) {
  // 배정 줄(부서 미정·미배정)은 줄 전체가 배정하기다. 나머지는 줄 전체가 일 보기, 아바타가 묻기.
  const open = row.person ? onOpen : onAssign
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle',
        'before:absolute before:top-0 before:right-0 before:h-px before:bg-border-subtle first:before:hidden',
        ROW_DIVIDER_INSET,
        rowLinkBox,
      )}
    >
      {row.person ? (
        <AskAvatar person={row.person} label={`${row.contact}에게 묻기`} onAsk={() => onAsk(row)} />
      ) : (
        <EmptySeat />
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => open(row)}
          className={cn('block max-w-full cursor-pointer text-left font-semibold text-fg outline-none', ROW_TITLE, rowLinkTarget)}
        >
          <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
        </button>
        <Meta row={row} onOpenAsked={onOpenAsked} />
      </div>
      <span
        className={cn('shrink-0 text-sm whitespace-nowrap', row.danger ? 'font-bold text-danger' : 'font-medium text-fg-secondary')}
      >
        {row.fact}
      </span>
      <ChevronRight aria-hidden className="-ml-1 size-4 shrink-0 text-fg-muted max-sm:hidden" />
    </li>
  )
}

function SeeAllRow({ total, onSeeAll }: { total: number; onSeeAll: () => void }) {
  return (
    <button
      type="button"
      onClick={onSeeAll}
      className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-0.5 border-t border-border-subtle text-sm font-medium text-primary-strong outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-inset @2xl:hidden [&_svg]:size-4"
    >
      {`전체 ${total}건 보기`}
      <ChevronRight aria-hidden />
    </button>
  )
}

export default function C1rF2({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const [picked, setPicked] = useState<string | null>(null)
  const tiles = REASONS.map(reason => ({
    ...reason,
    rows: data.rows.filter(row => reason.kinds.includes(row.kind)),
  })).filter(tile => tile.rows.length > 0)
  const showTiles = tiles.length >= MIN_REASONS_FOR_TILES
  const active = tiles.find(tile => tile.key === picked)
  const rows = (active ? active.rows : data.rows).slice(0, C1R_SHOWN)
  const more = data.total > C1R_SHOWN
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex flex-col', FACE_GAP, PANEL)}>
      <Head total={data.total} more={more} onSeeAll={onSeeAll} />
      {showTiles && (
        <div className={cn('flex flex-wrap', FACE_GAP)}>
          {tiles.map((tile, i) => (
            <ReasonTile
              key={tile.key}
              icon={tile.icon}
              label={tile.label}
              count={tile.rows.length}
              focus={i === 0}
              danger={tile.danger}
              pressed={tile.key === picked}
              onPress={() => setPicked(tile.key === picked ? null : tile.key)}
            />
          ))}
        </div>
      )}
      {rows.length > 0 && (
        <Face>
          <ul>
            {rows.map(row => (
              <Row key={row.id} row={row} onOpen={onOpen} onAsk={onAsk} onOpenAsked={onOpenAsked} onAssign={onAssign} />
            ))}
          </ul>
          {more && <SeeAllRow total={data.total} onSeeAll={onSeeAll} />}
        </Face>
      )}
    </section>
  )
}
