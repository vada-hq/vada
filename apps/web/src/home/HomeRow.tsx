import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  // 제목 아래 한 줄. 없는 것(false·null)은 빼고 가운뎃점으로 잇는다.
  meta?: ReactNode[]
  // 새 홈 카드 줄의 메타 아래 한 줄(후속 정리 중인 행사의 남은 정리)
  sub?: ReactNode
  // 오른쪽 끝: 마감, 요청 상태, 막힌 수
  side?: ReactNode
  // 왼쪽 끝: 아이콘 칸 같은 줄 머리
  lead?: ReactNode
  // 제목 앞 칩: 행사 상태(와이어프레임 행사 줄·DEC-95 '상태 칩, 행사명, 날짜')
  chip?: ReactNode
  onOpen: () => void
  // 새 홈 카드(HomeCard)의 줄: 머리 바와 같은 안쪽 여백, 제목은 어절로 접고 메타는 한 줄 말줄임(와이어프레임 줄,
  // 1024px 3열에서 낱자로 끊기지 않게). 전체 글은 누르면 여는 원래 기록에 있다.
  card?: boolean
}

// 카드 줄의 메타: 한 줄에 가운뎃점으로 잇고 넘치면 말줄임이다. 그 아래 한 줄(sub)도 말줄임이다.
function CardMeta({ parts, sub }: { parts: ReactNode[]; sub: ReactNode }) {
  return (
    <>
      {parts.length > 0 && (
        <p className="truncate text-xs text-gray-500">
          {parts.map((part, index) => (
            <span key={index}>
              {index > 0 && <span aria-hidden> · </span>}
              {part}
            </span>
          ))}
        </p>
      )}
      {sub && <p className="truncate text-xs text-gray-700">{sub}</p>}
    </>
  )
}

// 줄 제목(누르면 연다). 칩이 있으면 제목 앞에 두고, 긴 제목이 접혀도 칩은 첫 줄에 붙는다.
function RowTitle({
  title,
  chip,
  card,
  onOpen,
}: Pick<Props, 'title' | 'chip' | 'onOpen'> & { card: boolean }) {
  const heading = (
    <Button
      variant="link"
      className={cn(
        'h-auto max-w-full justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere after:absolute after:inset-0',
        card && 'break-keep',
        // Button은 shrink-0이라 칩 옆에서는 줄어들게 해야 긴 제목이 칸 안에서 접힌다.
        chip !== undefined && 'min-w-0 shrink',
      )}
      onClick={onOpen}
    >
      {title}
    </Button>
  )
  if (chip === undefined) return heading
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0">{chip}</span>
      {heading}
    </div>
  )
}

// 홈의 한 줄. 줄 어디를 눌러도 원래 화면이 열린다(홈은 읽기만 한다, DEC-69).
export default function HomeRow({
  title,
  meta = [],
  sub,
  side,
  lead,
  chip,
  onOpen,
  card = false,
}: Props) {
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
        <RowTitle title={title} chip={chip} card={card} onOpen={onOpen} />
        {card && <CardMeta parts={parts} sub={sub} />}
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
