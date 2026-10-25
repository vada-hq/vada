import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 제목 아래 한 줄. 없는 것(false·null)은 빼고 가운뎃점으로 잇는다.
  meta?: ReactNode[]
  // 오른쪽 끝: 마감, 상태, D-n
  side?: ReactNode
  // 왼쪽 끝: 행사의 날짜 칸
  lead?: ReactNode
  onOpen: () => void
  // 새 홈 카드(HomeCard)의 줄: 머리 바와 같은 안쪽 여백, 제목은 어절로 접고 메타는 한 줄 말줄임(와이어프레임 줄,
  // 1024px 3열에서 낱자로 끊기지 않게). 전체 글은 누르면 여는 원래 기록에 있다.
  card?: boolean
}

// 카드 줄의 메타: 한 줄에 가운뎃점으로 잇고 넘치면 말줄임이다.
function CardMeta({ parts }: { parts: ReactNode[] }) {
  return (
    <p className="truncate text-xs text-gray-500">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && <span aria-hidden> · </span>}
          {part}
        </span>
      ))}
    </p>
  )
}

// 홈의 한 줄. 줄 어디를 눌러도 원래 화면이 열린다(홈은 읽기만 한다, DEC-69).
export default function HomeRow({ title, meta = [], side, lead, onOpen, card = false }: Props) {
  const parts = meta.filter(part => part !== false && part !== null && part !== undefined)
  return (
    <li
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50',
        card && 'px-5 py-2.5',
      )}
    >
      {lead}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Button
          variant="link"
          className={cn(
            'h-auto max-w-full justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0',
            card && 'break-keep',
          )}
          onClick={onOpen}
        >
          {title}
        </Button>
        {card && parts.length > 0 && <CardMeta parts={parts} />}
        {!card && parts.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
            {parts.map((part, index) => [
              index > 0 && (
                <span key={`dot-${index}`} aria-hidden>
                  ·
                </span>
              ),
              <span key={index} className="wrap-anywhere">
                {part}
              </span>,
            ])}
          </div>
        )}
      </div>
      {side && <div className="flex shrink-0 items-center gap-2 text-xs">{side}</div>}
    </li>
  )
}
