import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { H1, M, MP, RP, R, RowTitle, TextLink, WRAP, listClass, rowClass } from '../s5/S5Parts'
import { StartButton } from './S7Start'
import { askedText, type AttentionRow } from './s7-view'

// ① 확인이 필요한 운영 상황: 화면에서 하나뿐인 상자(1.4). 표시는 아이콘 + 글자 둘 다(1.2), 제목과 같은 14px 진한 글자(1.1 R+).
const BOX = 'flex min-w-0 flex-col gap-2 rounded-lg border border-gray-300 bg-white p-4 @2xl:p-6'
export const ATTENTION_ID = 's7-attention'
const TITLE = '확인이 필요한 운영 상황'

const Icon = () => <CircleAlert aria-hidden className="mr-2 inline size-4 align-text-bottom text-gray-900" strokeWidth={2} />

// 물은 줄: '{날짜} 물어봄 · 답 있음'. 누르면 그 대화 패널.
function AskedStatus({ row, onAsk }: { row: AttentionRow; onAsk: () => void }) {
  const asked = row.ask?.asked
  if (!asked) return null
  return (
    <Button
      variant="link"
      className={cn(M, 'relative z-10 h-auto gap-1 p-0 text-left font-normal whitespace-normal hover:underline max-sm:-my-3 max-sm:min-h-11')}
      onClick={onAsk}
    >
      {askedText(asked)}
      <span className={asked.answered ? MP : M}>{asked.answered ? '답 있음' : '답 없음'}</span>
    </Button>
  )
}

function Contact({ row, onAsk }: { row: AttentionRow; onAsk: () => void }) {
  if (!row.ask) return null
  if (row.ask.asked) return <AskedStatus row={row} onAsk={onAsk} />
  return <StartButton label="묻기" onClick={onAsk} />
}

type RowProps = { row: AttentionRow; onOpen: () => void; onAsk: () => void }

// 넓은 줄: [표시 112 | 제목 320(1024는 남은 폭) | 연락할 사람 144 | 끝 칸]. 끝 칸은 사람 바로 옆(오른쪽 끝으로 밀지 않는다).
function WideRow({ row, onOpen, onAsk }: RowProps) {
  return (
    <li className={cn(rowClass, 'flex min-h-14 items-center gap-3 @4xl:gap-4')}>
      <span className={cn(RP, WRAP, 'w-28 shrink-0')}>
        <Icon />
        {row.marker}
      </span>
      <span className="min-w-0 flex-1 @4xl:w-60 @4xl:flex-none">
        <RowTitle strong onClick={onOpen}>
          {row.title}
        </RowTitle>
      </span>
      <span className={cn(R, WRAP, 'w-32 shrink-0 @4xl:w-36')}>{row.who}</span>
      <span className="flex w-40 shrink-0 items-center">
        <Contact row={row} onAsk={onAsk} />
      </span>
    </li>
  )
}

// 좁은 줄(390): 1행 아이콘 + 제목, 2행 표시 + 연락할 사람, 물은 줄은 3행 상태. [묻기]는 오른쪽.
function NarrowRow({ row, onOpen, onAsk }: RowProps) {
  const button = row.ask && !row.ask.asked
  return (
    <li className={cn(rowClass, 'flex items-center gap-3')}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start">
          <span className="flex h-5 shrink-0 items-center">
            <Icon />
          </span>
          <RowTitle strong onClick={onOpen}>
            {row.title}
          </RowTitle>
        </div>
        <p className="flex flex-wrap gap-x-2 pl-6">
          <span className={cn(RP, WRAP)}>{row.marker}</span>
          <span className={cn(R, WRAP)}>{row.who}</span>
        </p>
        {row.ask?.asked && (
          <p className="pl-6">
            <AskedStatus row={row} onAsk={onAsk} />
          </p>
        )}
      </div>
      {button && <StartButton label="묻기" onClick={onAsk} />}
    </li>
  )
}

type Props = {
  rows: AttentionRow[]
  total: number
  more: boolean
  onOpen: (row: AttentionRow) => void
  onAsk: (row: AttentionRow) => void
  onSeeAll: () => void
}

export default function S7Attention({ rows, total, more, onOpen, onAsk, onSeeAll }: Props) {
  // 정상인 날: 머리글 바로 옆에 '없음'을 붙인다(S6 검토: 제목과 결론이 멀었음).
  if (rows.length === 0)
    return (
      <section aria-labelledby={ATTENTION_ID} className={BOX}>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 id={ATTENTION_ID} className={cn(H1, WRAP)}>
            {TITLE}
          </h2>
          <p className={M}>없음</p>
        </div>
      </section>
    )
  const right = more ? (
    <TextLink onClick={onSeeAll}>{`전체 ${total}건 보기`}</TextLink>
  ) : (
    <span className={M}>{`${total}건`}</span>
  )
  const props = (row: AttentionRow) => ({ row, onOpen: () => onOpen(row), onAsk: () => onAsk(row) })
  return (
    <section aria-labelledby={ATTENTION_ID} className={BOX}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id={ATTENTION_ID} className={cn(H1, WRAP)}>
          {TITLE}
        </h2>
        {right}
      </div>
      <ul className={cn(listClass, '@2xl:hidden')}>
        {rows.map(row => (
          <NarrowRow key={row.key} {...props(row)} />
        ))}
      </ul>
      <ul className={cn(listClass, 'hidden @2xl:flex')}>
        {rows.map(row => (
          <WideRow key={row.key} {...props(row)} />
        ))}
      </ul>
    </section>
  )
}
