import { Check, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Face, type FaceTints } from '../c1r/f8/faces'
import {
  FACE_TINTS,
  GROUP,
  QUIET,
  QUIET_DOT,
  SEE_ALL,
  TEXT_HEAD,
  TEXT_SUB,
  TRAY,
  TRAY_HEAD,
} from '../c1r/f8/tokens'
import {
  C35_SHOWN,
  ME,
  TODO_TITLE,
  type TodoData,
  type TodoKind,
  type TodoRow as Row,
} from './c35-data'
import { TodoRow, type TodoActions } from './TodoRow'

// ③ 내가 할 일(C등급): ①f8의 쟁반·흰 묶음·두 칸 줄·아이콘 원·전체 보기·0건 띠를 그대로 쓴다.
// ①과 한 홈에서 같은 모양으로 두 번 이어지지 않게 둘을 바꿨다.
//   구역 머리: 이름 앞에 내 얼굴(머리글자 원). ①의 머리는 글자뿐이다.
//   줄 오른쪽: 파란 면을 채운 '확인하기'·'보기' 알약. ①은 누구 칸의 파란 글 '…에게 묻기'와 꺾쇠다.

const HEAD_ID = 'c35-todo-head'

// 얼굴 색: 나 → 줄에 나온 사람 차례(①f8과 같은 표). 같은 사람은 어디서나 같은 색.
function tintsOf(rows: Row[]): FaceTints {
  const tints = new Map<string, string>()
  const people = [ME, ...rows.flatMap(row => [row.owner, row.settlement?.contact ?? null])]
  for (const person of people) {
    if (!person || tints.has(person.name)) continue
    tints.set(person.name, FACE_TINTS[tints.size % FACE_TINTS.length] ?? FACE_TINTS[0])
  }
  return tints
}

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
        {`${TODO_TITLE} 없음`}
      </h2>
    </section>
  )
}

const KIND_NAME: Record<TodoKind, string> = {
  minutes: '회의록',
  'event-report': '행사 정리',
  review: '결과물',
  late: '지남',
  today: '오늘 마감',
}

function hiddenText(hidden: Row[]) {
  const counts = new Map<TodoKind, number>()
  for (const row of hidden) counts.set(row.kind, (counts.get(row.kind) ?? 0) + 1)
  const kinds = [...counts].map(([kind, n]) => `${KIND_NAME[kind]} ${n}`).join(', ')
  return `외 ${hidden.length}건 · ${kinds}`
}

function SeeAll({
  total,
  hidden,
  onSeeAll,
}: {
  total: number
  hidden: Row[]
  onSeeAll: () => void
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'group/all h-auto w-full flex-wrap gap-x-3 gap-y-0 rounded-2xl border-0 px-3 py-2 whitespace-normal hover:bg-transparent [&_svg]:size-4.5',
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

export default function Todo({
  data,
  onOpen,
  onAsk,
  onSeeAll,
}: { data: TodoData; onSeeAll: () => void } & TodoActions) {
  if (data.total === 0) return <Quiet />
  const shown = data.rows.slice(0, C35_SHOWN)
  const hidden = data.rows.slice(C35_SHOWN)
  const tints = tintsOf(data.rows)
  return (
    <section aria-labelledby={HEAD_ID} className={TRAY}>
      <div className={cn('flex items-center gap-2.5', TRAY_HEAD)}>
        <Face person={ME} tints={tints} />
        <h2 id={HEAD_ID} className={cn('min-w-0 text-fg break-keep', TEXT_HEAD)}>
          {TODO_TITLE}
        </h2>
        <span className={cn('shrink-0 text-fg-tertiary', TEXT_HEAD)}>{data.total}</span>
      </div>
      <ul className={GROUP}>
        {shown.map(row => (
          <TodoRow key={row.id} row={row} tints={tints} onOpen={onOpen} onAsk={onAsk} />
        ))}
      </ul>
      {hidden.length > 0 && <SeeAll total={data.total} hidden={hidden} onSeeAll={onSeeAll} />}
    </section>
  )
}
