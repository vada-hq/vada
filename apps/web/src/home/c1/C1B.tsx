import { ArrowRight, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GROUP_LABEL, askedDate, c1Groups, type C1Group, type C1Row } from './c1-view'
import { Calm, Card, Face, Head, RowTitle, SeeAll, WRAP, factClass, type RowHandlers } from './C1Parts'
import type { S7AttentionItem } from '../s7/s7-data'

// B안 '이유로 묶고, 사람이 곧 행동'(Linear My issues의 갈래 머리 + 수, Jira For you의 갈래 묶음).
// 갈래 머리가 이유(지남, 오늘·내일 마감, 결재 대기, 배정할 것)를 한 번만 말해 줄마다 반복하지 않는다.
// 줄 끝의 연락할 사람 이름이 그대로 [묻기] 단추다(테두리 없는 ghost). 따로 된 [묻기] 단추가 없다.
// hover에 기대지 않아 터치에서도 같은 모양이다(이름을 누르면 묻기).

function GroupHead({ group, total }: { group: C1Group; total: number }) {
  return (
    <div
      className={cn(
        'flex items-baseline gap-1.5 px-4 pt-3 pb-1 text-xs font-semibold @2xl:px-5',
        group === 'late' ? 'text-red-700' : 'text-gray-700',
      )}
    >
      <h3 className="text-xs font-semibold text-inherit">{GROUP_LABEL[group]}</h3>
      <span className="font-medium text-gray-500">{total}</span>
    </div>
  )
}

function PersonButton({ row, onAsk, onAssign }: { row: C1Row } & Omit<RowHandlers, 'onOpen'>) {
  if (!row.person)
    return (
      <Button variant="ghost" size="sm" className="relative z-10 text-blue-700 hover:bg-blue-50 hover:text-blue-700" onClick={() => onAssign(row)}>
        배정하기
        <ArrowRight />
      </Button>
    )
  const { name, role } = row.person
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`${name} ${role}에게 ${row.asked ? '물은 대화 열기' : '묻기'}`}
      className="group/ask relative z-10 gap-2 py-1 pr-2 pl-1 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700"
      onClick={() => onAsk(row)}
    >
      <Face person={row.person} size="sm" />
      <span className={WRAP}>{`${name} ${role}`}</span>
      <MessageCircle className="text-gray-400 group-hover:text-blue-700" />
    </Button>
  )
}

function Row({ row, onOpen, onAsk, onAssign }: { row: C1Row } & RowHandlers) {
  const fact = row.kind === 'late' ? row.fact : row.shortFact
  return (
    <li className="group relative flex flex-col gap-0.5 px-4 py-2.5 hover:bg-gray-50 has-focus-visible:ring-2 has-focus-visible:ring-blue-700 has-focus-visible:ring-inset @2xl:flex-row @2xl:items-center @2xl:gap-4 @2xl:px-5">
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <RowTitle onClick={() => onOpen(row)}>{row.title}</RowTitle>
        {row.kind !== 'unassigned' && (
          <span className={cn(factClass(row), 'text-xs', row.tone === 'strong' && 'font-medium text-gray-500')}>{fact}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 max-sm:-my-1 max-sm:-ml-1">
        <PersonButton row={row} onAsk={onAsk} onAssign={onAssign} />
        {row.asked && (
          <span className="text-xs text-gray-500 @2xl:order-first">
            {`${askedDate(row.asked)} 물어봄 · `}
            <span className={row.asked.answered ? 'font-semibold text-gray-900' : ''}>{row.asked.answered ? '답 있음' : '답 없음'}</span>
          </span>
        )}
      </div>
    </li>
  )
}

export default function C1B({ items, today, onSeeAll, ...handlers }: { items: S7AttentionItem[]; today: string; onSeeAll: () => void } & RowHandlers) {
  const { groups, total, more } = c1Groups(items, today)
  if (total === 0) return <Calm />
  return (
    <Card>
      <Head total={total} />
      {groups.map(({ group, total: count, rows }) => (
        <div key={group} className="border-t border-gray-100">
          <GroupHead group={group} total={count} />
          <ul className="divide-y divide-gray-100">
            {rows.map(row => (
              <Row key={row.key} row={row} {...handlers} />
            ))}
          </ul>
        </div>
      ))}
      {more && <SeeAll total={total} onClick={onSeeAll} />}
    </Card>
  )
}
