import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rKind, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'
import { faceTintsOf } from './faces'
import { REASON_NAME } from './reasons'
import { AssignRow, TaskRow } from './Row'
import { GROUP, QUIET, QUIET_DOT, SEE_ALL, TEXT_HEAD, TEXT_SUB, TRAY, TRAY_HEAD } from './tokens'

// f8 생김새 회차(c1f): f7(회색 쟁반 위 흰 묶음, 아이콘 원 + 큰 제목)에 f4의 작은 얼굴과 물어봄 답 표시를 합친 안.
// 줄 = 아이콘 원 / 무엇(제목 + 사실·행사) / 누구(얼굴 + '…에게 묻기' 또는 물어봄 알약) / 꺾쇠.
// 716·977은 무엇 | 누구 두 칸으로 펼쳐 줄 가운데를 채우고, 390은 무엇 아래 누구를 쌓는다.
// 회장단이 배정할 일은 한 줄로 모아 늘 보인다(일 줄은 그만큼 하나 덜 보인다, 상한 5 안).

const HEAD_ID = 'c1r-f8-head'
const ASSIGN_KINDS: ReadonlySet<C1rKind> = new Set(['no-department', 'unassigned'])

// 0건: 회색 띠 한 줄. 체크 원 + '○○ 없음'.
function Quiet() {
  return (
    <section aria-labelledby={HEAD_ID} className={cn('flex items-center', QUIET)}>
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-tertiary',
          QUIET_DOT,
        )}
      >
        <Check className="size-4.5" strokeWidth={2.5} />
      </span>
      <h2 id={HEAD_ID} className={cn('min-w-0 font-medium text-fg-secondary', TEXT_SUB)}>
        {`${C1R_TITLE} 없음`}
      </h2>
    </section>
  )
}

// 접힌 일 줄을 이유별로 센 글: '외 2건 · 내일 마감 1, 결재 대기 1'
function hiddenText(hidden: C1rRow[]) {
  const counts = new Map<C1rKind, number>()
  for (const row of hidden) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1)
  const kinds = [...counts].map(([kind, n]) => `${REASON_NAME[kind]} ${n}`).join(', ')
  return `외 ${hidden.length}건 · ${kinds}`
}

function SeeAll({
  total,
  hidden,
  onSeeAll,
}: {
  total: number
  hidden: C1rRow[]
  onSeeAll: () => void
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-auto w-full flex-wrap gap-x-3 gap-y-0 rounded-2xl border-0 px-3 py-2 whitespace-normal hover:bg-transparent [&_svg]:size-4.5',
        'group/all',
        SEE_ALL,
        TEXT_SUB,
      )}
      onClick={onSeeAll}
    >
      {hidden.length > 0 && (
        <span className="font-normal text-fg-tertiary">{hiddenText(hidden)}</span>
      )}
      <span className="inline-flex items-center gap-0.5 font-medium text-fg-secondary group-hover/all:text-fg">
        {`전체 ${total}건 보기`}
        <ChevronRight aria-hidden />
      </span>
    </Button>
  )
}

export default function C1rF8({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  if (data.total === 0) return <Quiet />
  const tasks = data.rows.filter(row => !ASSIGN_KINDS.has(row.kind))
  const assigns = data.rows.filter(row => ASSIGN_KINDS.has(row.kind))
  const taskLimit = C1R_SHOWN - (assigns.length > 0 ? 1 : 0)
  const shown = tasks.slice(0, taskLimit)
  const hidden = tasks.slice(taskLimit)
  const tints = faceTintsOf(data.rows)
  return (
    <section aria-labelledby={HEAD_ID} className={TRAY}>
      <div className={cn('flex items-baseline gap-2', TRAY_HEAD)}>
        <h2 id={HEAD_ID} className={cn('min-w-0 text-fg break-keep', TEXT_HEAD)}>
          {C1R_TITLE}
        </h2>
        <span className={cn('shrink-0 text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
      </div>
      <ul className={GROUP}>
        {shown.map(row => (
          <TaskRow
            key={row.id}
            row={row}
            tints={tints}
            onOpen={onOpen}
            onAsk={onAsk}
            onOpenAsked={onOpenAsked}
          />
        ))}
        {assigns.length > 0 && <AssignRow rows={assigns} onAssign={onAssign} />}
      </ul>
      {(data.total > C1R_SHOWN || hidden.length > 0) && (
        <SeeAll total={data.total} hidden={hidden} onSeeAll={onSeeAll} />
      )}
    </section>
  )
}
