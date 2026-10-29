import { ChevronRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { headLinkTouch, rowLinkBox, rowLinkTarget } from '@/components/ui/row-link'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { CheckRing, CountRing } from './Ring'
import {
  FACE_RADIUS,
  FACT_COL,
  GROUP_OF,
  GROUP_STYLE,
  GROUPS,
  NUMBER_LG,
  NUMBER_SM,
  RING_LG,
  RING_SM,
  ROW_RADIUS,
  SIDE_W,
  type Group,
} from './tokens'

// f5 '큰 숫자와 링'(c1f 마). 왼쪽(358은 위) 옅은 면에 큰 건수와 건수 링, 오른쪽에 5줄.
// 링은 진행이 아니다: 조각 하나 = 한 건, 색은 그 건의 이유 묶음(지남·오늘 위험 색 / 임박 / 배정 필요 회색 두 농도).
// 줄 앞의 점이 같은 색이라 링 조각과 줄이 이어진다. 목록에 다 안 보이는 건(6번째부터)도 링과 범례에는 들어 있다.

const HEAD_ID = 'c1r-f5-head'
const WRAP = 'break-keep wrap-anywhere'
const META_SIDE = '@4xl:mt-0 @4xl:w-56 @4xl:shrink-0 @4xl:flex-col @4xl:items-end @4xl:gap-y-1'
const LINK_XS = cn('relative z-10 h-auto gap-1 p-0 text-xs font-medium', headLinkTouch)

function Legend({ counts }: { counts: Record<Group, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 @2xl:flex-col @2xl:items-start">
      {GROUPS.filter(g => counts[g.id] > 0).map(g => (
        <li key={g.id} className="flex items-center gap-1.5 text-xs text-fg-secondary">
          <span aria-hidden className={cn('size-2 rounded-full', g.fill)} />
          {g.label}
          <span className="font-semibold text-fg tabular-nums">{counts[g.id]}</span>
        </li>
      ))}
    </ul>
  )
}

// 링 면: 716·977은 세로(링 → 구역 이름 → 범례), 358은 가로(링 | 구역 이름 + 범례).
function Face({ groups, total }: { groups: Group[]; total: number }) {
  const counts = { late: 0, soon: 0, assign: 0 }
  for (const g of groups) counts[g] += 1
  const number = (size: string) => (
    <>
      <span className={cn('font-bold tracking-tight text-fg tabular-nums', size)}>{total}</span>
      <span className="mt-1 text-xs text-fg-muted">건</span>
    </>
  )
  return (
    <div
      className={cn(
        'flex items-center gap-4 bg-surface-subtle p-3 @2xl:flex-col @2xl:justify-center @2xl:gap-4 @2xl:p-5',
        FACE_RADIUS,
      )}
    >
      <div className="hidden @2xl:block">
        <CountRing groups={groups} {...RING_LG}>
          {number(NUMBER_LG)}
        </CountRing>
      </div>
      <div className="@2xl:hidden">
        <CountRing groups={groups} {...RING_SM}>
          <span className={cn('font-bold tracking-tight text-fg tabular-nums', NUMBER_SM)}>
            {total}
          </span>
        </CountRing>
      </div>
      <div className="flex min-w-0 flex-col gap-2 @2xl:items-center @2xl:text-center">
        <h2 id={HEAD_ID} className={cn('text-sm font-semibold text-fg', WRAP)}>
          {C1R_TITLE}
        </h2>
        <Legend counts={counts} />
      </div>
    </div>
  )
}

// 둘째 줄: 연락할 사람(누르면 묻기) 또는 회장단 + 배정하기, 그다음 물어본 상태(누르면 그 대화) 또는 행사.
// 977(@4xl)에서는 줄 오른쪽 칸으로 옮겨 사람과 물어본 상태를 오른쪽 끝에 세운다(가운데 빈 폭이 한쪽에 몰리지 않게).
function Meta({
  row,
  onAsk,
  onOpenAsked,
  onAssign,
}: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onOpenAsked' | 'onAssign'>) {
  return (
    <p
      className={cn(
        'mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-fg-muted',
        META_SIDE,
      )}
    >
      {row.person ? (
        <Button
          variant="link"
          touch={false}
          className={LINK_XS}
          aria-label={`${row.contact}에게 묻기`}
          onClick={() => onAsk(row)}
        >
          <MessageCircle aria-hidden className="size-3.5" />
          {row.contact}
        </Button>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-fg-secondary">{row.contact}</span>
          <Button
            variant="link"
            touch={false}
            className={cn(LINK_XS, 'max-sm:min-w-11')}
            onClick={() => onAssign(row)}
          >
            배정하기
          </Button>
        </span>
      )}
      {row.askedText ? (
        <Button
          variant="link"
          touch={false}
          className={cn(LINK_XS, 'font-normal')}
          onClick={() => onOpenAsked(row)}
        >
          {row.askedText}
        </Button>
      ) : (
        row.event && <span className="min-w-0 max-w-full truncate @4xl:hidden">{row.event}</span>
      )}
    </p>
  )
}

function Row({
  row,
  ...actions
}: { row: C1rRow } & Pick<C1rProps, 'onOpen' | 'onAsk' | 'onOpenAsked' | 'onAssign'>) {
  const group = GROUP_STYLE[GROUP_OF[row.kind]]
  return (
    <li
      className={cn('flex gap-3 px-3 py-2.5 @2xl:hover:bg-surface-subtle', ROW_RADIUS, rowLinkBox)}
    >
      <div className={cn('flex shrink-0 items-start gap-2', FACT_COL)}>
        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', group.fill)} />
        <span
          className={cn(
            'text-sm font-semibold break-keep',
            row.danger ? 'text-danger' : 'text-fg-secondary',
          )}
        >
          {row.fact}
        </span>
      </div>
      <div className="min-w-0 flex-1 @4xl:flex @4xl:items-start @4xl:gap-6">
        <div className="min-w-0 flex-1">
          <Button
            variant="link"
            touch={false}
            className={cn(
              'h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-fg hover:no-underline',
              rowLinkTarget,
            )}
            onClick={() => actions.onOpen(row)}
          >
            <span className={cn('line-clamp-2 @2xl:line-clamp-1', WRAP)}>{row.title}</span>
          </Button>
          {row.event && !row.askedText && (
            <p className="mt-1 hidden truncate text-xs text-fg-muted @4xl:block">{row.event}</p>
          )}
        </div>
        <Meta
          row={row}
          onAsk={actions.onAsk}
          onOpenAsked={actions.onOpenAsked}
          onAssign={actions.onAssign}
        />
      </div>
    </li>
  )
}

// 정상인 날(0건): 체크 링 + 구역 이름 + '없음' 한 줄(K7).
function Quiet() {
  return (
    <section
      aria-labelledby={HEAD_ID}
      className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
    >
      <CheckRing />
      <h2 id={HEAD_ID} className={cn('min-w-0 flex-1 text-sm font-semibold text-fg', WRAP)}>
        {C1R_TITLE}
      </h2>
      <span className="text-sm text-fg-muted">없음</span>
    </section>
  )
}

export default function C1rF5({ data, onSeeAll, ...actions }: C1rProps) {
  if (data.total === 0) return <Quiet />
  const rows = data.rows.slice(0, C1R_SHOWN)
  const groups = data.rows.map(row => GROUP_OF[row.kind])
  return (
    <section
      aria-labelledby={HEAD_ID}
      className={cn(
        'grid grid-cols-1 gap-2 rounded-xl border bg-card p-2 shadow-sm @2xl:gap-3 @2xl:p-3',
        SIDE_W,
      )}
    >
      <Face groups={groups} total={data.total} />
      <div className="flex min-w-0 flex-col justify-center">
        <ul>
          {rows.map(row => (
            <Row key={row.id} row={row} {...actions} />
          ))}
        </ul>
        {data.total > C1R_SHOWN && (
          <div className="px-3 pt-1 pb-1">
            <Button
              variant="link"
              className={cn('h-auto gap-0.5 p-0 text-sm', headLinkTouch)}
              onClick={onSeeAll}
            >
              {`전체 ${data.total}건 보기`}
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
