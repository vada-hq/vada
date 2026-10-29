import { CircleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { H1, M, MP, R, RowTitle, SectionHead, TextLink, WRAP, listClass, rowClass } from './S5Parts'
import type { AttentionRow } from './s5-view'

// ① 확인이 필요한 운영 상황: 화면에서 하나뿐인 상자(1.4). 표시는 아이콘 + 글자 둘 다(1.2).
const BOX = 'flex min-w-0 flex-col gap-2 rounded-lg border border-gray-300 bg-white p-4 @2xl:p-6'
const ID = 's5-attention'
const TITLE = '확인이 필요한 운영 상황'

const Icon = () => (
  <span className="flex h-5 shrink-0 items-center">
    <CircleAlert aria-hidden className="size-4 text-gray-900" strokeWidth={2} />
  </span>
)

// 좁은 줄(A의 3열 칸, 390): 1행 아이콘 + 제목, 2행 표시 + '{누구} · {행사}'
function NarrowRow({ row, onOpen }: { row: AttentionRow; onOpen: () => void }) {
  return (
    <li className={cn(rowClass, 'flex flex-col gap-1')}>
      <div className="flex items-start gap-2">
        <Icon />
        <RowTitle strong onClick={onOpen}>
          {row.title}
        </RowTitle>
      </div>
      <p className="flex flex-wrap gap-x-2 pl-6">
        <span className={cn(MP, WRAP)}>{row.marker}</span>
        <span className={cn(M, WRAP)}>{row.event ? `${row.who} · ${row.event}` : row.who}</span>
      </p>
    </li>
  )
}

// 넓은 줄(줄 폭 640 이상): [표시 | 제목 | 누구 | 행사] 같은 칸 위치
function WideRow({ row, onOpen }: { row: AttentionRow; onOpen: () => void }) {
  return (
    <li className={cn(rowClass, 'flex items-baseline gap-3 @4xl:gap-4')}>
      {/* 칸들을 글자 기준선으로 맞춘다. 아이콘은 글 안에 둬 표시 칸의 기준선이 글자에서 나오게 한다. */}
      <span className={cn(MP, WRAP, 'w-32 shrink-0 @4xl:w-36')}>
        <CircleAlert
          aria-hidden
          className="mr-2 inline size-4 align-text-bottom text-gray-900"
          strokeWidth={2}
        />
        {row.marker}
      </span>
      <span className="min-w-0 flex-1">
        <RowTitle strong onClick={onOpen}>
          {row.title}
        </RowTitle>
      </span>
      <span className={cn(R, WRAP, 'w-32 shrink-0 @4xl:w-40')}>{row.who}</span>
      <span className={cn(M, WRAP, 'w-40 shrink-0 @4xl:w-auto @4xl:max-w-60 @4xl:flex-1')}>
        {row.event}
      </span>
    </li>
  )
}

type Props = {
  rows: AttentionRow[]
  more: number | null
  // B·C: 넓은 폭에서 한 줄 표 꼴. A: 늘 좁은 줄.
  wide: boolean
  onOpen: (row: AttentionRow) => void
  onSeeAll: () => void
}

export default function S5Attention({ rows, more, wide, onOpen, onSeeAll }: Props) {
  // 평소(모두 정상)에는 머리와 빈 문구 한 줄뿐인 낮은 상자다(4.2, 높이 72 이하).
  if (rows.length === 0)
    return (
      <section aria-labelledby={ID} className={BOX}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id={ID} className={cn(H1, WRAP)}>
            {TITLE}
          </h2>
          <p className={M}>확인할 일 없음</p>
        </div>
      </section>
    )
  const right = more !== null && <TextLink onClick={onSeeAll}>{`전체 ${more}건 보기`}</TextLink>
  const narrow = rows.map(row => <NarrowRow key={row.key} row={row} onOpen={() => onOpen(row)} />)
  return (
    <section aria-labelledby={ID} className={BOX}>
      <SectionHead id={ID} title={TITLE} right={right} />
      {wide ? (
        <>
          <ul className={cn(listClass, '@2xl:hidden')}>{narrow}</ul>
          <ul className={cn(listClass, 'hidden @2xl:flex')}>
            {rows.map(row => (
              <WideRow key={row.key} row={row} onOpen={() => onOpen(row)} />
            ))}
          </ul>
        </>
      ) : (
        <ul className={listClass}>{narrow}</ul>
      )}
    </section>
  )
}
