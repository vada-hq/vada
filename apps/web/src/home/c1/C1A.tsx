import { ArrowRight, FolderPlus, MessageCircle, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { askedDate, c1Rows, type C1Row } from './c1-view'
import { Calm, Card, Face, Head, RowTitle, SeeAll, WRAP, factClass, type RowHandlers } from './C1Parts'
import type { S7AttentionItem } from '../s7/s7-data'

// A안 '사람이 앞인 인박스'(Linear Inbox, GitHub 알림, Slack To-dos의 hover 행동).
// 줄 = [연락할 사람 얼굴] [일 / 사람 · 언제] ……… [객관적 사실]. 행동은 마우스를 올렸을 때만 사실 옆에 뜬다.
// 터치 기기(pointer: coarse)에는 hover가 없어 행동을 글 없는 아이콘 단추(44px)로 늘 보인다.

function KindFace({ row }: { row: C1Row }) {
  if (row.person) return <Face person={row.person} />
  const Icon = row.kind === 'unassigned' ? UserPlus : FolderPlus
  return (
    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
      <Icon className="size-4" />
    </span>
  )
}

const REVEAL =
  'relative z-10 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 pointer-coarse:size-11 pointer-coarse:border-transparent pointer-coarse:bg-transparent pointer-coarse:p-0 pointer-coarse:text-gray-500'

function Action({ row, onAsk, onAssign }: { row: C1Row } & Omit<RowHandlers, 'onOpen'>) {
  const assign = !row.person
  const label = assign ? '배정하기' : row.asked ? '대화 열기' : '묻기'
  const Icon = assign ? ArrowRight : MessageCircle
  const who = row.person ? `${row.person.name} ${row.person.role}에게 ` : ''
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={assign ? `${row.title} 배정하기` : `${who}${label}`}
      className={REVEAL}
      onClick={() => (assign ? onAssign(row) : onAsk(row))}
    >
      <Icon />
      <span className="pointer-coarse:sr-only">{label}</span>
    </Button>
  )
}

function Sub({ row, onAsk }: { row: C1Row; onAsk: (row: C1Row) => void }) {
  return (
    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-gray-500">
      <span className={cn(factClass(row), 'text-xs @2xl:hidden')}>{row.fact}</span>
      {row.person ? (
        <span className="font-medium text-gray-700">{`${row.person.name} ${row.person.role}`}</span>
      ) : (
        <span>{row.kind === 'unassigned' ? '부서 없는 운영진' : '어느 부서에도 맡기지 않음'}</span>
      )}
      {row.asked ? (
        <>
        <span aria-hidden className="hidden @2xl:inline">·</span>
        <Button
          variant="link"
          touch={false}
          className="relative z-10 h-auto basis-full justify-start p-0 text-xs font-normal @2xl:basis-auto"
          onClick={() => onAsk(row)}
        >
          {`${askedDate(row.asked)} 물어봄 · ${row.asked.answered ? '답 있음' : '답 없음'}`}
        </Button>
        </>
      ) : (
        row.when && (
          <>
            <span aria-hidden className="hidden @2xl:inline">·</span>
            <span className="hidden @2xl:inline">{row.when}</span>
          </>
        )
      )}
    </p>
  )
}

function Row({ row, onOpen, onAsk, onAssign }: { row: C1Row } & RowHandlers) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-3 hover:bg-gray-50 has-focus-visible:ring-2 has-focus-visible:ring-blue-700 has-focus-visible:ring-inset @2xl:px-5">
      <KindFace row={row} />
      <div className={cn('min-w-0 flex-1', WRAP)}>
        <RowTitle onClick={() => onOpen(row)}>{row.title}</RowTitle>
        <Sub row={row} onAsk={onAsk} />
      </div>
      <Action row={row} onAsk={onAsk} onAssign={onAssign} />
      <span className={cn(factClass(row), 'hidden w-24 text-right @2xl:block')}>{row.fact}</span>
    </li>
  )
}

export default function C1A({ items, today, onSeeAll, ...handlers }: { items: S7AttentionItem[]; today: string; onSeeAll: () => void } & RowHandlers) {
  const { rows, total, more } = c1Rows(items, today)
  if (total === 0) return <Calm />
  return (
    <Card>
      <Head total={total} />
      <ul className="divide-y divide-gray-100 border-t border-gray-100">
        {rows.map(row => (
          <Row key={row.key} row={row} {...handlers} />
        ))}
      </ul>
      {more && <SeeAll total={total} onClick={onSeeAll} />}
    </Card>
  )
}
