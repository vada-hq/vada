import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const BOX =
  'flex min-h-11 w-full flex-wrap items-center justify-center gap-x-3 gap-y-0 px-3 py-2 text-row-sub'

// 쟁반 아래 가운데 '전체 n건 보기'. 숨은 건이 있으면 앞에 그 종류를 센 글('외 1건 · 결재 대기 1')을 붙인다.
// onClick이 없으면 같은 모양의 글로 둔다(누를 곳이 없을 때).
export default function SeeAllButton({
  total,
  hidden,
  onClick,
}: {
  total: number
  hidden: string | null
  onClick?: (() => void) | undefined
}) {
  const body = (
    <>
      {hidden && <span className="font-normal text-fg-tertiary">{hidden}</span>}
      <span className="inline-flex items-center gap-0.5 font-medium text-fg-secondary group-hover/all:text-fg">
        {`전체 ${total}건 보기`}
        <ChevronRight aria-hidden className="size-4.5" />
      </span>
    </>
  )
  if (!onClick) return <p className={BOX}>{body}</p>
  return (
    <Button
      variant="ghost"
      className={cn(
        BOX,
        'group/all h-auto rounded-2xl border-0 whitespace-normal hover:bg-transparent [&_svg]:size-4.5',
      )}
      onClick={onClick}
    >
      {body}
    </Button>
  )
}
