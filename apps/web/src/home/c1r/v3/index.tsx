import { ArrowRight, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { C1R_SHOWN, C1R_TITLE, type C1rRow } from '../c1r-data'
import type { C1rProps } from '../c1r-props'

const HEAD_ID = 'c1r-v3-head'
const TEXT_ACTION = 'min-h-11 min-w-11 justify-start p-0 text-xs @2xl:min-h-6'

function Contact({ row, onAsk, onAssign }: { row: C1rRow } & Pick<C1rProps, 'onAsk' | 'onAssign'>) {
  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 @2xl:min-h-6">
      <span
        className={cn(
          'text-sm font-semibold whitespace-nowrap',
          row.danger ? 'text-red-700' : 'text-gray-700',
        )}
      >
        {row.fact}
      </span>
      <ArrowRight aria-hidden className="size-3 shrink-0 text-gray-500" />
      {row.person ? (
        <Button variant="link" className={TEXT_ACTION} onClick={() => onAsk(row)}>
          <span className="wrap-anywhere">{row.contact}에게 묻기</span>
        </Button>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-700">{row.contact}</span>
          <Button variant="link" className={TEXT_ACTION} onClick={() => onAssign(row)}>
            배정하기
          </Button>
        </div>
      )}
    </div>
  )
}

function Situation({
  row,
  onOpen,
  onAsk,
  onOpenAsked,
  onAssign,
}: { row: C1rRow } & Omit<C1rProps, 'data' | 'onSeeAll'>) {
  return (
    <li className="px-4 py-1 hover:bg-gray-50 @2xl:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="link"
          className="min-h-11 min-w-0 flex-1 justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 @2xl:min-h-6"
          onClick={() => onOpen(row)}
        >
          <span className="line-clamp-2 wrap-anywhere @2xl:line-clamp-1">{row.title}</span>
        </Button>
        {row.event && (
          <span className="max-w-20 shrink-0 truncate text-xs text-gray-500 @2xl:max-w-48">
            {row.event}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <Contact row={row} onAsk={onAsk} onAssign={onAssign} />
        {row.askedText && (
          <Button
            variant="link"
            className={cn(TEXT_ACTION, 'font-normal text-gray-600 underline')}
            onClick={() => onOpenAsked(row)}
          >
            {row.askedText}
          </Button>
        )}
      </div>
    </li>
  )
}

export default function C1rV3({ data, onOpen, onAsk, onOpenAsked, onAssign, onSeeAll }: C1rProps) {
  const unassigned = data.rows.find(row => row.kind === 'unassigned')
  // 새 구성원을 배정할 길도 첫 화면의 다섯 줄 안에 남긴다.
  const rows = data.rows
    .filter(row => row.kind !== 'unassigned')
    .slice(0, C1R_SHOWN - (unassigned ? 1 : 0))
  if (unassigned) rows.push(unassigned)
  return (
    <section aria-labelledby={HEAD_ID} className={cn(cardClass, 'overflow-hidden bg-white')}>
      <div className="flex min-h-12 items-center justify-between gap-3 px-4">
        <h2 id={HEAD_ID} className="text-sm font-semibold wrap-anywhere text-gray-900">
          {C1R_TITLE}
        </h2>
        <span className="shrink-0 text-xs text-gray-600">
          {data.total ? `${data.total}건` : '없음'}
        </span>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-200">
          {rows.map(row => (
            <Situation
              key={row.id}
              row={row}
              onOpen={onOpen}
              onAsk={onAsk}
              onOpenAsked={onOpenAsked}
              onAssign={onAssign}
            />
          ))}
        </ul>
      )}
      {data.total > C1R_SHOWN && (
        <div className="flex justify-end border-t border-gray-200 px-4 py-1">
          <Button variant="link" className="min-h-11 p-0 text-xs" onClick={onSeeAll}>
            전체 {data.total}건 보기
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </section>
  )
}
